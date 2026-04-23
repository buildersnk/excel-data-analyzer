import { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import initSqlJs, { type Database, type QueryExecResult, type SqlJsStatic } from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  useEdgesState,
  useNodesState,
} from 'reactflow'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ChangeEvent } from 'react'
import type { Connection, Node, NodeProps } from 'reactflow'
import 'reactflow/dist/style.css'
import './App.css'

type TabId = 'import' | 'model' | 'sql'

type ImportedTable = {
  id: string
  fileName: string
  sheetName: string
  displayName: string
  columns: string[]
  rows: Array<Record<string, unknown>>
}

type EntityNodeData = {
  entityName: string
  sourceTableId: string
  selectedColumns: string[]
}

type RelationshipEdgeData = {
  relationType: string
}

type ModeledColumn = {
  sourceName: string
  sqlName: string
  sqlType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE'
}

type ModeledTable = {
  nodeId: string
  displayName: string
  sqlName: string
  columns: ModeledColumn[]
  rows: Array<Record<string, unknown>>
}

type QueryOutput = {
  summary: string
  columns: string[]
  rows: Array<Record<string, unknown>>
}

type ChartType = 'bar' | 'line'
type ChartAggregation = 'none' | 'count' | 'sum' | 'avg'

type QueryHistoryItem = {
  id: string
  sql: string
  summary: string
  executedAt: string
}

type ChartPreset = {
  id: string
  name: string
  chartType: ChartType
  xColumn: string
  yColumn: string
  aggregation: ChartAggregation
}

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'import', label: '1. Import Excel' },
  { id: 'model', label: '2. Model Canvas' },
  { id: 'sql', label: '3. SQL Lab' },
]

const nodeTypes = {
  entityNode: EntityNode,
}

const QUERY_HISTORY_KEY = 'excel_studio_query_history'
const CHART_PRESETS_KEY = 'excel_studio_chart_presets'

function toNumericValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'bigint') {
    const converted = Number(value)
    return Number.isFinite(converted) ? converted : null
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const converted = Number(value)
    return Number.isFinite(converted) ? converted : null
  }
  return null
}

function EntityNode({ data }: NodeProps<EntityNodeData>) {
  return (
    <div className="entityNode">
      <Handle type="target" position={Position.Left} className="entityHandle entityHandleIn" />
      <div className="entityNodeTitle">{data.entityName}</div>
      <div className="entityNodeMeta">{data.selectedColumns.length} mapped columns</div>
      <div className="entityNodeColumns">
        {data.selectedColumns.slice(0, 4).map((column) => (
          <span className="entityNodeChip" key={column}>
            {column}
          </span>
        ))}
        {data.selectedColumns.length > 4 ? (
          <span className="entityNodeChip">+{data.selectedColumns.length - 4} more</span>
        ) : null}
      </div>
      <div className="handleLabel handleLabelIn">Join In</div>
      <div className="handleLabel handleLabelOut">Join Out</div>
      <Handle type="source" position={Position.Right} className="entityHandle entityHandleOut" />
    </div>
  )
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeHeader(value: unknown, index: number): string {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : `column_${index + 1}`
}

function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>()

  return headers.map((header) => {
    const cleaned = header.trim() || 'column'
    const count = seen.get(cleaned) ?? 0
    seen.set(cleaned, count + 1)

    return count === 0 ? cleaned : `${cleaned}_${count + 1}`
  })
}

function collectColumns(rows: Array<Record<string, unknown>>): string[] {
  const columns = new Set<string>()

  rows.forEach((row) => {
    Object.keys(row).forEach((column) => {
      columns.add(column)
    })
  })

  return [...columns]
}

async function parseExcelFile(file: File): Promise<ImportedTable[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
  })

  return workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      return []
    }

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
    })

    const firstRow = Array.isArray(matrix[0]) ? matrix[0] : []
    const headers = dedupeHeaders(firstRow.map((value, index) => normalizeHeader(value, index)))

    let rows: Array<Record<string, unknown>>
    if (headers.length > 0) {
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        header: headers,
        range: 1,
        defval: null,
      })
    } else {
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
      })
    }

    const columns = headers.length > 0 ? headers : collectColumns(rows)
    if (columns.length === 0) {
      return []
    }

    const normalizedRows = rows.map((row) => {
      const projected: Record<string, unknown> = {}
      columns.forEach((column) => {
        projected[column] = row[column] ?? null
      })
      return projected
    })

    return [
      {
        id: createId(),
        fileName: file.name,
        sheetName,
        displayName: `${file.name} / ${sheetName}`,
        columns,
        rows: normalizedRows,
      },
    ]
  })
}

function toSqlIdentifier(text: string): string {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^([0-9])/, '_$1')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized.length > 0 ? normalized : 'field'
}

function ensureUnique(baseName: string, used: Set<string>): string {
  let candidate = baseName
  let counter = 2

  while (used.has(candidate)) {
    candidate = `${baseName}_${counter}`
    counter += 1
  }

  used.add(candidate)
  return candidate
}

function inferSqlType(values: unknown[]): ModeledColumn['sqlType'] {
  const firstValue = values.find((value) => value !== null && value !== undefined)

  if (firstValue instanceof Date) {
    return 'DATE'
  }
  if (typeof firstValue === 'number') {
    return 'NUMBER'
  }
  if (typeof firstValue === 'boolean') {
    return 'BOOLEAN'
  }

  return 'STRING'
}

function buildModeledTables(
  nodes: Node<EntityNodeData>[],
  importedTables: ImportedTable[],
): ModeledTable[] {
  const importedById = new Map(importedTables.map((table) => [table.id, table]))
  const usedTableNames = new Set<string>()

  return nodes.flatMap((node) => {
    const source = importedById.get(node.data.sourceTableId)
    if (!source) {
      return []
    }

    const selectedColumns = node.data.selectedColumns.filter((column) => source.columns.includes(column))
    if (selectedColumns.length === 0) {
      return []
    }

    const sqlTableName = ensureUnique(toSqlIdentifier(node.data.entityName), usedTableNames)
    const usedColumnNames = new Set<string>()

    const columns = selectedColumns.map((sourceName) => {
      const sqlName = ensureUnique(toSqlIdentifier(sourceName), usedColumnNames)
      const values = source.rows.map((row) => row[sourceName])

      return {
        sourceName,
        sqlName,
        sqlType: inferSqlType(values),
      }
    })

    const rows = source.rows.map((sourceRow) => {
      const projectedRow: Record<string, unknown> = {}
      columns.forEach((column) => {
        const value = sourceRow[column.sourceName]
        projectedRow[column.sqlName] = value instanceof Date ? value.toISOString() : value
      })
      return projectedRow
    })

    return [
      {
        nodeId: node.id,
        displayName: node.data.entityName,
        sqlName: sqlTableName,
        columns,
        rows,
      },
    ]
  })
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function toSqliteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

function toSqliteType(sqlType: ModeledColumn['sqlType']): string {
  if (sqlType === 'NUMBER') {
    return 'REAL'
  }
  if (sqlType === 'BOOLEAN') {
    return 'INTEGER'
  }
  return 'TEXT'
}

function toSqliteLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL'
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE'
  }
  if (value instanceof Date) {
    return `'${value.toISOString().replace(/'/g, "''")}'`
  }

  return `'${String(value).replace(/'/g, "''")}'`
}

function convertSquareBracketIdentifiers(sql: string): string {
  return sql.replace(/\[([^\]]+)\]/g, (_match, identifier: string) => {
    return toSqliteIdentifier(identifier)
  })
}

function normalizeSqlJsResult(rawResult: QueryExecResult[]): QueryOutput {
  if (rawResult.length === 0) {
    return {
      summary: 'Statement executed.',
      columns: [],
      rows: [],
    }
  }

  const first = rawResult[0]
  const rows = first.values.map((valueRow) => {
    const row: Record<string, unknown> = {}
    first.columns.forEach((column, index) => {
      row[column] = valueRow[index]
    })
    return row
  })

  return {
    summary: `Query returned ${rows.length} row${rows.length === 1 ? '' : 's'}.`,
    columns: first.columns,
    rows,
  }
}

function App() {
  const docsUrl = import.meta.env.VITE_DOCS_URL ?? 'http://localhost:3000/docs/intro'
  const [activeTab, setActiveTab] = useState<TabId>('import')
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false)
  const [importedTables, setImportedTables] = useState<ImportedTable[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)

  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<RelationshipEdgeData>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const [queryText, setQueryText] = useState('SELECT 1 AS ready;')
  const [queryError, setQueryError] = useState<string | null>(null)
  const [queryOutput, setQueryOutput] = useState<QueryOutput | null>(null)
  const [selectedSqlTable, setSelectedSqlTable] = useState<string | null>(null)
  const [sqlite, setSqlite] = useState<SqlJsStatic | null>(null)
  const [sqliteStatus, setSqliteStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [sqliteError, setSqliteError] = useState<string | null>(null)
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [chartXColumn, setChartXColumn] = useState<string>('')
  const [chartYColumn, setChartYColumn] = useState<string>('')
  const [chartAggregation, setChartAggregation] = useState<ChartAggregation>('none')
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>(() => {
    if (typeof window === 'undefined') {
      return []
    }

    try {
      const stored = window.localStorage.getItem(QUERY_HISTORY_KEY)
      if (!stored) {
        return []
      }

      const parsed = JSON.parse(stored) as QueryHistoryItem[]
      return Array.isArray(parsed) ? parsed.slice(0, 20) : []
    } catch {
      return []
    }
  })
  const [chartPresets, setChartPresets] = useState<ChartPreset[]>(() => {
    if (typeof window === 'undefined') {
      return []
    }

    try {
      const stored = window.localStorage.getItem(CHART_PRESETS_KEY)
      if (!stored) {
        return []
      }

      const parsed = JSON.parse(stored) as ChartPreset[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  const modeledTables = useMemo(() => buildModeledTables(nodes, importedTables), [nodes, importedTables])

  const modelSqlPreview = useMemo(() => {
    if (modeledTables.length === 0) {
      return '-- Build entities on the canvas to generate SQL model preview.'
    }

    const ddl = modeledTables
      .map((table) => {
        const columns = table.columns
          .map((column) => `  [${column.sqlName}] ${column.sqlType}`)
          .join(',\n')
        return `CREATE TABLE [${table.sqlName}] (\n${columns}\n);`
      })
      .join('\n\n')

    const nodeToTable = new Map(modeledTables.map((table) => [table.nodeId, table]))
    const relationshipLines = edges
      .flatMap((edge) => {
        const source = nodeToTable.get(edge.source)
        const target = nodeToTable.get(edge.target)

        if (!source || !target) {
          return []
        }

        const relationType = edge.data?.relationType ?? 'related_to'
        return [`-- relationship: [${source.sqlName}] ${relationType} [${target.sqlName}]`]
      })
      .join('\n')

    return relationshipLines.length > 0 ? `${ddl}\n\n${relationshipLines}` : ddl
  }, [edges, modeledTables])

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  const selectedSource = useMemo(() => {
    if (!selectedNode) {
      return null
    }

    return importedTables.find((table) => table.id === selectedNode.data.sourceTableId) ?? null
  }, [importedTables, selectedNode])

  const sqlExplorerTable = useMemo(() => {
    if (modeledTables.length === 0) {
      return null
    }

    if (!selectedSqlTable) {
      return modeledTables[0]
    }

    return modeledTables.find((table) => table.sqlName === selectedSqlTable) ?? modeledTables[0]
  }, [modeledTables, selectedSqlTable])

  const sqlTemplates = useMemo(() => {
    if (modeledTables.length === 0) {
      return []
    }

    const primary = modeledTables[0].sqlName
    const secondary = modeledTables[1]?.sqlName

    const templates = [
      {
        label: 'Preview Rows',
        sql: `SELECT *\nFROM [${primary}]\nLIMIT 50;`,
      },
      {
        label: 'Row Count',
        sql: `SELECT COUNT(*) AS total_rows\nFROM [${primary}];`,
      },
      {
        label: 'Distinct Values',
        sql: `SELECT [${modeledTables[0].columns[0]?.sqlName ?? 'id'}], COUNT(*) AS cnt\nFROM [${primary}]\nGROUP BY [${modeledTables[0].columns[0]?.sqlName ?? 'id'}]\nORDER BY cnt DESC\nLIMIT 20;`,
      },
    ]

    if (secondary) {
      templates.push({
        label: 'Join Starter',
        sql: `SELECT a.*, b.*\nFROM [${primary}] a\nJOIN [${secondary}] b ON a.id = b.id\nLIMIT 50;`,
      })
    }

    return templates
  }, [modeledTables])

  const chartAvailableColumns = useMemo(() => {
    if (!queryOutput || queryOutput.rows.length === 0) {
      return { all: [] as string[], numeric: [] as string[] }
    }

    const all = queryOutput.columns
    const numeric = queryOutput.columns.filter((column) =>
      queryOutput.rows.some((row) => toNumericValue(row[column]) !== null),
    )

    return { all, numeric }
  }, [queryOutput])

  const chartYOptions = useMemo(
    () =>
      chartAggregation === 'count' ? chartAvailableColumns.all : chartAvailableColumns.numeric,
    [chartAggregation, chartAvailableColumns],
  )

  const effectiveChartXColumn = useMemo(() => {
    if (chartXColumn && chartAvailableColumns.all.includes(chartXColumn)) {
      return chartXColumn
    }
    return chartAvailableColumns.all[0] ?? ''
  }, [chartAvailableColumns.all, chartXColumn])

  const effectiveChartYColumn = useMemo(() => {
    if (chartYColumn && chartYOptions.includes(chartYColumn)) {
      return chartYColumn
    }
    return chartYOptions[0] ?? ''
  }, [chartYColumn, chartYOptions])

  const chartView = useMemo(() => {
    if (!queryOutput || queryOutput.rows.length === 0) {
      return null
    }

    const xColumn = effectiveChartXColumn
    const yColumn = effectiveChartYColumn

    if (!xColumn || (chartAggregation !== 'count' && !yColumn)) {
      return null
    }

    const sourceRows = queryOutput.rows.slice(0, 400)

    if (chartAggregation === 'none') {
      const data = sourceRows
        .slice(0, 100)
        .map((row, index) => ({
          label: String(row[xColumn] ?? `Row ${index + 1}`),
          [yColumn]: toNumericValue(row[yColumn]) ?? 0,
        }))

      return { data, valueColumns: [yColumn] }
    }

    const grouped = new Map<string, { count: number; sum: number }>()
    sourceRows.forEach((row) => {
      const key = String(row[xColumn] ?? 'Unknown')
      const current = grouped.get(key) ?? { count: 0, sum: 0 }
      current.count += 1

      const numericValue = yColumn ? toNumericValue(row[yColumn]) : null
      if (numericValue !== null) {
        current.sum += numericValue
      }

      grouped.set(key, current)
    })

    const entries = [...grouped.entries()].slice(0, 80)
    const valueKey = chartAggregation === 'count' ? 'count' : (yColumn ?? 'value')

    const data = entries.map(([label, bucket]) => {
      if (chartAggregation === 'count') {
        return { label, [valueKey]: bucket.count }
      }
      if (chartAggregation === 'avg') {
        return { label, [valueKey]: bucket.count > 0 ? bucket.sum / bucket.count : 0 }
      }
      return { label, [valueKey]: bucket.sum }
    })

    return { data, valueColumns: [valueKey] }
  }, [chartAggregation, effectiveChartXColumn, effectiveChartYColumn, queryOutput])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(queryHistory.slice(0, 20)))
  }, [queryHistory])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(CHART_PRESETS_KEY, JSON.stringify(chartPresets))
  }, [chartPresets])

  const retrySqliteInitialization = useCallback(() => {
    setSqlite(null)
    setSqliteError(null)
    setSqliteStatus('idle')
  }, [])

  useEffect(() => {
    if (activeTab !== 'sql' || sqlite || sqliteStatus === 'loading' || sqliteStatus === 'error') {
      return
    }

    const initSqlite = async () => {
      try {
        setSqliteStatus('loading')
        setSqliteError(null)

        const SQL = await initSqlJs({
          locateFile: () => sqlWasmUrl,
        })

        setSqlite(SQL)
        setSqliteStatus('ready')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'SQLite initialization failed.'
        setSqliteError(message)
        setSqliteStatus('error')
      }
    }

    void initSqlite()
  }, [activeTab, sqlite, sqliteStatus])

  const handleFilesSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) {
      return
    }

    setIsParsing(true)
    setUploadError(null)

    try {
      const parsed = await Promise.all(Array.from(files).map((file) => parseExcelFile(file)))
      const flattened = parsed.flat()

      if (flattened.length === 0) {
        setUploadError('No readable sheets were found in the selected files.')
      } else {
        setImportedTables((current) => [...current, ...flattened])
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parsing error'
      setUploadError(`Import failed: ${message}`)
    } finally {
      setIsParsing(false)
      event.target.value = ''
    }
  }, [])

  const addEntityFromSource = useCallback(
    (sourceTableId: string) => {
      const source = importedTables.find((table) => table.id === sourceTableId)
      if (!source) {
        return
      }

      const newNode: Node<EntityNodeData> = {
        id: createId(),
        type: 'entityNode',
        position: {
          x: 60 + (nodes.length % 3) * 280,
          y: 60 + Math.floor(nodes.length / 3) * 200,
        },
        data: {
          entityName: source.sheetName,
          sourceTableId: source.id,
          selectedColumns: [...source.columns],
        },
      }

      setNodes((current) => [...current, newNode])
      setSelectedNodeId(newNode.id)
      setActiveTab('model')
      setQueryOutput(null)
      setQueryError(null)
    },
    [importedTables, nodes.length, setNodes],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: createId(),
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#8e9cb2' },
            data: { relationType: 'related_to' },
            label: 'related_to',
            style: { stroke: '#8e9cb2', strokeWidth: 2.5 },
          },
          current,
        ),
      )
    },
    [setEdges],
  )

  const updateSelectedNode = useCallback(
    (updater: (currentData: EntityNodeData) => EntityNodeData) => {
      if (!selectedNodeId) {
        return
      }

      setNodes((current) =>
        current.map((node) => {
          if (node.id !== selectedNodeId) {
            return node
          }

          return {
            ...node,
            data: updater(node.data),
          }
        }),
      )
    },
    [selectedNodeId, setNodes],
  )

  const removeSelectedNode = useCallback(() => {
    if (!selectedNodeId) {
      return
    }

    setNodes((current) => current.filter((node) => node.id !== selectedNodeId))
    setEdges((current) =>
      current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
    )
    setSelectedNodeId(null)
  }, [selectedNodeId, setEdges, setNodes])

  const runQuery = useCallback(async () => {
    setQueryError(null)

    if (modeledTables.length === 0) {
      setQueryError('Create at least one modeled entity before running SQL queries.')
      setQueryOutput(null)
      return
    }

    if (queryText.trim().length === 0) {
      setQueryError('Write a SQL query before running.')
      setQueryOutput(null)
      return
    }

    if (!sqlite || sqliteStatus !== 'ready') {
      setQueryError(
        sqliteError ?? 'SQLite is initializing. Wait a moment, then run the query again.',
      )
      setQueryOutput(null)
      return
    }

    try {
      const db: Database = new sqlite.Database()

      for (const table of modeledTables) {
        const tableName = toSqliteIdentifier(table.sqlName)
        const columnsSql = table.columns
          .map((column) => `${toSqliteIdentifier(column.sqlName)} ${toSqliteType(column.sqlType)}`)
          .join(', ')

        db.run(`DROP TABLE IF EXISTS ${tableName}`)
        db.run(`CREATE TABLE ${tableName} (${columnsSql})`)

        for (const row of table.rows) {
          const rowSql = table.columns
            .map((column) => toSqliteLiteral(row[column.sqlName]))
            .join(', ')
          db.run(`INSERT INTO ${tableName} VALUES (${rowSql})`)
        }
      }

      const normalizedSql = convertSquareBracketIdentifiers(queryText)
      const rawResult = db.exec(normalizedSql)
      const normalizedOutput = normalizeSqlJsResult(rawResult)
      setQueryOutput(normalizedOutput)
      setQueryHistory((current) => [
        {
          id: createId(),
          sql: queryText.trim(),
          summary: normalizedOutput.summary,
          executedAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 20))
      db.close()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SQL execution error'
      setQueryError(message)
      setQueryOutput(null)
    }
  }, [modeledTables, queryText, sqlite, sqliteError, sqliteStatus])

  const insertQuerySnippet = useCallback((snippet: string) => {
    setQueryText((current) => {
      if (current.trim().length === 0) {
        return snippet
      }
      return `${current.trimEnd()}\n${snippet}`
    })
  }, [])

  const formatSqlText = useCallback(() => {
    const keywords = [
      'select',
      'from',
      'where',
      'join',
      'left',
      'right',
      'inner',
      'outer',
      'on',
      'group by',
      'order by',
      'limit',
      'as',
      'and',
      'or',
      'count',
      'sum',
      'avg',
      'min',
      'max',
    ]

    setQueryText((current) => {
      let formatted = current
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim()

      keywords.forEach((keyword) => {
        const pattern = new RegExp(`\\b${keyword}\\b`, 'gi')
        formatted = formatted.replace(pattern, keyword.toUpperCase())
      })

      return formatted
    })
  }, [])

  const applyChartPreset = useCallback((preset: ChartPreset) => {
    setChartType(preset.chartType)
    setChartXColumn(preset.xColumn)
    setChartYColumn(preset.yColumn)
    setChartAggregation(preset.aggregation)
  }, [])

  const saveChartPreset = useCallback(() => {
    if (!effectiveChartXColumn || !effectiveChartYColumn) {
      return
    }

    const name = window.prompt('Preset name')
    if (!name || name.trim().length === 0) {
      return
    }

    const newPreset: ChartPreset = {
      id: createId(),
      name: name.trim(),
      chartType,
      xColumn: effectiveChartXColumn,
      yColumn: effectiveChartYColumn,
      aggregation: chartAggregation,
    }

    setChartPresets((current) => [newPreset, ...current].slice(0, 20))
  }, [chartAggregation, chartType, effectiveChartXColumn, effectiveChartYColumn])

  const removeChartPreset = useCallback((presetId: string) => {
    setChartPresets((current) => current.filter((preset) => preset.id !== presetId))
  }, [])

  return (
    <div className="appShell">
      <header className="appHeader">
        <div className="headerTopRow">
          <p className="kicker">Excel Data Model Studio</p>
          <div className="headerMenuWrap">
            <button
              type="button"
              className="hamburgerButton"
              aria-label="Open help menu"
              aria-expanded={isHeaderMenuOpen}
              onClick={() => setIsHeaderMenuOpen((current) => !current)}
            >
              <span />
              <span />
              <span />
            </button>
            {isHeaderMenuOpen ? (
              <div className="hamburgerMenuPanel">
                <div className="menuSectionLabel">Help</div>
                <a
                  className="menuLink"
                  href={docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setIsHeaderMenuOpen(false)}
                >
                  Open Docs
                </a>
              </div>
            ) : null}
          </div>
        </div>
        <h1>Upload spreadsheets, model entities, and query them with SQL.</h1>
        <p>
          Multi-file import feeds a canvas-driven data model. The generated model becomes queryable in
          SQL Lab.
        </p>
      </header>

      <nav className="tabRow" aria-label="Main workflow tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === activeTab ? 'tabButton active' : 'tabButton'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="tabPanel">
        {activeTab === 'import' ? (
          <section className="importTab">
            <label className="uploadCard" htmlFor="excel-upload">
              <div>
                <h2>Import Excel Files</h2>
                <p>Choose one or more `.xlsx`/`.xls` files. Every sheet is loaded as a source table.</p>
              </div>
              <input
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={handleFilesSelected}
              />
            </label>

            {isParsing ? <p className="statusNote">Parsing files...</p> : null}
            {uploadError ? <p className="errorNote">{uploadError}</p> : null}

            <div className="sourceGrid">
              {importedTables.map((table) => (
                <article className="sourceCard" key={table.id}>
                  <div className="sourceCardHeader">
                    <div>
                      <h3>{table.sheetName}</h3>
                      <p>{table.fileName}</p>
                    </div>
                    <button type="button" onClick={() => addEntityFromSource(table.id)}>
                      Add To Canvas
                    </button>
                  </div>
                  <p className="sourceMeta">
                    {table.rows.length} rows | {table.columns.length} columns
                  </p>
                  <div className="chipWrap">
                    {table.columns.map((column) => (
                      <span className="chip" key={`${table.id}-${column}`}>
                        {column}
                      </span>
                    ))}
                  </div>
                </article>
              ))}

              {importedTables.length === 0 ? (
                <p className="emptyState">
                  No sources loaded yet. Upload files to inspect available columns before modeling.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === 'model' ? (
          <section className="modelTab">
            {importedTables.length === 0 ? (
              <p className="emptyState">
                Import Excel files first. Then create entities from source sheets and connect them in the
                canvas.
              </p>
            ) : (
              <div className="modelLayout">
                <aside className="leftPane card">
                  <h2>Sources</h2>
                  <p>Each source can become one or more entities in the canvas.</p>
                  <div className="sourcePickerList">
                    {importedTables.map((table) => (
                      <button key={table.id} type="button" onClick={() => addEntityFromSource(table.id)}>
                        + {table.displayName}
                      </button>
                    ))}
                  </div>
                </aside>

                <div className="canvasPane card">
                  <div className="canvasHint">
                    <p>Drag nodes and connect Join Out to Join In to create table joins.</p>
                    <div className="connectorLegend">
                      <span className="connectorBadge connectorOut">Join Out</span>
                      <span className="connectorBadge connectorIn">Join In</span>
                    </div>
                  </div>
                  <div className="canvasSurface">
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onConnect={onConnect}
                      onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
                      onPaneClick={() => setSelectedNodeId(null)}
                      fitView
                      nodeTypes={nodeTypes}
                      defaultEdgeOptions={{
                        type: 'smoothstep',
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#8e9cb2' },
                        animated: true,
                        style: { stroke: '#8e9cb2', strokeWidth: 2.5 },
                      }}
                      connectionLineStyle={{ strokeWidth: 2.5 }}
                    >
                      <MiniMap zoomable pannable />
                      <Controls />
                      <Background gap={20} size={1} />
                    </ReactFlow>
                  </div>
                </div>

                <aside className="rightPane card">
                  <h2>Inspector</h2>
                  {selectedNode && selectedSource ? (
                    <>
                      <label className="fieldLabel" htmlFor="entity-name-input">
                        Entity Name
                      </label>
                      <input
                        id="entity-name-input"
                        className="textInput"
                        type="text"
                        value={selectedNode.data.entityName}
                        onChange={(event) =>
                          updateSelectedNode((current) => ({
                            ...current,
                            entityName: event.target.value,
                          }))
                        }
                      />

                      <label className="fieldLabel" htmlFor="source-select-input">
                        Source Table
                      </label>
                      <select
                        id="source-select-input"
                        className="selectInput"
                        value={selectedNode.data.sourceTableId}
                        onChange={(event) => {
                          const nextSource = importedTables.find(
                            (table) => table.id === event.target.value,
                          )

                          if (!nextSource) {
                            return
                          }

                          updateSelectedNode((current) => ({
                            ...current,
                            sourceTableId: nextSource.id,
                            selectedColumns: [...nextSource.columns],
                          }))
                        }}
                      >
                        {importedTables.map((table) => (
                          <option key={table.id} value={table.id}>
                            {table.displayName}
                          </option>
                        ))}
                      </select>

                      <label className="fieldLabel">Columns</label>
                      <div className="columnChecklist">
                        {selectedSource.columns.map((column) => {
                          const checked = selectedNode.data.selectedColumns.includes(column)

                          return (
                            <label className="checkboxRow" key={column}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  updateSelectedNode((current) => {
                                    const alreadySelected = current.selectedColumns.includes(column)

                                    if (alreadySelected) {
                                      return {
                                        ...current,
                                        selectedColumns: current.selectedColumns.filter(
                                          (value) => value !== column,
                                        ),
                                      }
                                    }

                                    return {
                                      ...current,
                                      selectedColumns: [...current.selectedColumns, column],
                                    }
                                  })
                                }
                              />
                              <span>{column}</span>
                            </label>
                          )
                        })}
                      </div>

                      <button className="dangerButton" type="button" onClick={removeSelectedNode}>
                        Remove Entity
                      </button>
                    </>
                  ) : (
                    <p className="emptyStateInline">Select an entity node to edit its model mapping.</p>
                  )}

                  <label className="fieldLabel">Generated SQL Model</label>
                  <pre className="sqlPreview">{modelSqlPreview}</pre>
                </aside>
              </div>
            )}
          </section>
        ) : null}

        {activeTab === 'sql' ? (
          <section className="sqlTab">
            <div className="sqlWorkbench">
              <aside className="sqlSidebar card">
                <div className="sqlSidebarSection">
                  <h2>Schema</h2>
                  <p>Browse modeled tables and click to insert references.</p>
                </div>

                {modeledTables.length === 0 ? (
                  <p className="emptyStateInline">No modeled entities available yet.</p>
                ) : (
                  <>
                    <div className="sqlTableList">
                      {modeledTables.map((table) => (
                        <button
                          key={table.sqlName}
                          type="button"
                          className={
                            table.sqlName === sqlExplorerTable?.sqlName
                              ? 'sqlTableButton active'
                              : 'sqlTableButton'
                          }
                          onClick={() => setSelectedSqlTable(table.sqlName)}
                        >
                          [{table.sqlName}]
                        </button>
                      ))}
                    </div>

                    {sqlExplorerTable ? (
                      <div className="sqlColumnExplorer">
                        <div className="sqlExplorerTitle">
                          Columns in <strong>[{sqlExplorerTable.sqlName}]</strong>
                        </div>
                        <div className="sqlColumnList">
                          {sqlExplorerTable.columns.map((column) => (
                            <button
                              key={column.sqlName}
                              type="button"
                              className="sqlColumnButton"
                              onClick={() => insertQuerySnippet(`[${column.sqlName}]`)}
                            >
                              [{column.sqlName}] <span>{column.sqlType}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}

                <div className="sqlSidebarSection historySection">
                  <div className="historyHeader">
                    <h2>History</h2>
                    <button type="button" onClick={() => setQueryHistory([])}>
                      Clear
                    </button>
                  </div>
                  {queryHistory.length === 0 ? (
                    <p className="emptyStateInline">No queries run yet.</p>
                  ) : (
                    <div className="historyList">
                      {queryHistory.map((item) => (
                        <button
                          type="button"
                          className="historyItem"
                          key={item.id}
                          onClick={() => setQueryText(item.sql)}
                          title={item.sql}
                        >
                          <span>{item.sql.replace(/\s+/g, ' ').slice(0, 74)}</span>
                          <small>{new Date(item.executedAt).toLocaleString()}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </aside>

              <div className="sqlMain">
                <div className="card sqlEditorCard">
                  <div className="sqlEditorHeader">
                    <div>
                      <h2>SQL Editor</h2>
                      <p>Superset-style workbench for writing and iterating queries.</p>
                      <p className="sqlEngineStatus">
                        SQL Engine:{' '}
                        <strong>
                          {sqliteStatus === 'ready'
                            ? 'SQLite Ready'
                            : sqliteStatus === 'loading'
                              ? 'SQLite Initializing...'
                              : sqliteStatus === 'idle'
                                ? 'SQLite Idle'
                              : 'SQLite Error'}
                        </strong>
                      </p>
                    </div>
                    <div className="sqlActions">
                      <button type="button" onClick={runQuery}>
                        Run
                      </button>
                      <button type="button" onClick={formatSqlText}>
                        Format
                      </button>
                      {sqliteStatus === 'error' ? (
                        <button type="button" onClick={retrySqliteInitialization}>
                          Retry SQLite
                        </button>
                      ) : null}
                      {modeledTables.length > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setQueryText(`SELECT *\nFROM [${modeledTables[0].sqlName}]\nLIMIT 50;`)
                          }
                        >
                          Quick Start
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="sqlTemplateRow">
                    {sqlTemplates.map((template) => (
                      <button
                        type="button"
                        className="sqlTemplateButton"
                        key={template.label}
                        onClick={() => setQueryText(template.sql)}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    className="queryInput sqlWorkbenchEditor"
                    value={queryText}
                    onChange={(event) => setQueryText(event.target.value)}
                    spellCheck={false}
                  />
                </div>

                <div className="card resultPanel">
                  <div className="resultHeader">
                    <h2>Results</h2>
                    {queryOutput ? <p className="statusNote">{queryOutput.summary}</p> : null}
                  </div>
                  {queryError ? <p className="errorNote">{queryError}</p> : null}

                  {queryOutput && queryOutput.rows.length > 0 ? (
                    <div className="resultTableWrap">
                      <table className="resultTable">
                        <thead>
                          <tr>
                            {queryOutput.columns.map((column) => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryOutput.rows.map((row, rowIndex) => (
                            <tr key={`row-${rowIndex}`}>
                              {queryOutput.columns.map((column) => (
                                <td key={`${rowIndex}-${column}`}>{formatCellValue(row[column])}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {chartView ? (
                    <div className="chartPanel">
                      <div className="chartHeader">
                        <h3>Chart Preview</h3>
                        <div className="chartActions">
                          <button
                            type="button"
                            className={chartType === 'bar' ? 'chartToggle active' : 'chartToggle'}
                            onClick={() => setChartType('bar')}
                          >
                            Bar
                          </button>
                          <button
                            type="button"
                            className={chartType === 'line' ? 'chartToggle active' : 'chartToggle'}
                            onClick={() => setChartType('line')}
                          >
                            Line
                          </button>
                        </div>
                      </div>
                      <div className="chartConfigRow">
                        <label>
                          X Axis
                          <select
                            value={effectiveChartXColumn}
                            onChange={(event) => setChartXColumn(event.target.value)}
                          >
                            {chartAvailableColumns.all.length === 0 ? (
                              <option value="">No columns</option>
                            ) : null}
                            {chartAvailableColumns.all.map((column) => (
                              <option key={column} value={column}>
                                {column}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Y Axis
                          <select
                            value={effectiveChartYColumn}
                            onChange={(event) => setChartYColumn(event.target.value)}
                          >
                            {chartYOptions.length === 0 ? <option value="">No numeric columns</option> : null}
                            {chartYOptions.map((column) => (
                              <option key={column} value={column}>
                                {column}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Aggregate
                          <select
                            value={chartAggregation}
                            onChange={(event) =>
                              setChartAggregation(event.target.value as ChartAggregation)
                            }
                          >
                            <option value="none">None</option>
                            <option value="count">Count</option>
                            <option value="sum">Sum</option>
                            <option value="avg">Average</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          className="chartPresetSave"
                          onClick={saveChartPreset}
                          disabled={!effectiveChartXColumn || !effectiveChartYColumn}
                        >
                          Save Preset
                        </button>
                      </div>
                      {chartPresets.length > 0 ? (
                        <div className="chartPresetList">
                          {chartPresets.map((preset) => (
                            <div className="chartPresetItem" key={preset.id}>
                              <button type="button" onClick={() => applyChartPreset(preset)}>
                                {preset.name}
                              </button>
                              <button
                                type="button"
                                className="chartPresetDelete"
                                onClick={() => removeChartPreset(preset.id)}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="chartSurface">
                        <ResponsiveContainer width="100%" height="100%">
                          {chartType === 'bar' ? (
                            <BarChart data={chartView.data}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#d9deea" />
                              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Legend />
                              {chartView.valueColumns.map((column, index) => (
                                <Bar
                                  key={column}
                                  dataKey={column}
                                  fill={index === 0 ? '#9aa9c5' : '#c9a5bf'}
                                />
                              ))}
                            </BarChart>
                          ) : (
                            <LineChart data={chartView.data}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#d9deea" />
                              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Legend />
                              {chartView.valueColumns.map((column, index) => (
                                <Line
                                  key={column}
                                  type="monotone"
                                  dataKey={column}
                                  stroke={index === 0 ? '#7f93b7' : '#b88ba8'}
                                  strokeWidth={2}
                                  dot={false}
                                />
                              ))}
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : null}

                  {queryOutput && queryOutput.rows.length === 0 && !queryError ? (
                    <p className="emptyStateInline">Query executed successfully with no rows returned.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default App

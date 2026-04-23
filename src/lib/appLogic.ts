import * as XLSX from 'xlsx'

export type ImportedTable = {
  id: string
  fileName: string
  sheetName: string
  displayName: string
  columns: string[]
  rows: Array<Record<string, unknown>>
}

export type EntityNodeData = {
  entityName: string
  sourceTableId: string
  selectedColumns: string[]
}

export type ModeledColumn = {
  sourceName: string
  sqlName: string
  sqlType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE'
}

export type ModeledTable = {
  nodeId: string
  displayName: string
  sqlName: string
  columns: ModeledColumn[]
  rows: Array<Record<string, unknown>>
}

export type QueryOutput = {
  summary: string
  columns: string[]
  rows: Array<Record<string, unknown>>
}

export type ChartAggregation = 'none' | 'count' | 'sum' | 'avg'

export type ModelNode = {
  id: string
  data: EntityNodeData
}

export function toNumericValue(value: unknown): number | null {
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

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function normalizeHeader(value: unknown, index: number): string {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : `column_${index + 1}`
}

export function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>()

  return headers.map((header) => {
    const cleaned = header.trim() || 'column'
    const count = seen.get(cleaned) ?? 0
    seen.set(cleaned, count + 1)

    return count === 0 ? cleaned : `${cleaned}_${count + 1}`
  })
}

export function collectColumns(rows: Array<Record<string, unknown>>): string[] {
  const columns = new Set<string>()

  rows.forEach((row) => {
    Object.keys(row).forEach((column) => {
      columns.add(column)
    })
  })

  return [...columns]
}

export async function parseExcelFile(
  file: File,
  idFactory: () => string = createId,
): Promise<ImportedTable[]> {
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
        id: idFactory(),
        fileName: file.name,
        sheetName,
        displayName: `${file.name} / ${sheetName}`,
        columns,
        rows: normalizedRows,
      },
    ]
  })
}

export function toSqlIdentifier(text: string): string {
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

export function ensureUnique(baseName: string, used: Set<string>): string {
  let candidate = baseName
  let counter = 2

  while (used.has(candidate)) {
    candidate = `${baseName}_${counter}`
    counter += 1
  }

  used.add(candidate)
  return candidate
}

export function inferSqlType(values: unknown[]): ModeledColumn['sqlType'] {
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

export function buildModeledTables(nodes: ModelNode[], importedTables: ImportedTable[]): ModeledTable[] {
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

export function formatCellValue(value: unknown): string {
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

export function toSqliteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

export function toSqliteType(sqlType: ModeledColumn['sqlType']): string {
  if (sqlType === 'NUMBER') {
    return 'REAL'
  }
  if (sqlType === 'BOOLEAN') {
    return 'INTEGER'
  }
  return 'TEXT'
}

export function toSqliteLiteral(value: unknown): string {
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

export function convertSquareBracketIdentifiers(sql: string): string {
  return sql.replace(/\[([^\]]+)\]/g, (_match, identifier: string) => {
    return toSqliteIdentifier(identifier)
  })
}

export type SqlJsLikeResult = {
  columns: string[]
  values: unknown[][]
}

export function normalizeSqlJsResult(rawResult: SqlJsLikeResult[]): QueryOutput {
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

export function buildChartView(
  queryOutput: QueryOutput | null,
  chartAggregation: ChartAggregation,
  xColumn: string,
  yColumn: string,
): { data: Array<Record<string, unknown>>; valueColumns: string[] } | null {
  if (!queryOutput || queryOutput.rows.length === 0) {
    return null
  }

  if (!xColumn || (chartAggregation !== 'count' && !yColumn)) {
    return null
  }

  const sourceRows = queryOutput.rows.slice(0, 400)

  if (chartAggregation === 'none') {
    const data = sourceRows.slice(0, 100).map((row, index) => ({
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
}

import * as XLSX from 'xlsx'
import { describe, expect, it, vi } from 'vitest'
import {
  buildChartView,
  buildModeledTables,
  collectColumns,
  convertSquareBracketIdentifiers,
  createId,
  dedupeHeaders,
  ensureUnique,
  formatCellValue,
  inferSqlType,
  normalizeHeader,
  normalizeSqlJsResult,
  parseExcelFile,
  toNumericValue,
  toSqlIdentifier,
  toSqliteIdentifier,
  toSqliteLiteral,
  toSqliteType,
  type ImportedTable,
  type ModelNode,
  type QueryOutput,
} from './appLogic'

describe('appLogic unit', () => {
  it('converts numeric-like values', () => {
    expect(toNumericValue(12)).toBe(12)
    expect(toNumericValue('42')).toBe(42)
    expect(toNumericValue(BigInt(9))).toBe(9)
    expect(toNumericValue('')).toBeNull()
    expect(toNumericValue('abc')).toBeNull()
    expect(toNumericValue(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('normalizes and dedupes headers', () => {
    const headers = [' Name ', '', 'Name', 'department', 'department']
    const normalized = headers.map((value, index) => normalizeHeader(value, index))
    expect(normalized).toEqual(['Name', 'column_2', 'Name', 'department', 'department'])
    expect(dedupeHeaders(normalized)).toEqual(['Name', 'column_2', 'Name_2', 'department', 'department_2'])
  })

  it('collects unique columns from rows', () => {
    expect(collectColumns([{ a: 1 }, { b: 2, c: 3 }, { a: 4, c: 5 }]).sort()).toEqual(['a', 'b', 'c'])
  })

  it('parses excel workbook into imported tables', async () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Employee ID', 'Name', 'Salary'],
      [1, 'Asha', 100],
      [2, 'Ben', 200],
    ])
    XLSX.utils.book_append_sheet(workbook, sheet, 'Employees')
    const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const file = new File([data], 'employees.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const tables = await parseExcelFile(file, () => 'fixed-id')

    expect(tables).toHaveLength(1)
    expect(tables[0].id).toBe('fixed-id')
    expect(tables[0].sheetName).toBe('Employees')
    expect(tables[0].displayName).toBe('employees.xlsx / Employees')
    expect(tables[0].columns).toEqual(['Employee ID', 'Name', 'Salary'])
    expect(tables[0].rows[0]).toEqual({ 'Employee ID': 1, Name: 'Asha', Salary: 100 })
  })

  it('handles parse path for empty sheets', async () => {
    const workbook = XLSX.utils.book_new()
    const emptySheet = XLSX.utils.aoa_to_sheet([])
    XLSX.utils.book_append_sheet(workbook, emptySheet, 'Empty')
    const emptyData = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const emptyFile = new File([emptyData], 'empty.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    await expect(parseExcelFile(emptyFile)).resolves.toEqual([])
  })

  it('creates ids from crypto uuid and fallback strategy', () => {
    const originalCrypto = globalThis.crypto
    const cryptoMock = {
      randomUUID: vi.fn(() => 'uuid-123'),
    } as unknown as Crypto

    Object.defineProperty(globalThis, 'crypto', { value: cryptoMock, configurable: true })
    expect(createId()).toBe('uuid-123')

    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    const fallback = createId()
    expect(fallback).toMatch(/^[0-9]+-[a-f0-9]+$/)

    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true })
  })

  it('creates SQL-safe identifiers and uniqueness', () => {
    expect(toSqlIdentifier(' Department Name ')).toBe('department_name')
    expect(toSqlIdentifier('123Project')).toBe('123project')
    expect(toSqlIdentifier('!@#$')).toBe('field')

    const used = new Set<string>()
    expect(ensureUnique('employee', used)).toBe('employee')
    expect(ensureUnique('employee', used)).toBe('employee_2')
    expect(ensureUnique('employee', used)).toBe('employee_3')
  })

  it('infers SQL data types', () => {
    expect(inferSqlType([null, undefined, 'a'])).toBe('STRING')
    expect(inferSqlType([null, 4])).toBe('NUMBER')
    expect(inferSqlType([null, true])).toBe('BOOLEAN')
    expect(inferSqlType([new Date('2026-01-01')])).toBe('DATE')
  })

  it('builds modeled tables from nodes and sources', () => {
    const importedTables: ImportedTable[] = [
      {
        id: 'src-1',
        fileName: 'employees.xlsx',
        sheetName: 'Employees',
        displayName: 'employees.xlsx / Employees',
        columns: ['Emp ID', 'Name', 'Joined', 'Active'],
        rows: [
          { 'Emp ID': 1, Name: 'Asha', Joined: new Date('2026-01-01'), Active: true },
          { 'Emp ID': 2, Name: 'Ben', Joined: new Date('2026-02-01'), Active: false },
        ],
      },
    ]

    const nodes: ModelNode[] = [
      {
        id: 'n1',
        data: {
          entityName: 'Employee Details',
          sourceTableId: 'src-1',
          selectedColumns: ['Emp ID', 'Name', 'Joined', 'Active'],
        },
      },
    ]

    const modeled = buildModeledTables(nodes, importedTables)

    expect(modeled).toHaveLength(1)
    expect(modeled[0].sqlName).toBe('employee_details')
    expect(modeled[0].columns.map((column) => column.sqlName)).toEqual(['emp_id', 'name', 'joined', 'active'])
    expect(modeled[0].columns.map((column) => column.sqlType)).toEqual(['NUMBER', 'STRING', 'DATE', 'BOOLEAN'])
    expect(modeled[0].rows[0].joined).toBe('2026-01-01T00:00:00.000Z')
  })

  it('skips nodes with no source or no selected columns', () => {
    const tables: ImportedTable[] = [
      {
        id: 'src-a',
        fileName: 'x.xlsx',
        sheetName: 'X',
        displayName: 'x',
        columns: ['id'],
        rows: [{ id: 1 }],
      },
    ]

    const nodes: ModelNode[] = [
      {
        id: 'missing-source',
        data: { entityName: 'A', sourceTableId: 'src-missing', selectedColumns: ['id'] },
      },
      {
        id: 'empty-cols',
        data: { entityName: 'B', sourceTableId: 'src-a', selectedColumns: ['not_here'] },
      },
    ]

    expect(buildModeledTables(nodes, tables)).toEqual([])
  })

  it('formats values for rendering', () => {
    expect(formatCellValue(null)).toBe('NULL')
    expect(formatCellValue(BigInt(88))).toBe('88')
    expect(formatCellValue(new Date('2026-03-01T00:00:00.000Z'))).toBe('2026-03-01T00:00:00.000Z')
    expect(formatCellValue({ a: 1 })).toBe('{"a":1}')
    expect(formatCellValue(12)).toBe('12')
  })

  it('maps sqlite identifier/type/literal conversions', () => {
    expect(toSqliteIdentifier('a"b')).toBe('"a""b"')
    expect(toSqliteType('NUMBER')).toBe('REAL')
    expect(toSqliteType('BOOLEAN')).toBe('INTEGER')
    expect(toSqliteType('STRING')).toBe('TEXT')

    expect(toSqliteLiteral(null)).toBe('NULL')
    expect(toSqliteLiteral(Number.NaN)).toBe('NULL')
    expect(toSqliteLiteral(12.5)).toBe('12.5')
    expect(toSqliteLiteral(true)).toBe('TRUE')
    expect(toSqliteLiteral(false)).toBe('FALSE')
    expect(toSqliteLiteral(BigInt(7))).toBe('7')
    expect(toSqliteLiteral("O'Reilly")).toBe("'O''Reilly'")
    expect(toSqliteLiteral(new Date('2026-01-01T00:00:00.000Z'))).toBe("'2026-01-01T00:00:00.000Z'")
  })

  it('converts square bracket identifiers', () => {
    const sql = 'SELECT [employee id], [name] FROM [employee table] WHERE [a] = 1'
    expect(convertSquareBracketIdentifiers(sql)).toBe(
      'SELECT "employee id", "name" FROM "employee table" WHERE "a" = 1',
    )
  })

  it('normalizes sql.js result sets', () => {
    expect(normalizeSqlJsResult([])).toEqual({ summary: 'Statement executed.', columns: [], rows: [] })

    const normalized = normalizeSqlJsResult([
      {
        columns: ['id', 'name'],
        values: [
          [1, 'A'],
          [2, 'B'],
        ],
      },
    ])

    expect(normalized.summary).toBe('Query returned 2 rows.')
    expect(normalized.columns).toEqual(['id', 'name'])
    expect(normalized.rows).toEqual([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ])
  })

  it('builds chart view for none/count/sum/avg', () => {
    const output: QueryOutput = {
      summary: 'ok',
      columns: ['dept', 'salary'],
      rows: [
        { dept: 'Eng', salary: 100 },
        { dept: 'Eng', salary: 150 },
        { dept: 'Sales', salary: 90 },
      ],
    }

    const noneView = buildChartView(output, 'none', 'dept', 'salary')
    expect(noneView?.valueColumns).toEqual(['salary'])
    expect(noneView?.data).toHaveLength(3)

    const countView = buildChartView(output, 'count', 'dept', '')
    expect(countView?.valueColumns).toEqual(['count'])
    expect(countView?.data).toEqual([
      { label: 'Eng', count: 2 },
      { label: 'Sales', count: 1 },
    ])

    const sumView = buildChartView(output, 'sum', 'dept', 'salary')
    expect(sumView?.data).toEqual([
      { label: 'Eng', salary: 250 },
      { label: 'Sales', salary: 90 },
    ])

    const avgView = buildChartView(output, 'avg', 'dept', 'salary')
    expect(avgView?.data).toEqual([
      { label: 'Eng', salary: 125 },
      { label: 'Sales', salary: 90 },
    ])
  })

  it('returns null chart view when invalid inputs are provided', () => {
    expect(buildChartView(null, 'none', 'x', 'y')).toBeNull()
    expect(buildChartView({ summary: 's', columns: [], rows: [] }, 'none', 'x', 'y')).toBeNull()
    expect(buildChartView({ summary: 's', columns: ['x'], rows: [{ x: 1 }] }, 'sum', '', 'x')).toBeNull()
    expect(buildChartView({ summary: 's', columns: ['x'], rows: [{ x: 1 }] }, 'sum', 'x', '')).toBeNull()
  })
})

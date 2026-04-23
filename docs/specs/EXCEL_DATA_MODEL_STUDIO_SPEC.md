# Excel Data Model Studio Spec (Retrospective Baseline)

## 1) Purpose
Provide a browser-based workflow to:
- import multiple Excel files,
- inspect detected columns,
- model entities and relationships on a canvas,
- query modeled data with SQL,
- visualize query outputs with configurable charts.

This document is the canonical context baseline for future changes.

## 2) Product Scope
### In scope
- Multi-file upload (`.xlsx`, `.xls`, `.csv`) and sheet-level parsing.
- Source table introspection (row count, column list).
- Canvas-based entity modeling from source sheets.
- Relationship edge creation between entities.
- SQL editor + schema browser + templates + query history.
- In-browser SQL execution with SQLite WASM (`sql.js`).
- Query result table and chart visualization.
- Saved chart presets in browser storage.

### Out of scope
- Backend persistence or multi-user collaboration.
- Role-based access control.
- Guaranteed relational key inference from edges.
- Server-side scheduling, orchestration, or materialized pipelines.

## 3) Key User Flows
1. User uploads one or more Excel files.
2. App parses sheets and exposes source tables/columns.
3. User creates modeled entities from source tables and chooses columns.
4. User connects entities to represent relationships.
5. User writes SQL in SQL Lab and runs query.
6. App executes query in SQLite WASM (`sql.js`) and renders table output.
7. User configures chart controls and saves presets.

## 4) Domain Model
### Source layer
- `ImportedTable`: parsed workbook sheet with `columns` + `rows`.

### Model layer
- Entity node (`EntityNodeData`):
  - `entityName`
  - `sourceTableId`
  - `selectedColumns`
- Relationship edge (`RelationshipEdgeData`):
  - `relationType`

### Query layer
- `ModeledTable`: derived SQL-ready table with inferred SQL types.
- `QueryOutput`: query summary, columns, rows.
- Chart settings:
  - type (`bar`, `line`)
  - x column
  - y column
  - aggregation (`none`, `count`, `sum`, `avg`)

## 5) Architecture Decisions
### Decision A: In-browser analytics engine
- Chosen: SQLite WASM (`sql.js`).
- Reason: lighter and more reliable in-browser execution for current project scope.
- Tradeoff: fewer analytical capabilities than DuckDB for very large/complex workloads.

### Decision B: Lazy-load SQL engine
- SQLite initializes when SQL tab is opened.
- Reason: reduce initial app load cost for users focusing on import/modeling.

### Decision C: Local persistence for UX state
- Query history + chart presets stored in `localStorage`.
- Reason: quick continuity without backend complexity.

### Decision D: Bracket identifier compatibility
- User SQL using `[identifier]` is translated to SQLite-safe quoted identifiers.
- Reason: preserve existing query habits and generated snippets.

## 6) Non-functional Requirements
- Build and lint must pass before merge.
- SQL tab remains usable with no modeled entities (shows guidance states).
- Result table supports horizontal overflow for wide output.
- Canvas and SQL workbench remain functional on desktop and mobile widths.

## 7) Acceptance Criteria
1. Import
- Given valid Excel files, source cards appear with rows/columns metadata.

2. Modeling
- Given a source table, `Add To Canvas` creates an entity node.
- Entity inspector can rename entity and toggle mapped columns.

3. SQL execution
- Given modeled tables and valid SQL, query executes and shows tabular results.
- If SQLite is not ready, a clear status/error is shown.

4. Charts
- If result has numeric data, chart preview appears.
- User can switch chart type and configure x/y/aggregation.

5. Persistence
- Query history survives refresh.
- Chart presets survive refresh and can be reapplied.

## 8) Known Constraints / Risks
- Very large datasets can stress browser memory.
- WASM asset still adds bundle size and can delay first SQL run on low-end devices.
- Relationship edges are descriptive; they do not enforce join keys automatically.

## 9) Change Control (Spec-first)
For any future feature work:
1. Update this spec first (`Scope`, `Decision`, `Acceptance Criteria`).
2. Implement code changes.
3. Update `docs/CHANGELOG_TRACKER.md` with Added/Changed/Fixed entries.
4. Re-run `npm run lint` and `npm run build`.

## 10) Current Code Anchors
- Main product logic: `src/App.tsx`
- Main UI styling: `src/App.css`, `src/index.css`
- Sample dataset generator: `scripts/generate-sample-excel.mjs`

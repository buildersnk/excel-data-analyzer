# Changelist Tracker

This tracker is a retrospective log of major product and engineering changes made on **April 23, 2026**.

## How to use
- Add one entry per meaningful change batch.
- Keep entries scoped to behavior, UX, data model, and technical decisions.
- For new work, append at the top under `Unreleased`.

## Unreleased

### Added
- Added SQLite (`sql.js`) as the in-browser SQL engine for SQL Lab.
- Added local wasm loading for SQLite via bundled `sql-wasm.wasm`.
- Added SQL engine retry action and status handling for SQLite initialization.
- Added docs governance/admin context (`docs/CONTEXT_ADMIN.md`).

### Changed
- Replaced DuckDB implementation with SQLite execution path in `src/App.tsx`.
- Updated SQL engine status messaging from DuckDB to SQLite in SQL Lab UX.
- Simplified Vite config by removing DuckDB-specific sourcemap workaround.
- Updated baseline product spec to reflect SQLite architecture and constraints.

### Fixed
- Removed DuckDB initialization timeout errors from runtime path.
- Removed DuckDB worker sourcemap warning/error chain by removing DuckDB integration entirely.

---

## 2026-04-23

### Added
- Bootstrapped a Vite + React + TypeScript application for Excel data analysis and modeling.
- Added multi-file Excel import with sheet parsing and source table introspection.
- Added model canvas flow using React Flow to create entity nodes and connect relationships.
- Added SQL Lab tab with query editor and tabular result rendering.
- Added sample data generator and produced three linked Excel files:
  - `employees.xlsx`
  - `departments.xlsx`
  - `projects.xlsx`
- Added Superset-style SQL workspace features:
  - schema explorer
  - query templates
  - SQL editor toolbar
  - result panel separation
- Added DuckDB WASM query execution in browser.
- Added chart rendering from query results using Recharts.
- Added query history (persisted in `localStorage`).
- Added chart preset save/apply/remove (persisted in `localStorage`).

### Changed
- Replaced initial SQL engine approach with DuckDB WASM for stronger analytical SQL support.
- Updated visual theme to professional grey + pastel palette.
- Improved layout width and reduced border heaviness across app sections.
- Improved model-canvas connector visibility with clearer handles, legends, and edge styling.
- Enhanced SQL result grid with stronger horizontal scrolling behavior.
- Converted bracket-style identifiers in SQL (`[table]`) to DuckDB-safe quoted identifiers before execution.
- Lazy-loaded DuckDB so initialization happens when SQL Lab is opened, not at initial app boot.

### Fixed
- Resolved TypeScript import/type issues and React Flow typing mismatches during build.
- Resolved lint and hook-order issues introduced during chart and state refactors.

### Technical Notes
- Build and lint status for current state:
  - `npm run build` passing
  - `npm run lint` passing
- Known caveat:
  - Historical note: DuckDB WASM path previously depended on runtime worker/wasm loading behavior.

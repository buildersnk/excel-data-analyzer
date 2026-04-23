# Excel Data Analyzer
[![Build](https://github.com/buildersnk/excel-data-analyzer/actions/workflows/build.yml/badge.svg?branch=master)](https://github.com/buildersnk/excel-data-analyzer/actions/workflows/build.yml)
[![Test](https://github.com/buildersnk/excel-data-analyzer/actions/workflows/test.yml/badge.svg?branch=master)](https://github.com/buildersnk/excel-data-analyzer/actions/workflows/test.yml)

Upload multiple Excel files, model entities/relationships on a canvas, run SQL queries, and visualize results with charts.

## What This App Does
- Imports `.xlsx`, `.xls`, and `.csv` files (sheet-level parsing)
- Shows detected columns and row counts per source table
- Lets you create a data model in a canvas (entities + relationship edges)
- Provides a SQL Lab with schema explorer, templates, and query history
- Executes SQL in-browser using **SQLite WASM** (`sql.js`)
- Renders query output as both table and chart (bar/line)
- Supports chart presets stored in `localStorage`

## Tech Stack
- React + TypeScript + Vite
- React Flow (canvas modeling)
- `xlsx` (Excel parsing)
- `sql.js` (SQLite WASM in browser)
- Recharts (charting)
- Docusaurus (project docs site)

## Project Structure
- `src/` main app
- `scripts/generate-sample-excel.mjs` sample Excel generator
- `sample-data/` generated sample files
- `docs/` spec-first governance docs (spec, changelog, context admin)
- `docs-site/` Docusaurus docs app

## Getting Started
Install dependencies:

```bash
npm install
```

Run app + docs together:

```bash
npm run dev
```

Default URLs:
- App: `http://localhost:5173`
- Docs: `http://localhost:3000/docs/intro`

## Helpful Scripts
- `npm run dev` start app and docs together
- `npm run dev:app` start Vite app only
- `npm run dev:docs` start Docusaurus docs only
- `npm run build` build Vite app
- `npm run build:docs` build Docusaurus docs
- `npm run lint` run ESLint

## Generate Sample Excel Data

```bash
node scripts/generate-sample-excel.mjs
```

Generated files:
- `sample-data/employees.xlsx`
- `sample-data/departments.xlsx`
- `sample-data/projects.xlsx`

## Docs Link From App Header
The app hamburger menu opens docs using `VITE_DOCS_URL`.

Default fallback:
- `http://localhost:3000/docs/intro`

Optional override in `.env`:

```bash
VITE_DOCS_URL=http://localhost:3000/docs/intro
```

## Spec-First Workflow
Governance docs:
- `docs/specs/EXCEL_DATA_MODEL_STUDIO_SPEC.md`
- `docs/CHANGELOG_TRACKER.md`
- `docs/CONTEXT_ADMIN.md`

Expected workflow:
1. Update spec first
2. Implement code changes
3. Update changelist tracker
4. Validate with `npm run lint` and `npm run build`

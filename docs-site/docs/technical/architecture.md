---
sidebar_position: 1
---

# Architecture and Tech Stack

## Stack summary
- **Frontend:** React + TypeScript + Vite
- **Data parsing:** `xlsx` (Excel and CSV ingestion)
- **Model canvas:** React Flow
- **SQL engine:** SQLite WASM via `sql.js`
- **Charts:** Recharts
- **Docs:** Docusaurus

## System diagram

![Tech stack diagram](/img/guides/tech-stack-diagram.svg)

## Runtime flow
1. User uploads files.
2. Parser converts each sheet into in-memory table rows.
3. Canvas entities map selected columns from source tables.
4. SQL Lab builds SQLite in-memory tables from modeled entities.
5. Query output is rendered as table and optional chart.

## Core implementation files
- `src/App.tsx`: state, upload parsing, model logic, SQL flow, chart config.
- `src/App.css` and `src/index.css`: layout and design system.
- `scripts/generate-sample-excel.mjs`: sample dataset generation.

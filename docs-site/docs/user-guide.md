---
sidebar_position: 2
---

# Quick Start

This guide shows the fastest path from file upload to chart output.

## 1. Import data
1. Open the **Import Excel** tab.
2. Upload one or more `.xlsx`, `.xls`, or `.csv` files.
3. Confirm source cards show rows and columns.

![Import and inspect](/img/guides/quickstart-import.svg)

## 2. Build your model
1. Open **Model Canvas**.
2. Click **Add To Canvas** for each source table.
3. Connect tables from **Join Out** to **Join In**.
4. Select a node to rename entities and choose columns.

## 3. Run SQL
1. Open **SQL Lab**.
2. Use schema explorer and templates to build SQL.
3. Run the query and review results.

## 4. Create charts
1. Choose chart type (`bar` or `line`).
2. Select `x` and `y` columns.
3. Optionally use aggregation (`count`, `sum`, `avg`).
4. Save preset for reuse.

![SQL and chart flow](/img/guides/quickstart-sql-chart.svg)

## Common issues

### Query returns no data
- Verify table names in SQL match model table names.
- Confirm joins are valid for your selected columns.

### SQL engine not ready
- Wait a few seconds after opening SQL Lab.
- Refresh the page if initialization fails.

### Chart controls disabled
- Charts require query results with at least one numeric field.

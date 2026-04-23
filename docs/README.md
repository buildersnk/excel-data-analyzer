# Docs Index

This project uses **spec-first context engineering** and explicit change tracking.

## Files
- `docs-site/`
  - Docusaurus documentation site (separate from the Vite app).
- `docs/CHANGELOG_TRACKER.md`
  - Retrospective and ongoing change log with `Added / Changed / Fixed` sections.
- `docs/specs/EXCEL_DATA_MODEL_STUDIO_SPEC.md`
  - Canonical baseline spec for current product behavior.
- `docs/specs/SPEC_TEMPLATE.md`
  - Template for future feature specs.
- `docs/CONTEXT_ADMIN.md`
  - Admin checklist for context maintenance (spec drift, changelog hygiene, architecture sync).

## Working Agreement
1. Write/update spec before implementation.
2. Implement code changes.
3. Update changelist tracker.
4. Validate with lint and build.
5. Run context admin checklist before closing major feature or architecture changes.

## Docusaurus Commands
- `npm run dev` from repo root starts **app (Vite)** and **docs (Docusaurus)** together.
- `cd docs-site && npm start` starts docs server only.
- `npm run build:docs` from repo root builds docs site.

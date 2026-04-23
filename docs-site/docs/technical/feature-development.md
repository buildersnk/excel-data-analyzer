---
sidebar_position: 2
---

# Feature Development Guide

Use this sequence for every feature so docs and code stay aligned.

## 1. Spec first
1. Update `docs/specs/EXCEL_DATA_MODEL_STUDIO_SPEC.md`.
2. Define scope, acceptance criteria, and technical decisions.

## 2. Implement
1. Update UI, state, and data flow in `src/App.tsx`.
2. Add/adjust styles in `src/App.css` and `src/index.css`.
3. Keep UX behavior consistent across Import, Model, and SQL tabs.

## 3. Validate
1. Run `npm run lint`.
2. Run `npm run build`.
3. Verify app workflow manually using sample files in `sample-data/`.

## 4. Document and release
1. Add changelist entry in `docs/CHANGELOG_TRACKER.md` (`Added`, `Changed`, `Fixed`).
2. Update relevant Docusaurus docs under `docs-site/docs`.
3. If architecture changed, update [Architecture and Tech Stack](./architecture).

## Feature checklist
- [ ] Spec updated
- [ ] Implementation complete
- [ ] Lint/build passing
- [ ] Changelog updated
- [ ] User guide updated (if UX changed)
- [ ] Architecture doc updated (if technical design changed)

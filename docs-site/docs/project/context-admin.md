# Context Admin Checklist

Use this checklist when a feature, architecture, or workflow changes.

## 1) Spec Drift Check
- Confirm current implementation matches `docs/specs/EXCEL_DATA_MODEL_STUDIO_SPEC.md`.
- If behavior changed, update:
  - Scope
  - Architecture Decisions
  - Acceptance Criteria
  - Known Constraints/Risks

## 2) Changelist Hygiene
- Add entries in `docs/CHANGELOG_TRACKER.md` under `Unreleased`:
  - `Added`
  - `Changed`
  - `Fixed`
- Keep entries outcome-focused, not commit-log noise.

## 3) Engine/Dependency Sync
- If data/query engine changed, ensure docs explicitly mention current engine.
- Verify `package.json` aligns with architecture section in spec.

## 4) UX Contract Sync
- If tabs/flows changed (Import, Model, SQL), update user flow steps in the spec.
- Ensure error/status messages referenced by docs still exist in UI.

## 5) Validation
- Run and record:
  - `npm run lint`
  - `npm run build`
- If validation fails, do not close the doc/admin update task.

## 6) Closeout
- Ensure docs index (`docs/README.md`) lists all active governance docs.
- Keep this checklist lightweight; avoid process overhead without value.

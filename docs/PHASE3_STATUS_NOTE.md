# Phase 3 Implementation Status Note

> **Date:** 2026-07-15
> **Branch:** `fix/mini-rally-gap-remediation`
> **Purpose:** Summarize actual current state of Phase 3 features in THIS repo, since
> the tracking status in the [Mini_Rally_pj spec repo](https://github.com/hieuvbm2404/Mini_Rally_pj)
> cannot be edited from here.

## Summary

The Mini_Rally_pj BA tracking doc marks Phase 3 tasks as **"NOT STARTED"** for the dev team.
This is **stale** — the Rally implementation repo has Phase 3 backend fully implemented and
partially wired on the frontend. The table below reconciles the spec repo's tracking labels
with the actual codebase state.

## Phase 3 Feature Matrix

| Spec Task | BA Tracking Label | Actual Implementation State | Backend | Frontend |
|-----------|-------------------|----------------------------|---------|----------|
| **P3.1 Team Status** — Member-grouped task dashboard | NOT STARTED | ✅ Fully implemented | `GET /team-status` with member groups, capacity, task rows. `PATCH /team-status/capacity` and `PATCH /team-status/tasks/:taskId` for inline edit. | Page exists at `Track > Team Status` with iteration selector, grouped table, inline capacity/task editing |
| **P3.1 Parent auto-complete** — Last child task completes parent | NOT STARTED | ✅ Implemented | `TeamStatusService` recalculates parent progress; auto-sets parent to `Completed` when all children complete | Wired in team-status page |
| **P3.2 Release Management** — Timeboxes Release type | NOT STARTED | ✅ Fully implemented | `GET/POST /releases` with CRUD, inline edit, artifacts (Story/Defect), one-active-release-per-item enforcement | Release pages exist under Timeboxes with list/detail/views |
| **P3.2 Release reassignment feedback** | NOT STARTED | 🟡 Backend ready | Release reassignment logic exists; toast/feedback on the FE is unverified | Needs verification |
| **P3.3 Milestones** — Multi-project/team/release spanning | NOT STARTED | ✅ Fully implemented | `GET/POST /milestones` with CRUD, multi-project/team/release linking, derived target dates from linked releases | Milestone pages exist with list/detail |
| **P3.3 Milestone derived target dates** | NOT STARTED | ✅ Implemented | Recalculates `targetStartDate`/`targetEndDate` from earliest/latest linked releases on add/remove | Wired |
| **P3.4 Quality/Defect dashboard** | NOT STARTED | ✅ Backend fully implemented | `GET /quality/defects` with all defect-specific columns (Rank, ID, Name, User Story, Severity, Priority, State, Flow State, Fixed In Build, Iteration, Submitted By, Owner), metrics, and 9 filter dimensions | Page exists at `Quality > Defect` |
| **P3.4 Defect state transitions** | NOT STARTED | ✅ Implemented | Submitted → Open → Fixed → Closed flow via `defect_state` field, shared `schedule_state` for schedule progression. `Closed Declined` state exists. | Wired in quality page |

## Test/Lint/Typecheck/Build Baseline (2026-07-15)

| Check | Result |
|-------|--------|
| `tsc --noEmit` | ✅ 0 errors |
| `eslint` | ✅ Clean |
| `vitest run` | ✅ 22 suites, 498 tests passed |
| `nest build api` | ✅ Clean |
| `nest build worker` | ✅ Clean |

## Notes

- The BA tracking doc's "NOT STARTED" labels reflect a **documentation gap**, not a code gap.
- All Phase 3 backend modules were implemented in feature branches (`feature/p3.1-*`,
  `feature/p3.2-*`, `feature/p3.3-*`, `feature/p3.4-*`) and merged to `main`.
- The primary remaining work is **test coverage** (unit + E2E) for the Phase 3 business
  rules, which is what the `fix/mini-rally-gap-remediation` branch addresses.
- Sprint lifecycle management (start/close/cancel/capacity/carry-over) is intentionally
  **not implemented** — the report flags this as a BA decision, not an approved dev task.
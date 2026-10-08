---
gsd_state_version: "1.0"
milestone: v0.2.0
milestone_name: Actions menu + Send individual consent
current_phase: 4
current_phase_name: Actions Menu
status: planning
stopped_at: v0.2.0 roadmap created (Phases 4-6); ready to plan Phase 4
last_updated: "2026-10-08T00:51:55.528Z"
last_activity: 2026-10-07
last_activity_desc: Roadmap for v0.2.0 created (Phases 4-6, 29/29 requirements mapped)
state_head: 239517d4ba65df3fabd53d1fa63d6c57b153cef0
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-07)

**Core value:** From an open contact record, a staff member can press one button and reliably trigger the right HighLevel workflow for that exact contact and location, with no stale context and no duplicate sends.
**Current focus:** Milestone v0.2.0 — Actions menu + Send individual consent. Phase 4 (Actions Menu) is next. v0.1.2 is the current release tag.

## Current Position

Phase: 4 (Actions Menu) — READY TO EXECUTE
Plan: —
Status: Not started (roadmap created, ready to plan)
Last activity: 2026-10-07 — Roadmap for v0.2.0 created (Phases 4-6, 29/29 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 7
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |
| 02 | 2 | - | - |
| 3 | 2 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02 P01 | 14 min | 2 tasks | 5 files |
| Phase 02 P02 | 14 min | 2 tasks | 8 files |
| Phase 03 P01 | 20 min | 3 tasks | 6 files |
| Phase 03 P02 | 22 min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (full log). Milestone v0.1.0 decisions are archived with it. v0.2.0 decisions so far (from `notes/actions-menu-individual-consent.md` and `notes/webhook-test-workflow-audit.md`):

- [v0.2.0]: Member consent link reuses the member's own `consent_hub_token`; wf2 shows only the holder's card when the holder is not the owner.
- [v0.2.0]: Consent actions resolve the contact with Find Contact by payload `contactId`, never email or phone (proven in the live Send Invite workflow).
- [v0.2.0]: Send Invite keeps its own trigger `bde416ab`; both consent items share one new Inbound Webhook branching on `buttonId`. Rollback to v0.1.2 needs no ClinX change.
- [v0.2.0]: Refusals are written by the ClinX workflow (contact Note + internal notification); the client only pre-checks empty or synthetic email.
- [v0.2.0]: Hardening is client cooldown only (60 s per item); server-side dedupe and INV-01..05 deferred to `seeds/consent-actions-hardening.md`.
- [v0.2.0 roadmap]: Three coarse phases: 4 Actions Menu (this repo), 5 Individual Consent Backend (artifacts in `~/Repos/clients/xcelsior/hint-api/` and `Email-Templates/`), 6 Release. Phases 4 and 5 are independent; 6 needs both.

### Pending Todos

None yet.

### Blockers/Concerns

- [v0.2.0]: The consent Inbound Webhook URL does not exist until Rob builds the Phase 5 workflow in ClinX. Phase 4 uses a placeholder/stub URL in config and tests; Phase 6 must swap in the real URL before the release commit.
- [v0.2.0]: Unverified in ClinX UI: whether `{{contact.*}}` after Find Contact refers to the found contact (runs 2-3 of the Send Invite audit suggest yes). Phase 5 spec flags it; Phase 6 live test confirms it.
- [v0.2.0]: Send Invite inherits the Longevity branch (a `longevity-interest` contact without `trigger:direct` gets the Longevity email). Unchanged by this milestone; note for live testing.
- [v0.1.0 close]: Verification override — phases 1-3 read `stale` after the v0.1.2 release changed covered files; closed on the 119/119 suite, the 9/9 phase-3 live UAT, and 03-SECURITY.md (see MILESTONES.md). Phase 4 touches `src/` and should re-run the verifier before its own close.
- [Phase 1]: Webhook URL lives in public config (accepted trade-off AR-03-01 for a staff-only tool); anyone with the URL can enqueue the workflow. v0.2.0 adds a second public URL (consent webhook); volume risk grows, disclosure does not (links only go to the address on file). v2 hardening (INV-01..05) removes it.
- [Phase 1]: HighLevel states custom JS/CSS is unsupported; a HighLevel UI update can break mount points at any time. Graceful degradation is a hard requirement; `GHLC.verify()` is the first diagnostic.
- [Phase 3]: Location Business Profile logos live on HighLevel's storage; a re-upload changes the URL, so a config that points at one needs a follow-up tag. HighLevel's nav icons are black images, so a dark `sidebarBg` leaves them low-contrast; the 40px logo slot makes padded logos small.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-07
Stopped at: v0.2.0 roadmap created (Phases 4-6); ready to plan Phase 4
Resume file: None

## Operator Next Steps

- Plan the first phase with /gsd-plan-phase 4 (Phase 5 can be planned independently)

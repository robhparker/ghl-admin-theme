---
phase: 06-release-v0-2-0
plan: 01
subsystem: release
tags: [release, version-bump, live-checklist, rollback, checklist-gate]

requires:
  - phase: 04-actions-menu
    provides: Actions menu, consent item ids, suite version gate (test/run.mjs)
  - phase: 05-individual-consent-backend
    provides: BUILD-SPEC §9 refusal register, deliverables README Phase 6 live checks and rollback order
provides:
  - Every README release-checklist version site at 0.2.0 (untagged, unpushed)
  - 06-LIVE-CHECKLIST.md run log (44 rows, rollback to v0.1.2, no-push load methods)
  - harness/checklist-gate.cjs read-only completeness and ordering gate
affects: [06-02, 06-03, 06-04, 06-05, phase-6-verification]

actuals:
  tokens: 8200
  tasks: 2
  commits: 2
plan_head_before: 07ece864522992b85f731ac21bcc05e37b1baeb3

tech-stack:
  added: []
  patterns:
    - "Run log gate: a Node CommonJS script reads only the last (Result) cell of fixed-id markdown rows and prints counts and ids, never cell text"

key-files:
  created:
    - .planning/phases/06-release-v0-2-0/06-LIVE-CHECKLIST.md
    - .planning/phases/06-release-v0-2-0/harness/checklist-gate.cjs
  modified:
    - package.json
    - src/ghl-customizer.js
    - src/ghl-customizer.css
    - config/agency-config.json
    - README.md

key-decisions:
  - "checklist-gate.cjs treats a literal 'deferred: <reason>' (the placeholder copied unchanged) as invalid, so a deferral must carry a real reason"
  - "R-table 'Email sent' cells stay empty like every observed cell; the section intro states it must be 'none' on every row (for R-12, none from the refused run)"
  - "Run order puts PR-01/PR-02 before the RB rows (recorded as PR-03), so recording an RB row before the pre-release rows are done is an ORDER-VIOLATION"

patterns-established:
  - "Live run logs in a public repo record mailbox letters, subjects, link match yes/no, Note text, and requestIds only"

requirements-completed: [REL-03]
requirements-partial: [REL-02]

coverage:
  - id: D1
    description: "Every README release-checklist version site reads 0.2.0; the suite's version gate ties them together; committed, untagged, unpushed"
    requirement: REL-02
    verification:
      - kind: unit
        ref: "npm test (test/run.mjs version gate and README URL gate) -> PASS 165/165"
        status: pass
      - kind: other
        ref: "Task 1 BUMP-OK node check plus no v0.2.0 tag locally or on origin, origin main 90c32eac"
        status: pass
    human_judgment: false
  - id: D2
    description: "06-LIVE-CHECKLIST.md with ten H2s, 44 rows with empty Result cells, verbatim BUILD-SPEC §9 Note texts, D-03 path labels, load methods, rollback to v0.1.2, and no URL or token"
    requirement: REL-03
    verification:
      - kind: other
        ref: "Task 2 checklist node check -> CHECKLIST-OK 44 rows"
        status: pass
    human_judgment: true
    rationale: "Whether the rows are runnable as written in a live ClinX tab is only proven by the live run itself (the backstop truth); the gate tracks that run"
  - id: D3
    description: "checklist-gate.cjs: OPEN exit 1 on the fresh checklist; LIVE-RUN-COMPLETE, PRE-RELEASE-COMPLETE (--pre-release exit 0), ORDER-VIOLATION, FAILED, MALFORMED on temporary copies; never prints cell text"
    verification:
      - kind: unit
        ref: "Task 2 gate drive -> GATE-OK; node .planning/phases/06-release-v0-2-0/harness/checklist-gate.cjs -> OPEN (exit 1)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-08
status: complete
---

# Phase 6 Plan 01: Version bump, live-test checklist, and checklist gate Summary

**All twelve README release-checklist sites now read v0.2.0, and the suite still passes 165/165. A 44-row live-test run log with a v0.1.2 rollback is ready to fill in. A read-only gate keeps staff off v0.2.0 (`--pre-release`) and keeps phase 6 unverified (`LIVE-RUN-COMPLETE`) until the live results are recorded. No tag was created and nothing was pushed.**

## Performance

- **Duration:** about 6 min
- **Started:** 2026-10-08T15:43:22Z
- **Completed:** 2026-10-08T15:49Z
- **Tasks:** 2
- **Files modified:** 7 (5 modified, 2 created)

## Accomplishments

- Version bump (REL-02 bump half): package.json, `VERSION`, the head-comment Version line, the `DEFAULT_CONFIG_URL` tag, the stylesheet header, the Dummy Clinic logo URL, the five README jsDelivr URLs, and README line 35 all read 0.2.0. The historical comment ("exactly as v0.1.2 did") and the test/run.mjs old-release mentions are unchanged. The consent item URLs are still `""` (Plan 06-04 fills them).
- `06-LIVE-CHECKLIST.md` (REL-03, D-03) has these parts:
  - The rules: test contacts only, nothing private written into the file, and Result cells hold exactly `pass`, `fail`, or `deferred: <reason>`.
  - P-01..P-07, including the P-06 `prepush-scan.cjs --history` / `PASS 7/7` check.
  - The duplicate-instance explanation and both no-push load methods (Method A route interception, Method B Request blocking plus the blob-URL recipe). Loading at a commit sha is forbidden before Plan 06-05.
  - M-01..M-10, R-01..R-12, and H-01..H-08. The R rows carry the BUILD-SPEC §9 Note texts verbatim and the D-03 path labels, and the curl helper reads the URL with `node -p` without echoing it.
  - The rollback snippet at v0.1.2 with RB-01..RB-04, then PR-01..PR-03.
- `harness/checklist-gate.cjs` prints the pre-release and post-release count lines, the open, fail, and invalid id lists, the order line, and one verdict. It never prints cell text.

Verification results:
- `npm test`: `PASS 165/165` (after both commits)
- Checklist check: `CHECKLIST-OK 44 rows`
- Gate drive: `GATE-OK`
- Gate on the fresh checklist: `OPEN`, exit 1 (the fail-first proof)

## Task Commits

1. **Task 1 (tracer): v0.2.0 identity end to end** - `e91b39c` (chore). The tracer gate re-ran both verify commands after the commit: V1-OK, BUMP-OK, V2-OK.
2. **Task 2: live-test checklist with rollback and checklist gate** - `eaf5105` (docs)

## Files Created/Modified

- `package.json`, `src/ghl-customizer.js`, `src/ghl-customizer.css`, `config/agency-config.json`, `README.md`: version and tag text only
- `.planning/phases/06-release-v0-2-0/06-LIVE-CHECKLIST.md`: the live run log
- `.planning/phases/06-release-v0-2-0/harness/checklist-gate.cjs`: the read-only gate (CLI `node checklist-gate.cjs [--pre-release] [PATH]`, exit 0/1/2)

## Decisions Made

See key-decisions in the frontmatter. In short:
- A placeholder deferral is invalid.
- The R-table "Email sent" cells stay empty, and the section intro states the expected value ("none").
- RB rows are recorded after PR-01/PR-02, as the PR-03 rehearsal.

## Deviations from Plan

**1. [Process note] Committed on `main` although `git.base-branch --is-protected main` returns true.** The orchestrator dispatched this plan as a sequential executor on the main working tree, and the plan's stated output is "two commits on main". `branching_strategy` is `none`, and every earlier phase commit is on main. HEAD was on main by design, not by drift. Config was not changed, and nothing was pushed.

Otherwise the plan was executed as written.

## Issues Encountered

None.

## Flagged Assumptions Carried Forward

- A-1: REL-02 edge classification is still unresolved (no data shape). It remains flagged for human review.
- A-3: the installed snippet version is recorded at P-07 during the live run.
- A-4: if the Playwright tab is no longer logged in, Method B is the fallback.

## User Setup Required

None for this plan. The live run itself needs Rob's logged-in tab and the test contacts from P-04.

## Next Phase Readiness

- **06-02** (pre-push scan and tree scrub) and **06-03** (unpushed-history cleanup) can run now without Rob.
- **06-04** (consent URL and release commit) waits on Rob's consent trigger URL after the pilot gate.
- **06-05** (D-02 decision, tag, push) waits on Rob. The decision reads `checklist-gate.cjs --pre-release`.
- REL-02 stays open until the tag and push in 06-05. Phase 6 verification stays open until the gate prints `LIVE-RUN-COMPLETE`.

## Self-Check: PASSED

- FOUND: .planning/phases/06-release-v0-2-0/06-LIVE-CHECKLIST.md
- FOUND: .planning/phases/06-release-v0-2-0/harness/checklist-gate.cjs
- FOUND: e91b39c, eaf5105
- No v0.2.0 tag locally or on origin; origin main still 90c32eac84ac23502e785a92a445df41b8747f12

---
*Phase: 06-release-v0-2-0*
*Completed: 2026-10-08*

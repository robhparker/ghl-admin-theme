---
phase: 06-release-v0-2-0
plan: 02
subsystem: release
tags: [release, prepush-scan, privacy, patient-id, publication-gate]

requires:
  - phase: 06-release-v0-2-0
    provides: 06-01 version bump to 0.2.0 (untagged, unpushed) and the P-06 checklist row that runs prepush-scan --history
provides:
  - harness/prepush-scan.cjs, the read-only publication gate (tree PASS 6/6, history PASS 7/7)
  - A tracked tree free of live-looking Hint patient ids (synthetic pat-EXAMPLEa1B2c, pat-EXAMPLEd4E5f, pat-EXAMPLEg7H8i)
  - The scrub commit with the exact subject Plan 06-03 derives its history mapping from
affects: [06-03, 06-04, 06-05, phase-6-verification]

actuals:
  tokens: 5300
  tasks: 2
  commits: 2
plan_head_before: cb3c810a9cdad0ba6e6fa022b76890eec0a46439

tech-stack:
  added: []
  patterns:
    - "Publication scan: a Node CommonJS script runs git only through spawnSync argument arrays, prints class and location (path:line, or sha7 plus path/message), never a matched value, and gates its exit code"

key-files:
  created:
    - .planning/phases/06-release-v0-2-0/harness/prepush-scan.cjs
  modified:
    - src/ghl-customizer.js
    - README.md
    - test/run.mjs
    - .planning/phases/05-individual-consent-backend/harness/spec-check.cjs
    - .planning/phases/05-individual-consent-backend/05-02-PLAN.md

key-decisions:
  - "Scrub edits keep every EXAMPLE id at the same character offset as the id it replaces (same 16-char length, text before it unchanged), so Plan 06-03 can pair ids by position on the changed line"
  - "The src comment drops '(live)' after the second example and calls both 'synthetic examples of the wf1 key shape' on the same line; no line added or removed"
  - "History email findings in commit messages (the Co-Authored-By trailer, one public anthropic.com address) stay listed as informational; the email class was not given an extra allowlist entry"

patterns-established:
  - "Gate before publish: every push or tag path checks prepush-scan.cjs --history exit 0 / PASS 7/7 first"

requirements-completed: []
requirements-partial: [REL-02]

coverage:
  - id: D1
    description: "prepush-scan.cjs tree mode: six gating checks over every tracked text file plus the hl-id review class; fail-first FAIL 1/6 on the pre-scrub tree (patient-id in exactly the five expected files, two hl-id review lines, no value printed)"
    requirement: REL-02
    verification:
      - kind: other
        ref: "Task 1 verify 1 -> SCAN-FAIL-FIRST-OK (node .planning/phases/06-release-v0-2-0/harness/prepush-scan.cjs, exit 1, FAIL 1/6)"
        status: pass
    human_judgment: false
  - id: D2
    description: "prepush-scan.cjs --history: gating history-patient-id check over origin/main..HEAD; fail-first FAIL 2/7 with exactly the six expected (commit, path) findings in 86b53d7, 1d5dc04, 4cd4085; unresolvable RANGE exits 2"
    requirement: REL-02
    verification:
      - kind: other
        ref: "Task 1 verify 2 -> HISTORY-FAIL-FIRST-OK, no-such-ref..HEAD exit 2"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tracked tree scrubbed of the three live-looking ids, line for line (5 files, added == removed per file), one commit with the exact subject; tree scan PASS 6/6, suite PASS 165/165, spec-check stage 3 PASS 46/46, check-phase05 PASS 24/24; history FAIL 1/7 only on history-patient-id"
    requirement: REL-02
    verification:
      - kind: unit
        ref: "Task 2 verify 1 -> T2-V1-OK (prepush-scan PASS 6/6, npm test PASS 165/165, spec-check --stage 3 PASS 46/46, check-phase05.sh PASS 24/24)"
        status: pass
      - kind: other
        ref: "Task 2 verify 2 -> TREE-CLEAN-HISTORY-PENDING, T2-V2-OK (exact subject once, numstat 5 files equal, no v0.2.0 tag, origin main 90c32eac)"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-10-08
status: complete
---

# Phase 6 Plan 02: Pre-push publication scan and patient-id tree scrub Summary

**`prepush-scan.cjs` is the publication gate. Tree mode runs six gating checks, and `--history` adds a gating patient-id check over every unpushed commit. It prints only class and location. Both modes were proven fail-first on the real repository. The three live-looking Hint patient ids in the tracked tree are now the synthetic ids `pat-EXAMPLEa1B2c`, `pat-EXAMPLEd4E5f`, and `pat-EXAMPLEg7H8i`, replaced in place in one commit. All suites and harnesses still pass at their baselines. History still fails, as expected, until Plan 06-03. No tag was created, nothing was pushed, and no history was rewritten.**

## Performance

- **Duration:** about 4 min
- **Started:** 2026-10-08T15:50:30Z
- **Completed:** 2026-10-08T15:54:33Z
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- **Scanner** (`harness/prepush-scan.cjs`, CommonJS, Node built-ins only, read-only, git via `spawnSync` argument arrays):
  - Tree mode checks every `git ls-files -z` text file (binaries skipped by a NUL in the first 8000 bytes) for `secret`, `patient-id`, `email`, `member-token`, `webhook-trigger`, and `consent-url`, plus the non-failing `hl-id` review class. The final line is `PASS 6/6` or `FAIL k/6`.
  - `--history [RANGE]` (default `origin/main..HEAD`) resolves the range before any output (an unresolvable or option-shaped RANGE exits 2). It scans each commit's full message and the added lines of `git show --unified=0 --no-renames --diff-merges=first-parent`. It prints `history - <class>: <sha7> <path|message>`, the `history: N commits, K findings` line, and the seventh check, `history-patient-id`, which gates. The final line is `PASS 7/7` or `FAIL k/7`.
- **Scrub:** each id was replaced in place with a same-length EXAMPLE id, consistently in every file. The mapping is one to one, and `-4` is kept after the second id. No old value was typed, echoed, or logged. The replacement script read the ids from their anchor lines and printed only lengths and per-line counts.

## Gate Results (class, sha7, and path only)

| When | Command | Result |
|------|---------|--------|
| Before scrub (Task 1) | `prepush-scan.cjs` | `FAIL 1/6`, exit 1. Nine `not ok - patient-id` lines in 05-02-PLAN.md:58, spec-check.cjs:372/374/376/377, README.md:98, src/ghl-customizer.js:91/92, test/run.mjs:4839. Two `review - hl-id` lines |
| After Task 1 commit | `prepush-scan.cjs --history` | `FAIL 2/7`, exit 1. `history: 72 commits, 57 findings`. `not ok - history-patient-id: 6 findings in 3 commits` |
| After Task 1 | `--history no-such-ref..HEAD` | usage error, exit 2 |
| After scrub (Task 2) | `prepush-scan.cjs` | `PASS 6/6`, exit 0. The same two `review - hl-id` lines |
| After scrub | `npm test` | `PASS 165/165` |
| After scrub | `spec-check.cjs --stage 3` | `PASS 46/46` |
| After scrub | `check-phase05.sh` | `PASS 24/24` |
| After scrub commit | `prepush-scan.cjs --history` | `FAIL 1/7`, exit 1. `history: 73 commits, 58 findings`. Only `not ok - history-patient-id: 6 findings in 3 commits` fails |

History lines after Task 2, excluding the message-email lines:

- `history - patient-id: 86b53d7 message`
- `history - patient-id: 86b53d7 README.md`
- `history - patient-id: 86b53d7 src/ghl-customizer.js`
- `history - patient-id: 86b53d7 test/run.mjs`
- `history - patient-id: 1d5dc04 .planning/phases/05-individual-consent-backend/harness/spec-check.cjs`
- `history - patient-id: 4cd4085 .planning/phases/05-individual-consent-backend/05-02-PLAN.md`
- `history - hl-id: 633647a .planning/notes/webhook-test-workflow-audit.md` (informational)
- `history - hl-id: 2441639 .planning/phases/04-actions-menu/04-UAT.md` (informational)
- 50 `history - email: <sha7> message` lines (informational). All of them are the Co-Authored-By trailer, a single public anthropic.com no-reply address; no other email domain occurs in an unpushed message.

**hl-id review locations (for Rob's D-02 decision; not redacted here):** `.planning/notes/webhook-test-workflow-audit.md:31` and `.planning/phases/04-actions-menu/04-UAT.md:36`, the same Xcelsior contact id in both.

## Task Commits

1. **Task 1 (tracer): publication gate end to end** - `4410c71` (feat). The tracer gate re-ran both verify commands after the commit: SCAN-FAIL-FIRST-OK / V1-OK and HISTORY-FAIL-FIRST-OK / V2-OK.
2. **Task 2: scrub the tracked tree** - `9c13f8a` (chore), subject `chore(06-02): replace live-looking Hint patient ids with synthetic examples before publishing`. numstat: 05-02-PLAN.md 1/1, spec-check.cjs 4/4, README.md 1/1, src/ghl-customizer.js 2/2, test/run.mjs 1/1.

Both shas change when Plan 06-03 rewrites the unpushed history, and its SUMMARY maps old to new.

## Files Created/Modified

- `.planning/phases/06-release-v0-2-0/harness/prepush-scan.cjs`: the publication gate (CLI `node prepush-scan.cjs [--history [RANGE]]`, exit 0/1/2)
- `src/ghl-customizer.js`: lines 91-92 comment only (EXAMPLE ids, "(live)" replaced by "synthetic examples of the wf1 key shape"). `SYNTHETIC_EMAIL_RE` is unchanged.
- `README.md`: line 98 example id
- `test/run.mjs`: line 4839 isSyntheticEmail vectors
- `.planning/phases/05-individual-consent-backend/harness/spec-check.cjs`: R-04 vectors at lines 372, 374, 376, 377
- `.planning/phases/05-individual-consent-backend/05-02-PLAN.md`: line 58 example id

## Decisions Made

See key-decisions in the frontmatter. In short:
- Each EXAMPLE id keeps the character offset of the id it replaces.
- The "(live)" wording is gone from the src comment, and no line was added.
- Message-trailer emails stay visible as informational history lines.

## Deviations from Plan

**1. [Process note] Committed on `main`.** The orchestrator dispatched this plan sequentially on the main working tree. `branching_strategy` is `none`, and the plan's stated output is two commits on main. Nothing was pushed or tagged.

**2. [Rule 2 - Hardening] Option-shaped RANGE rejected; merge diffs pinned to first parent.** `--history` refuses a RANGE starting with `-`, which would otherwise reach `git rev-list` as an option, and exits 2. `git show` also gets `--diff-merges=first-parent`, so a future merge commit shows its full diff instead of a combined diff that can hide added lines (threat T-06-19). The current range has no merges, so results are unchanged. Commit `4410c71`.

**3. [Note] The scrub commit carries the standard Co-Authored-By trailer after the exact subject.** The plan's checks and Plan 06-03 key on the subject, and the subject is exact.

**Total deviations:** 1 hardening addition (Rule 2) and 2 process notes. **Impact:** none on the specified behavior; every verify command passes as written.

## Issues Encountered

None.

## Expected Side Effect

The Phase 4 and Phase 5 VERIFICATION.md fingerprints (`04-VERIFICATION.md`, `05-VERIFICATION.md`) are now stale. The scrub changed `src/`, README, the suite, and spec-check, as happened at the v0.1.0 close. This is not a regression; the suite, spec-check, and check-phase05 are green at their baselines.

## Flagged Assumptions Carried Forward

- A-2: the three ids were treated as live because the source comment marked one "(live)". If Rob confirms they were synthetic, the scrub and the history cleanup are still harmless.

## User Setup Required

None.

## Next Phase Readiness

- **06-03** comes next. It rewrites origin/main..HEAD so that 86b53d7, 1d5dc04, and 4cd4085 lose the ids, using the mapping derived from `9c13f8a`. After that, `prepush-scan.cjs --history` must end `PASS 7/7`.
- 06-04 and 06-05 must check `prepush-scan.cjs --history` exit 0 before any release commit verification or push (D-02).
- The two hl-id review lines and the informational email lines are input to Rob's D-02 decision.
- State at the end of this plan: no `v0.2.0` tag, and origin main is still `90c32eac84ac23502e785a92a445df41b8747f12`.

## Self-Check: PASSED

- FOUND: .planning/phases/06-release-v0-2-0/harness/prepush-scan.cjs (tracked)
- FOUND: 4410c71, 9c13f8a (2 commits since plan_head_before cb3c810)
- prepush-scan tree `PASS 6/6`; history `FAIL 1/7` (history-patient-id only)
- No v0.2.0 tag; origin main 90c32eac84ac23502e785a92a445df41b8747f12

---
*Phase: 06-release-v0-2-0*
*Completed: 2026-10-08*

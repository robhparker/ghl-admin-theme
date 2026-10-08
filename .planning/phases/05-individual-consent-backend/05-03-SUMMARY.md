---
phase: 05-individual-consent-backend
plan: 03
subsystem: member-email-and-apply-docs
tags: [mjml, email, readme, apply-order, rollback, mirror, xcelsior, phase-gate]
status: complete

requires:
  - phase: 05-individual-consent-backend (05-01)
    provides: wf2 Build Status v9 JSON/diff, build-status-v9.js, COMPLETION-PATH.md (Q-1, Q-2, D-11), F-1, wf2 harness
  - phase: 05-individual-consent-backend (05-02)
    provides: BUILD-SPEC (template "Member Consent Forms", subject, V-01..V-11, R-01..R-09), F-2, F-3, spec-check
provides:
  - Member consent email "Your Xcelsior consent forms" (MJML + build.sh-compiled HTML, 26.5 KB) in Consent Hub Invite house style
  - email-check.cjs (9 checks, including fresh-compile equality)
  - Proposal README.md: index, F-1 warning, apply order with the n8n Publish reminder, wf2 node table plus generated v8->v9 diff, v9 paste block, rollback, Phase 6 checks, Q-1..Q-4
  - check-phase05.sh phase gate (22 checks, read-only)
affects: [06 release (consent webhook URL into config, live checklist), verify-work 05]

actuals:
  tokens: 21256
  tasks: 2
  commits: 2
plan_head_before: 2e84cafe0e926f62ac5ac9924af78f0466522466

tech-stack:
  added: []
  patterns:
    - "Fresh-compile proof for email HTML: re-run the cached mjml with build.sh's flags via -s from /tmp, strip the -s FILE banner, compare trimmed"
    - "Generated doc blocks: README diff and paste block spliced from the real files by script, then gated by an equality check"

key-files:
  created:
    - .planning/phases/05-individual-consent-backend/harness/email-check.cjs
    - .planning/phases/05-individual-consent-backend/harness/check-phase05.sh
    - .planning/phases/05-individual-consent-backend/deliverables/consent-forms-member.mjml
    - .planning/phases/05-individual-consent-backend/deliverables/consent-forms-member.html
    - .planning/phases/05-individual-consent-backend/deliverables/README.md
    - /Users/rhparker/Repos/clients/xcelsior/Email-Templates/Consent-Hub-Invite/consent-forms-member.mjml (untracked, canonical)
    - /Users/rhparker/Repos/clients/xcelsior/Email-Templates/Consent-Hub-Invite/consent-forms-member.html (untracked, canonical)
    - /Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/README.md (untracked, canonical)
  modified: []

key-decisions:
  - "Q-4 (F-3) recorded as resolved, not open: admin-theme 86b53d7 widened the client pre-check to /\\+(?:\\d+|pat-[A-Za-z0-9_-]+)@/; R-04 still refuses server-side"
  - "Phase gate checks xcelsior history with --branches --tags --remotes, excluding refs/t3/checkpoints/* (T3 client working-tree snapshots, not branch commits)"
  - "Phase 6 refusal checks use four outcomes per R-id: Note on the clicked record, reason-only notification, run ends, no email sent"

patterns-established:
  - "Phase gate: one read-only script proves mirrors, exact mirror set, foreign-repo git safety, all harnesses, secret scan, and doc structure, with ok/not ok lines and PASS n/n"

requirements-completed: [HUB-03, HUB-02]

coverage:
  - id: D1
    description: "Member email MJML in Consent Hub Invite style: member's own hub link, first-name greeting, 'for you personally', about ten minutes, only two merge fields, no dashes, no vendor names, header states paste target, subject, and click tracking OFF"
    requirement: HUB-03
    verification:
      - kind: unit
        ref: "node harness/email-check.cjs (link, merge, copy, dashes, vendor, style, header): PASS 9/9"
        status: pass
      - kind: other
        ref: "Mutation runs on /tmp copies: &mdash;, a vendor name, {{contact.email}}, 'stays on', renamed template each fail the checker"
        status: pass
    human_judgment: false
  - id: D2
    description: "Compiled HTML from build.sh (single-file run), 27172 bytes, equal to a fresh compile; no sibling template recompiled"
    requirement: HUB-03
    verification:
      - kind: unit
        ref: "email-check.cjs size: and fresh: checks"
        status: pass
      - kind: other
        ref: "git -C xcelsior diff --stat -- Email-Templates (empty); Consent-Hub-Invite shows exactly two ?? files"
        status: pass
    human_judgment: false
  - id: D3
    description: "Visual rendering of the member email (header, button, footer, mobile stack) in ClinX preview and real inboxes"
    requirement: HUB-03
    verification: []
    human_judgment: true
    rationale: "Visual and client-rendering quality cannot be asserted offline; Rob previews it after pasting (BUILD-SPEC 0.2) and in the Phase 6 test send"
  - id: D4
    description: "Proposal README: ten H2s in order, Publish reminder twice, F-1 base check, node table, generated diff, v9 paste block equal to the JSON jsCode, rollback order Draft -> clear adhoc_ -> v8 + Publish, Q-1..Q-4"
    requirement: HUB-02
    verification:
      - kind: unit
        ref: "bash harness/check-phase05.sh (readme: checks): PASS 22/22"
        status: pass
    human_judgment: true
    rationale: "Rob must confirm the Apply order and Rollback match how he works in n8n and ClinX, and answer Q-1..Q-3 (plan human-check)"
  - id: D5
    description: "Phase gate: all 7 canonical deliverables byte-identical to mirrors, exact mirror set, xcelsior untouched (no staged/tracked/branch commits, ?? only), all three harnesses PASS, no PIT pattern"
    verification:
      - kind: unit
        ref: "bash harness/check-phase05.sh: PASS 22/22; negative control (mirror byte change + stray file) FAIL 2/22"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-08
---

# Phase 5 Plan 03: Member Consent Email, Proposal README, and Phase Gate Summary

**I built the member email "Your Xcelsior consent forms" as house-style MJML and compiled it with build.sh to 26.5 KB of HTML linking the member's own `consent_hub_token`. email-check proves the link, merge fields, copy, and dash- and vendor-free text (PASS 9/9). The proposal README gives Rob one apply order (wf2 v9 published first), a paste block proven equal to the JSON, and a safe rollback. A read-only phase gate proves all seven deliverables match their mirrors and xcelsior is untouched (PASS 22/22).**

## Performance

- **Duration:** about 6 min
- **Started:** 2026-10-08T03:30:20Z
- **Completed:** 2026-10-08T03:36Z
- **Tasks:** 2 (both committed)
- **Files:** 5 committed in admin-theme, plus 3 untracked canonical files in xcelsior

## Accomplishments

- **Member email (HUB-03, D-13).** `consent-forms-member.mjml` follows the solo and family siblings section for section: the same palette, fonts, logo, footer, and legal line. Copy: pill "Your Forms", hero "Your consent forms are ready", greeting `Hi <strong>{{contact.first_name}}</strong>,`, "These forms are for you personally", "Complete My Forms" pointing at `https://join.xcelsiorhealth.com/consent-hub?t={{contact.consent_hub_token}}`, and a "Good to know" box. The header comment names the paste target "Member Consent Forms", the subject, the workflow "[Ready] Admin Menu: Consent Actions (webhook)", and "Click tracking stays OFF in the email action". The body comments are dash-free, unlike the siblings'.
- **Compiled HTML:** `build.sh Consent-Hub-Invite/consent-forms-member.mjml` printed `26.5 KB [OK]` (27172 bytes, Gmail clip limit 102400). It ran with the file argument only, so no sibling was recompiled (`git diff --stat -- Email-Templates` is empty).
- **email-check.cjs: PASS 9/9.** Mutation runs fail as expected for an `&mdash;`, a vendor name, an extra merge field, a "stays on" header, and a renamed template.
- **README.md:** ten H2s in order. The Publish sentence appears in apply step 1 and rollback step 3. It has the F-1 base check (`// v8: PART-1 PREFILL`, versionId `dbe383be-ac63-433a-af8e-5564d948aec9`, never import), a 15-row node table, a `diff -u` of v8 against v9 generated by command (53 lines), the v9 paste block spliced from the JSON `jsCode`, an `adhoc_` touchpoint table, a five-step rollback, the Phase 6 checks (COMPLETION-PATH items 1-5, V-01..V-11, an R-01..R-09 four-outcome table, pass outcomes), and the open questions.
- **check-phase05.sh: PASS 22/22.** A negative control (one changed mirror byte plus a stray file) gives FAIL 2/22, and the files were restored.

## Final deliverables (canonical, untracked in xcelsior; mirrored in admin-theme `deliverables/`)

| File | Canonical absolute path |
|---|---|
| BUILD-SPEC-clinx-consent-webhook.md | /Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/BUILD-SPEC-clinx-consent-webhook.md |
| wf2-consent-hub-status.member-scope.json | /Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/wf2-consent-hub-status.member-scope.json |
| wf2-member-scope.diff | /Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/wf2-member-scope.diff |
| COMPLETION-PATH.md | /Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/COMPLETION-PATH.md |
| README.md | /Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/README.md |
| consent-forms-member.mjml | /Users/rhparker/Repos/clients/xcelsior/Email-Templates/Consent-Hub-Invite/consent-forms-member.mjml |
| consent-forms-member.html | /Users/rhparker/Repos/clients/xcelsior/Email-Templates/Consent-Hub-Invite/consent-forms-member.html |

There is no `hub-page.diff` (D-11 no change).

## Task Commits

1. **Task 1 (tracer): member email, compiled HTML, email checker, mirrors**: `32df306` (docs)
2. **Task 2: proposal README and phase gate**: `bd60701` (docs)

Tracer gate: auto mode is on (`workflow.auto_advance` true) and the tracer `<verify>` re-ran green, so expansion proceeded with no checkpoint.

## Q-1..Q-4 carried to Phase 6 (README "Open questions")

- **Q-1** Attestation radio: an adult member sees `form_behalf=Child` preselected. A one-line change if Rob wants "Self". Ships as-is.
- **Q-2** The member's hub shows the family heading and intro. Cosmetic, not proposed.
- **Q-3** Token length (F-2): owners use 16 bytes, members 32 bytes (`adhoc_`). Kept at 32. Rob to confirm.
- **Q-4** Synthetic-email client pre-check (F-3): **resolved** by admin-theme 86b53d7. R-04 still refuses server-side.
- Also carried: sandbox token holders without `member_type` (05-01, Phase 6 check 5), and V-01..V-11 to tick in BUILD-SPEC §10.

## Decisions Made

- Q-4 is recorded as resolved (86b53d7), per the orchestrator note and the 05-02 summary.
- The refusal live checks use four outcomes per R-id: a Note on the clicked record, a reason-only notification, the run ends, and no email is sent. These are the refusal pattern's observable results (BUILD-SPEC §0.5).
- The gate checks xcelsior history with `--branches --tags --remotes` (see the deviations below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] email-check fresh-compile comparison included the `mjml -s` banner**
- **Found during:** Task 1 (first green run)
- **Issue:** The plan's `npx mjml <file> -s` prints a leading `<!-- FILE: <path> -->` line that build.sh's `-o` never writes, so the check reported a mismatch at offset 2 for a correct build.
- **Fix:** Strip exactly that banner (for this input path), then compare the trimmed text.
- **Files modified:** harness/email-check.cjs
- **Verification:** PASS 9/9. Mutated HTML still fails `fresh:`.
- **Committed in:** 32df306

**2. [Rule 1 - Bug] The header click-tracking check was too loose**
- **Found during:** Task 1 mutation run
- **Issue:** The same header line also says "Track link clicks = OFF", so changing "stays OFF" to "stays on" still passed.
- **Fix:** Require "click tracking stays OFF in the email action" on one line.
- **Files modified:** harness/email-check.cjs
- **Verification:** the "stays on" mutation now fails `header:`.
- **Committed in:** 32df306

**3. [Rule 1 - Bug] check-phase05.sh failed to parse under macOS bash 3.2, and `git log --all` matched tool snapshot refs**
- **Found during:** Task 2 (first gate run)
- **Issue:** (a) A quoted heredoc with backticks inside `$(...)` gave "unexpected EOF". (b) `git log --all` matched `refs/t3/checkpoints/*/turn/4` (77c9482). That is a per-turn working-tree snapshot from Rob's T3 client. It is on no branch, and I did not create it (I ran no git write in xcelsior). The plan's own verify uses `git log` without `--all`.
- **Fix:** (a) The node program is written to a mktemp file and then run. (b) The log check uses `--branches --tags --remotes`, with a comment explaining the exclusion.
- **Files modified:** harness/check-phase05.sh
- **Verification:** `bash -n` OK. Gate PASS 22/22. The negative control fails as expected.
- **Committed in:** bd60701

---

**Total deviations:** 3 auto-fixed (all in this plan's own checkers). **Impact:** none on the deliverables. No check was weakened. #2 tightened a check, and #3b now matches the plan's stated scope (branch history).

## Issues Encountered

- build.sh printed the expected cssnano warning. Nothing was installed.
- **Observation for Rob:** the xcelsior repo has 10 `refs/t3/checkpoints/*` refs created by T3 while sessions ran. At least one snapshot (77c9482) includes the untracked proposal files. These refs are local only and on no branch. If they are ever pushed (for example by `git push --mirror`), the proposal files would go with them. No action was taken.

## Pending human verification

- **Visual email preview:** after pasting into "Member Consent Forms", confirm the header, the button, the footer, and the mobile layout in the ClinX preview. In the Phase 6 test send (test contact only), the button link must end in `?t=adhoc_` plus 64 hex (V-09) and open a hub with one card.
- Rob reads the README "Apply order" and "Rollback" top to bottom and confirms they match how he works in n8n and ClinX. He then answers Q-1..Q-3, or marks them for Phase 6.
- Every 05-01/05-02 live item: the GHL `eq` search on an `adhoc_` value, V-01..V-11, and the R-01..R-09 outcomes.

## Known Stubs

None. The empty result cells in the README's Phase 6 refusal table are a deliberate checklist for the live run.

## User Setup Required

None from this plan. Rob applies everything by hand in the README order (wf2 v9 Publish, template paste, workflow build, rename).

## Next Phase Readiness

- Phase 5 is complete (3/3 plans). Phase 6 puts the consent webhook URL into both admin-theme items and runs the README "Phase 6 live checks".
- No blockers.

## Self-Check: PASSED

- FOUND: email-check.cjs, check-phase05.sh, all 7 mirrors, and all 3 new xcelsior canonical files.
- FOUND commits: 32df306 and bd60701 (`git rev-list --count 2e84caf..HEAD` = 2 before this summary).
- Plan verification: email-check PASS 9/9. check-phase05 PASS 22/22. `git -C xcelsior diff --stat -- hint-api Email-Templates` is empty. xcelsior shows only `??` for the 7 phase paths.

---
*Phase: 05-individual-consent-backend*
*Completed: 2026-10-08*

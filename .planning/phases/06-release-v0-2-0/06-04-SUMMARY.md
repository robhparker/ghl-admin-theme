---
phase: 06-release-v0-2-0
plan: 04
subsystem: release
tags: [release, consent-webhook, config, d-01]

requires:
  - phase: 06-release-v0-2-0
    provides: 06-01 v0.2.0 bump and live checklist, 06-02 prepush-scan.cjs, 06-03 cleaned unpushed history
provides:
  - The release commit 67cb44c0680986755c8a9c2af2dceba13a052db2 (untagged, unpushed) with the consent trigger URL in both consent items
  - CONSENT_TRIGGER_RE and the shipped-config assertions proving each consent item posts to the one consent webhook with its own buttonId
  - README consent docs and the AR-03-01 note for two public webhook URLs
affects: [06-05, phase-6-verification]

actuals:
  tokens: 2800
  tasks: 2
  commits: 1
plan_head_before: 915e8bbb729e78a7fe5515af99e56569119146b8

tech-stack:
  added: []
  patterns:
    - "Secret-adjacent values (a public webhook trigger) live in exactly one tracked file; tests derive them from the parsed config and assert their absence elsewhere"

key-files:
  created: []
  modified:
    - config/agency-config.json
    - test/run.mjs
    - README.md

key-decisions:
  - "The consent trigger URL was written by an exact two-line text edit (numstat 2 2), never by re-serializing the JSON"
  - "test/run.mjs never holds the consent URL or its id as a literal; the config check and the shipped-config scenario read it from the parsed sample config"
  - "The release commit landed directly on main as the plan, branching_strategy none, and the orchestrator specify, although the executor's protected-branch query flags main"
  - "ClinX consent workflow redesigned during the pilot (V-05: HighLevel binds a webhook run to the first Find Contact): one Find Contact per run; Branch A drops the owner email compare (D-04 alternative, residual risk accepted); Reload member removed in favour of V-09b; Branch B member path forwards to the same trigger with a forwarded marker and an R-13 loop guard; member token minted with Python secrets (V-08)"

patterns-established:
  - "Release-commit proof: suite count unchanged, tree scan, and history scan all re-run on the committed HEAD before the plan closes"

requirements-completed: [REL-02]

coverage:
  - id: D1
    description: "Both consent items carry one identical consent trigger URL that matches the D-01 shape for Xcelsior Health, differs from Send Invite, and appears only in config/agency-config.json; no other config field changed"
    requirement: REL-02
    verification:
      - kind: other
        ref: "Task 2 verify 2 -> RELEASE-COMMIT-READY (node shape/equality/cooldown/extraFields check, git grep -lF on the trigger id lists only the config, numstat 2 2, no v0.2.0 tag local or remote, origin main still 90c32eac)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Suite proves both consent items render ready on an Xcelsior record and each posts the standard payload to the one consent URL with its own buttonId; the empty-url D-15 scenario is unchanged; count stays 165"
    requirement: REL-02
    verification:
      - kind: unit
        ref: "npm test -> PASS 165/165"
        status: pass
    human_judgment: false
  - id: D3
    description: "Publication gate clean on the tree and on the unpushed history including the release commit"
    requirement: REL-02
    verification:
      - kind: other
        ref: "prepush-scan.cjs -> PASS 6/6 (consent-url ok); prepush-scan.cjs --history -> PASS 7/7"
        status: pass
    human_judgment: false
  - id: D4
    description: "First real press of each consent item on a test contact, and Rob's mailbox confirmation of pilot runs 0101-0106"
    requirement: REL-02
    verification:
      - kind: manual
        ref: "06-LIVE-CHECKLIST.md P, M, R, H rows; Plan 06-05 D-02 decision"
        status: pending
    human_judgment: true

duration: 2min
completed: 2026-10-10
status: complete
---

# Phase 6 Plan 04: Wire the consent Inbound Webhook (release commit) Summary

**The consent trigger URL now sits in both `send-individual-consent` and `resend-consent-hub` in config/agency-config.json, and nowhere else in the tree. The suite proves each item posts the standard payload to it with its own buttonId, the README no longer calls the items Not configured, and the tree and history scans are clean. HEAD is the release commit `67cb44c0680986755c8a9c2af2dceba13a052db2`, untagged and unpushed.**

## Performance

- **Duration:** about 2 min (Task 2 only; Task 1 was Rob's ClinX build and pilot)
- **Started:** 2026-10-10T04:34:39Z
- **Completed:** 2026-10-10T04:36Z
- **Tasks:** 2 (Task 1 human checkpoint, Task 2 tracer)
- **Files modified:** 3

## Task 1: URL checks (no value recorded)

Rob pasted the consent trigger URL together with "pilot gate passed". The orchestrator validated it before this executor ran, and the Task 2 node check re-validated it from the committed file:

1. The pilot-gate statement was present.
2. The trimmed value matches the D-01 shape: the Xcelsior Health location (Cp2XxBsRoyKS2CUf1Hwi) plus a lowercase uuid.
3. Its trigger id is not the Send Invite trigger.

No automation POSTed to the URL. The suite's fetch shim intercepts every request.

## Accomplishments

- **Config.** An exact text edit replaced the two `"url": ""` lines (`git diff --numstat`: `2 2`). The cooldowns (60000), the `extraFields`, the `requires` rule, and the Send Invite URL are unchanged.
- **Tests** (test/run.mjs; existing checks changed, none added, so the count stays 165):
  - Added the `CONSENT_TRIGGER_RE` constant next to `SECRET_KEY_RE`.
  - The config check now asserts four things: the two consent urls are equal, they match `CONSENT_TRIGGER_RE`, they differ from the Send Invite url, and README.md does not contain the consent trigger id.
  - The shipped-config Xcelsior scenario now expects both consent items to be `ready`. A press on Resend Consent Hub link (log entry 2) and a press on Send individual consent (log entry 3) each POST the standard payload to the consent URL read from the config, with `buttonId` `resend-consent-hub` and `send-individual-consent` respectively and `contactId` `c1`.
  - Reworded the MENU_CONSENT_HOOK scenario comment. The empty-url D-15 scenario is untouched.
- **README.**
  - The JSON example uses the `hooks/...` placeholder for both consent items.
  - Added the sentence "The shipped config carries that URL in both items." with the instruction for setting `url` back to `""`.
  - Security notes now say the config holds two Inbound Webhook URLs and explain how to rotate the consent one.

## Verification Lines

```
PASS 165/165          (npm test)
PASS 6/6              (prepush-scan.cjs; ok - consent-url: both consent items share one trigger, distinct from Send Invite, only in config/agency-config.json)
PASS 7/7              (prepush-scan.cjs --history, after the commit)
RELEASE-COMMIT-READY  (Task 2 verify 2)
```

Tracer gate: auto mode is on, so both verify commands were re-run end to end on the committed HEAD. Both passed.

## Task Commits

1. **Task 1: Rob builds and pilots the consent workflow** — no commit (human checkpoint)
2. **Task 2: Release commit** — `67cb44c0680986755c8a9c2af2dceba13a052db2` (feat)

## ClinX Workflow Pilot Context (recorded from the orchestrator)

During the pilot, Rob found that HighLevel binds a webhook run to the first Find Contact step and skips any later ones (V-05). He approved this redesign:

- **One Find Contact per run.**
- **Branch A** uses the spec's D-04 alternative: the owner email comparison is dropped, and the residual risk is accepted.
- **"Reload member" removed.** It is replaced by the new check V-09b (the saved token equals the minted token after the 1 minute wait), which passed.
- **Branch B member path** forwards with a Custom Webhook POST to the same trigger, carrying the owner's contactId and a `forwarded` marker. A loop guard (R-13) refuses forwarded requests that land on a contact with an owner link.
- **Member token mint** uses Python `secrets` with a behaviour guard. V-08 passed.
- **Pilot runs 0101-0106** all passed on the run logs. **Rob's mailbox confirmation is still pending. It is a prerequisite for the Plan 06-05 push decision.**

## Follow-up Owed

- BUILD-SPEC §4.4, §4.6, §5.2, §8, and §10 (`.planning/phases/05-individual-consent-backend/deliverables/BUILD-SPEC-clinx-consent-webhook.md`) do not yet describe the redesign above. This needs a separate docs update; this plan did not edit the BUILD-SPEC.

## Deviations from Plan

**1. [Process] Committed on main despite the protected-branch assertion**
- **Found during:** Task 2 commit
- **Issue:** `git.base-branch --is-protected main` returns true, so the executor's pre-commit HEAD assertion would refuse.
- **Resolution:** The plan's objective ("one commit on main"), `git.branching_strategy: none`, and the orchestrator's sequential no-worktree instruction all put the release commit on main, as Plans 06-01 to 06-03 did. The executor committed by explicit paths only, with no tag and no push.

**2. [Process] REL-02 left Pending in REQUIREMENTS.md**
- `requirements.mark-complete REL-02` checked it off. The executor reverted only that file, because REL-02 also covers the approved v0.2.0 tag and push (Plan 06-05), and Plans 06-01 to 06-03 likewise left it Pending.

No code deviations. The plan was executed as written.

## Known Stubs

None.

## Next Step

Rob walks the 06-LIVE-CHECKLIST.md P, M, R, and H rows (`checklist-gate.cjs --pre-release` shows progress) and confirms the pilot-run emails in his mailboxes. He then answers the Plan 06-05 D-02 decision. Plan 06-05 checks that `67cb44c0680986755c8a9c2af2dceba13a052db2` is an ancestor of the tagged commit, with no shipped-file change since.

## Self-Check: PASSED

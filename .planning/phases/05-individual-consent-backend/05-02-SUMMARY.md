---
phase: 05-individual-consent-backend
plan: 02
subsystem: clinx-workflow-spec
tags: [clinx, highlevel-workflow, inbound-webhook, build-spec, docs, xcelsior, harness]
status: complete

requires:
  - phase: 04-actions-menu
    provides: send-individual-consent / resend-consent-hub item ids posted as buttonId (url '' until Phase 6)
  - phase: 05-individual-consent-backend (05-01)
    provides: wf2 Build Status v9 member scope (spec §0 apply-order prerequisite), proof that no consumer checks token length
provides:
  - BUILD-SPEC-clinx-consent-webhook.md, a 12-section click-by-click ClinX build spec for "[Ready] Admin Menu: Consent Actions (webhook)" and the Send Invite rename
  - harness/spec-check.cjs, a staged checker (stage 3 = 26 checks), including a runtime test of the Custom Code adhoc_ token mint
  - Refusal register R-01..R-09 and verify-in-ClinX-UI checklist V-01..V-11 for Rob's build
affects: [05-03 README and mirror sweep, 06 release (consent webhook URL into config, live checklist)]

actuals:
  tokens: 13244
  tasks: 3
  commits: 3
plan_head_before: 5eeeb26f1c62de2487b5d9a562f7a30906711167

tech-stack:
  added: []
  patterns:
    - "Staged doc checker: cumulative --stage N content checks plus execution of the spec's own code region via new Function with injected crypto/require to prove each runtime path"
    - "Refusal pattern for ClinX workflows: restore the clicked contact by payload contactId, Note, Internal Notification (ids and reason only), End"

key-files:
  created:
    - .planning/phases/05-individual-consent-backend/harness/spec-check.cjs
    - .planning/phases/05-individual-consent-backend/deliverables/BUILD-SPEC-clinx-consent-webhook.md
    - /Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/BUILD-SPEC-clinx-consent-webhook.md (untracked, canonical)
  modified: []

key-decisions:
  - "Member token = adhoc_ + 64 lowercase hex (32 bytes) from crypto.getRandomValues or require('crypto').randomBytes, throwing otherwise; never Math random (F-2, D-05a)"
  - "R-04 adds a third OR condition, Email contains +{{contact.hint_patient_id}}@, because wf1 never applies the synthetic-email tag (F-3); falls back to the two D-04 conditions if V-10 fails"
  - "§5.4 resend uses one four-branch If/Else in d6cf9af1's live order (LP Family, LP Solo, Family, None) and binds the templates d6cf9af1 actually binds"
  - "Every refusal restores the clicked contact by {{inboundWebhookRequest.contactId}} before its Note when an earlier Find Contact may have moved the context"

patterns-established:
  - "Spec-as-contract: every uncertain ClinX UI behavior carries a numbered 'verify in ClinX UI (V-xx)' line with a fallback, collected in a tickable checklist"

requirements-completed: [CONS-01, CONS-02, CONS-03, CONS-04, CONS-05, CONS-06]

coverage:
  - id: D1
    description: "Spec §1-§3: one Inbound Webhook trigger, Find Contact by {{inboundWebhookRequest.contactId}} only, R-01 not-found notification, If/Else on buttonId with R-02 None branch"
    requirement: CONS-01
    verification:
      - kind: unit
        ref: "node harness/spec-check.cjs --stage 3 (checks a, b, b2, c, e, f)"
        status: pass
    human_judgment: true
    rationale: "Whether ClinX behaves as the spec assumes (V-01, V-02, V-03) is only provable while building and in the Phase 6 live run"
  - id: D2
    description: "Spec §4.1-§4.5: R-03..R-07 guards in D-04 order with verbatim refusal texts and member-context restores"
    requirement: CONS-02
    verification:
      - kind: unit
        ref: "spec-check stage 2 checks g, h, i, k"
        status: pass
    human_judgment: true
    rationale: "V-05 (Find Contact context switching) and V-10 (merge field in a contains value) need the ClinX UI"
  - id: D3
    description: "Every refusal writes a Note on the clicked record plus an internal notification with reason and fix; register §9 has nine rows identical to the inline texts"
    requirement: CONS-03
    verification:
      - kind: unit
        ref: "spec-check stage 3 checks h, o"
        status: pass
    human_judgment: false
  - id: D4
    description: "Spec §4.6-§4.7: Custom Code mints adhoc_ + 64 hex from crypto only, Update Contact Field writes it before the Member Consent Forms email, consent-pending tag, Note"
    requirement: CONS-04
    verification:
      - kind: unit
        ref: "spec-check stage 2 checks j, k, l, m0-m5 (web-crypto path, require path, distinct tokens, no-crypto throws, no Math random in region)"
        status: pass
      - kind: other
        ref: "Mutation runs: Math random fallback, 16-byte token, fixed token each fail the checker"
        status: pass
    human_judgment: true
    rationale: "V-06..V-09 and V-11 (Custom Code availability, output merge syntax, runtime crypto, write visibility, no token-change triggers) need the ClinX UI"
  - id: D5
    description: "Spec §5: resend-consent-hub from owner or member record, R-08/R-09, four d6cf9af1 leaves, Track clicks OFF, owner Note"
    requirement: CONS-05
    verification:
      - kind: unit
        ref: "spec-check stage 1 checks b, e, f"
        status: pass
    human_judgment: true
    rationale: "Template bindings and subjects must be copied from d6cf9af1 in the UI"
  - id: D6
    description: "Spec §6-§7, §10: Allow re-entry, reload-after-save, Draft then sample then Publish, Publish-in-n8n reminder, Send Invite rename, V-01..V-11 checklist"
    requirement: CONS-06
    verification:
      - kind: unit
        ref: "spec-check stage 3 checks b, d, n, p, q, r, s"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-08
---

# Phase 5 Plan 02: ClinX Consent Webhook Build Spec Summary

**I wrote a 12-section, click-by-click ClinX build spec for the consent Inbound Webhook workflow. It resolves the contact by ID, branches on buttonId, and enforces nine reasoned refusals. A runtime-tested Custom Code step mints a cryptographic `adhoc_` member token before the "Member Consent Forms" email. The staged checker passes stage 3 with 26/26.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-08T03:21:26Z
- **Completed:** 2026-10-08T03:28:29Z
- **Tasks:** 3
- **Files:** 2 committed in admin-theme, plus 1 untracked canonical file in xcelsior

## Accomplishments

- **Spec**: 12 H2s in the fixed order. §0 makes publishing wf2 v9 the first prerequisite, with the line "n8n changes do not ship until you click Publish." §1 to §3 cover the trigger, the fake-data curl sample, and Find Contact by `{{inboundWebhookRequest.contactId}}` ("Never match on email or phone."). §4 covers send-individual-consent and §5 covers resend-consent-hub. §6 has the settings and the reload-after-save rule. §7 renames Send Invite. §8 covers AR-03-01. §9 is the refusal register, §10 is the V-checklist, and §11 is rollback.
- **Checker**: `harness/spec-check.cjs --stage 1|2|3` uses Node built-ins only. Stage 1 = 7 checks, stage 2 = 20, stage 3 = **PASS 26/26**. Stage 2 failed as required before §4 existed. Three mutations (a Math random fallback, a 16-byte token, a fixed token) each make the checker fail.
- **Mirror**: `deliverables/BUILD-SPEC-clinx-consent-webhook.md` is `cmp`-identical to the canonical file. The xcelsior proposal folder shows only `??` lines, and there are no staged, tracked, or logged changes under hint-api/ or Email-Templates/.

## Canonical file (xcelsior, untracked, never staged)

- `/Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/BUILD-SPEC-clinx-consent-webhook.md`

## Findings recorded in the spec

- **F-2 (token length):** wf1 mints owner tokens with `crypto.randomBytes(16).toString('hex')` (32 hex) in Build Dependents and Prep Owner Update (Solo). Member tokens are `adhoc_` + 64 hex (32 bytes, 70 chars total) per D-05a. No consumer checks length (05-01 harness). The prefix rules out a clash with an owner token.
- **F-3 (synthetic-email gap):** wf1's Tag Dependent writes only `family-member` and `consent-pending`. `synthetic-email` exists only on the 17 contacts tagged in the 2026-08-26 unified review. R-04 keeps both D-04 #2 conditions and adds `Email contains +{{contact.hint_patient_id}}@` as a labeled planner addition with the same message. If V-10 fails, the residual risk is stated: plus-addressing delivers the mail to the owner's inbox, which is confusing but not a disclosure. The admin-theme client pre-check was already widened to `/\+(?:\d+|pat-[A-Za-z0-9_-]+)@/` in 86b53d7, so the "Phase 4 code note" the plan expected 05-03 to record is already resolved. 05-03's README should say it is done, not open.
- **F-4 (LP template names, new):** the four d6cf9af1 templates used in §5.4 are listed below. The plan's LP names came from the LP handoff's suggestions. The templates actually bound live are different (phase0 FINDINGS item 3, 2026-08-24, and the 2026-08-06 LP FINDINGS):

| Leaf (d6cf9af1 order) | Condition | Name in the plan / handoff | Template bound live | Subject |
|---|---|---|---|---|
| LP Family | `longevity-member` AND Dependent Count > 0 | Longevity Plus Family Consent Hub Invite | Longevity Family Consent Invite | Complete your family's Longevity Plus forms |
| LP Solo | `longevity-member` | Longevity Plus Consent Hub Invite | Longevity Consent Invite | {{contact.first_name}}, your Longevity Plus forms are ready |
| Family | Dependent Count > 0 | Family Consent Hub Invite | Family Consent Hub Invite | Complete your family's consent forms |
| None | fallback | Consent Hub Invite | Consent Hub Invite | {{contact.first_name}}, your consent forms are ready |

The spec carries both names and tells Rob to copy each binding and subject from d6cf9af1 read-only.

## V-01..V-11: what Rob must tick during the build (spec §10)

| Id | Check |
|---|---|
| V-01 | After Find Contact, `{{contact.*}}` and the email recipient are the found contact |
| V-02 | How `{{inboundWebhookRequest.buttonId}}` appears in the If/Else picker |
| V-03 | The captured trigger sample includes `buttonId` |
| V-04 | Track link clicks OFF on every Send Email |
| V-05 | Find Contact switches context; "Restore member" switches back; a failed Find Contact leaves the member; equals case sensitivity |
| V-06 | Custom Code is available on the plan (Premium) |
| V-07 | Custom Code output variable name and the merge syntax for `token` |
| V-08 | Crypto exists in the Custom Code runtime (Test your Code returns `adhoc_` + 64 hex) |
| V-09 | The token written by Update Contact Field shows in the next Send Email's link |
| V-10 | A "contains" value resolves `+{{contact.hint_patient_id}}@` per contact (planner addition) |
| V-11 | No workflow triggers on a Consent Hub Token change (planner addition) |

## Task Commits

1. **Task 1: Tracer (spec §0-§3, §5, §6, checker for all three stages, mirror)**: `caaa890` (docs)
2. **Task 2: Spec §4, send-individual-consent (R-03..R-07, adhoc_ mint, side effects)**: `0d8d226` (docs)
3. **Task 3: Spec §7-§11 (rename, AR-03-01, register, checklist, rollback)**: `b6d1532` (docs)

## Decisions Made

- §5.4 uses one four-branch If/Else in d6cf9af1's live order instead of nested If/Elses. The routing is the same, and it mirrors what Rob already maintains.
- HighLevel branches do not rejoin, so §4.6 tells Rob to put a Go To action under the "token exists" branch, or to repeat 4.7's three actions there.
- R-08's not-found path restores the member explicitly, so the Note lands on the clicked record whatever V-05 shows.
- V-09 gets a fallback: a refetch Find Contact after the token write.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Accuracy] LP template names in §5.4**
- **Found during:** Task 1
- **Issue:** The plan's LP names ("Longevity Plus Family Consent Hub Invite", "Longevity Plus Consent Hub Invite") were the 2026-08-06 handoff's suggestions. d6cf9af1 actually binds "Longevity Family Consent Invite" and "Longevity Consent Invite". Following the plan as written would have Rob search for templates that do not exist.
- **Fix:** The §5.4 table lists both names, with the live binding marked as the one to use. The LP subjects come from the 2026-08-06 FINDINGS. The checker's required strings are unchanged.
- **Files modified:** spec (canonical and mirror)
- **Commit:** caaa890

### Additions within scope

- The checker gains `(b2)` (all eight payload keys are table rows) and `(i2)` (V-05..V-11 use the exact marker form). The snippet checks report "no snippet" when the region is absent, so they never pass vacuously.
- Mutation tests were run, then discarded (temp files only).

**Total deviations:** 1 auto-fixed. **Impact:** the spec matches the live d6cf9af1.

## Issues Encountered

- `gsd-tools query git.base-branch --is-protected main` returns true. The dispatch says local commits on `main` are intended for this sequential run (as in 05-01), so the commits went to local `main` and nothing was pushed.
- The security-guidance hook flagged `new Function()` in the checker. Check (m) requires it to run the spec's own repo-authored snippet, and no external input reaches it. The file header documents this.

## Known Stubs

None. `PASTE_CONSENT_WEBHOOK_URL_HERE` in §1.4 is a deliberate placeholder: the URL exists only once Rob creates the trigger, and it is kept out of docs.

## Pending human verification

- Rob builds the workflow in ClinX following the spec, ticks V-01..V-11 in §10 (several need the Phase 6 live run log), and confirms the d6cf9af1 bindings and subjects he copies.
- Phase 6: the live run of both branches with test contacts (never real patients), then the consent webhook URL goes into both admin-theme items.

## User Setup Required

None from this plan. Rob builds the ClinX workflow by hand after wf2 v9 is published (05-03 README apply order).

## Next Phase Readiness

- 05-03 can reference this spec in the README apply order, run the final mirror `cmp` sweep across all four deliverables, and drop the "client regex misses +pat-" note (resolved by 86b53d7).
- No blockers.

## Self-Check: PASSED

- FOUND: `harness/spec-check.cjs`, `deliverables/BUILD-SPEC-clinx-consent-webhook.md`, and the canonical xcelsior spec (`cmp` identical).
- FOUND commits: caaa890, 0d8d226, b6d1532 (`git rev-list --count 5eeeb26..HEAD` = 3 before this summary).
- `spec-check --stage 3`: PASS 26/26. The xcelsior proposal folder is untracked only, with no tracked or staged change under hint-api/ or Email-Templates/.

---
*Phase: 05-individual-consent-backend*
*Completed: 2026-10-08*

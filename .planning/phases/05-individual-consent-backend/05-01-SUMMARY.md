---
phase: 05-individual-consent-backend
plan: 01
subsystem: n8n-wf2
tags: [n8n, wf2, consent-hub, harness, docs, xcelsior]

requires:
  - phase: 04-actions-menu
    provides: send-individual-consent / resend-consent-hub menu items (url '' until Phase 6)
provides:
  - wf2 Build Status v9 (member scope) as an edited workflow JSON and unified diff, synced to the live v8 roster
  - 22-check offline harness proving member scope, owner byte-identity, adhoc_ token acceptance, hub v11 render and return-to-hub
  - COMPLETION-PATH.md (HUB-04 trace, D-11 no-hub-change decision, Q-1/Q-2, Phase 6 live checks)
affects: [05-02 ClinX build spec, 05-03 README and mirror sweep, 06 release]

actuals:
  tokens: 24800
  tasks: 3
  commits: 3
plan_head_before: a041fb11a4e22357bdd444af0efa324127b26b0d

tech-stack:
  added: []
  patterns:
    - "Offline node-level n8n harness: run real Code-node jsCode via new Function('$', '$input', code) with stubbed upstream nodes; evaluate ={{ }} expressions the same way"
    - "Repo n8n mirror serializer: JSON.stringify(obj, null, 2) with U+007F+ escaped as lowercase \\uXXXX, no trailing newline (round-trip asserted before building a diff)"

key-files:
  created:
    - .planning/phases/05-individual-consent-backend/harness/build-status-v9.js
    - .planning/phases/05-individual-consent-backend/harness/build-wf2.cjs
    - .planning/phases/05-individual-consent-backend/harness/wf2-member-scope.harness.cjs
    - .planning/phases/05-individual-consent-backend/deliverables/wf2-consent-hub-status.member-scope.json
    - .planning/phases/05-individual-consent-backend/deliverables/wf2-member-scope.diff
    - .planning/phases/05-individual-consent-backend/deliverables/COMPLETION-PATH.md
    - /Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/wf2-consent-hub-status.member-scope.json (untracked)
    - /Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/wf2-member-scope.diff (untracked)
    - /Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/COMPLETION-PATH.md (untracked)
  modified: []

key-decisions:
  - "wf2 deliverable is the repo copy synced to the live v8 roster (Lookup Member Docs removed, Refetch Member -> Build Status) plus v9, so applying it cannot roll live back to v6 (F-1)"
  - "v9 member rule: holder is a member when owner_contact_id is set or member_type is not 'owner'; legacy shape (both empty) fails closed to the member view"
  - "Member card uses formParamsFor(c) unchanged so the member's link equals the owner-view link (HUB-04); Self-vs-Child radio left to Rob as Q-1"
  - "Hub v11 needs no change (D-11); no hub-page.diff produced"

patterns-established:
  - "Negative control: --edited-js feeds v8 into the behavior checks; member checks must fail"

requirements-completed: [HUB-01, HUB-02, HUB-04]

coverage:
  - id: D1
    description: "Build Status v9: a member-held adhoc_ token returns only the holder's card with owner null and no other member's data"
    requirement: HUB-01
    verification:
      - kind: unit
        ref: "harness/wf2-member-scope.harness.cjs#member:, member detect:, leak:"
        status: pass
      - kind: unit
        ref: "node harness/wf2-member-scope.harness.cjs --edited-js build-status-v8-PROPOSED.js (negative control exits 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Owner tokens byte-identical to live Build Status v8 across 8 family and solo scenarios"
    requirement: HUB-01
    verification:
      - kind: unit
        ref: "harness/wf2-member-scope.harness.cjs#owner: byte-identical to v8 across 8 scenarios"
        status: pass
    human_judgment: false
  - id: D3
    description: "Edited wf2 JSON and diff: live roster, only Build Status changed, placeholder PIT, patch reproduces the JSON byte-for-byte"
    requirement: HUB-02
    verification:
      - kind: unit
        ref: "harness#base:, sync:, scope:, secrets:"
        status: pass
      - kind: other
        ref: "patch -s repo.json -i wf2-member-scope.diff && cmp (Task 1 verify 3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Hub v11 renders one family-part-1 card for the member response and return-to-hub recovers the adhoc_ token; no token validation anywhere"
    requirement: HUB-02
    verification:
      - kind: unit
        ref: "harness#hub: (4 checks) and token:"
        status: pass
    human_judgment: false
  - id: D5
    description: "COMPLETION-PATH.md traces the member's completion to the owner's hub with node/file evidence"
    requirement: HUB-04
    verification:
      - kind: unit
        ref: "harness#HUB-04: member-view form_params equal the owner-view form_params"
        status: pass
      - kind: other
        ref: "Task 3 verify 1 (required headings/ids/nodes present)"
        status: pass
    human_judgment: true
    rationale: "The trace's GHL-side steps (forms, workflows a56137e1/d68d9c2a, redirects) are cited from design docs, not exercised; the GHL search matching an adhoc_ token is a Phase 6 live check"

duration: 7min
completed: 2026-10-08
status: complete
---

# Phase 5 Plan 01: wf2 Member Scope Summary

**wf2 Build Status v9 returns only the token holder's card for a member-held `adhoc_` token. The change is delivered as a live-v8-synced workflow JSON plus a diff, and a 22/22 offline harness proves that owner tokens stay byte-identical to v8 and that hub v11 needs no change.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-08T03:12:05Z
- **Completed:** 2026-10-08T03:19:33Z
- **Tasks:** 3
- **Files modified:** 6 committed in admin-theme, plus 3 untracked canonical files in xcelsior

## Accomplishments

- `build-status-v9.js` is live v8 plus a header and one early-return member-scope block. A member token gets `owner: null` and one card built from the unchanged member-card fields. Owner tokens fall through to the untouched v8 code.
- `build-wf2.cjs` rebuilds the canonical JSON and diff from committed, secret-free sources. It syncs the stale repo mirror to the live 14-node roster (F-1) and asserts the serializer round-trips the repo file byte-for-byte.
- The harness ends at **PASS 22/22**. The negative control (v8 as the edited code) fails 12 checks: 9 member/leak, plus HUB-04 and both hub render checks. Two mutation tests confirmed that the static token scan and the owner identity checks can fail.
- COMPLETION-PATH.md has an 11-row trace where only the wf2 row changes, a token-consumer audit, the D-11 no-change decision with v11 line evidence, Q-1 and Q-2, and the Phase 6 live checks.

## Canonical files (xcelsior, untracked, never staged)

- `/Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/wf2-consent-hub-status.member-scope.json`
- `/Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/wf2-member-scope.diff`
- `/Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/COMPLETION-PATH.md`

All three are byte-identical to the mirrors in `.planning/phases/05-individual-consent-backend/deliverables/`. `hub-page.diff` was **not** needed.

## Task Commits

1. **Task 1: Tracer (v9, builder, harness 8/8, JSON + diff mirrors)**: `4e90329` (docs)
2. **Task 2: Harness expanded to 22 checks**: `aaf1b45` (test)
3. **Task 3: COMPLETION-PATH.md mirror**: `ccda56b` (docs)

## Files Created/Modified

- `harness/build-status-v9.js`: Build Status v9 source (single source for jsCode and the 05-03 README paste block)
- `harness/build-wf2.cjs`: repo JSON + v9 -> edited JSON + diff (repo-relative labels)
- `harness/wf2-member-scope.harness.cjs`: 22 checks. Defaults to the absolute xcelsior paths; `--edited-js` for the negative control
- `deliverables/wf2-consent-hub-status.member-scope.json`, `deliverables/wf2-member-scope.diff`, `deliverables/COMPLETION-PATH.md`: mirrors

## Decisions Made

- **F-1 (planner finding, confirmed):** the repo `n8n/2-consent-hub-status.json` is stale (Build Status v6 plus `Lookup Member Docs`). The live export's draft and published (`activeVersion`) Build Status both equal `build-status-v8-PROPOSED.js`, and the live graph has 14 nodes with Refetch Member -> Build Status. The deliverable is based on that live roster. The live export was read only for node names, connections, and equality, and none of its values were printed or copied.
- The v9 member rule follows the n8n/README role rule. A legacy holder (both fields empty) fails closed to the member view.
- The member card calls `formParamsFor(c)` with no second argument, so the link is identical to the owner view (HUB-04). The radio is left to Rob as Q-1.

## Questions for Rob (also in COMPLETION-PATH.md)

- **Q-1 (attestation radio):** an adult child opening their own link sees `form_behalf=Child` preselected. Switching to `Self` is a one-line change (`formParamsFor(c, true)`) in the member-scope block.
- **Q-2 (hub copy):** the member sees the "Family Consent Forms" eyebrow (v11 line 43) and the family intro (lines 75-77). This is cosmetic. Changing it means a hub re-paste, with the solo-mode swap as precedent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Harness card counter over-counted**
- **Found during:** Task 1 (first harness run)
- **Issue:** the hub check counted `<div class="xh-card` as a prefix, which also matched `xh-card-name` and `xh-card-sub` and reported 3 cards for a correct one-card render.
- **Fix:** count whole card divs with `/<div class="xh-card(?: [^"]*)?">/g`.
- **Files modified:** harness/wf2-member-scope.harness.cjs
- **Verification:** tracer 8/8. The negative control still fails the hub check (3 cards from v8).
- **Committed in:** 4e90329

### Additions within scope (not deviations from intent)

- The owner byte-identity check covers **8** scenarios (plan minimum 6). Extras: "one member not yet minted is skipped" and the prefill path, which runs in every family scenario.
- The static scan also asserts that no wf2 node other than Has Token? and Find Owner by Token reads `query.t`.
- COMPLETION-PATH "Live checks" gains item 5 (see Issues Encountered). The D-11 section also notes that phase0 FINDINGS item 8 names the wrong repo file (`consent-hub-page.html` is the older v9 mirror, and the live markers match v11).

**Total deviations:** 1 auto-fixed (1 bug in the harness itself). **Impact on plan:** none on the deliverables. v9 and the edited JSON did not change after Task 1.

## Issues Encountered

- **Sandbox token holders without `member_type`:** in the 2026-08-25 contact pull (read for counts only, no identities printed), 6 of 10 `consent_hub_token` holders have empty `member_type`, `owner_contact_id`, and `hint_patient_id`. All 6 are sandbox or test contacts (sandbox membership ids or test names). Under v9's fail-closed rule their hubs would show the could-not-load message. Real owners are unaffected: wf1 stamps `member_type` owner on every owner, and the backfill stamped the 4 real or rehearsal holders. This is recorded as COMPLETION-PATH live check 5 so Rob can stamp `owner` on any of those test contacts before testing v9.
- The security-guidance hook flagged `new Function()` in the harness. It is used deliberately, following the plan and the 2026-07-30 precedent harness, to execute the repo's own committed Code-node source offline. No external input reaches it.

## Pending human verification (Phase 6 live)

- The GHL contacts search `eq` finds a member by an `adhoc_` token on the first real member send.
- A member's link opens exactly one card. The owner's hub is unchanged. After the member completes, the owner's hub shows them done.
- Rob confirms the live Build Status header reads v8 before pasting v9 (the README in 05-03 carries this).

## User Setup Required

None. Rob applies the wf2 change by hand in n8n (and clicks Publish) per the 05-03 README.

## Next Phase Readiness

- 05-02 (ClinX build spec) and 05-03 (member email, README, final mirror sweep) can proceed. 05-03 should paste `harness/build-status-v9.js` as the README code block and repeat the mirror cmp sweep.
- No blockers.

## Self-Check: PASSED

- FOUND: all 6 admin-theme files and all 3 xcelsior canonical files. All 3 mirrors are `cmp`-identical.
- FOUND commits: 4e90329, aaf1b45, ccda56b (`git rev-list --count a041fb1..HEAD` = 3).
- Plan verification: harness PASS 22/22; negative control exit 1; `patch` reproduces the JSON; the xcelsior proposal folder is untracked only, with no tracked change under hint-api/ or Email-Templates/.

---
*Phase: 05-individual-consent-backend*
*Completed: 2026-10-08*

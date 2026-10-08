---
phase: 04-actions-menu
plan: 02
subsystem: ui
tags: [vanilla-js, state-machine, cooldown, webhook, config-validation, overrides, email-precheck]

requires:
  - phase: 04-actions-menu (Plan 04-01)
    provides: menus[] config, resolveMenus, Actions menu widget, flashTrigger, openMenu, renderMenus, menu-aware setState/createButtonEl/runWebhook/runHandler
provides:
  - D-15 "Not configured" for an empty or missing webhook url (never binds a click, never POSTs)
  - D-16 optional item rule requires { email 'real' } evaluated at render, reconcile, menu open, and click time
  - refreshMenuItems(wrapper, menu) as the single per-item re-evaluation hook for survivors and open
  - verify().config.menuIds and __test.isSyntheticEmail
  - automated proof of per-item outcomes, 60 s per-item cooldown, overrides, scope, empty-menu, validation, log hygiene
affects: [04-03 shipped Xcelsior menu (consent items ship with empty url and requires), harness, README config docs]

actuals:
  tokens: 9715
  tasks: 2
  commits: 4
plan_head_before: 87682529226b1a35ac6c5d6f1cf63deafac764be

tech-stack:
  added: []
  patterns:
    - "Unavailable reasons live in data-ghlc-reason ('no-contact-fields', 'needs-real-email'); each reason owns its own recovery path, and recovery runs only where staff can see or press the control"
    - "An email edit is not a DOM mutation, so the requires rule is re-read at render, every reconcile, every menu open, and click time instead of adding a poll or an observer"
    - "Cross-realm arrays from the shim (api.* results) go through plain() before assert.deepEqual"

key-files:
  created: []
  modified:
    - src/ghl-customizer.js
    - test/run.mjs

key-decisions:
  - "D-15 applies to every webhook action, plain buttons included: an empty/missing url was already unavailable and unbound in v0.1.2 (HTTPS message); only the message changes to 'Not configured'. No shipped or fixture config has an empty url, so D-03 byte-for-byte holds"
  - "A click-time requires refusal happens after the item's activation closed the menu, so the result is surfaced as a trigger flash 'Actions · Unavailable' with the reason in the status span"
  - "refreshRequires never gates anchors (a link cannot be made inert by state) and never touches submitting, queued, or otherwise-unavailable elements"
  - "meetsRequires reads only an own 'email' key equal to 'real'; any other requires shape is ignored and validateConfig accepts it"

patterns-established:
  - "Per-item rule hook: recoverNoContactFields then refreshRequires, called from refreshMenuItems (menu survivors, openMenu) and the plain-button survivor loop"

requirements-completed: [MENU-01, MENU-02, MENU-06, MENU-08, ITEM-05, ITEM-06, ITEM-07, REL-01]

coverage:
  - id: D1
    description: "Each item's ok/unconfirmed/failed/network/handler outcome stays on the item and flashes on the trigger and its status span"
    requirement: MENU-06
    verification:
      - kind: integration
        ref: "test/run.mjs#menu items: failed, unconfirmed, and network outcomes stay on the item and flash on the trigger"
        status: pass
    human_judgment: false
  - id: D2
    description: "Copy contact ID item copies the open contact id and reports on the trigger; no clipboard reports failed"
    requirement: ITEM-05
    verification:
      - kind: integration
        ref: "test/run.mjs#menu items: Copy contact ID copies the open contact's id and reports on the trigger (ITEM-05)"
        status: pass
    human_judgment: false
  - id: D3
    description: "60 s per-item cooldown keyed by ctx|itemId blocks only that item and survives a same-context re-render"
    requirement: ITEM-06
    verification:
      - kind: integration
        ref: "test/run.mjs#menu items: a 60 s cooldown keyed by item id blocks only that item (ITEM-06, D-09, D-10)"
        status: pass
      - kind: integration
        ref: "test/run.mjs#menu items: an item's cooldown survives a same-context region re-render"
        status: pass
    human_judgment: false
  - id: D4
    description: "Empty or missing webhook url renders 'Not configured', binds no click, and never sends"
    requirement: MENU-06
    verification:
      - kind: integration
        ref: "test/run.mjs#menu items: an empty or missing webhook url renders \"Not configured\" and never sends (D-15)"
        status: pass
      - kind: unit
        ref: "test/run.mjs#unit: resolveAction reports \"Not configured\" for an empty or missing webhook url and keeps the HTTPS message otherwise"
        status: pass
    human_judgment: false
  - id: D5
    description: "Stale clicks are refused and late results for a previous contact are discarded on items"
    requirement: MENU-06
    verification:
      - kind: integration
        ref: "test/run.mjs#menu items: a stale click on an item is refused and sends nothing"
        status: pass
      - kind: integration
        ref: "test/run.mjs#menu items: a late result for a previous contact never lands on the new contact's menu"
        status: pass
    human_judgment: false
  - id: D6
    description: "requires { email 'real' } makes only that item unavailable for an empty or synthetic email, re-evaluated at render, reconcile, open, and click time in both directions"
    requirement: ITEM-07
    verification:
      - kind: integration
        ref: "test/run.mjs#menu requires: (4 scenarios)"
        status: pass
      - kind: unit
        ref: "test/run.mjs#unit: isSyntheticEmail matches the +digits@ dedupe pattern only"
        status: pass
    human_judgment: false
  - id: D7
    description: "Per-item overrides (false hides, object relabels, true forces), menu/item scope, and the empty-menu rule"
    requirement: MENU-02
    verification:
      - kind: integration
        ref: "test/run.mjs#menu overrides: false hides an item, an object relabels it, true forces an out-of-scope item (MENU-02)"
        status: pass
      - kind: integration
        ref: "test/run.mjs#menu scope: a menu renders only on its scoped locations' contact records; an empty menu renders nothing (D-02)"
        status: pass
      - kind: unit
        ref: "test/run.mjs#unit: resolveMenus applies menu scope, item scope, and per-item overrides"
        status: pass
    human_judgment: false
  - id: D8
    description: "validateConfig accepts optional menus and enforces one id namespace; buttons-only messages unchanged"
    requirement: MENU-01
    verification:
      - kind: unit
        ref: "test/run.mjs#unit: validateConfig accepts menus and enforces one id namespace across buttons and items"
        status: pass
    human_judgment: false
  - id: D9
    description: "verify().config.menuIds lists menu ids; diagnostics carry ids and reasons only"
    requirement: MENU-08
    verification:
      - kind: integration
        ref: "test/run.mjs#menu verify: verify() reports configured menu ids"
        status: pass
      - kind: integration
        ref: "test/run.mjs#menu logs: menu and requires diagnostics carry ids and reasons only"
        status: pass
      - kind: integration
        ref: "test/run.mjs#verify: report shape and hygiene"
        status: pass
    human_judgment: false
  - id: D10
    description: "On a live HighLevel record, editing the email field and reopening the Actions menu flips the consent item's availability"
    requirement: ITEM-07
    verification: []
    human_judgment: true
    rationale: "The shim models the no-mutation input change, but the live field's timing and markup need a browser check (Plan 04-03 ships the item)"

duration: 6min
completed: 2026-10-07
status: complete
---

# Phase 4 Plan 02: Per-Item Rules Summary

**Every Actions-menu item now behaves correctly on its own. It shows its own result on itself and on the trigger. It runs its own 60 s cooldown, keyed by item id. An empty URL renders "Not configured" and can never POST. A configuration-driven `requires: { email: 'real' }` rule disables only the consent-style item while the record's email is empty or synthetic (`+digits@`), and that rule is re-read at render, reconcile, menu open, and click time.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-08T01:05:36Z
- **Completed:** 2026-10-08T01:11:12Z
- **Tasks:** 2 (4 commits; both tasks were TDD, so each has a test commit and a feat commit)
- **Files modified:** 2
- **Suite:** `node test/run.mjs` and `npm test` both print `PASS 154/154` (135 from Plan 04-01, plus 8 for Task 1 and 11 for Task 2)

## Accomplishments

- **D-15:** `MSG_NOT_CONFIGURED`. The webhook branch of `resolveAction` returns `unavailable('Not configured')` when the url is `undefined`, `null`, or `''`. This check runs after the placement check and before the HTTPS check. Because the result is unavailable, `createButtonEl` binds no click.
- **D-16:** The new pieces are `SYNTHETIC_EMAIL_RE`, `isSyntheticEmail`, `meetsRequires`, `MSG_NEEDS_REAL_EMAIL`, `markNeedsRealEmail` (which sets `data-ghlc-reason="needs-real-email"` and logs `requires-unmet { buttonId }`), `refreshRequires`, `refuseUnmetRequires`, and `refreshMenuItems`. They are wired in four places:
  - `createButtonEl` at render.
  - `renderMenus` survivors, which now use `refreshMenuItems`.
  - The plain-button survivor loop in `reconcilePlacement`.
  - `openMenu`, before it picks the focus target.

  `runWebhook` and `runHandler` also refuse at click time. No poll was added (there is still no `setInterval`), and the observer count stays 9.
- `verify().config.menuIds`, `__test.isSyntheticEmail`, and a `requires` line in the head-comment schema.
- 19 new checks covering per-item outcomes, the cooldown, stale and late results, requires, overrides, scope, empty menus, validation, verify, and logs. The `verify: report shape and hygiene` assertion now expects `menuIds: []`.

## Task Commits

1. **Task 1: per-item state, feedback, cooldown, Not configured, stale and late results:** `8d999d5` (test, RED), `564f776` (feat, GREEN)
2. **Task 2: requires rule, overrides, scope, validation, verify menuIds, log hygiene:** `d7c4e7a` (test, RED), `4f6ac70` (feat, GREEN)

## Files Created/Modified

- `src/ghl-customizer.js`:
  - Constants: `SYNTHETIC_EMAIL_RE`.
  - Schema comment: the MenuItem entry now documents `requires`.
  - Buttons section: `MSG_NOT_CONFIGURED`, `MSG_NEEDS_REAL_EMAIL`, the `resolveAction` empty-url branch, the requires branch in `createButtonEl`, `refreshMenuItems`, the rule functions, the survivor and `openMenu` wiring, and the click-time refusals.
  - `verify` reports `menuIds`, and boot exposes `__test.isSyntheticEmail`.
  - There are still ten sections, and no version was bumped.
- `test/run.mjs`:
  - New helpers: `MENU_HOOK_2`, `tSecond`, `MENU_CONSENT_HOOK`, `tConsent`, `tScoped`, `SYNTHETIC_CONTACT`, `consentMenu`, `liveEmailRegion`, and `assertNeedsReal`.
  - 19 new checks.
  - The verify shape assertion now includes `menuIds`.

## Decisions Made

- **D-15 interpretation (recorded as the plan requires):** the empty-url branch applies to every webhook action, plain buttons included. In v0.1.2 a plain button with an empty url was already unavailable and unbound, with the message "Webhook URL must use HTTPS". Only the message changes. No shipped or fixture config has an empty url, so D-03's byte-for-byte guarantee (the `menu D-03` snapshot) still holds for working buttons-only configs.
- A click-time requires refusal happens after activation has already closed the menu, so it shows as `Actions · Unavailable` on the trigger, with `Consent Item: Needs the member's own email` in the trigger's status span.
- `refreshRequires` leaves anchors alone, because changing an `<a>`'s state cannot stop it navigating. It also leaves submitting, queued, and other-reason unavailable elements alone, so a cooling item is never flipped.
- `meetsRequires` only enforces an own `email` key whose value is exactly `'real'`. Any other `requires` shape is ignored, and `validateConfig` accepts it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, test-only] Cross-realm arrays failed deepEqual in the new unit checks**
- **Found during:** Task 2 (RED run)
- **Issue:** Arrays returned by `throwawayApi()` come from the shim's realm, so `assert.deepEqual` reported "same structure but not reference-equal" even when the values matched.
- **Fix:** Wrapped those arrays in the existing `plain()` helper. This is the pattern the rest of the suite already uses.
- **Files modified:** test/run.mjs
- **Commit:** `d7c4e7a`

**2. [Minor] The schema comment's MenuItem entry grew from 3 to 4 lines**
- **Issue:** `requires?: { email: 'real' }` plus a one-clause explanation would not fit in the original three lines at the comment's existing width.
- **Fix:** Added one comment line. No static check pins the line count, and the comment is still ES2019-neutral.
- **Commit:** `4f6ac70`

### Additional coverage (within scope)
- The click-time requires scenario also proves the `runHandler` refusal, using a handler item that carries `requires`. The plan only wired it.
- The `requires` re-render scenario continues past the cooldown. When the 60 s ends, the next reconcile applies the rule again.

**Total deviations:** 2 (1 test-infra fix, 1 cosmetic comment). **Impact:** none on runtime behavior beyond the plan.

## Issues Encountered

- TDD RED states:
  - **Task 1:** only the two D-15 checks failed. The other six `menu items:` scenarios passed at RED because Plan 04-01 had already wired every flash branch, the discard guard, and the `ctx|id` cooldown key. No source gap was found.
  - **Task 2:** 8 checks failed, all for missing features. The overrides, scope, validateConfig, and resolveMenus checks passed at RED because Plan 04-01 had already implemented those rules; this plan pins them.
- Commits were made on local `main`, as the orchestrator instructed (sequential, branching_strategy `none`). Nothing was pushed or tagged.

## Pending Human Verification (collected at phase end)

- On a live HighLevel contact, after Plan 04-03 ships the Xcelsior menu: open a record whose email is `owner+N@...`. "Send individual consent" should read "Needs the member's own email" while the other items stay usable. Then edit the email to a real address and reopen the menu; the item should become ready. Do this check after the consent URL is filled; until then the item reads "Not configured" (D-15).

## Known Stubs

None. The empty consent URL is a Plan 04-03/Phase 6 config concern. The code path for it ("Not configured") is complete and tested.

## Threat Flags

None. No new network endpoint, auth path, or storage was added. `requires-unmet` logs ids only, and verify adds menu ids only.

## User Setup Required

None.

## Next Phase Readiness

- Plan 04-03 can ship `menus[]` with `xcelsiorActions`. Its consent items carry `url: ""`, which renders "Not configured", and "Send individual consent" carries `requires: { email: 'real' }`. Send Invite gets `cooldownMs: 60000`.

---
*Phase: 04-actions-menu*
*Completed: 2026-10-07*

## Self-Check: PASSED

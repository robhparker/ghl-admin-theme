---
phase: 04-actions-menu
verified: 2026-10-08T01:31:37Z
status: human_needed
score: 18/20 must-haves verified
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/04-actions-menu/04-01-PLAN.md"
  - ".planning/phases/04-actions-menu/04-01-SUMMARY.md"
  - ".planning/phases/04-actions-menu/04-02-PLAN.md"
  - ".planning/phases/04-actions-menu/04-02-SUMMARY.md"
  - ".planning/phases/04-actions-menu/04-03-PLAN.md"
  - ".planning/phases/04-actions-menu/04-03-SUMMARY.md"
  - "README.md"
  - "config/agency-config.json"
  - "src/ghl-customizer.css"
  - "src/ghl-customizer.js"
  - "test/dom-shim.mjs"
  - "test/fixtures/config.json"
  - "test/harness.html"
  - "test/run.mjs"
covered_digest: "v1:sha256:84a2a497e6c8c4210a39efe394828aa8d7378f3a209d0d336b712f22b554f48a"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "Send individual consent and Resend Consent Hub link post to the real consent Inbound Webhook"
    addressed_in: "Phase 6"
    evidence: "Phase 6 success criterion 1: 'the shipped config carries the real consent webhook URL'. Phase 4 ships url '' by design (D-15); the posting mechanism is proven with a substituted URL."
human_verification:
  - test: "Live HighLevel: open a Xcelsior (Cp2XxBsRoyKS2CUf1Hwi) contact record, open the Actions menu"
    expected: "One Actions button in the contact name row; the panel opens below it, fully visible, not clipped by the name row or by any scrolling/overflow ancestor of the left record column"
    why_human: "WR-03 (deferred): the panel is absolute inside .ghlc-group, so any HighLevel ancestor with overflow hidden/auto clips it. The suite only checks our own CSS, and the harness 'Tighten name row' control sets no overflow, so it cannot reproduce clipping. Needs real layout."
  - test: "Decide whether the trigger must show 'Sending…' while an item's request is in flight (roadmap SC3 wording vs MENU-06/D-11)"
    expected: "Either accept current behavior (trigger stays 'Actions' until the result lands, then flashes the result) via an override, or schedule IN-05 (trigger 'submitting' flash state)"
    why_human: "Roadmap SC3 says each item 'shows its own Sending... / Workflow triggered / Failed result on the trigger and in the screen-reader status span'. MENU-06 and D-11 only require the result on the trigger. Probe confirmed the trigger shows nothing during a held send and the item's 'Sending…' sits in the closed panel. Code review IN-05 flagged this and it was skipped. This is a scope interpretation only Rob can make."
  - test: "Harness: npm run serve, open http://localhost:5173/test/harness.html?ghlc-debug=1, click 'Location M · Contact X (Actions menu)'"
    expected: "Actions button at the right of the name row; Enter/Space/ArrowDown open it; arrows wrap; Home/End jump; Esc and Tab close it with focus back on the trigger; visible focus ring follows arrows; 'Resend hub link (harness)' shows unavailable with a 'Not configured' tooltip; 'Send Invite (harness)' turns green and the trigger reads 'Actions · Workflow triggered' for about 4 s; Location A contacts show no Actions menu"
    why_human: "The DOM shim has no layout, no rendering, and no real focus traversal; visual states, focus ring, and Tab order need a browser"
  - test: "Harness: on Location M · Contact S, and on Contact X after 'Toggle synthetic email (no mutation)' then reopening the menu"
    expected: "'Send consent (harness)' is unavailable with 'Needs the member's own email'; toggling back and reopening makes it ready again"
    why_human: "Confirms the open-time re-evaluation in a real browser where the email edit is a value change with no DOM mutation"
  - test: "Live HighLevel (after Phase 6 fills the consent URL): open a record whose email is owner+N@..., then edit it to a real address and reopen the menu"
    expected: "Send individual consent reads 'Needs the member's own email' while the other items stay usable; after the edit and reopen it becomes ready"
    why_human: "HighLevel's real email field timing and markup cannot be reproduced headlessly; until the URL is filled the item reads 'Not configured' (D-15)"
---

# Phase 4: Actions Menu Verification Report

**Phase Goal:** On an Xcelsior contact record, staff open one "Actions" menu in the name row and fire any of four actions (Send Invite, Send individual consent, Resend Consent Hub link, Copy contact ID) by mouse or keyboard, each with its own visible result and cooldown, while every other location and every plain-button config behaves exactly as in v0.1.2.
**Verified:** 2026-10-08T01:31:37Z
**Status:** human_needed
**Re-verification:** No (initial verification)

## Goal Achievement

The widget, per-item pipeline, requires rule, shipped config, harness, and README all exist in the code, are wired end to end, and are exercised by passing behavioral tests. I confirmed D-03 independently: I ran the `v0.1.2` tag's own source and fixture through the shim and compared the output with the current source. I did not rely on the pasted snapshot. Two truths cannot be settled by code: panel clipping inside real HighLevel layout, and whether the roadmap's "Sending..." on the trigger is in scope.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Xcelsior contact record shows one Actions menu in the contact group, items in D-12 order (SC1, ITEM-01) | ✓ VERIFIED | `config/agency-config.json` menus[0] `xcelsiorActions` scope `["Cp2XxBsRoyKS2CUf1Hwi"]`, items sendInvite, send-individual-consent, resend-consent-hub, copyContactId. `sample: an Xcelsior contact record ...` passes (menu is the group's only element). My independent probe on the shipped file gives the same order and states. |
| 2 | No Actions menu or Xcelsior action at other locations or agency pages; Help Center unchanged (SC1, ITEM-01, D-13) | ✓ VERIFIED | `buttons` = `[helpCenter]` only. `sample: no Xcelsior action renders ...` and the Dummy Clinic scenario pass. In the probe at Dummy Clinic: 0 menus, 0 contact buttons. |
| 3 | A buttons-only config renders exactly as v0.1.2 (SC1, MENU-01, D-03) | ✓ VERIFIED | Independent re-derivation (`$TMPDIR/ghlc-verify/d03.mjs`). The v0.1.2 tag source with the v0.1.2 fixture and the current source with the current fixture minus `menus` give EQUAL boot, queued, and ready snapshots (4413/4433/4413 chars), 9 observers, 0 document pointerdown/keydown listeners, and 1 fetch. `isOwnNode` is byte-identical to v0.1.2. |
| 4 | Keyboard: Enter/Space/ArrowDown open and focus the first enabled item; arrows wrap; Home/End; Esc closes and refocuses; Tab closes without preventDefault; one activation per key (SC2, MENU-04) | ✓ VERIFIED | `onMenuKeydown` (src 1448-1498) compares `evt.key` only (0 `keyCode`). Enter and Space go through native click (no double handling). All 7 `menu keyboard:` scenarios pass, using `pressKey`, which models native Enter-on-keydown and Space-on-keyup activation. |
| 5 | Closes on outside pointerdown, activation, Esc, Tab, toggle, SPA navigation, contact change, and detachment, with exactly one document listener while open (SC2, MENU-05, D-06) | ✓ VERIFIED | `openMenu` adds a capture `pointerdown` listener. `closeMenu` removes it by stored reference. `applyContext` calls `closeMenu('context')`, `onNavigationSignal` calls `closeMenu('navigation')`, and `renderPlacement` calls `closeDetachedMenu`. All 5 `menu close:` scenarios pass (listener counts 0/1/0). |
| 6 | The panel is never clipped by the name row (SC2, MENU-05, D-07) | ? UNCERTAIN | Our CSS is correct: group `position: relative`, panel `position: absolute; z-index: 1000`, `[hidden]` hides it, and no group or menu rule clips (the `menu css:` check passes). An absolute panel is still clipped by any HighLevel ancestor with overflow hidden or auto (WR-03, deferred). The harness `.hx-tight` rule sets no `overflow`, so it cannot show clipping. This needs a live check. |
| 7 | Send Invite posts the unchanged v0.1.2 payload to trigger bde416ab (SC3, ITEM-02, D-14) | ✓ VERIFIED | The URL matches the v0.1.2 config. `buildPayload` is unchanged. The sample scenario asserts the exact URL, the keys (exactly the 8 v0.1.2 keys), buttonId `sendInvite`, and source `ghl-customizer`. |
| 8 | Send individual consent and Resend Consent Hub link post the standard payload with their own buttonId (SC3, ITEM-03, ITEM-04) | ✓ VERIFIED (mechanism) | The `sample: with the consent URL filled in ...` scenario clones the shipped file and substitutes a /hooks/ URL. It asserts the 8 keys and buttonIds `send-individual-consent` and `resend-consent-hub`. The real URL is deferred to Phase 6, as intended (D-15). |
| 9 | Copy contact ID copies the open contact's id (SC3, ITEM-05) | ✓ VERIFIED | The item uses the existing `copyContactId` handler. The sample scenario asserts the clipboard gets `['c1']` and the trigger reads `Actions · Contact ID copied`. The no-clipboard path shows failed. |
| 10 | Each item's result (Workflow triggered, Sent (unconfirmed), Failed, handler ok or failure) shows on the trigger and in its status span (SC3, MENU-06, D-11) | ✓ VERIFIED | `flashTrigger` is called on every `runWebhook`/`runHandler` outcome branch, after the discard guard, with a 4000 ms restore timer in `state.timers`. Both `menu items: failed, unconfirmed, and network outcomes ...` and the tracer pass. A late result after a contact change never flashes (scenario passes). |
| 11 | "Sending..." shows on the trigger while an item's request is in flight (roadmap SC3 wording) | ? UNCERTAIN (needs Rob's decision) | **Not implemented.** Probe with a held fetch: the trigger label stays `"Actions"`, its status span is `""`, and there is no flash, while the item is `submitting` inside the closed (hidden) panel. MENU-06 and D-11 require only the *result* on the trigger, so this may be out of scope. Review IN-05 flagged it and it was skipped. |
| 12 | Each webhook item refuses repeat presses for 60 s without blocking the others (SC3, ITEM-06, D-09, D-10) | ✓ VERIFIED | The cooldown is keyed by `ctx|itemId`. The shipped items all use `cooldownMs: 60000`. Tests confirm queued at 59 999 ms and ready at 60 000 ms, that `tSecond` still sends while `tInvite` cools, that the cooldown survives a re-render, and that WR-01 (rebuilt mid-send) never re-POSTs. In the probe, a repeat Enter during the cooldown left the fetch count at 1. |
| 13 | An empty or synthetic email makes only Send individual consent unavailable with a reason; re-read at render, reconcile, open, and click time (SC4, ITEM-07, D-16) | ✓ VERIFIED | `meetsRequires`, `refreshRequires`, `refuseUnmetRequires`, and `refreshMenuItems` are wired into `createButtonEl`, `renderMenus`, `openMenu`, the plain survivor loop, `runWebhook`, and `runHandler`. It fails closed on a malformed rule (WR-02). All 4 `menu requires:` scenarios pass. No `setInterval`, and the observer count stays 9. The live-field flip is listed under human verification. |
| 14 | Per-location overrides hide or relabel or force single items; a menu with no visible items does not render (SC4, MENU-02, D-02) | ✓ VERIFIED | `resolveMenus` (src 865-895) uses own-property override lookup, drops empty menus, and never lets an item override pull a menu out of its scope. `menu overrides:`, `menu scope:`, and `unit: resolveMenus` pass. |
| 15 | An empty or missing webhook url renders "Not configured", binds no click, and never POSTs (D-15) | ✓ VERIFIED | The `resolveAction` empty-url check (src 1170) runs before the HTTPS check. The shipped consent items render `unavailable`, title `Not configured`, and clicking them gives 0 fetches (sample scenario and probe). |
| 16 | No re-render loop; observer count unchanged (9); panel inside `.ghlc-group` (MENU-07, D-08) | ✓ VERIFIED | `menu observers:` passes (0 `rerender` log lines, 9 observers, panel's closest group is the contact group). `isOwnNode` is unchanged from the tag. |
| 17 | `validateConfig` accepts menus, enforces one id namespace, and keeps buttons-only messages unchanged; `verify().config.menuIds`; id-only diagnostics (MENU-01, MENU-08) | ✓ VERIFIED | `validateMenu`/`validateButton` (src 669-768). `menuIds` is set in verify (src 2965). `unit: validateConfig accepts menus ...`, `menu verify:`, `menu logs:`, and `verify: report shape and hygiene` pass. |
| 18 | Every v0.1.2 static rule passes; the full suite is green (SC5, MENU-08, REL-01) | ✓ VERIFIED | `node test/run.mjs` exits 0 with `PASS 164/164` and no `not ok`. The run includes ten section markers, FND-03 adapter-only selectors, ES2019, forbidden tokens, console only via log/warn/verify, scoped CSS with no `!important`, and the version check (still 0.1.2, no bump). |
| 19 | `test/harness.html` exercises the menu offline (SC5, REL-01) | ✓ VERIFIED (structure) | The fixture `harnessActions` (locM) has working, requires-real-email, Not configured, and copy items. The harness has Location M navigation, contact cS, and the `hx-clip-name-row` and `hx-synthetic-email` controls (value-only, no mutation). `harness:` and `harness fixture:` pass. The fixture minus `menus` deep-equals v0.1.2. The visual check is listed under human verification. |
| 20 | The README documents the `menus[]` shape and the consent item IDs (SC5, REL-04) | ✓ VERIFIED | README rows for `menus[].*` and `menus[].items[].requires`, a `### Actions menu` section (keyboard, closing, unavailable, overrides, xcelsiorActions JSON), a consent ID table (`send-individual-consent`, `resend-consent-hub`), the "Not configured" note, and `menuIds` in Verify mode. Still eleven H2s, all pinned to v0.1.2. |

**Score:** 18/20 truths verified (0 present-but-behavior-unverified; 2 uncertain and routed to human)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Consent items post to the real consent Inbound Webhook URL | Phase 6 | Phase 6 SC1: "the shipped config carries the real consent webhook URL". The Phase 4 empty URL is intentional (D-15). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/ghl-customizer.js` | menus validation, resolveMenus, widget, keyboard, close paths, flash, requires rule, Not configured, menuIds | ✓ VERIFIED | Every named function is present (resolveMenus 865, createMenuEl 1364, onMenuKeydown 1448, openMenu 1510, closeMenu 1543, flashTrigger 1557, renderMenus 1584, meetsRequires 1869, etc.), substantive, and called from the render and click paths. Still ten sections. |
| `src/ghl-customizer.css` | group containing block; menu, trigger flash, panel, and item rules | ✓ VERIFIED | `.ghlc-group { position: relative }`; `.ghlc-menu__panel` absolute, z-index 1000; `[hidden] { display: none }`. The only `overflow: hidden` is the visually-hidden `.ghlc-btn__msg` (pre-existing). |
| `test/dom-shim.mjs` | KeyboardEvent, pressKey, snapshot | ✓ VERIFIED | Used by the keyboard scenarios and the D-03 check (including my independent run). |
| `test/run.mjs` | Phase 4 block and sample scenarios | ✓ VERIFIED | 164 checks. I read the assertions in the shipped-config scenarios; they are exact, not loosened. |
| `config/agency-config.json` | `xcelsiorActions` with D-12 items, buttons = helpCenter | ✓ VERIFIED | The plan's shape check exits 0. The Send Invite URL is byte-identical to v0.1.2. |
| `test/fixtures/config.json` | `harnessActions` scoped to locM | ✓ VERIFIED | Used by the harness and the `harness fixture:` scenario. |
| `test/harness.html` | Location M, cS, two controls, banner | ✓ VERIFIED | Wired with `getElementById(...).addEventListener`. `.hx-tight` has no overflow (see WR-03). |
| `README.md` | menus docs, consent IDs | ✓ VERIFIED | See truth 20. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `reconcilePlacement('contact')` | `resolveMenus` → `renderMenus` → `createMenuEl` | menus computed when contactId is set; empty-exit and mount-wait count menus | WIRED | src 1687-1732 |
| `createMenuEl` | `createButtonEl(item, { menuItem: true })` | items are normal button records | WIRED | src 1394 |
| `onButtonClick` | `closeMenu('activate', true)` | after the ready/failed gate | WIRED | src 2108 |
| `runWebhook`/`runHandler` outcomes | `flashTrigger` | after the generation and isConnected guard (or a same-ctx live replacement) | WIRED | src 2032-2046, 2092, 2096 |
| `openMenu`/`closeMenu` | document capture `pointerdown` | added once per open, removed by reference | WIRED | src 1529, 1546 |
| `applyContext`/`onNavigationSignal` | `closeMenu('context'|'navigation')` | context and SPA signals | WIRED | src 1001, 1046 |
| `resolveAction` webhook branch | `unavailable(MSG_NOT_CONFIGURED)` | before the HTTPS check | WIRED | src 1170-1171 |
| `createButtonEl` / `refreshMenuItems` / `runWebhook`, `runHandler` | `meetsRequires` → `adapter.readContactEmail` | render, reconcile, open, click time | WIRED | src 1297, 1611-1623, 1535, 1994, 2072 |
| `verify()` | `state.config.menus` ids | `menuIds` | WIRED | src 2965 |
| shipped `menus[0]` | `resolveMenus(config, 'Cp2XxBsRoyKS2CUf1Hwi')` | menu scope | WIRED | sample scenarios and probe |
| item ids | payload `buttonId` | `buildPayload` uses `button.id` | WIRED | src 1773; asserted in the consent sample scenario |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Menu items | `menu.items` | `resolveMenus(state.config, state.ctx.locationId)` from the fetched, validated config | Yes | ✓ FLOWING |
| Webhook payload | `email`, `phone`, `contactId`, `locationId` | `adapter.readContactEmail/Phone(findContactRegion())`, `state.ctx` from the route | Yes | ✓ FLOWING |
| Trigger flash | label and status text | outcome of `sendWebhook` / handler result | Yes | ✓ FLOWING |
| requires rule | email | live `adapter.readContactEmail` at each evaluation point | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green | `node test/run.mjs` | exit 0, `PASS 164/164`, no `not ok` | ✓ PASS |
| D-03 vs the v0.1.2 tag, independently derived | `node $TMPDIR/ghlc-verify/d03.mjs <repo>` | boot, queued, ready, observers, listeners, fetches all EQUAL | ✓ PASS |
| Shipped config at Xcelsior: items, Not configured, single POST, cooldown refusal | `node $TMPDIR/ghlc-verify/sending.mjs <repo>` | 4 items in order; consent items `unavailable: Not configured`; 1 fetch; repeat press is still 1 fetch | ✓ PASS |
| Shipped config at Dummy Clinic | same probe | 0 menus, 0 contact buttons, 0 errors | ✓ PASS |
| Trigger feedback during an in-flight send | same probe, fetch mode `hold` | trigger `"Actions"`, msg `""`, no flash | ? See truth 11 |
| Shipped config shape (plan verify command) | node shape check from 04-03-PLAN | exit 0 | ✓ PASS |
| isOwnNode unchanged | awk diff vs `git show v0.1.2:` | no diff | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist, and no plan declares one. Step 7c: not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MENU-01 | 04-01, 04-02 | menus[] config; buttons-only unchanged | ✓ SATISFIED | Truths 3, 17 |
| MENU-02 | 04-02 | Per-item overrides; empty menu not rendered | ✓ SATISFIED | Truth 14 |
| MENU-03 | 04-01 | One native Actions trigger with aria-haspopup/expanded; native menuitem buttons | ✓ SATISFIED | Truth 1; tracer asserts the attributes |
| MENU-04 | 04-01 | Keyboard operation | ✓ SATISFIED (real focus ring and Tab order need a human) | Truth 4 |
| MENU-05 | 04-01, 04-03 | Close paths; not clipped (overflow tested) | ? NEEDS HUMAN | Truth 5 verified; truth 6 uncertain (the "overflow tested" part is only our-CSS-level) |
| MENU-06 | 04-01, 04-02 | Per-item state and cooldown; result on trigger and status span | ✓ SATISFIED | Truths 10, 12 (see truth 11 for the SC3 "Sending..." wording) |
| MENU-07 | 04-01 | No re-render loop; observer count unchanged | ✓ SATISFIED | Truth 16 |
| MENU-08 | 04-01, 04-02 | All v0.1.2 static rules | ✓ SATISFIED | Truth 18 |
| ITEM-01 | 04-03 | Xcelsior menu, D-12 order, nothing elsewhere | ✓ SATISFIED | Truths 1, 2 |
| ITEM-02 | 04-03 | Send Invite unchanged payload to bde416ab, Xcelsior only | ✓ SATISFIED | Truth 7 |
| ITEM-03 | 04-03 | Send individual consent posts with its buttonId to the consent webhook | ✓ SATISFIED (mechanism; URL is deferred to Phase 6) | Truth 8 |
| ITEM-04 | 04-03 | Resend Consent Hub link posts with its buttonId | ✓ SATISFIED (mechanism; URL is deferred to Phase 6) | Truth 8 |
| ITEM-05 | 04-02, 04-03 | Copy contact ID via the existing handler | ✓ SATISFIED | Truth 9 |
| ITEM-06 | 04-02, 04-03 | 60 s per-item cooldown | ✓ SATISFIED | Truth 12 |
| ITEM-07 | 04-02, 04-03 | Consent unavailable for an empty or synthetic email | ✓ SATISFIED (the live field flip needs a human) | Truth 13 |
| REL-01 | 04-01, 04-02, 04-03 | Suite and harness coverage; green | ✓ SATISFIED | Truths 18, 19 |
| REL-04 | 04-03 | README documents menus[] and consent IDs | ✓ SATISFIED | Truth 20 |

All 17 phase requirement IDs appear in at least one plan's `requirements`. REQUIREMENTS.md maps no other ID to Phase 4, so there are no orphans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all modified files) | none | TBD / FIXME / XXX / TODO / HACK / PLACEHOLDER | none found | No debt markers |
| `test/harness.html` | 40 | `.hx-tight` sets only height and background, no `overflow` | ⚠️ Warning | The D-07 harness control cannot demonstrate clipping (WR-03). The D-07 "harness control" exists but does not prove what it claims. |
| `src/ghl-customizer.js` | 2008-2013 | `state.inflight[key]` is cleared only when `sendWebhook` settles; there is no fetch timeout | ℹ️ Info | Inherited from v0.1.2 (a hung fetch already left the element in `submitting`). With WR-01, a re-rendered control for that contact also stays "Sending…" until reload. This is safe (no duplicate send) but sticky. |
| `src/ghl-customizer.js` | 1170, 1312-1345, 2012-2027 | Deliberate edge-case changes for plain buttons: "Not configured" message for an empty url; mid-send re-render shows Sending… and records the cooldown; `recoverNoContactFields` honors the cooldown | ℹ️ Info | These only diverge from v0.1.2 in failure or race paths, and all of them are safety fixes (recorded in 04-02-SUMMARY and 04-REVIEW). Normal-path DOM, states, and observers are byte-identical (truth 3). |
| `src/ghl-customizer.js` | 1510-1541 | No `focusout` close (IN-01, skipped) | ℹ️ Info | The menu stays open if focus leaves via an iframe or a window switch. Not a must-have. |

### Human Verification Required

#### 1. Panel clipping on a live Xcelsior record (WR-03)

**Test:** Inject the build into a logged-in HighLevel tab. Open a Xcelsior contact record and open the Actions menu.
**Expected:** The panel opens below the trigger and is fully visible, not cut off by the name row or by the scrollable left record column.
**Why human:** The panel is absolute inside `.ghlc-group`, so any HighLevel ancestor with overflow hidden or auto will clip it. Neither the suite nor the harness can reproduce HighLevel's real overflow ancestors. If it clips, the fix in 04-REVIEW is `position: fixed` from the trigger's rect, or the Popover API.

#### 2. Decide on "Sending..." on the trigger (roadmap SC3 vs MENU-06)

**Test:** Read roadmap SC3 against MENU-06 and D-11, and choose one.
**Expected:** Either accept the current behavior with an override, or schedule IN-05 (a `submitting` flash on the trigger).
**Why human:** This is a scope interpretation. The code clearly does not show "Sending..." on the trigger. The open question is whether it is required. To accept it, add this to the frontmatter:

```yaml
overrides:
  - must_have: "Sending... shows on the trigger while an item's request is in flight"
    reason: "MENU-06 and D-11 require only the result on the trigger; the item's own Sending… state exists, and the request typically resolves in under a second. IN-05 deferred to a UX pass."
    accepted_by: "Rob"
    accepted_at: "<ISO timestamp>"
```

#### 3. Harness walkthrough (Plan 04-03 human-check)

**Test:** Run `npm run serve`, open `http://localhost:5173/test/harness.html?ghlc-debug=1`, and click "Location M · Contact X (Actions menu)".
**Expected:**
- The Actions button sits at the right of the name row.
- Enter, Space, and ArrowDown open the menu. Arrows wrap and Home/End jump.
- Esc and Tab close it; Esc returns focus to the trigger.
- The visible focus ring follows the arrow keys.
- "Resend hub link (harness)" is unavailable with a "Not configured" tooltip.
- "Send Invite (harness)" turns green, and the trigger reads "Actions · Workflow triggered" for about 4 s.
- Location A contacts show no menu.

**Why human:** The shim has no layout, no visual rendering, and no real focus traversal.

#### 4. Harness synthetic-email toggle

**Test:** Open "Location M · Contact S". Also open Contact X, click "Toggle synthetic email (no mutation)", and reopen the menu.
**Expected:** "Send consent (harness)" is unavailable with "Needs the member's own email". After toggling back and reopening, it is ready.
**Why human:** This confirms the open-time re-evaluation in a real browser.

#### 5. Live email flip (after Phase 6 fills the consent URL)

**Test:** On a live record with an `owner+N@...` email, open the menu. Then edit the email to a real address and reopen the menu.
**Expected:** Send individual consent is unavailable with the reason while the other items stay usable. After the edit and reopen, it is ready.
**Why human:** HighLevel's real field timing and markup can't be reproduced headlessly. Until the URL is filled in, the item reads "Not configured".

### Gaps Summary

No blocking gaps. Every must-have that code can satisfy exists, is substantive, is wired, and has passing behavioral tests. I re-derived the D-03 regression from the `v0.1.2` tag myself rather than relying on the pasted snapshot. Two items remain open, and only Rob can close them:

1. **Panel clipping (MENU-05, SC2):** our CSS is right, but HighLevel's overflow ancestors are unknown and the harness control cannot show clipping. This needs the live test that review WR-03 deferred to Phase 6. Phase 6's roadmap criteria do not name clipping explicitly, so add it to the Phase 6 live-test checklist.
2. **"Sending..." on the trigger (SC3 wording):** not implemented. Accept it with an override, or schedule IN-05.

The empty consent URLs are intentional (D-15). They are tracked as deferred to Phase 6 SC1, not as a gap.

---

_Verified: 2026-10-08T01:31:37Z_
_Verifier: Claude (gsd-verifier)_

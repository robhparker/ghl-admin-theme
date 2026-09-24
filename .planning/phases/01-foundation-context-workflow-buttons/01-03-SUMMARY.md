---
phase: 01-foundation-context-workflow-buttons
plan: 03
subsystem: ui
tags: [vanilla-js, mutation-observer, header-buttons, action-allowlist, handler-registry, verify-mode, accessibility, dom-shim]

# Dependency graph
requires:
  - phase: 01-foundation-context-workflow-buttons (plan 01)
    provides: "IIFE skeleton, adapter, config validation, renderPlacement/createButtonEl/setState, dom-shim + run.mjs harness, harness.html, NOTICE.md"
  - phase: 01-foundation-context-workflow-buttons (plan 02)
    provides: "applyContext/scheduleContextCheck navigation engine, refuseStaleClick, generation discard rule, recoverNoContactFields, GHLC.__test.renderAll, shim setContact/setPath/setSidebarMode"
provides:
  - "Header placement: renderAll() renders header then contact; header buttons need only a locationId; link buttons are native <a href target rel>"
  - "resolveButtons(config, locationId) with config.locations[id].buttons overrides by button ID via hasOwn: false disables, true enables, object merges label/icon/action (BTN-02)"
  - "resolveAction(button) allowlist: link (isSafeLinkHref: https/mailto/tel or single-slash path, SAFE_TARGETS, rel=noopener noreferrer on _blank), webhook (contact placement only), handler (frozen in-script registry, own-property lookup); everything else unavailable (BTN-09)"
  - "handlers registry: copyContactId(ctx) -> clipboard; runHandler with stale-click and generation guards, ready/failed reporting"
  - "makeIcon(name): svg/path via createElementNS from the frozen ICONS map (mail, link, external, send); unknown or prototype-named keys render nothing"
  - "Observers section: watchMount/unwatchMount one bounded set per placement (rootMo region root childList+subtree, anchorMo region parent childList only), isOwnNode/isSelfInflicted loop guard, scheduleRender coalescing, waitForMount/cancelMountWait bounded 250 ms x 60 retry (BTN-03)"
  - "adapter.findRegionRoot(placement, mount) and adapter.probe() boolean mount map (FND-03 kept: no selector literal outside the adapter, verify section statically checked)"
  - "window.GHLC.verify() / ?ghlc-debug=1 full report: version, url, route, generation, hooksInstalled, config{loaded,enabled,schemaVersion,buttonIds}, mounts{...}, contactFields{email,phone} booleans, buttons[], observers{}, waiting{} (FND-04, DLV-04)"
  - "Disabled/unsupported/unreachable config is a complete no-op: no styles, hooks, observers, DOM, or history patch; warn config-schema-unsupported is distinct from config-invalid (FND-05, FND-06)"
  - "test/run.mjs: notice/harness/verify-section checks; header/actions/a11y/icons/observers/disable/verify/boot scenarios (PASS 73/73, was 45/45)"
affects: [phase-2-branding, phase-3-colors-delivery]

# Actuals (#2632) — same estimateTokens scale as the plan's estimate (chars/4 over the realized diff).
actuals:
  tokens: 18070
  tasks: 2
  commits: 2
plan_head_before: d778b933e3f1c0dd06b7e94b9ebaf43c3a008776

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every config-keyed read (locations, overrides, handlers, icons) goes through hasOwn(); prototype names can never resolve"
    - "Two observers per active placement, both region-scoped: root (subtree) plus shallow parent anchor; never a page-wide subtree observer"
    - "Watch before writing: renderPlacement attaches observers first so its own writes are self-inflicted records the filter drops"
    - "Mount waits are tick-counted setTimeout chains bounded by MOUNT_WAIT_MAX_MS, only while the route expects a missing mount; setInterval is banned"
    - "verify() reaches the DOM only through adapter.probe() and the adapter readers; a static check keeps selector literals out of the verify section"
    - "Config facts observed before adoption (lastSchemaVersion, lastEnabled) are stored so verify() can explain a no-op boot"

key-files:
  created: []
  modified:
    - src/ghl-customizer.js
    - test/run.mjs
    - test/dom-shim.mjs

key-decisions:
  - "SVG_NS and ICONS moved from the buttons section to the constants section (plan placement); ICONS values stay arrays of path strings (multi-path icons) rather than one string per icon"
  - "runHandler applies refuseStaleClick before running, mirroring runWebhook (BTN-05 applies to every action kind)"
  - "isSafeLinkHref also rejects https URLs carrying credentials, matching isSafeHttpsUrl"
  - "Override labels are accepted only when 1..80 characters (same bound validateConfig enforces on base labels); other override shapes are ignored rather than failing the config"
  - "schemaVersion !== 1 short-circuits loadConfig with config-schema-unsupported and never reaches validateConfig, so exactly one warning is emitted; the Plan 01 FND-05 matrix now expects that event and gained a config-invalid case (buttons: null)"
  - "watchMount's already-watching check also requires anchorFor(slot.root) === slot.anchor, so a re-parented region re-anchors instead of watching a stale parent"
  - "No dom-shim change was needed for Task 2: observers() already lists active registrations only and record delivery already matches browser childList semantics (a replaceChild on the parent reaches only observers on that parent)"

patterns-established:
  - "Pattern: self-inflicted record = own target with own additions, or no removals with own additions; anything else is HighLevel's doing and schedules exactly one coalesced render"
  - "Pattern: the observer set follows a replaced region (unwatch old, watch new) inside the render the anchor observer triggered; observer count per placement is a constant 2"
  - "Pattern: disabled paths are proven by footprint assertions (no buttons, groups, observers, listeners, stylesheet link, history patch) plus verify() still answering"

requirements-completed: [FND-02, FND-03, FND-04, FND-05, FND-06, BTN-01, BTN-02, BTN-03, BTN-08, BTN-09, DLV-03, DLV-04]

coverage:
  - id: D1
    description: "Header link buttons render exactly once in the header mount for an in-scope location with the configured href/target and rel=noopener noreferrer on _blank; absent for out-of-scope locations and on agency pages; the fixture's code-looking text never reaches text or attributes"
    requirement: BTN-01
    verification:
      - kind: e2e
        ref: "test/run.mjs#header: link buttons render once in the header mount for an in-scope location"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#header: agency page renders no buttons at all"
        status: pass
    human_judgment: false
  - id: D2
    description: "Location overrides by button ID: locB hides sendInvite, relabels supportLink to 'B Support', and locOnlyLink stays scoped out; prototype-named override keys are ignored"
    requirement: BTN-02
    verification:
      - kind: e2e
        ref: "test/run.mjs#header: location overrides on locB relabel, disable, and scope out"
        status: pass
      - kind: unit
        ref: "test/run.mjs#unit: resolveButtons scopes by location and returns nothing at agency level"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#actions: prototype-named handlers and override keys are ignored"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unknown action types and unregistered or prototype-named handlers render unavailable and execute nothing; unsafe link hrefs (javascript:, protocol-relative, http, data, ftp, credentials) render as disabled buttons while https/path/mailto/tel render as anchors; the registered copyContactId handler copies and reports, and failures re-enable the button"
    requirement: BTN-09
    verification:
      - kind: e2e
        ref: "test/run.mjs#actions: unknown type and unknown handler never execute anything"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#actions: unsafe link hrefs are unavailable, safe ones render anchors"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#actions: handler registry runs copyContactId and reports"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#actions: handler failure reports failed and re-enables"
        status: pass
      - kind: unit
        ref: "test/run.mjs#static: source contains no forbidden tokens (HTML setters, eval, storage, cookies)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every rendered control is a native <button type=button> or <a href>, with no role or tabindex attributes; message spans carry role=status; icons are aria-hidden svgs from the in-script map"
    requirement: BTN-08
    verification:
      - kind: e2e
        ref: "test/run.mjs#a11y: every rendered control is a native button or anchor"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#icons: known icon renders an svg, unknown renders none"
        status: pass
    human_judgment: false
  - id: D5
    description: "Wholesale header or contact-region replacement, the group being removed by a native parent, and the mount's children being wiped each restore the buttons exactly once; the observer set is swapped (never accumulated) and stays at two per active placement; own writes never re-render; fields appearing later flip unavailable to ready through the observer"
    requirement: BTN-03
    verification:
      - kind: e2e
        ref: "test/run.mjs#observers: wholesale header replacement restores header buttons once and swaps the observer set"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#observers: framework wiping our group from the mount re-adds it once"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#observers: contact toolbar re-render keeps one button bound to the current contact"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#observers: own writes do not cause render loops"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#observers: fields appearing later flip unavailable to ready via the observer"
        status: pass
    human_judgment: false
  - id: D6
    description: "A mount that appears after navigation is picked up by the bounded wait; the wait gives up after 15 s with a mount-missing log; a context change cancels it; agency pages end with zero observers"
    requirement: BTN-03
    verification:
      - kind: e2e
        ref: "test/run.mjs#observers: mount appearing after navigation is picked up by the bounded wait"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#observers: bounded wait gives up after MOUNT_WAIT_MAX_MS"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#observers: context change cancels the wait and leaving to agency disconnects everything"
        status: pass
    human_judgment: false
  - id: D7
    description: "GHLC.verify() / ?ghlc-debug=1 report mounts, route, config facts, contact fields as booleans, buttons, observers, and waits; the report never contains email, phone, webhook URL, or config URL; missing mounts report false and the native DOM stays untouched"
    requirement: FND-04
    verification:
      - kind: e2e
        ref: "test/run.mjs#verify: report shape and hygiene"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#verify: missing mounts are reported false and native DOM stays untouched"
        status: pass
      - kind: unit
        ref: "test/run.mjs#static: verify section contains no selector literals (probing goes through adapter.probe)"
        status: pass
    human_judgment: false
  - id: D8
    description: "enabled:false, unsupported schemaVersion, fetch failure, and malformed JSON install no hooks, styles, observers, or DOM, leave history untouched, and verify() still reports config.enabled/schemaVersion; window.GHLC is the only global added"
    requirement: FND-06
    verification:
      - kind: e2e
        ref: "test/run.mjs#disable: enabled false is a complete no-op"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#disable: unsupported schemaVersion is a no-op with one warning"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#disable: config fetch failure is a no-op"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#disable: malformed JSON is a no-op"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#boot: window.GHLC is the only global the script adds"
        status: pass
    human_judgment: false
  - id: D9
    description: "NOTICE.md records the reference project URL, revision ff7c8e4, its missing license, and that nothing was copied; test/harness.html carries the required shell, router hook, config attribute, and no-cors stub"
    requirement: FND-02
    verification:
      - kind: unit
        ref: "test/run.mjs#notice: NOTICE.md records the reference project, its revision, its missing license, and that nothing was copied"
        status: pass
      - kind: unit
        ref: "test/run.mjs#harness: test/harness.html carries the required HighLevel shell, router hook, config, and stub"
        status: pass
    human_judgment: false
  - id: D10
    description: "End-of-phase browser walkthrough in test/harness.html (re-render buttons, Location B overrides, agency page, Back/Forward and switcher, ?ghlc-debug=1 console, Tab focus ring and Enter activation, enabled:false) and the live HighLevel verify() run to confirm or correct the candidate selectors"
    requirement: DLV-03
    verification: []
    human_judgment: true
    rationale: "Visual focus ring, real-browser MutationObserver timing under HighLevel's framework, and the live selector report need a human in a browser and a logged-in HighLevel session (human_verify_mode=end-of-phase)"

# Metrics
duration: 11min
completed: 2026-09-24
status: complete
---

# Phase 01 Plan 03: Header Buttons, Action Allowlist, Scoped Observers, and Verify Mode Summary

**Header link buttons with per-location overrides and a frozen handler registry now render as native anchors/buttons, survive HighLevel re-renders through exactly two region-scoped MutationObservers per placement (root + shallow parent anchor, swapped not accumulated), pick up late mounts with a 15 s tick-bounded wait, and are diagnosable through `GHLC.verify()` / `?ghlc-debug=1` — while a disabled, unsupported, or unreachable config leaves zero footprint. Proven headlessly: `node test/run.mjs` 73/73 (was 45/45).**

## Performance

- **Duration:** 11 min (execution) — started 2026-09-24T16:45:35Z, last task commit 2026-09-24T16:56:35Z
- **Tasks:** 2
- **Files modified:** 3 (`src/ghl-customizer.js`, `test/run.mjs`, `test/dom-shim.mjs`)
- **Tests:** 45 -> 73 (28 new: 3 static/notice/harness checks, 10 header/actions/a11y/icons scenarios, 15 observers/disable/verify/boot scenarios; 6 existing assertions scoped to the contact placement, 1 expectation re-targeted)

## Accomplishments

- **Header placement and overrides (Task 1).** `renderAll()` renders `header` then `contact`; header buttons need only a `locationId`. `resolveButtons` reads `config.locations[locationId].buttons[buttonId]` through `hasOwn`: `false` skips, `true` includes even out of scope, an object includes and shallow-merges `label` (1..80 chars), `icon`, and `action` (replaced whole); `id`, `placement`, `scope` are never overridable. The fixture's `locB` hides `sendInvite` and shows "B Support".
- **Action allowlist and handler registry (BTN-09).** `resolveAction` reads only `type`, `href`, `target`, `url`, `extraFields`, `cooldownMs`, `handler`. `link` requires `isSafeLinkHref` (single-slash path, or `https:`/`mailto:`/`tel:` without credentials) and clamps `target` to `_self`/`_blank`; `webhook` outside the contact placement is "Requires an open contact"; `handler` resolves against the frozen `handlers` object via own-property lookup only (`constructor`, `__proto__`, `toString`, `hasOwnProperty` all render unavailable). The one registered handler, `copyContactId`, writes the contact ID to `navigator.clipboard` and reports "Contact ID copied" / "Clipboard unavailable" / "No contact open". `runHandler` shares `refuseStaleClick` and the generation/`isConnected` discard rule with `runWebhook`.
- **Native controls and icons (BTN-08).** Links are `<a class="ghlc-btn ghlc-btn--link" href target [rel="noopener noreferrer"]>` with no click listener; everything else is `<button type="button">`; unsafe or unknown actions are `<button disabled aria-disabled="true">`. No `role` or focus-order attributes anywhere on controls; `.ghlc-btn__msg` keeps `role="status"`. `makeIcon` builds `svg[viewBox][aria-hidden][focusable=false] > path[d][fill=none][stroke=currentColor]` via `createElementNS` from `ICONS` (`mail`, `link`, `external`, `send`); unknown keys leave the icon span empty.
- **Scoped, bounded observers (Task 2, BTN-03).** See "Observer strategy as implemented" below. Wholesale header replacement (twice in a row, and once inside an extra wrapper div), the group being removed by its native parent, the mount's children being wiped, the contact region being swapped, and a `mailto:` anchor appearing later all restore or recover the buttons exactly once with one `rerender` log each; the observer count stays at 4 on a contact page, 2 on a location dashboard, 0 on agency pages; own writes (boot, `setState`, cooldown flips) never schedule a render.
- **Bounded mount wait.** `waitForMount` chains `setTimeout(MOUNT_WAIT_INTERVAL_MS)` ticks, giving up after `ticks * 250 > 15000` (60 render passes) with a `mount-missing` log; it starts only when the route expects the placement and buttons are desired, is cancelled by `applyContext`, and never uses `setInterval`.
- **Verify mode (FND-04).** Report shape below. `mounts` comes from `adapter.probe()` so the verify section holds no selector literal (new static check). `contactFields` are booleans; the report was asserted to contain none of `jane@`, `5550100`, `hooks/`, `TEST-HOOK`, `leadconnectorhq`, `config.test`, `alert(`.
- **Complete no-op paths (FND-05/06).** `boot()` now runs `ensureStyles()`, `installNavigationHooks()`, and `applyContext('boot')` only after `enabled === true`. `loadConfig` records `state.lastSchemaVersion`/`state.lastEnabled` before validation and emits `config-schema-unsupported` (exactly one line, no `config-invalid`) for `schemaVersion !== 1`. Footprint assertions cover buttons, groups, observers, three window listeners, the stylesheet link, `hooksInstalled`, and the untouched `history.pushState`/`replaceState` references; `window.GHLC` is the only global the script adds.
- **NOTICE.md and harness checks (FND-02, DLV-03).** `test/run.mjs` now asserts NOTICE.md's reference URL, revision hash, "no LICENSE file", and "Nothing was copied", and the harness's shell selectors, `data-config`, `routeChangeEvent`, and `no-cors` stub.

## Task Commits

1. **Task 1: Header link buttons, location overrides, action allowlist, handler registry, icons** - `66438cc` (feat)
2. **Task 2: Scoped observers, bounded mount wait, verify mode, disabled/invalid no-op paths, NOTICE check, final gates** - `5d4ffdd` (feat)

**Plan metadata:** committed with this SUMMARY (docs) — see the completion report for the hash. STATE.md and ROADMAP.md were not touched (orchestrator-owned).

## Files Created/Modified

- `src/ghl-customizer.js` — constants: `SAFE_LINK_SCHEMES`, `SAFE_TARGETS`, `MOUNT_WAIT_INTERVAL_MS`, `MOUNT_WAIT_MAX_MS`, `SVG_NS`, `ICONS` (moved here), `hasOwn`. Adapter: `findRegionRoot`, `probe`. Config: `applyOverride`, rewritten `resolveButtons`, `lastSchemaVersion`/`lastEnabled` capture and `config-schema-unsupported` in `loadConfig`. Context: `state.watch`/`renderTimers`/`mountWaits`/`lastSchemaVersion`/`lastEnabled`; `applyContext` cancels scheduled renders and mount waits. Buttons: `makeIcon`, `handlers`, `isSafeLinkHref`, `unavailable`, rewritten `resolveAction`, anchor branch in `createButtonEl`, `runHandler`, `onButtonClick` dispatch, `renderPlacement` watch/wait integration, `renderAll` header. Observers: `everyNode`, `isOwnNode`, `isSelfInflicted`, `onMountMutation`, `scheduleRender`, `cancelScheduledRender`, `anchorFor`, `watchMount`, `unwatchMount`, `waitForMount`, `scheduleMountTick`, `cancelMountWait`. Verify: full `verify()`. Boot: gated `ensureStyles`; `__test` gains `resolveAction`, `isSafeLinkHref`, `handlers`, `verify`.
- `test/run.mjs` — checks `static: verify section contains no selector literals`, `notice:`, `harness:`; helpers `byId`, `headerGroup`, `contactGroup`, `allElements`, `assertNoCodeText`, `bootWithConfig`, `logCount`, `headerButtons`, `freshHeader`, `bootDashboard`, `disabledShim`, `assertNoFootprint`; 10 Task 1 scenarios; 15 Task 2 scenarios; contact-scoped assertions in `tracer:`, `BTN-04:`, `mount missing:`, `nav: leaving the contact`, `unit: resolveButtons`; FND-05 matrix re-targeted.
- `test/dom-shim.mjs` — `window.alert` throws `alert must never be called`; comment marking `navigator` as injectable. No observer-delivery change was needed.

## Observer strategy as implemented

| Piece | Behavior |
|---|---|
| Region root | `adapter.findRegionRoot(placement, mount)`: header -> `mount.closest(selectors.header) \|\| mount`; contact -> the contact region when it is or contains the mount, else the mount. In the harness and shim the contact region and mount are the same `.hl_contact-details-header` element. |
| Anchor | `anchorFor(root)`: `root.parentNode` when it is an Element, else `document.body`. |
| `rootMo` | `observe(root, { childList: true, subtree: true })` — sees the mount swapped inside the region, its children wiped, our group removed, contact fields appearing later. |
| `anchorMo` | `observe(anchor, { childList: true, subtree: false })` — sees the region itself replaced (a childList mutation on the region's parent, invisible from inside the region). Shallow, so it wakes only for direct children of that parent. |
| Self-inflicted filter | A record is dropped when (a) its target is own and every added node is own (removed children of an own node are own by construction), or (b) nothing was removed and every added node is own. Own = element with `data-ghlc-button-id` or `data-ghlc-styles`, the group, anything inside a group, or a text node with an own parent. |
| Coalescing | Any non-self-inflicted record in a batch -> `scheduleRender(placement)`: one `setTimeout(0)` per placement, replaced on each wake, logging `rerender {placement}`. |
| Swap, never accumulate | `renderPlacement` calls `watchMount` before writing; it is a no-op while the same mount is watched, its anchor is connected, and the root still sits under that anchor; otherwise it disconnects the old pair and attaches a new pair on the new root/anchor. Missing mount or no desired buttons -> `unwatchMount`. |
| Bounded wait | `waitForMount` only when the route expects the placement (header: `locationId`; contact: `contactId`) and buttons are desired: tick every 250 ms, give up after 60 ticks (`mount-missing`), cancelled on context change and whenever the mount is found. |
| Counts observed | Contact page 4 observers, location dashboard 2, agency 0; `observer-attached` logged once per attach, `observer-detached` once per detach. |

## `verify()` report shape (as implemented)

```js
{
  version: '0.1.0',
  url: '/v2/location/locA/contacts/detail/c1',      // pathname only (IDs)
  route: { locationId: 'locA', contactId: 'c1', isAgency: false },
  generation: 1,
  hooksInstalled: true,
  config: { loaded: true, enabled: true, schemaVersion: 1,
            buttonIds: ['sendInvite', 'supportLink', 'locOnlyLink', 'badTypeBtn', 'badHandlerBtn', 'copyIdBtn'] },
  mounts: { sidebar: true, header: true, headerMount: true, contactMount: true, contactRegion: true,
            sidebarLogo: false, headerLogo: false, locationSwitcher: true, backToAgency: true },
  contactFields: { email: true, phone: true },       // booleans only, never values
  buttons: [{ id, placement, state }, ...],
  observers: { header: true, contact: true },
  waiting: { header: false, contact: false }
}
```

On a disabled boot `config` reads `{ loaded: false, enabled: false, schemaVersion: 1, buttonIds: [] }`; on `schemaVersion: 2` it reads `{ loaded: false, enabled: true, schemaVersion: 2, ... }`; on a fetch or parse failure `enabled` and `schemaVersion` are `null`.

## Live-account verify output

```json
{
  "config": { "loaded": true, "enabled": true, "schemaVersion": 1, "buttonIds": ["sendInvite", "helpCenter"] },
  "route": { "locationId": "iDPNGKoFsjvf9wUCrk3V", "contactId": "Q7c2Whf2KdoKSzPbNN7K", "isAgency": false },
  "generation": 1, "hooksInstalled": true,
  "mounts": {
    "sidebar": true, "header": true, "headerMount": true, "headerLogo": true, "sidebarLogo": true,
    "locationSwitcher": true, "backToAgency": false,
    "contactRegion": true, "contactMount": true, "contactMountVia": "toolbar-anchor",
    "contactEmailField": true, "contactPhoneField": true
  },
  "contactFields": { "email": true, "phone": false, "emailCandidates": 0, "phoneCandidates": 1 },
  "buttons": [ { "id": "helpCenter", "placement": "header", "state": "ready" }, { "id": "sendInvite", "placement": "contact", "state": "ready" } ],
  "observers": { "header": true, "contact": true },
  "waiting": { "header": false, "contact": false, "contactFields": false }
}
```
Captured 2026-09-24 on app.gohighlevel.com, agency Park Health Systems, location Dummy Clinic, sample contact "(Example) Jordan Smith", script served from an HTTPS test host and injected with `data-config`/`data-css`. `backToAgency: false` is expected: `#backButtonv2` does not exist in the current UI. The class-based contact selectors from community guides did not resolve; the adapter now targets `#record-details-lhs`, the `#delete-contact-trigger` name row, and the `contact.email` / `contact.phone` stateful fields (commit 9e173b9).

## Decisions Made

- `SVG_NS` and `ICONS` moved to the constants section per the plan's artifact table; the existing multi-path icon definitions were kept (arrays of path strings, each under 120 characters) rather than flattened to one path per icon.
- `runHandler` runs `refuseStaleClick` first: BTN-05's click-time revalidation applies to every action kind, not only webhooks.
- `isSafeLinkHref` rejects `https://user:pw@host/` for consistency with `isSafeHttpsUrl`; the plan's scheme list is otherwise unchanged.
- `schemaVersion !== 1` short-circuits before `validateConfig`, so the unsupported-schema path emits exactly one warning; the Plan 01 FND-05 matrix now expects `config-schema-unsupported` for that case and gained a `buttons: null` case that still expects `config-invalid`.
- `watchMount` additionally compares `anchorFor(slot.root)` with the stored anchor, so a re-parented region re-anchors (beyond the plan's mount + anchor.isConnected check).
- `test/dom-shim.mjs` needed only the `window.alert` trap: `observers()` already filtered inactive registrations and record delivery already matched the browser semantics the plan describes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-Plan-03 assertions assumed no header buttons**
- **Found during:** Task 1 (first run after `renderAll` gained the header placement)
- **Issue:** `tracer:`, `BTN-04:`, `mount missing:`, and `nav: leaving the contact` asserted zero `[data-ghlc-button-id]` / `.ghlc-group` in the whole document, and `unit: resolveButtons` expected `sendInvite` on `locB`, which the fixture's override now disables (BTN-02). All five contradicted the plan's own Task 1 behavior.
- **Fix:** Scoped those assertions to `[data-ghlc-placement="contact"]` (and asserted the header group is present where a location is active); the resolveButtons unit now asserts the override and proves `sendInvite` returns on `locB` when `locations` is empty. `mount missing:` additionally snapshots `<main>`'s child nodes to prove the native DOM is untouched.
- **Files modified:** test/run.mjs
- **Verification:** 55/55 after Task 1
- **Committed in:** 66438cc

**2. [Rule 1 - Bug] FND-05 matrix expected `config-invalid` for `schemaVersion: 2`**
- **Found during:** Task 2 (after adding the distinct `config-schema-unsupported` event the plan requires)
- **Issue:** The Plan 01 scenario's schema case expected the generic event; the plan's `disable:` scenario 10 requires exactly one `config-schema-unsupported` line and none of `config-invalid`.
- **Fix:** Re-targeted that case and added a `buttons: null` case that still exercises `config-invalid`.
- **Files modified:** test/run.mjs
- **Verification:** 73/73
- **Committed in:** 5d4ffdd

**3. [Rule 3 - Blocking] FND-03 gate flagged `.hl_header` in a JSDoc comment**
- **Found during:** Task 2 (first run)
- **Issue:** The `watchMount` rationale named `.hl_header` literally; the static gate scans comments too.
- **Fix:** Reworded to "the entire header element or contact header element".
- **Files modified:** src/ghl-customizer.js
- **Verification:** `static: FND-03` passes
- **Committed in:** 5d4ffdd

### Additions beyond the plan (no scope change)

- `actions: unknown type…` also checks `resolveAction` on a header webhook ("Requires an open contact"), a null action, and a non-string handler name.
- `actions: unsafe link hrefs…` adds credentialed https and empty href to the unsafe set, and a `_blank` control to prove `rel` is only added there.
- `observers: framework wiping…` also covers a native node appearing in the mount and the mount's children being wiped wholesale.
- `observers: bounded wait gives up…` proves nothing polls after the bound and that a mount appearing after the bound waits for the next navigation.
- `disable:` scenarios share `assertNoFootprint` (buttons, groups, observers, three listeners, stylesheet, hooks, configLoaded) and the `enabled false` case re-checks after 16 s of virtual time.
- `boot:` scenario also pins `Object.keys(GHLC)` to `['__test', 'ready', 'verify', 'version']`.

---

**Total deviations:** 3 auto-fixed (2 test expectations superseded by the plan's own behavior, 1 comment wording blocked by a static gate). No scope creep; no new HighLevel selectors beyond the CONTEXT candidate table; `test/harness.html` untouched.

## Issues Encountered

- Cross-realm `assert.deepEqual` on a vm-realm array (same quirk Plan 01 hit) — wrapped through `plain()`.
- A comment in `createButtonEl` contained the word the BTN-08 grep gate forbids (`tabindex`); reworded so `grep -c 'tabindex'` is 0.
- As in Plans 01/02, the sandbox refuses compound Bash commands that name `.git/` paths, so the on-disk commit ledger file could not be written; the ledger base is the orchestrator-supplied worktree base `d778b933e3f1c0dd06b7e94b9ebaf43c3a008776` and `commits: 2` was measured with `git rev-list --count d778b93…..HEAD`.

## Known Stubs

None. Every action kind in the allowlist is implemented; `sidebarLogo`/`headerLogo` are reserved adapter selectors (D-07) that `verify()` reports as booleans, not stubs.

## Threat Flags

None beyond the plan's register. T-01-01 (`ACTION_TYPES` + frozen `handlers` + `hasOwn`: `actions:4`, `actions:7`, forbidden-token gate), T-01-08 (`isSafeLinkHref`, `SAFE_TARGETS`, `rel`: `actions:8`), T-01-02 (`textContent`/`setAttribute`/`createElementNS` only; `assertNoCodeText` walks every attribute: `header:1`, `actions:8`), T-01-12 (self-inflicted filter, coalesced render, two region-scoped observers swapped not accumulated, bounded wait, `setInterval` gate: `observers:1,2,4,6`), T-01-13 (`hasOwn` everywhere: `actions:7`, `icons:`), T-01-03 (booleans-only `contactFields`, report hygiene: `verify:13`), T-01-14 (boot gates styles/hooks/observers/DOM: `disable:9-12`, `boot:15`), T-01-SC (no installs; `package.json` still declares no dependencies) are all as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1's automated surface is complete: all 26 requirement IDs are implemented across Plans 01-03; FND-02, FND-04, FND-06, BTN-02, BTN-03, BTN-09 close here.
- **End-of-phase human check (browser, `npm run serve`, `http://localhost:5173/test/harness.html`):** (a) Location A · Contact X shows "Send Invite" plus header links "Support" and the locA-only link; click "Re-render header" and "Re-render contact toolbar" and confirm each button still appears exactly once; (b) Location B · Contact Z shows "B Support", no locA-only link, no Send Invite; (c) Agency dashboard shows no customizer buttons; (d) Back/Forward and the sidebar switcher rebind correctly; (e) open with `?ghlc-debug=1`, confirm the console `[ghlc] verify` object lists mounts and route with no email/phone/URL values, and run `GHLC.verify()` manually; (f) Tab through the header links and Send Invite, confirm the focus ring, press Enter on Send Invite; (g) set the fixture's `enabled` to false temporarily, reload, confirm nothing renders, restore.
- **Live HighLevel check:** paste the snippet, open a contact record with `?ghlc-debug=1`, and paste the verify output into this SUMMARY's "Live-account verify output" section; any `mounts.*` false (other than the reserved logo mounts) names a candidate selector to correct in `adapter.selectors` before Phase 2.
- Phase 2 (branding) has `adapter.selectors.sidebarLogo`/`headerLogo`, `adapter.probe()`, and the observer section's `watchMount` pattern as its seams; Phase 3 (colors/delivery) pins `DEFAULT_CONFIG_URL` and can override the `--ghlc-*` tokens per location.

---
*Phase: 01-foundation-context-workflow-buttons*
*Completed: 2026-09-24*

## Self-Check: PASSED

- Files: src/ghl-customizer.js, test/run.mjs, test/dom-shim.mjs, and this SUMMARY exist on disk
- Commits: 66438cc (Task 1) and 5d4ffdd (Task 2) present on worktree-agent-ac89b21ba33abbc87
- `node test/run.mjs` exits 0, last line `PASS 73/73` (was 45/45 at plan start); `node --check src/ghl-customizer.js` exits 0
- STATE.md and ROADMAP.md unchanged versus base d778b93 (orchestrator owns those writes)

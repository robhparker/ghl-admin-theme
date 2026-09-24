---
phase: 01-foundation-context-workflow-buttons
plan: 01
subsystem: ui
tags: [vanilla-js, iife, highlevel, webhook, dom-adapter, test-harness, node-vm]

# Dependency graph
requires: []
provides:
  - "src/ghl-customizer.js: single IIFE with constants/adapter/config/context/buttons/observers/verify/boot sections, window.GHLC, gated GHLC.__test"
  - "adapter object holding every HighLevel selector, route regex, event name, and contact email/phone reader"
  - "Config loading from the script tag's data-config attribute (DEFAULT_CONFIG_URL fallback), https/same-origin only, schemaVersion 1 validation, enabled flag"
  - "Send Invite contact webhook button: ready -> submitting -> queued/failed with the D-02 payload and generation-guarded completion"
  - "safe() diagnostics guard: booleans, numbers, and short ID-shaped strings only"
  - "src/ghl-customizer.css: .ghlc- scoped stylesheet with --ghlc-* tokens and data-state variants; ensureStyles() injection"
  - "config/agency-config.json sample and test/fixtures/config.json fixture"
  - "test/dom-shim.mjs: dependency-free window/document/history/fetch/MutationObserver/timers for node:vm"
  - "test/run.mjs: static gates + end-to-end scenarios printing PASS n/n"
  - "test/harness.html: offline HighLevel shell with fake router, fetch stub, re-render controls"
  - "package.json: type module, test and serve scripts, zero dependencies"
affects: [01-02, 01-03, phase-2-branding, phase-3-colors-delivery]

# Actuals (#2632) — same estimateTokens scale as the plan's estimate (chars/4 over the realized diff).
actuals:
  tokens: 26400
  tasks: 2
  commits: 2
plan_head_before: d5c30cf432b9ea85e3ae4c314e4881001a0d5e6b

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single frozen adapter object for all third-party DOM knowledge; static test forbids selector literals elsewhere"
    - "Generation counter compared after every await before touching the DOM (stale-context guard)"
    - "Button element bound to one locationId|contactId pair via data-ghlc-ctx; reconcile removes rather than reuses across contexts"
    - "Diagnostics pass through safe(): IDs and states only"
    - "Core payload keys assigned last so config extraFields cannot override identity"
    - "vm-run the production IIFE inside a hand-written DOM shim for dependency-free end-to-end tests"

key-files:
  created:
    - src/ghl-customizer.js
    - src/ghl-customizer.css
    - config/agency-config.json
    - test/fixtures/config.json
    - test/dom-shim.mjs
    - test/run.mjs
    - test/harness.html
    - package.json
  modified: []

key-decisions:
  - "OWN gained labelSel and msgSel, and buttons carry data-ghlc-label, so setState can re-derive the config label without a selector literal (FND-03 gate)"
  - "renderPlacement removes the .ghlc-group when no buttons are desired instead of leaving an empty div in native UI"
  - "Tracer scenarios run with ?ghlc-debug=1 so the DLV-04 no-leak assertion exercises the safe() guard on real log output"
  - "Section markers sit at column 0 inside the IIFE so the plan's grep gates (^// ==== x ====$) hold"
  - "DEFAULT_CONFIG_URL is the provisional slug https://cdn.jsdelivr.net/gh/robhparker/admin-theme@v0.1.0/config/agency-config.json; Phase 3 pins the real tag"

patterns-established:
  - "Section markers: eight exact comment lines at column 0, order constants/adapter/config/context/buttons/observers/verify/boot"
  - "Own-element selectors live in OWN (constants), never as literals at call sites"
  - "Test runner: check(name, fn) for static gates, scenario(name, async fn) for shim runs, plain() to strip vm-realm prototypes before deepEqual"

requirements-completed: [FND-01, FND-03, FND-05, LOC-01, BTN-01, BTN-04, BTN-07, BTN-08, BTN-10, BTN-11, BTN-13, DLV-03]

coverage:
  - id: D1
    description: "Contact record in a configured location shows exactly one Send Invite <button> with data-state=ready inside .ghlc-group[data-ghlc-placement=contact]"
    requirement: BTN-04
    verification:
      - kind: e2e
        ref: "test/run.mjs#tracer: contact page renders Send Invite; click POSTs once and shows queued"
        status: pass
    human_judgment: false
  - id: D2
    description: "Click moves ready -> submitting -> queued ('Workflow triggered'); exactly one POST with contactId, locationId, buttonId, requestId (UUID v4), sentAt, email, phone; extraFields cannot override core keys"
    requirement: BTN-10
    verification:
      - kind: e2e
        ref: "test/run.mjs#tracer: contact page renders Send Invite; click POSTs once and shows queued"
        status: pass
    human_judgment: false
  - id: D3
    description: "Non-2xx and network failures move the button to failed with a message that excludes the URL and payload; retry issues a fresh requestId"
    requirement: BTN-11
    verification:
      - kind: e2e
        ref: "test/run.mjs#tracer: 500 response shows failed without leaking the URL"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#tracer: network failure shows failed with a connection message"
        status: pass
    human_judgment: false
  - id: D4
    description: "Config fetched from data-config, validated as schemaVersion 1; enabled:false, invalid schema, HTTP error, parse error, and non-https cross-origin URL all no-op"
    requirement: FND-05
    verification:
      - kind: e2e
        ref: "test/run.mjs#FND-05: enabled:false, invalid schema, fetch failure, and parse failure all no-op"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#FND-05: non-https, cross-origin config URL is rejected before fetch"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every HighLevel selector and route regex lives in the adapter; no selector literal outside it; no HTML-string, eval, or storage APIs in src"
    requirement: FND-03
    verification:
      - kind: unit
        ref: "test/run.mjs#static: FND-03 — no selector literals or HighLevel strings outside the adapter section"
        status: pass
      - kind: unit
        ref: "test/run.mjs#static: source contains no forbidden tokens (HTML setters, eval, storage, cookies)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Diagnostics never carry the webhook URL, payload, email, phone, or requestId, even in debug mode"
    requirement: DLV-04
    verification:
      - kind: e2e
        ref: "test/run.mjs#tracer: contact page renders Send Invite; click POSTs once and shows queued (assertNoLeak)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Sample config ships sendInvite (contact/webhook/REPLACE_ME) and helpCenter (header/link) with no secret-like keys"
    requirement: BTN-13
    verification:
      - kind: unit
        ref: "test/run.mjs#config: both JSON files parse, validate, use HTTPS webhooks, and carry no secret-like keys"
        status: pass
    human_judgment: false
  - id: D8
    description: "test/harness.html renders the fake HighLevel shell, loads the real script and stylesheet, and exercises Send Invite against 200/500/CORS/offline stubs with visible state styling and a focus ring"
    requirement: DLV-03
    verification:
      - kind: other
        ref: "python3 -m http.server smoke: harness.html, fixtures/config.json, ghl-customizer.js, ghl-customizer.css all served 200"
        status: pass
    human_judgment: true
    rationale: "Visual styling, the focus ring, and the Sending… -> Workflow triggered transition in a real browser need a human eye; end-of-phase human check per human_verify_mode"

# Metrics
duration: 16min
completed: 2026-09-24
status: complete
---

# Phase 01 Plan 01: Walking Skeleton — Send Invite Tracer Summary

**One vanilla IIFE that reads a public config, resolves location/contact from the URL through a single adapter, renders Send Invite on the contact toolbar, and POSTs the D-02 payload to a HighLevel Inbound Webhook — proven end-to-end headlessly (`node test/run.mjs`, 21/21) and offline in a browser harness.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-24T16:14:15Z
- **Completed:** 2026-09-24T16:29:51Z
- **Tasks:** 2
- **Files modified:** 8 (all created)

## Accomplishments

- Full vertical slice works: script load -> `data-config` fetch -> `schemaVersion 1` validation -> URL context via `adapter.parseRoute` -> contact mount lookup -> `<button data-ghlc-button-id="sendInvite">` -> click -> one `POST` (`contactId`, `locationId`, `buttonId`, `requestId` UUID v4, `sentAt`, `email`, `phone`, safe `extraFields`) -> `queued` / "Workflow triggered"; 500 and network errors -> `failed` with a message that never contains the URL or payload.
- Stale-context and identity guards are in place from day one: `data-ghlc-ctx` binds each element to `locationId|contactId`, `state.generation` is compared after the webhook await, and core payload keys are assigned last (fixture proves `contactId: "SHOULD-NOT-WIN"` loses).
- Dependency-free test infrastructure: `test/dom-shim.mjs` (selector engine, events, history/popstate, virtual timers, fetch recorder with `ok/error/cors/offline/hold` modes, MutationObserver with real record delivery) and `test/run.mjs` (static gates for FND-03/BTN-09/DLV-04, config checks, 10 scenarios).
- Browser twin: `test/harness.html` with the CONTEXT selector table reproduced, a history-based router, re-render buttons, `routeChangeEvent` dispatch, and a webhook stub radio group; `npm run serve` verified to serve every asset with HTTP 200.

## Task Commits

1. **Task 1: End-to-end Send Invite — one contact, one webhook POST, one queued state** - `3ccfe3e` (feat)
2. **Task 2: Offline harness and scoped stylesheet** - `a058350` (feat)

**Plan metadata:** committed with this SUMMARY (docs) — see the completion report for the hash.

## Files Created/Modified

- `src/ghl-customizer.js` - The IIFE. Sections: constants (`VERSION`, `NS`, `DEFAULT_CONFIG_URL`, `DEFAULT_COOLDOWN_MS`, `ACTION_TYPES`, `STATES`, `OWN`, `DEBUG`, `safe/log/warn`), adapter, config (`configUrl`, `isAllowedConfigUrl`, `isSafeHttpsUrl`, `validateConfig`, `loadConfig`, `resolveButtons`), context (`state`, `computeContext`, `applyContext`), buttons (icons, `resolveAction`, `setState`, `createButtonEl`, reconcile, `uuid`, `buildPayload`, `sendWebhook`, `runWebhook`, `onButtonClick`), observers (marker only), verify, boot (`ensureStyles`, `getState`, `boot`, test gate).
- `src/ghl-customizer.css` - `.ghlc-group` tokens, `.ghlc-btn`, `.ghlc-btn--link`, `__icon/__label/__msg`, `data-state` variants, `focus-visible` ring, reduced-motion transition. Every rule starts with `.ghlc-`.
- `config/agency-config.json` - Sample: `sendInvite` (contact/webhook/`REPLACE_ME`, cooldown 10000) and `helpCenter` (header/link).
- `test/fixtures/config.json` - `locA`/`locB` with overrides; `sendInvite`, `supportLink`, `locOnlyLink`, `badTypeBtn` (`type: "script"`, `code: "alert(1)"`), `badHandlerBtn`, `copyIdBtn`.
- `test/dom-shim.mjs` - `createShim()` and the shim API (see below).
- `test/run.mjs` - `check()`/`scenario()` runner, `FORBIDDEN`, `SECTION_MARKERS`, `ADAPTER_ONLY`, `plain()`; final `PASS n/n` / `FAIL k/n`.
- `test/harness.html` - Offline shell + router + fetch stub + control panel.
- `package.json` - `type: module`; `test`, `serve`; no dependency keys.

## Interfaces as implemented

### `window.GHLC`

`{ version: '0.1.0', ready: Promise<boolean> | null, verify(): { version, route, generation } }` — `ready` is `null` until `boot()` runs. `verify()` logs `[ghlc] verify` with the report.

### `GHLC.__test` (exact surface; present only when `globalThis.__GHLC_TEST__ === true`)

`parseRoute(pathname)`, `resolveButtons(config, locationId)`, `isSafeHttpsUrl(value)`, `validateConfig(obj)`, `boot()`, `getState()`, `applyContext(reason)`, `adapter`. Matches the plan's interfaces block exactly; in test mode the IIFE does not auto-boot.

### `OWN` (superset of the plan)

`groupClass`, `groupSel`, `buttonSel`, `styleLinkSel` as specified, plus **`labelSel` (`.ghlc-btn__label`) and `msgSel` (`.ghlc-btn__msg`)** so `setState` can locate child spans via a constant. Buttons also carry **`data-ghlc-label`** (the config label) so state resets never need the button object.

### `adapter`

Exactly the keys in the plan's interfaces block, all from the CONTEXT candidate table; no selectors were guessed beyond it. `findContactRegion()` falls back to the nearest ancestor of the contact mount whose class contains `contact`. `readContactEmail` strips `mailto:`, drops `?query`, percent-decodes, trims; `readContactPhone` strips `tel:` and trims only.

### `DEFAULT_CONFIG_URL`

`https://cdn.jsdelivr.net/gh/robhparker/admin-theme@v0.1.0/config/agency-config.json` — provisional; the repo has no GitHub remote yet and Phase 3 pins the final tag. `data-config` always wins.

### `test/dom-shim.mjs` API (as implemented; additions vs. the plan marked +)

- `createShim({ pathname, search, origin, configUrl, fixture })` — `fixture` defaults to a minimal valid config when omitted.
- `shim.window`, `shim.document`, `+shim.context` (the vm context, for running src without the test flag).
- `shim.el(tag, attrs, children)`; `shim.buildShell({ sidebarMode, contact })` returns `{ sidebar, header, headerControls, main, contactRegion }` and clears `body` first, so it is safe to call once per scenario. `contact` accepts `{ name?, email?, phone? }`.
- `shim.run(src)` — sets `__GHLC_TEST__ = true`, appends a `<script src="https://cdn.test/ghl-customizer.js" data-config=...>` to head, sets `document.currentScript`, runs, returns `window.GHLC`.
- `shim.setFetchMode('ok'|'error'|'cors'|'offline'|'hold')`, `shim.releaseFetch()`, `shim.fetchLog` entries `{ url, method, mode, credentials, headers (lower-cased keys), body, bodyJson, time }` for `/hooks/` URLs only.
- `shim.setConfigResponse({ status, body })` — `body` may be an object (stringified) or a raw string (for parse failures).
- `shim.navigate(path, { via })`, `shim.back()`, `shim.forward()` — `pushState`/`replaceState` call through `window.history` so a patched `pushState` is exercised; `popstate`/`routeChangeEvent` set the URL silently and dispatch the event.
- `shim.flush()`, `shim.advanceTimers(ms)` (steps the virtual clock timer by timer, `+shim.now`).
- `shim.console.lines` — each line is prefixed with its level (`info: ...`, `warn: ...`).
- `shim.listenerCount(target, type)`, `shim.observers()`.
- `+shim.errors` — exceptions thrown inside listeners, timers, or observer callbacks (scenarios assert it stays empty).
- `+` Element extras: `closest`, `matches`, `> ` child combinator, attribute mutation records (`attributes` / `attributeFilter`), `style` bag, `setInterval`/`clearInterval`, `requestAnimationFrame`, `PopStateEvent`; `Event`, `CustomEvent`, `MutationObserver` are also named exports.

### Log events emitted

`context`, `disabled`, `config-url-rejected`, `config-fetch-failed`, `config-parse-failed`, `config-invalid`, `webhook-unavailable`, `webhook-start`, `webhook-discarded` — all through `safe()`.

## Decisions Made

- `OWN.labelSel` / `OWN.msgSel` + `data-ghlc-label`: the FND-03 gate forbids `querySelector('...')` literals outside the adapter, and `setState(el, ...)` needs the label/message spans and the original label. Constants keep the gate green without threading the button object through every call.
- Empty desired set removes the group: leaving an empty `div.ghlc-group` inside HighLevel's toolbar would be a visible artifact (8px margin) on contact pages with no buttons.
- Debug mode on in tracer scenarios: with `DEBUG` off `log()` is silent, so a no-leak assertion would be vacuous. `?ghlc-debug=1` makes every `log()` line real, and the assertion proves `safe()` redacts.
- Markers at column 0: the plan's acceptance gates use `^// ==== x ====$`, so the marker lines are not indented inside the IIFE body.
- `resolveButtons` returns `[]` for agency-level pages (plan left this to discretion; documented in the JSDoc).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cross-realm `assert.deepEqual` in test/run.mjs**
- **Found during:** Task 1 (first test run)
- **Issue:** Objects returned from the vm realm have a different `Object.prototype`, so strict `deepEqual` failed with "Values have same structure but are not reference-equal" on `parseRoute`, `validateConfig`, `resolveButtons`, and `verify().route`.
- **Fix:** Added `plain()` (`JSON.parse(JSON.stringify(v))`) and compared through it.
- **Files modified:** test/run.mjs
- **Verification:** 20/20 then 21/21 pass
- **Committed in:** 3ccfe3e

**2. [Rule 3 - Blocking] Section markers indented inside the IIFE**
- **Found during:** Task 1 (first test run)
- **Issue:** The markers were written with two-space indentation, which fails both the runner's exact-line check and the plan's `^// ==== x ====$` grep gates.
- **Fix:** Moved the eight marker lines to column 0.
- **Files modified:** src/ghl-customizer.js
- **Verification:** `grep -c '^// ==== adapter ====$'` == 1 for all eight
- **Committed in:** 3ccfe3e

### Additions beyond the plan (no scope change)

- Extra checks/scenarios in `test/run.mjs`: ES2019 syntax gate (`??` / `?.`), `parseRoute` / `isSafeHttpsUrl` / `validateConfig` / `resolveButtons` units, network-failure scenario, D-02 unavailable scenario, BTN-04 dashboard scenario, missing-mount scenario, FND-05 no-op matrix, config-URL rejection, stylesheet injection, and a production-mode run (no `__test`, self-boot, `verify()` report).
- Shim extras listed above (`errors`, `context`, `now`, child combinator, attribute records, intervals).

---

**Total deviations:** 2 auto-fixed (2 blocking), both test-infrastructure corrections in the first commit. No scope creep; no HighLevel selectors invented.

## Issues Encountered

- The sandbox refused compound Bash commands that mention `.git/` paths, so the on-disk commit ledger/sentinel files from the commit protocol could not be written. The ledger base is the known worktree base `d5c30cf432b9ea85e3ae4c314e4881001a0d5e6b`; `commits: 2` was measured with `git rev-list --count d5c30cf…..HEAD`.

## Known Stubs

None. The `observers` section is intentionally a marker plus a comment — Plan 03 fills it with the scoped MutationObservers and navigation listeners; nothing renders from it in this plan. Header buttons, `link`/`handler` actions, the no-cors retry (D-11), and the cooldown (BTN-12) are Plan 02/03 expansion tasks; unresolved actions render `unavailable` ("Action not available") rather than silently doing nothing.

## Threat Flags

None beyond the plan's register. T-01-01 (allowlist + FORBIDDEN scan), T-01-02 (createElement/textContent/setAttribute only), T-01-03 (`safe()` + no-leak assertions), T-01-05 (`data-ghlc-ctx` + generation compare), T-01-06 (`isAllowedConfigUrl` + `credentials: 'omit'`), T-01-07 (core keys last; fixture proves it), and T-01-SC (zero dependencies; `node:`-only imports gate) are all mitigated and tested.

## User Setup Required

None - no external service configuration required. The harness runs from `npm run serve` (python3 http.server on port 5173).

## Next Phase Readiness

- Plan 02 (navigation, generation, no-cors retry, cooldown) can build directly on `applyContext`, `state.timers`, `adapter.events`, `shim.navigate/back/forward/advanceTimers`, and `setFetchMode('cors'|'hold')`.
- Plan 03 (header buttons, link/handler actions, observers, verify mode) has `renderPlacement('header')`, `resolveAction`, the `observers` section, and `verify()` as its seams; `shim.observers()`/`listenerCount()` and `buildShell`'s `#location-switcher-sidbar-v2` / `#backButtonv2` are ready for its assertions.
- End-of-phase human check: `npm run serve`, open `http://localhost:5173/test/harness.html`, click "Location A · Contact X", press Send Invite (expect "Sending…" then "Workflow triggered" and one log entry with cX/locA/sendInvite), switch the stub to "error (500)", go to Contact Y, confirm "Failed — retry" with no URL on the button, and Tab to the button for the focus ring.
- Live HighLevel selector verification remains blocked on a logged-in session (Plan 03 verify mode).

---
*Phase: 01-foundation-context-workflow-buttons*
*Completed: 2026-09-24*

## Self-Check: PASSED

- Files: all 8 source/test files plus this SUMMARY exist on disk
- Commits: 3ccfe3e (Task 1) and a058350 (Task 2) present on worktree-agent-a953a54db5a7f7ffa
- STATE.md and ROADMAP.md unchanged versus base d5c30cf (orchestrator owns those writes)

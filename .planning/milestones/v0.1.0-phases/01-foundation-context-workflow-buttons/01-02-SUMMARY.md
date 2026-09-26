---
phase: 01-foundation-context-workflow-buttons
plan: 02
subsystem: ui
tags: [vanilla-js, spa-navigation, history-api, generation-token, webhook, cooldown, no-cors, dom-shim]

# Dependency graph
requires:
  - phase: 01-foundation-context-workflow-buttons (plan 01)
    provides: "IIFE skeleton, adapter, state/applyContext/renderPlacement/createButtonEl/setState, sendWebhook tracer, dom-shim + run.mjs harness"
provides:
  - "installNavigationHooks(): once-only history.pushState/replaceState patch dispatching ghlc:navigate; popstate / routeChangeEvent / ghlc:navigate listeners"
  - "scheduleContextCheck(reason): zero-delay coalesced applyContext; state.navTimer outside state.timers"
  - "refuseStaleClick(): click-time revalidation of data-ghlc-ctx + data-ghlc-generation against adapter.parseRoute(location.pathname) (BTN-05)"
  - "sendWebhook(url, payload) -> { outcome: ok | unconfirmed | failed | network, status, message? } with exactly one no-cors retry (D-11)"
  - "startCooldown(): per-element cooldown in state.timers (action.cooldownMs, default 10 s), cleared on context change (BTN-12)"
  - "Render-time D-02: data-ghlc-reason=no-contact-fields + unavailable when no email/phone readable; recoverNoContactFields() on re-render; bindClick() one listener per element (data-ghlc-bound)"
  - "GHLC.__test.renderAll() re-render hook with no generation bump"
  - "shim.setPath / setContact / setSidebarMode; shared buildContactRegion"
  - "test/run.mjs: DLV-04 console static gate; nav:*, stale:*, ctx:*, webhook:*, logs:* scenarios (PASS 45/45)"
affects: [01-03, phase-2-branding, phase-3-colors-delivery]

# Actuals (#2632) — same estimateTokens scale as the plan's estimate (chars/4 over the realized diff).
actuals:
  tokens: 9665
  tasks: 2
  commits: 2
plan_head_before: dbb4a30a4490ab7da4f5646f16dd6eb0ec9b33ef

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Navigation signals never render directly; they coalesce through one zero-delay timer into applyContext"
    - "The pending navigation timer lives outside state.timers so the context change it causes cannot cancel it"
    - "Click-time revalidation: element attributes (ctx, generation) are compared against the live URL before any fetch"
    - "Fixed message strings with only the HTTP status interpolated; MSG_* constants next to sendWebhook"
    - "Reconcile survivors are recovered in place (no-contact-fields -> ready) and never re-stamped with a new generation"
    - "Test-only re-render goes through GHLC.__test.renderAll(), never applyContext('boot')"

key-files:
  created: []
  modified:
    - src/ghl-customizer.js
    - test/dom-shim.mjs
    - test/run.mjs

key-decisions:
  - "history.pushState/replaceState are patched on the history instance (not History.prototype) via a wrapper that applies the original with the same this/arguments and returns its value; the ghlc:navigate dispatch is wrapped in try/catch"
  - "applyContext logs a new `nav` event and keeps the Plan 01 `context` event; both go through safe()"
  - "The no-cors retry sends the identical JSON body (same requestId) with no Content-Type header, so downstream dedupe sees one request"
  - "Both queued variants (ok and unconfirmed) start the cooldown; failed/network leave the element enabled with no cooldown so retry is immediate"
  - "The D-02 click-time re-read also stamps data-ghlc-reason so a later re-render can recover an element whose fields disappeared after render"
  - "The Plan 01 D-02 scenario (ready -> click -> unavailable) was rewritten to remove the anchors after render, because Task 2 makes a record with no fields unavailable at render time"

patterns-established:
  - "Pattern: one coalesced context check per navigation burst (scheduleContextCheck), never one render per signal"
  - "Pattern: stale-click refusal schedules its own context check so the DOM catches up with the URL the click revealed"
  - "Pattern: cooldown timers are keyed by element in state.timers and die with the context (clearTimers in applyContext)"
  - "Pattern: DLV-04 static gate — `console.` may appear only inside the constants (log/warn) and verify sections"

requirements-completed: [LOC-01, LOC-02, LOC-03, LOC-04, LOC-05, BTN-04, BTN-05, BTN-06, BTN-07, BTN-10, BTN-11, BTN-12, DLV-04]

coverage:
  - id: D1
    description: "pushState, replaceState, popstate (back/forward), and routeChangeEvent each rebind the contact button to the contact in the URL; the previous element is disconnected and never reused; generation increments once per real change"
    requirement: LOC-02
    verification:
      - kind: e2e
        ref: "test/run.mjs#nav: pushState to another contact rebinds the button and bumps generation"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#nav: browser back and forward rebind through popstate"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#nav: routeChangeEvent alone is honored"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#nav: replaceState is hooked"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#ctx: unchanged URL does not bump generation"
        status: pass
    human_judgment: false
  - id: D2
    description: "Patched pushState still updates location, history.length, and history.state; hooks and listeners are installed exactly once even across a second boot"
    requirement: LOC-01
    verification:
      - kind: e2e
        ref: "test/run.mjs#nav: patched pushState still updates location and history"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#ctx: hooks are installed exactly once"
        status: pass
    human_judgment: false
  - id: D3
    description: "Agency routes resolve to null location/contact and remove every group; leaving a contact removes the button and no pending timer resurrects it"
    requirement: LOC-03
    verification:
      - kind: e2e
        ref: "test/run.mjs#nav: agency route yields a null location and zero buttons"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#nav: leaving the contact removes the button and clears pending timers"
        status: pass
    human_judgment: false
  - id: D4
    description: "A click after an unobserved URL change is refused (unavailable, 'Context changed'), sends nothing, and triggers a re-render; an in-flight result from an older generation is discarded and never touches old or new elements"
    requirement: BTN-05
    verification:
      - kind: e2e
        ref: "test/run.mjs#stale: click after an unobserved URL change refuses to fire"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#stale: in-flight result from an older generation is discarded"
        status: pass
    human_judgment: false
  - id: D5
    description: "Queued stays disabled for cooldownMs then returns to ready; triple click and clicks during cooldown produce exactly one POST"
    requirement: BTN-12
    verification:
      - kind: e2e
        ref: "test/run.mjs#webhook: queued stays disabled for cooldownMs then returns to ready"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#webhook: triple click sends exactly one request"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#webhook: click during cooldown sends nothing"
        status: pass
    human_judgment: false
  - id: D6
    description: "Non-2xx -> failed with 'HTTP n' message and no URL/payload; CORS TypeError -> one no-cors retry -> queued 'Sent (unconfirmed)'; offline -> failed after both attempts; retry sends a fresh requestId"
    requirement: BTN-11
    verification:
      - kind: e2e
        ref: "test/run.mjs#webhook: non-2xx -> failed with an actionable message; retry sends a new requestId"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#webhook: CORS TypeError falls back to no-cors and reports Sent (unconfirmed)"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#webhook: offline -> failed after both attempts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Record without email/phone renders unavailable (data-ghlc-reason=no-contact-fields) and sends nothing; fields appearing later flip the same element to ready on re-render with no generation bump; email-only omits phone; extraFields cannot override identity keys; non-https URL renders unavailable"
    requirement: BTN-10
    verification:
      - kind: e2e
        ref: "test/run.mjs#webhook: record without email or phone renders unavailable and sends nothing"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#webhook: fields appearing later flip unavailable to ready on re-render"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#webhook: email-only record sends email and omits phone"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#webhook: extraFields cannot override identity keys"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#webhook: non-https URL renders unavailable"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#D-02: fields removed after render make the next click unavailable, not a POST"
        status: pass
    human_judgment: false
  - id: D8
    description: "With ?ghlc-debug=1 the console across ok / 500 / cors / offline flows never contains the webhook URL, host, payload keys, requestId, email, or phone; console.* is reachable only through log/warn or verify()"
    requirement: DLV-04
    verification:
      - kind: e2e
        ref: "test/run.mjs#logs: debug mode never prints URL, payload, email, or phone"
        status: pass
      - kind: unit
        ref: "test/run.mjs#static: DLV-04 — console is reached only through log/warn (constants) or verify()"
        status: pass
    human_judgment: false
  - id: D9
    description: "No Web Storage or cookie use for context; per-tab in-memory state only"
    requirement: LOC-04
    verification:
      - kind: unit
        ref: "test/run.mjs#static: source contains no forbidden tokens (HTML setters, eval, storage, cookies)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-09-24
status: complete
---

# Phase 01 Plan 02: Context Engine and Hardened Webhook Path Summary

**The Send Invite button now follows every HighLevel navigation path (patched pushState/replaceState, popstate, routeChangeEvent) through one coalesced generation-stamped context check, refuses stale clicks at click time, degrades CORS failures to a single honest no-cors retry, enforces a per-button cooldown, renders unavailable when the record has no email/phone and recovers when they appear — all proven headlessly (`node test/run.mjs`, 45/45) with a static gate that keeps `console.` behind `safe()`.**

## Performance

- **Duration:** 6 min (execution) — started 2026-09-24T16:36:15Z, tasks committed by 2026-09-24T16:41:20Z
- **Tasks:** 2
- **Files modified:** 3 (`src/ghl-customizer.js`, `test/dom-shim.mjs`, `test/run.mjs`)
- **Tests:** 21 -> 45 (24 new: 11 navigation/stale/ctx, 12 webhook/logs, 1 static gate; 1 existing scenario rewritten)

## Accomplishments

- **Navigation engine (Task 1).** `installNavigationHooks()` runs once from `boot()` before the first `applyContext`. It wraps `history.pushState`/`replaceState` (same `this`/arguments, original return value, `ghlc:navigate` dispatch in try/catch) and listens to `popstate`, HighLevel's route event, and `ghlc:navigate`. All signals go through `scheduleContextCheck(reason)` — one zero-delay timer, replaced on every signal, held in `state.navTimer` outside `state.timers` so the context change it triggers cannot cancel it. `applyContext` bumps `generation` only on a real `(locationId, contactId)` change, clears cooldown timers, re-renders, and logs `nav {reason, generation}`. Agency routes yield null IDs, so `resolveButtons` is empty and every group is removed.
- **Stale-click refusal (BTN-05).** `refuseStaleClick` runs at the top of `runWebhook`: it parses `location.pathname` live and compares against `data-ghlc-ctx` (`loc|contact`, empty = null) and `data-ghlc-generation`. A mismatch sets `unavailable` with "Context changed — reopen the contact and try again", logs `stale-click`, schedules a context check so the DOM catches up with the URL, and never fetches. In-flight results are still discarded by the Plan 01 generation/`isConnected` compare (`webhook-discarded`).
- **Delivery strategy (D-11, Task 2).** `sendWebhook` returns `{ outcome, status, message? }` per the table below. Exactly one `mode: 'cors'` site and one `mode: 'no-cors'` site exist; the retry reuses the same serialized body (same `requestId`) and carries no Content-Type because a no-cors request may only send CORS-safelisted headers.
- **Cooldown (BTN-12).** Both queued variants call `startCooldown`, which keeps the element `disabled` for `action.cooldownMs` (already normalized by `resolveAction`; default `DEFAULT_COOLDOWN_MS` = 10 000) and flips it back to `ready` only if it is still connected and still stamped with the current generation. Timers are keyed by element in `state.timers`; `applyContext` clears them on context change. `failed`/`network` leave the element enabled with no cooldown.
- **Unavailable at render (D-02, BTN-10).** `createButtonEl` renders a contact webhook button `unavailable` with `data-ghlc-reason="no-contact-fields"` when `contactFieldsReadable()` is false, and does not bind the click listener. `renderPlacement`'s reconcile calls `recoverNoContactFields` on survivors: if a field is now readable it removes the attribute, binds the listener once (`data-ghlc-bound="1"`), and sets `ready` — with no generation re-stamp, so the next click passes the stale check. `runWebhook`'s click-time re-read also stamps the reason attribute so a record whose fields vanished after render can recover the same way.
- **Log hygiene (DLV-04).** New static gate: with the constants and verify sections removed, the source contains no `console.`. The `logs:` scenario runs ok -> 500 -> cors -> offline with `?ghlc-debug=1` and asserts the console never contains `hooks/`, `TEST-HOOK`, `leadconnectorhq`, `@example`, `5550100`, `"contactId"`, `requestId`, or `sentAt`.

## Task Commits

1. **Task 1: Follow every navigation path and rebind the contact button to the contact on screen** - `a7bdacc` (feat)
2. **Task 2: Webhook hardening — cooldown, no-cors fallback, failed/unavailable messaging, log hygiene** - `d7138be` (feat)

**Plan metadata:** committed with this SUMMARY (docs) — see the completion report for the hash. STATE.md and ROADMAP.md were not touched (orchestrator-owned).

## Files Created/Modified

- `src/ghl-customizer.js` — context section: `state.hooksInstalled`, `state.navTimer`, `scheduleContextCheck`, `onNavigationSignal`, `dispatchNavigate`, `wrapHistoryMethod`, `installNavigationHooks`, `nav` log in `applyContext`. Buttons section: `bindClick`, `recoverNoContactFields`, `MSG_*` constants, `attemptFetch`, rewritten `sendWebhook`, `contactFieldsReadable`, `markNoContactFields`, `startCooldown`, `refuseStaleClick`, rewritten `runWebhook` outcome mapping; `createButtonEl` render-time D-02 check; `renderPlacement` survivor recovery. Boot section: `installNavigationHooks()` before `applyContext('boot')`, `hooksInstalled` in `getState()`, `renderAll` on `GHLC.__test`.
- `test/dom-shim.mjs` — `buildContactRegion` / `buildDashboard` helpers shared by `buildShell` and the new `setContact`; `setSidebarMode`; `setPath` (rewrites the current history entry's URL silently); `shell` closure ref so `setContact` finds `<main>` and updates `shell.contactRegion`.
- `test/run.mjs` — `static: DLV-04 — console is reached only through log/warn (constants) or verify()`; helpers `invites`/`invite`/`label`/`msg`/`bootWithContact`; 11 `nav:`/`stale:`/`ctx:` scenarios; 12 `webhook:`/`logs:` scenarios; D-02 scenario rewritten.

## `sendWebhook` outcome table (as implemented)

| Attempt result | Outcome | `status` | Button state / label | Message (`.ghlc-btn__msg`, `title`) | Log event |
|---|---|---|---|---|---|
| CORS POST resolves `ok` | `ok` | HTTP status | `queued` / "Workflow triggered" | (none) | `webhook-queued {buttonId, generation, cooldownMs}` |
| CORS POST resolves non-2xx | `failed` | HTTP status | `failed` / "Failed — retry" | `Workflow did not accept the request (HTTP <n>). Try again or contact your admin.` | `webhook-failed {buttonId, status}` |
| CORS POST throws non-`TypeError` | `failed` | 0 | `failed` / "Failed — retry" | `Something went wrong sending the request. Try again.` | `webhook-failed {buttonId, status: 0}` |
| CORS POST throws `TypeError`, no-cors retry resolves (opaque) | `unconfirmed` | 0 | `queued` / "Sent (unconfirmed)" | `The workflow endpoint did not confirm receipt. Check the workflow execution log before resending.` | `webhook-unconfirmed {buttonId, generation, cooldownMs}` |
| CORS POST throws `TypeError`, no-cors retry throws | `network` | 0 | `failed` / "Failed — retry" | `Could not reach the workflow. Check your connection and try again.` | `webhook-network {buttonId, status: 0}` |

Other exact strings: stale click -> `unavailable` / `Context changed — reopen the contact and try again` (log `stale-click {buttonId, generation}`); missing fields -> `unavailable` / `contact email/phone not found` with `data-ghlc-reason="no-contact-fields"` (log `webhook-unavailable {buttonId}` on the click-time path); non-https action URL -> `unavailable` / `Webhook URL must use HTTPS` (Plan 01). "Email delivered" appears nowhere.

## Shim behavior added or changed for faithful navigation scenarios

- `setContact(contactOrNull)` replaces the children of `<main>` with a freshly built `.hl_contact-details-header` (same class and `mailto:`/`tel:` anchor shapes as `buildShell`) or the dashboard placeholder; the old region node is removed, so its `isConnected` becomes false and the customizer's mount lookup sees the new node.
- `setPath(path)` rewrites the current history entry's URL with no new entry and no event — the "unobserved URL change" that the stale-click scenario needs.
- `setSidebarMode(mode)` rewrites `#sidebar-v2`'s class.
- No change was needed to `navigate`, `back`, or `forward`: `navigate(path, { via: 'pushState' | 'replaceState' })` already reads `win.history.pushState` at call time (so the customizer's patch is exercised, and `nav:5` proves the original still updates `location`, `history.length`, and `history.state`); `popstate` and `back()`/`forward()` update the URL first and dispatch a `PopStateEvent`; `routeChangeEvent` updates the URL and dispatches a `CustomEvent` on `window`.

## Decisions Made

- Patch the `history` instance rather than `History.prototype` (plan wording); either exercises the same code path, and an instance patch is trivially reversible and cannot leak into other frames.
- Keep the Plan 01 `context` log event and add the plan's `nav` event beside it rather than renaming, so the `01-01` log-event inventory stays valid.
- `startCooldown(action, el)` — the plan's sketch passed `button` too, but nothing in the timer needs it; the log line that does (`webhook-queued`) is emitted by the caller.
- Attribute reads use `getAttribute('data-ghlc-…')` rather than `el.dataset.ghlcCtx` (plan wording) to match every other attribute access in the file; behavior is identical.
- `ctx: hooks are installed exactly once` additionally boots a second time and re-asserts listener counts; the plan said this was not required, but it costs one line and proves the `hooksInstalled` guard.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan 01's D-02 scenario contradicted Task 2's render-time check**
- **Found during:** Task 2 (running the suite after the `createButtonEl` change)
- **Issue:** The existing scenario `D-02: contact without email or phone renders unavailable on click` booted a record with no fields and asserted `data-state === 'ready'` before the click. Task 2 (per the plan) makes such a record `unavailable` at render, so the old expectation can no longer hold; the plan's `webhook:7` scenario is the replacement for that case.
- **Fix:** Rewrote the scenario as `D-02: fields removed after render make the next click unavailable, not a POST` — boot with jane's fields, remove the anchors, click, assert `unavailable` + `data-ghlc-reason="no-contact-fields"` + no POST. This covers the "fields can also disappear" branch the plan asked `runWebhook` to keep, which no other scenario exercised.
- **Files modified:** test/run.mjs
- **Verification:** 45/45
- **Committed in:** d7138be

### Additions beyond the plan (no scope change)

- `refuseStaleClick` normalizes both sides with `|| ''` before comparing (`(live.locationId || '') !== boundLocation`) so a null live ID and an empty bound segment compare correctly instead of always reading as stale.
- `runWebhook`'s click-time re-read stamps `data-ghlc-reason` (via the shared `markNoContactFields`) so recovery on re-render works for both the render-time and click-time paths; `grep -c 'no-contact-fields'` is 2 as required.
- `webhook: fields appearing later…` additionally re-renders a second time after the cooldown and clicks again, asserting exactly two POSTs — proving `data-ghlc-bound` prevents a duplicate listener.
- `logs:` scenario also runs the offline flow (four outcomes, six fetch calls) and adds `leadconnectorhq` to the forbidden list.

---

**Total deviations:** 1 auto-fixed (test expectation superseded by the plan's own Task 2 behavior). No scope creep; no HighLevel selectors added; `test/harness.html` untouched (not in `files_modified`; its `cors` stub already produces the "Sent (unconfirmed)" path in a browser).

## Issues Encountered

- The first `sendWebhook`/`runWebhook` edit failed to match because Task 1 had inserted `refuseStaleClick` between them; split into two edits. No code impact.
- As in Plan 01, the sandbox refuses compound Bash commands that reference `.git/` paths, so the on-disk commit ledger/sentinel files from the commit protocol could not be written. The ledger base is the orchestrator-supplied worktree base `dbb4a30a4490ab7da4f5646f16dd6eb0ec9b33ef`; `commits: 2` was measured with `git rev-list --count dbb4a30…..HEAD`.

## Known Stubs

None. The `observers` section is still the Plan 01 marker plus comment (Plan 03 fills it); header placement, `link`/`handler` actions, and location overrides remain Plan 03 work and render `unavailable` rather than silently doing nothing.

## Threat Flags

None beyond the plan's register. T-01-05 (`refuseStaleClick` + generation compare + no element reuse: `stale:1`, `stale:2`, `nav:1`), T-01-09 (`disabled` + `onButtonClick` guard + cooldown: `webhook:1-3`), T-01-03 (fixed messages, `safe()`, console static gate, `logs:`), T-01-10 (wrapper preserves `this`/args/return, try/catch dispatch: `nav:5`), T-01-11 (accepted; "Sent (unconfirmed)" + instruction to check the execution log), T-01-04 (accepted; `isSafeHttpsUrl` at render: `webhook:11`), T-01-SC (no installs; `package.json` still has no dependency keys) are all as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 can drive `renderPlacement` from its scoped MutationObservers exactly as `GHLC.__test.renderAll()` does: survivors are recovered in place and never re-stamped, so observer-driven re-renders will not trip the stale-click check.
- `installNavigationHooks` is the single seam if HighLevel's route signal changes; `adapter.events` still owns the event names.
- Header buttons, `link`/`handler` actions, `config.locations[id].buttons` overrides (`resolveButtons` comment), and verify-mode selector reporting remain for Plan 03.
- End-of-phase human check (browser): `npm run serve`, open `http://localhost:5173/test/harness.html`, open Contact X, press Send Invite (expect "Sending…" -> "Workflow triggered", button stays disabled ~10 s then returns to "Send Invite"), switch the stub to `cors` and press again after the cooldown (expect "Sent (unconfirmed)" with the confirm-receipt tooltip), use browser Back/Forward between contacts and confirm the button re-renders for the contact shown, and confirm the console under `?ghlc-debug=1` shows only IDs and states.

---
*Phase: 01-foundation-context-workflow-buttons*
*Completed: 2026-09-24*

## Self-Check: PASSED

- Files: src/ghl-customizer.js, test/dom-shim.mjs, test/run.mjs, and this SUMMARY exist on disk
- Commits: a7bdacc (Task 1) and d7138be (Task 2) present on worktree-agent-a77ee291751e96176
- `node test/run.mjs` exits 0, last line `PASS 45/45` (was 21/21 at plan start)
- STATE.md and ROADMAP.md unchanged versus base dbb4a30 (orchestrator owns those writes)

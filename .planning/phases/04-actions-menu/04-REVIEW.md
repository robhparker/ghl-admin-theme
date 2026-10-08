---
phase: 04-actions-menu
reviewed: 2026-10-07T00:00:00Z
depth: quick
files_reviewed: 8
files_reviewed_list:
  - src/ghl-customizer.js
  - src/ghl-customizer.css
  - config/agency-config.json
  - README.md
  - test/run.mjs
  - test/dom-shim.mjs
  - test/harness.html
  - test/fixtures/config.json
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-07
**Depth:** quick (pattern scan over all 8 files, plus a targeted read of the `b97e9b7..HEAD` diff of `src/ghl-customizer.js` and `src/ghl-customizer.css` for the areas the orchestrator prioritized)
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The pattern scan found no problems. There are no hardcoded secrets, no `innerHTML`/`eval`/`new Function`/`document.write`, no `?.`/`??` or other post-ES2019 syntax, no `!important`, no empty catch blocks, and no debug artifacts in `src/`. (`console.log` appears only in the test runner's reporter, and `exec(` hits are `RegExp.prototype.exec`.) `node test/run.mjs` prints `PASS 158/158`.

The prioritized areas held up when traced:
- **Empty URL never POSTs (D-15):** `resolveAction` returns unavailable before the HTTPS check. `createButtonEl` checks `unavailable` before the no-contact-fields and requires branches, so an empty-URL item never gets a `data-ghlc-reason` that a recovery path could rebind. Even if it were bound, `onButtonClick` dispatches only on `kind === 'webhook'`.
- **Listener lifecycle (D-06):** exactly one capture-phase document `pointerdown` listener exists while the menu is open. `closeMenu` removes it, and context change, navigation, rerender, and detachment all close the menu.
- **Per-item cooldown:** the key is `ctx|itemId`, and ids are unique across buttons and items.
- **No HTML strings:** the menu is built entirely with `createElement`/`setAttribute`/`textContent`.

The remaining concerns:
1. A send that is in flight when HighLevel re-renders the name row records no cooldown, so the item can be sent again. This is inherited from v0.1.2, but the consent items now use it too.
2. The `requires` guard fails open when it is misconfigured.
3. The D-07 "never clipped" claim is not actually guaranteed by the CSS approach, and neither the suite nor the harness exercises it.

## Warnings

### WR-01: A send in flight during a same-context re-render records no cooldown, so the item can be sent twice

**File:** `src/ghl-customizer.js:1960-1980` (`runWebhook`), with `createButtonEl` (~1290) and `renderMenus` (~1547)
**Issue:** The cooldown is written to `state.cooldowns` only inside `startCooldown`, after the response arrives, and only when `el.isConnected`. Here is the sequence when HighLevel replaces the contact name row while a POST is in flight (same location and contact, same generation; the harness's "re-rendered contact toolbar" control simulates this):
1. `ensureGroup` builds a new group.
2. `renderMenus` creates a fresh wrapper. Its item reads `state.cooldowns`, finds nothing yet, and renders `ready` with a click bound.
3. The original request resolves. Its `el` is detached, so the result hits the `webhook-discarded` branch and returns before `startCooldown`.
4. No 60 s cooldown is ever recorded for `ctx|itemId`. The new item stays `ready` and can POST again immediately, both during the flight and after it.

This defeats the 60 s duplicate-send guard (D-09/D-10) that the project's core value depends on ("no duplicate sends"). It matters more now that consent sends go through this path. The guard line is unchanged from v0.1.2, but this phase extends it to new items. The summary note "the panel is hidden, never detached, so an in-flight result still lands on its item" holds only while HighLevel leaves the mount alone. No test covers a re-render while a request is in flight; the existing test covers a re-render after the result.
**Fix:** Record the send against the context key when it starts, not when the result lands. Then honor that record at render time, and still record the cooldown when the result comes back for a detached element in the same generation:
```js
// in runWebhook, before sendWebhook:
var key = el.getAttribute('data-' + NS + '-ctx') + '|' + button.id;
state.inflight[key] = true;
return sendWebhook(action.url, payload).then(function (result) {
  delete state.inflight[key];
  var queued = result.outcome === 'ok' || result.outcome === 'unconfirmed';
  if (gen === state.generation && queued && !el.isConnected) {
    state.cooldowns[key] = Date.now() + action.cooldownMs; // still guard the replacement element
    scheduleRender('contact');                               // let the live element pick up 'queued'
  }
  if (gen !== state.generation || !el.isConnected) { log('webhook-discarded', ...); return; }
  ...
});
// in createButtonEl's bound branch: treat state.inflight[ctxKey() + '|' + button.id] as 'submitting'.
```
Add a scenario: click an item, replace the name row before the fetch resolves, then assert that the new item is not `ready` and that a second click sends nothing.

### WR-02: The `requires` guard fails open on any misconfiguration

**File:** `src/ghl-customizer.js:1831-1836` (`meetsRequires`), `src/ghl-customizer.js:668-695` (`validateButton`)
**Issue:** `meetsRequires` enforces the rule only when `requires` is a plain object with an own key `email` exactly equal to `'real'`. Every other shape returns `true` (allowed), and `validateConfig` accepts every other shape without an error. So a one-character config slip such as `"requires": { "email": "Real" }`, `{ "email": true }`, `{ "emails": "real" }`, or `"requires": "real"` silently removes the D-16 protection. "Send individual consent" would then go to the synthetic `owner+N@` address, which is exactly what the rule exists to prevent. The config is maintained by hand (see the project constraints), so this is a realistic failure. A guard rule should fail closed, or at least fail validation.
**Fix:** Validate `requires` in `validateButton` and reject anything unrecognised:
```js
if (button.requires !== undefined) {
  var r = button.requires;
  var okShape = isPlainObject(r) && Object.keys(r).every(function (k) { return k === 'email'; }) &&
    r.email === 'real';
  if (!okShape) errors.push(where + '.requires must be { "email": "real" } when present');
}
```
Alternatively, make `meetsRequires` return `false` (unavailable, with a "Rule not recognised" message) when `requires` is present but not understood.

### WR-03: An absolute panel inside `.ghlc-group` is still clipped by any `overflow` ancestor, and nothing tests this

**File:** `src/ghl-customizer.css:20` (`.ghlc-group { position: relative }`), `src/ghl-customizer.css:129-144` (`.ghlc-menu__panel`), `test/harness.html:40`, `test/run.mjs:3963-3986`
**Issue:** D-07 requires that the panel "must not be clipped by the name row". Making the group the containing block does not guarantee that. An absolutely positioned box is clipped by every ancestor with `overflow: hidden|auto|clip` that sits between it and its containing block's ancestors. Because the containing block is now the group, which lives inside HighLevel's name row and the left record column, any such ancestor in HighLevel's markup will clip the panel. The record panel is a scrollable column, so this is likely. The tests do not catch it:
- The `menu css` test only checks that *our* rules lack `overflow: hidden`.
- The harness "Tighten name row" control (`.hx-tight`) sets only `height: 24px` and a background, with no `overflow` value. Content simply overflows visibly, so the control cannot reproduce clipping.

The D-07 guarantee is therefore unproven in both the shim and the harness. It rests entirely on the pending live check.
**Fix:**
- Make the harness control realistic. Add `overflow: hidden` to `.hx-tight`, and give an ancestor such as `#record-details-lhs` `overflow: auto`.
- If the live check shows clipping, move the panel out of the clipping context. Either position it with `position: fixed` using coordinates from `trigger.getBoundingClientRect()` at open time (and close it on scroll or resize), or use the Popover API top layer. The panel must still stay inside `.ghlc-group` for `isOwnNode` (D-08); `position: fixed` keeps it there.

## Info

### IN-01: Focus leaving by any route other than Tab or pointerdown leaves the menu open

**File:** `src/ghl-customizer.js:1473-1504` (`openMenu`)
**Issue:** The menu closes only on Tab, Escape, `pointerdown` in this document, activation, navigation, and context change. Focus can leave in other ways while the menu stays open, with its document listener attached and `aria-expanded="true"`:
- clicking into an iframe (no `pointerdown` reaches the parent document)
- switching windows
- a HighLevel shortcut or script that moves focus

**Fix:** Add one `focusout` listener on the wrapper, bound once in `bindMenu`. It should close the menu (without refocusing the trigger) when `evt.relatedTarget` is null or outside the wrapper. This adds no document-level listener.

### IN-02: Handled menu keys are not stopped from bubbling to page-level handlers

**File:** `src/ghl-customizer.js:1411-1461` (`onMenuKeydown`)
**Issue:** Escape, the arrow keys, Home, and End call `preventDefault()` but not `stopPropagation()`. A HighLevel document-level shortcut handler would also receive them. For example, an Escape handler that closes a contact drawer or modal would fire while staff are only dismissing the menu.
**Fix:** Call `evt.stopPropagation()` alongside `preventDefault()` for every key the menu consumes.

### IN-03: Panel and trigger DOM ids can collide across menus

**File:** `src/ghl-customizer.js:1337-1338`
**Issue:** The panel id is `ghlc-menu-<id>` and the trigger id is `ghlc-menu-<id>-trigger`. Menu ids allow `-`, so menu `a` and menu `a-trigger` at the same location would both produce the DOM id `ghlc-menu-a-trigger`. That breaks `aria-controls`/`aria-labelledby` resolution. It is unlikely with the shipped config.
**Fix:** Use distinct prefixes that a valid id cannot bridge, for example `ghlc-menupanel-<id>` and `ghlc-menutrigger-<id>`.

### IN-04: The README override row implies `true` can force a menu item into any location

**File:** `README.md:83`
**Issue:** The row says `true` "enables it here even if it is out of scope". `resolveMenus` (correctly, per the code comment) never pulls a menu into a location outside the *menu's* scope. So `true` on an item at a location outside the menu's scope does nothing, and nothing reports it.
**Fix:** Add: "For a menu item, `true` only overrides the item's own scope; the menu's `scope` still decides where the menu appears."

### IN-05: There is no in-progress feedback on the trigger while a closed-menu item is submitting

**File:** `src/ghl-customizer.js:2045` (`onButtonClick` closes the menu), `src/ghl-customizer.js:1976-2000`
**Issue:** Activation closes the menu immediately, but the trigger flashes only when the result arrives. Until the response comes back (up to the fetch timeout), staff see an unchanged "Actions" button and no "Sending..." state (D-09). The state gate still prevents a duplicate send, but the lack of feedback invites repeated attempts and confusion.
**Fix:** Call `flashTrigger(el, 'submitting', 'Sending...', '')` (without a timeout, or with the result flash replacing it) when an item enters `submitting`, and add a matching `[data-ghlc-flash="submitting"]` style.

---

_Reviewed: 2026-10-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_

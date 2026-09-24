---
phase: 01-foundation-context-workflow-buttons
reviewed: 2026-09-24T17:04:31Z
depth: quick
files_reviewed: 8
files_reviewed_list:
  - src/ghl-customizer.js
  - src/ghl-customizer.css
  - config/agency-config.json
  - test/fixtures/config.json
  - test/dom-shim.mjs
  - test/run.mjs
  - test/harness.html
  - package.json
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-09-24T17:04:31Z
**Depth:** quick
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Quick-depth pattern scan of the eight in-scope files (all new since `d5c30cf`), with the focus areas from the orchestrator checked directly against source: config-driven DOM injection, the `history.pushState`/`replaceState` patch, MutationObserver scoping, the webhook fetch path, stale-context refusal, log hygiene, and ES2019 compliance. `node test/run.mjs` passes 73/73 on Node 25.9.

Pattern scan results: no hardcoded secrets, no `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`eval`/`new Function`/`document.write`, no Web Storage or cookie access, no `console.log`/`debugger`/TODO markers in `src/`. All `exec(` hits are `RegExp.prototype.exec`. The single empty `catch` is in the harness fetch stub (test tooling, intentional). Every config string reaches the DOM only through `textContent` or `setAttribute` on elements the script creates, action types are allowlisted, and handlers/icons/overrides resolve through own-property lookups. The observer design (one root observer with subtree + one shallow anchor observer per placement, swapped rather than accumulated, disconnected on agency routes) is sound and the self-inflicted-record filter converges after one pass. The webhook path is HTTPS-only, re-validates the URL at click time, retries `no-cors` only on `TypeError`, reuses the same `requestId` on that retry, and never puts the URL or payload into a message or log line.

Three Warnings are provable defects: the "same-origin path" branch of the link guard is bypassable with a backslash (`/\host`), the queued cooldown and failed state live on the DOM element so a native re-render of the region within the same generation silently resets a button to `ready`, and the contact email/phone readers accept the first `mailto:`/`tel:` anchor or the first email/tel `<input>` anywhere inside a very broadly matched region. None rise to Critical: the first is bounded by an allowlist that already permits any `https:` URL, the second needs a HighLevel re-render to land inside the cooldown window, and the third is gated on selectors the context file itself marks as unverified pending live inspection.

## Warnings

### WR-01: `isSafeLinkHref` same-origin branch is bypassable with a backslash

**File:** `src/ghl-customizer.js:614-623`
**Issue:** The guard treats any href starting with a single `/` as a same-origin path and only rejects a second `/`. Under WHATWG URL parsing, special schemes treat `\` as `/`, so `"/\\evil.test/x"` resolves to `https://evil.test/x` (verified with `new URL('/\\evil.test/x', 'https://app.gohighlevel.com/...')`), and `isSafeLinkHref('/\\evil.test/x')` returns `true`. The resulting anchor navigates off-origin while the comment and BTN-09 describe this branch as "a single-slash same-origin path". Security impact is limited because the absolute branch already allows any `https:` URL, but the guard does not do what it claims and a location override could push staff to an arbitrary host under a path-looking href.
**Fix:**
```javascript
function isSafeLinkHref(href) {
  if (typeof href !== 'string' || !href) return false;
  try {
    var url = new URL(href, location.origin);
    if (href.charAt(0) === '/') return url.origin === location.origin;
    return SAFE_LINK_SCHEMES.indexOf(url.protocol) !== -1 && url.username === '' && url.password === '';
  } catch (e) {
    return false;
  }
}
```
Add `'/\\evil.test/x'` to the `unsafe` map in the `actions: unsafe link hrefs` scenario in `test/run.mjs:1114`.

### WR-02: Cooldown and failed state are element-bound; a native re-render inside the same generation resets the button to `ready`

**File:** `src/ghl-customizer.js:806-852` (reconcile), `src/ghl-customizer.js:968-982` (`startCooldown`)
**Issue:** `startCooldown` keys the timer on the element and `renderPlacement` recreates any button whose element vanished. When HighLevel replaces the contact header (exactly what the harness "Re-render contact toolbar" button simulates, and what the `observers: contact toolbar re-render` scenario exercises) during the `cooldownMs` window, the old element is detached, its timer becomes a no-op (`el.isConnected` is false), and `createButtonEl` renders a fresh `ready` button. Staff can then trigger the workflow a second time within the window BTN-12 is meant to close. The same re-render also erases a `failed` message, so the user loses the "Failed — retry" context. The context key `data-ghlc-ctx` is unchanged, so no generation bump happens and nothing else catches it.
**Fix:** Track cooldown expiry per context + button in `state` rather than on the element, and honor it when creating a button:
```javascript
// state
cooldowns: Object.create(null), // key: ctxKey() + '|' + buttonId -> expiry (ms since epoch)

// startCooldown: also record expiry
state.cooldowns[ctxKey() + '|' + button.id] = Date.now() + cooldownMs;

// createButtonEl, before bindClick/setState(el, 'ready'):
var until = state.cooldowns[ctxKey() + '|' + button.id];
if (until && until > Date.now()) {
  setState(el, 'queued');
  startCooldown(action, el, until - Date.now());
}
```
Clear `state.cooldowns` in `applyContext` alongside `clearTimers()`. Add a scenario: click, `setContact(JANE)` again within 3000 ms, assert the restored button is `queued` and a click sends nothing.

### WR-03: Contact email/phone readers accept the first matching node anywhere in a broadly matched region

**File:** `src/ghl-customizer.js:145-152` (selectors), `src/ghl-customizer.js:202-243` (readers)
**Issue:** `contactRegion` falls back to `[class*="contact-details"]` and `[class*="contact-detail"]`, and `readContactEmail`/`readContactPhone` take the first `a[href^="mailto:"]`/`a[href^="tel:"]` or the first `input[type="email"]`/`input[type="tel"]` inside it. On the live HighLevel DOM a substring class match can capture a large container (conversation pane, associated contacts, company/owner details, an "add email" form), so the value POSTed as `email`/`phone` — which is the field HighLevel's Inbound Webhook uses to *find the contact* (D-02) — may belong to a different person than the `contactId` in the URL. The workflow would then fire against the wrong contact with no client-side signal. `01-CONTEXT.md` marks these selectors as unverified, but the reader has no ambiguity guard in the meantime.
**Fix:** Refuse to send when the region is ambiguous, and let verify mode surface the count:
```javascript
function readContactEmail(region) {
  if (!region) return null;
  var anchors = region.querySelectorAll(selectors.contactEmail[0]);
  if (anchors.length > 1) return null; // ambiguous: more than one mailto in the region
  ...
}
```
Report `contactFields.emailCandidates` / `phoneCandidates` counts from `probe()`/`verify()` so the live-inspection pass can tighten the selectors, and drop the `[class*="contact-detail"]` substring fallbacks once a stable container selector is confirmed.

## Info

### IN-01: History patch has no teardown, and a second script instance double-wraps it

**File:** `src/ghl-customizer.js:556-568`, `src/ghl-customizer.js:1266`
**Issue:** `installNavigationHooks` wraps `history.pushState`/`replaceState` for the page lifetime with no unpatch path, and `state.hooksInstalled` is closure-scoped. HighLevel allows Custom JS at both agency and sub-account level; if the snippet is pasted in both, the second instance wraps the already-wrapped functions again, overwrites `window.GHLC` unconditionally, and both instances reconcile the same `.ghlc-group` (ownership is class-based, so they converge, but each navigation dispatches two `ghlc:navigate` events and two renders). The originals are retained in the wrapper closures, so nothing is lost; this is a robustness note, not a correctness bug.
**Fix:** Early-return in boot when `window.GHLC && window.GHLC.version` is already set (log `duplicate-instance`), and optionally expose `GHLC.destroy()` that restores the originals captured in `wrapHistoryMethod`, disconnects observers, and removes groups.

### IN-02: `globalThis` is an ES2020 global

**File:** `src/ghl-customizer.js:1327`
**Issue:** The header promises ES2019. `typeof globalThis !== 'undefined'` makes the reference safe at runtime on older engines, but it is still an ES2020 feature and the static ES-level check in `test/run.mjs:142` does not catch it.
**Fix:** `var testMode = window.__GHLC_TEST__ === true;` — the shim sets `win.__GHLC_TEST__` on the same object that is the vm global.

### IN-03: `verify()` logs raw `location.pathname` outside the `safe()` guard

**File:** `src/ghl-customizer.js:1241`, `src/ghl-customizer.js:1260`
**Issue:** The constraint is "Diagnostics log IDs and states only." The report already includes `route` (parsed IDs); `url: location.pathname` duplicates that as a free-form string and is printed through `console.info` without passing through `safe()`. It is not the webhook URL or payload, so DLV-04 is not violated, but it is broader than the stated policy.
**Fix:** Drop `url` from the report, or report `pathMatched: !!route.locationId` instead.

### IN-04: `.ghlc-btn--link` duplicates the entire `.ghlc-btn` rule block

**File:** `src/ghl-customizer.css:76-103`
**Issue:** Link elements are created with `class="ghlc-btn ghlc-btn--link"` (`src/ghl-customizer.js:707`), so every declaration in `.ghlc-btn--link`, `.ghlc-btn--link:hover`, and `.ghlc-btn--link:focus-visible` is already applied by `.ghlc-btn`. The only distinct declaration is `text-decoration: none` on hover, which `.ghlc-btn` also sets. Two copies will drift when Phase 3 themes the buttons.
**Fix:** Reduce the modifier to only what differs (currently nothing), e.g. delete lines 76-103 or keep `.ghlc-btn--link:hover { text-decoration: none; }` alone.

### IN-05: Redundant contact region fallback selector

**File:** `src/ghl-customizer.js:148-149`
**Issue:** `[class*="contact-details"]` is a strict subset of `[class*="contact-detail"]`; the second entry can never match something the first did not already cover in the same element, and `findFirst` returns the first hit in document order per selector, so the ordering can only change which element wins for the substring match. Combined with WR-03 this widens the region further.
**Fix:** Remove one of the two, or replace both with a verified container selector after live inspection.

### IN-06: `cooldownMs` is unbounded; values above 2147483647 fire immediately in browsers

**File:** `src/ghl-customizer.js:655-657`, `src/ghl-customizer.js:969-971`
**Issue:** `resolveAction` accepts any non-negative number and `startCooldown` accepts any finite non-negative number. Browsers store `setTimeout` delays as int32, so a misconfigured `cooldownMs: 1e10` overflows and fires on the next tick, turning a "long" cooldown into no cooldown without any warning.
**Fix:** Clamp in `resolveAction`: `cooldownMs: Math.min(action.cooldownMs, MAX_COOLDOWN_MS)` with `MAX_COOLDOWN_MS = 2147483647` (or a sane product limit such as 5 minutes), and drop the duplicate validation in `startCooldown`.

### IN-07: Production config URL points at a tag that does not yet exist

**File:** `src/ghl-customizer.js:40`, `config/agency-config.json:19`
**Issue:** `DEFAULT_CONFIG_URL` targets `robhparker/admin-theme@v0.1.0` on jsDelivr while the repo has no GitHub remote (acknowledged in the comment), and the shipped config carries `hooks/REPLACE_ME`. Both fail closed (404 → no-op; webhook → HTTP failure), so this is a deployment reminder rather than a bug.
**Fix:** Track as a Phase 3 checklist item: pin the real tag, replace `REPLACE_ME`, and add a `package.json` `engines` field (`"node": ">=18"`) to match the shim's stated requirement.

---

_Reviewed: 2026-09-24T17:04:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_

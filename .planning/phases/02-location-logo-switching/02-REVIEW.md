---
phase: 02-location-logo-switching
reviewed: 2026-09-24T22:34:01Z
depth: quick
files_reviewed: 11
files_reviewed_list:
  - config/agency-config.json
  - src/ghl-customizer.css
  - src/ghl-customizer.js
  - test/dom-shim.mjs
  - test/fixtures/config.json
  - test/fixtures/logos/agency.svg
  - test/fixtures/logos/loc-a.svg
  - test/fixtures/logos/loc-b.svg
  - test/fixtures/logos/native.svg
  - test/harness.html
  - test/run.mjs
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-09-24T22:34:01Z
**Depth:** quick
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the Phase 02 "Location Logo Switching" change set: the `// ==== branding ====` section and branding observer in `src/ghl-customizer.js`, the `.ghlc-logo` rule in the stylesheet, the `logoMount` config key, the image-request stub added to `test/dom-shim.mjs`, the sidebar-logo controls in `test/harness.html`, the four SVG fixtures, and the branding scenarios in `test/run.mjs`. `node test/run.mjs` passes 98/98 at HEAD.

The quick-depth pattern scan is clean: no hardcoded secrets, no `eval`/`innerHTML`/`document.write`/`new Function`, no Web Storage or cookie access, no debug `console.log` in the shipped script (the only `console.*` calls are the `log`/`warn` helpers and `verify()`), no `?.`/`??` or other ES2020+ syntax in `src/`, no `<script>`/`onload`/`javascript:` in the SVG fixtures, and the only empty catch is a deliberate `Object.defineProperty` guard in harness tooling. Config files carry no tokens or contact data.

Because the branding code is a state machine whose invariants are stated in its own comments (T-02-03 "never from the logo that happened to be on the mount before"; srcset "removed while branded"), I went beyond grep and probed two suspected edge cases against the real IIFE running in `test/dom-shim.mjs`. Both reproduced. The first one is a cross-client logo leak of exactly the kind the phase says it prevents and is classified Critical. The second is a gap in what the branding observer defends. The remaining items are a validation/base-URL mismatch and two documentation-versus-behavior discrepancies.

## Critical Issues

### CR-01: A branded logo element that becomes un-findable and is later re-found is captured as "native", so the previous client's logo is restored as the native tier (T-02-03 violation)

**File:** `src/ghl-customizer.js:1526-1541` (missing-mount branch of `renderBranding`) and `src/ghl-customizer.js:1339-1367` (`captureNativeLogo`)

**Issue:** When `adapter.findLogoMount()` returns null, `renderBranding` sets `branding.native = null` (line 1529) without touching the element that was branded. If the element is still in the document but no longer matches `#sidebar-v2 img.agency-logo` (HighLevel rewriting the img's `class` attribute through a framework class binding, the sidebar temporarily losing its id, or the img being detached and re-attached), it keeps our `src`, `alt`, `referrerpolicy`, `ghlc-logo` class, and `data-ghlc-logo="location"`. The next time the selector matches the same element, `captureNativeLogo` finds `branding.native === null`, takes the fresh-capture branch at line 1352, and records the client's logo URL and alt as the native values. The `!mount.hasAttribute(OWN.logoAttr)` guard at line 1345 only protects the re-read branch, not the fresh capture.

From that point every native restore puts the wrong client's logo on the mount. Reproduced in the shim (locA branded, class stripped, `renderAll`, class restored, `renderAll`, navigate to `/v2/agency/dashboard`):

```
after re-found:   src=./fixtures/logos/loc-a.svg tier=location applied=location
on agency route:  src=./fixtures/logos/loc-a.svg tier=null     applied=native
```

The agency dashboard shows Location A's logo with no tier marker and no observer (native is the "resting state", A-11), so nothing will ever correct it. On a later switch to an unconfigured location, or when locB's logo fails and the chain falls through to native (BRD-04), Location A's logo is shown for Location B. `branding.errorBound` is also left pointing at the old element in this path, so the stale reference is retained.

**Fix:** Never let a branded element out of sight without restoring it, and never fresh-capture from an element that carries our marker.

```javascript
// renderBranding, missing-mount branch (replace lines 1529-1532)
if (!mount) {
  if (branding.native) {
    // The element left our control still wearing our tier: put HighLevel's
    // values back before forgetting it, so a re-found element is native.
    restoreNativeLogo(branding.native.el);
    if (branding.errorBound === branding.native.el) {
      branding.native.el.removeEventListener('error', onLogoError);
      branding.errorBound = null;
    }
  }
  branding.native = null;
  branding.applied = null;
  branding.appliedSrc = null;
  branding.appliedAlt = null;
  ...
}

// captureNativeLogo, fresh-capture branch (defense in depth, before line 1352)
if (mount.hasAttribute(OWN.logoAttr)) {
  // Our marks on an element we have no capture for: strip them rather than
  // record our own logo as native (T-02-03).
  mount.removeAttribute(OWN.logoAttr);
  mount.removeAttribute('referrerpolicy');
  mount.classList.remove(OWN.logoClass);
}
```

Add a scenario to `test/run.mjs` that strips and restores the img class (or moves the img out and back) and asserts the agency route shows `NATIVE_SRC`.

## Warnings

### WR-01: `srcset` (and `class`) written back by HighLevel on the same element are neither observed nor re-stripped, so the browser can pick the native variant over the branded `src`

**File:** `src/ghl-customizer.js:1716` (`attributeFilter: ['src', 'alt']`), `src/ghl-customizer.js:1386-1393` (`applyLogo` early return)

**Issue:** The code explicitly treats `srcset` as a threat ("srcset would let the browser pick a native variant over our src", line 1392) and removes it on apply, captures it, and restores it on native. But the branding observer's `attributeFilter` omits `srcset`, so HighLevel re-adding it on the same element (the same class of write the harness "HighLevel resets logo src" control simulates for `src`) schedules no rebrand. Worse, even an explicit `renderBranding` does not fix it: the idempotency check at line 1386 compares only `src`, `alt`, and the tier marker, returns early, and never reaches `removeAttribute('srcset')` at line 1393. Reproduced in the shim:

```
after HighLevel re-adds srcset:   srcset="https://native.test/a@2x.png 2x" tier=location
after explicit renderBranding:    srcset still present
```

On a DPR>1 display the browser will then render the native 2x candidate while `verify()` reports `applied: "location"`. The same gap applies to `class`: a framework class rewrite drops `ghlc-logo` (losing `object-fit: contain`) and is never restored.

**Fix:** Defend every attribute the script writes.

```javascript
// watchBranding
mo.observe(img, { attributes: true, attributeFilter: ['src', 'alt', 'srcset', 'class'] });

// onBrandingMutation: treat srcset/class records on the img as foreign
if (name === 'srcset') { foreign = value !== null; continue; }
if (name === 'class') { foreign = !slot.img.classList.contains(OWN.logoClass); continue; }

// applyLogo: strip srcset and re-add the class before the idempotency check
if (mount.hasAttribute('srcset')) mount.removeAttribute('srcset');
mount.classList.add(OWN.logoClass);
if (mount.getAttribute('src') === candidate.src && ...) { recordApplied(...); return; }
```

Note the `srcset` capture at line 1348 must then only re-read when the observer is not active (it already only runs when `!mount.hasAttribute(OWN.logoAttr)`, which is correct).

### WR-02: URL safety checks resolve relative URLs against `location.href`, but the browser resolves `img src` and `fetch()` against `document.baseURI`

**File:** `src/ghl-customizer.js:381` (`isAllowedConfigUrl`), `src/ghl-customizer.js:409` (`isSafeImageUrl`)

**Issue:** Both allowlist checks do `new URL(value, location.href)`, while the value is then handed to `setAttribute('src', value)` / `fetch(value)`, which the browser resolves against the document base URL. The two differ whenever a `<base>` element is present. `test/harness.html:10` adds exactly that (`<base href="/test/">`), so in the harness the URL that was validated (`/v2/location/locA/fixtures/logos/loc-a.svg`) is not the URL that loads (`/test/fixtures/logos/loc-a.svg`); the harness comment on lines 7-9 documents the resolution difference without noticing the check is on the wrong side of it. Origin still matches today because the base is same-origin, but a validated-vs-loaded mismatch on a security allowlist is the pattern that turns into a bypass the day the host page carries a cross-origin base (a relative `logoUrl` would then be validated same-origin and loaded cross-origin, bypassing the https/no-credentials rule).

**Fix:** Resolve exactly as the browser will.

```javascript
var base = document.baseURI || location.href;
var url = new URL(value, base);
```

Apply in both `isAllowedConfigUrl` and `isSafeImageUrl`, and use the same `base` in `isSafeLinkHref` if a same-origin path is ever resolved there.

## Info

### IN-01: Doc comment says `blob:` URLs are refused by `isSafeImageUrl`; they are accepted

**File:** `src/ghl-customizer.js:399-404` (comment) vs `src/ghl-customizer.js:411` (origin check)

**Issue:** The comment lists `blob:` among sources that are "absent, never written", but `new URL('blob:https://app.gohighlevel.com/x').origin` is `https://app.gohighlevel.com`, so the `url.origin === location.origin` branch returns true. Confirmed in the shim: `isSafeImageUrl('blob:https://app.gohighlevel.com/abc') === true`. Not exploitable from config (a config author cannot mint a blob in the page; the request just errors and marks the URL failed), and on an opaque-origin page (`file://`, `location.origin === 'null'`) the same branch would also accept `javascript:`/`data:` URLs since their origin is `'null'` too, though an `<img src>` never executes script. The documented contract and the behavior should agree.

**Fix:** Gate on scheme first, then origin.

```javascript
if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
if (url.protocol === 'https:' && url.username === '' && url.password === '') return true;
return location.origin !== 'null' && url.origin === location.origin;
```

### IN-02: A single transient image error excludes that logo URL for the rest of the session

**File:** `src/ghl-customizer.js:1481-1492` (`onPreloadError`), `src/ghl-customizer.js:1506-1514` (`onLogoError`), `src/ghl-customizer.js:1545-1547`

**Issue:** `branding.failed[src] = true` is permanent for the tab: one CDN hiccup or offline blip during a preload means the location logo never appears again until a full reload, while `loaded[src]` persists alongside it. This is documented as intentional ("a broken URL is never retried"), so it is noted, not contested, but it will surface as "logo disappeared and won't come back" support reports. A bounded retry (e.g. clear `failed[src]` on the next context change into that location, at most N times) would keep the "no flicker on a genuinely broken URL" property while recovering from transient failures.

**Fix:** Optional; if kept as-is, mention the reload requirement in the operator docs and expose `failed` count in `verify()` (already done) so support can confirm the cause.

---

_Reviewed: 2026-09-24T22:34:01Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_

---
phase: 02-location-logo-switching
fixed_at: 2026-09-24T22:45:11Z
review_path: /Users/rhparker/Repos/ghl/admin-theme/.planning/phases/02-location-logo-switching/02-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-09-24T22:45:11Z
**Source review:** /Users/rhparker/Repos/ghl/admin-theme/.planning/phases/02-location-logo-switching/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (fix_scope `critical_warning`: CR-01, WR-01, WR-02; IN-01/IN-02 out of scope and untouched)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: A branded logo element that becomes un-findable and is later re-found is captured as "native" (T-02-03 violation)

**Files modified:** `src/ghl-customizer.js`, `test/run.mjs`
**Commit:** 94fbc02
**Status:** fixed: requires human verification (state-machine logic; the regression scenario reproduces the review's exact sequence in the shim, not in a live HighLevel tab)
**Applied fix:** In the missing-mount branch of `renderBranding`, the branding observer is now detached first, then if a capture exists `restoreNativeLogo(branding.native.el)` puts HighLevel's src/alt/srcset back and strips our tier marker, class, and referrerpolicy, and the `error` listener is unbound (`branding.errorBound = null`) before `branding.native` is cleared. The trailing `unwatchBranding()` moved to the top of the branch so the restore writes are never delivered. As defense in depth, the fresh-capture branch of `captureNativeLogo` strips `data-ghlc-logo`, `referrerpolicy`, and `ghlc-logo` from an element that carries our marker while no capture exists, instead of recording our own logo as native. Regression scenario `review CR-01: ...` in `test/run.mjs` boots locA branded, rewrites the img class so the selector no longer matches, re-renders, restores the class, re-renders, then navigates to the agency route and an unconfigured location, asserting `NATIVE_SRC` on both, no second preload, and the error listener bound exactly once on the re-found element.

### WR-01: `srcset` and `class` written back by HighLevel on the same element are neither observed nor re-stripped

**Files modified:** `src/ghl-customizer.js`, `test/run.mjs`
**Commit:** 2915adb
**Status:** fixed: requires human verification (observer classification logic; verified against the shim's MutationObserver, which fires attribute records on every `setAttribute`/`removeAttribute` like a browser does)
**Applied fix:** `watchBranding` now observes the img with `attributeFilter: ['src', 'alt', 'srcset', 'class']` (still exactly one `MutationObserver` instance with three registrations). `onBrandingMutation` treats a `class` record as foreign only when `ghlc-logo` is missing, and a `srcset` record as foreign when a value is present (remembering it as `branding.native.srcset` for the restore and logging `logo-native-updated` with the attribute name only). `applyLogo` strips `srcset` and re-adds the class (guarded by `classList.contains`, so idempotent passes write nothing) ahead of the idempotency early return, and the trailing `classList.add` was removed. The existing assertion on the attribute filter was updated. Regression scenario `review WR-01: ...` re-adds a srcset and rewrites the class on the branded element, asserts each is corrected via one coalesced rebrand with no src rewrite, that a class rewrite keeping our token schedules nothing, and that the native restore puts the HighLevel-written srcset back.

### WR-02: URL safety checks resolve relative URLs against `location.href` while the browser uses `document.baseURI`

**Files modified:** `src/ghl-customizer.js`, `test/run.mjs`
**Commit:** 9bb4afa
**Status:** fixed
**Applied fix:** Added `documentBase()` (`document.baseURI || location.href`) in the config section and routed `isAllowedConfigUrl`, `isSafeImageUrl`, and `isSafeLinkHref` (which does resolve root-relative hrefs for its origin comparison) through it, updating the surrounding doc comments. Unit check `review WR-02: ...` sets `document.baseURI` on the shim to a cross-origin http base and asserts relative and root-relative logo URLs and links are refused, that a same-origin base keeps harness-style relative files allowed, and that behavior without a base is unchanged.

## Skipped Issues

None.

## Verification

- Ran in the **main checkout** (`/Users/rhparker/Repos/ghl/admin-theme`, branch `main`), not an isolated worktree, per the orchestrator's sequential-mode instruction; results are reproducible from the checkout.
- Before each commit: `node --check src/ghl-customizer.js` (pass) and `node test/run.mjs` (98/98 at start; 99/99 after CR-01, 100/100 after WR-01, 101/101 after WR-02).
- Plan acceptance gates remain green through the suite's static checks: nine section markers in order, no selector literals or `console.` in the branding section, `cloneNode`/`new Image`/`setInterval`/`!important` absent, no `?.`/`??`, single `new MutationObserver` inside `watchBranding`, `new Set(observer).size === 1`.
- No uncommitted changes remain in `src/`, `test/`, or `config/`.

---

_Fixed: 2026-09-24T22:45:11Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

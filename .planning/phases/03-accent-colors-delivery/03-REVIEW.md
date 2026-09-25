---
phase: 03-accent-colors-delivery
reviewed: 2026-09-25T01:57:37Z
depth: quick
files_reviewed: 8
files_reviewed_list:
  - README.md
  - config/agency-config.json
  - src/ghl-customizer.css
  - src/ghl-customizer.js
  - test/dom-shim.mjs
  - test/fixtures/config.json
  - test/harness.html
  - test/run.mjs
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-09-25T01:57:37Z
**Depth:** quick
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Quick-depth review of the Phase 3 deliverables (theme engine, README, sample config, static test gates). All eight files were read in full as required, then swept with the quick-depth anti-pattern greps (hardcoded secrets, dangerous DOM/eval sinks, debug artifacts, empty catch blocks) plus targeted checks on the security surfaces the orchestrator called out.

Results of the sweep and targeted checks:

- **Secrets / dangerous sinks / debug artifacts:** no real hits. The only grep matches were regex `.exec(` calls, the literal `token:` field name inside `resolveTheme`'s `ignored` records, and the TAP `console.log` output in `test/run.mjs`. `test/harness.html:179` has an intentional one-line empty `catch` around `Object.defineProperty` on a stub `Response`; it is test tooling and does not affect test reliability, so it is not reported.
- **Untrusted color strings reaching CSS:** confirmed safe. `resolveTheme` (`src/ghl-customizer.js:598-600`) stores only `parseColor(raw).hex`, and every write goes through `setVar` -> `style.setProperty` (`src/ghl-customizer.js:2007-2050`). No color value is ever interpolated into stylesheet text, a `<style>` element, or `cssText`. `safe()` redacts any string containing `#`, so colors cannot reach the console either.
- **Public config:** `config/agency-config.json` contains the known webhook trigger URL (accepted trade-off D-08) and nothing new: no token, key, or contact data. `test/run.mjs:90,312` gates secret-like keys in both JSON files.
- **Observer scoping and teardown:** the theme observer is created only when a sidebar token resolves (`renderTheme`, line 2013 region), is disconnected on missing root and on native sidebar, and `clearSidebarTheme` runs when the root element is swapped, so a stale container never keeps custom properties.
- **jsDelivr pinning:** every jsDelivr URL in `README.md`, `config/agency-config.json`, and `DEFAULT_CONFIG_URL` is pinned to `@v0.1.0`; there are no `@latest`, branch, or unversioned references. Tag `v0.1.0` (a6ab42c) differs from HEAD (44f4e9a) only in `.planning/` files, so the assets jsDelivr serves are exactly the source reviewed here. All four `test/fixtures/logos/*.svg` files exist at the tag as the README requires.
- `node test/run.mjs` passes 119/119.

One warning: the README promises a readability guard for `navActive` that the code only applies when `sidebarText` is also set. Two info items are README drift against the code.

## Warnings

### WR-01: `navActive` contrast guard documented as unconditional but only runs when `sidebarText` is applied

**File:** `README.md:107` and `src/ghl-customizer.js:615-618`
**Issue:** The theme-token table says `navActive` is "Dropped when it is unreadable against the sidebar text." In `resolveTheme` the check is:

```js
if (tokens.navActive && tokens.sidebarText && contrastRatio(tokens.navActive, tokens.sidebarText) < MIN_CONTRAST) {
```

When a theme sets `navActive` without `sidebarText` (or with `sidebarText` but no `sidebarBg`, which rule 1 strips as `unpaired`), the `sidebarText` token is absent and `navActive` is applied with no contrast check at all, against a native sidebar text color the script cannot see. A location admin can ship a `navActive` close to HighLevel's native nav text and get an unreadable active item, and `verify().theme.ignored` will report 0 for it. The shipped sample sets all four tokens so it does not hit this path, but the README documents the guard as a guarantee.
**Fix:** Either enforce the pairing (mirrors the existing `unpaired` rule and keeps the README true as written):

```js
if (tokens.navActive && !tokens.sidebarText) {
  ignored.push({ scope: owner.navActive, token: 'navActive', reason: 'unpaired' });
  delete tokens.navActive;
}
```

or, if applying `navActive` alone is intended, change `README.md:107` to state the precondition explicitly ("Only checked against `sidebarText` when that token is applied; with no `sidebarText` it is applied as-is") and update the head-comment schema at `src/ghl-customizer.js:27-30` to match.

## Info

### IN-01: Release steps understate where the version tag lives

**File:** `README.md:46` (also `README.md:16,17,26,27,129`, `config/agency-config.json:15,26`, `src/ghl-customizer.js:48`)
**Issue:** Step 2 says to "Bump the version in three places so they agree" (the `VERSION` constant, the head comment, and `package.json`). The tag also appears in `DEFAULT_CONFIG_URL` (`src/ghl-customizer.js:48`), in both sample-config logo URLs (`config/agency-config.json:15,26`), and in five README URLs. The test suite gates all of them (`test/run.mjs:195`, `271-275`, `336-339`), so a missed spot fails `npm test` rather than shipping a mismatched release, but an operator following the README as written will always hit a failing suite on the first bump.
**Fix:** List the full set in step 2, e.g. "Bump the tag everywhere it appears: `VERSION`, the head comment, `package.json`, `DEFAULT_CONFIG_URL`, the two logo URLs in `config/agency-config.json`, and every jsDelivr URL in this README (`grep -rn '@v0\.' README.md config src`). `npm test` fails if any of them disagree."

### IN-02: Verify-mode `mounts` description omits `contactMountVia` and calls every key a boolean

**File:** `README.md:158` and `src/ghl-customizer.js:394`
**Issue:** The README says `mounts` is "a boolean per adapter selector" and lists twelve keys. `probe()` also returns `contactMountVia`, a string (`'toolbar-anchor'`, `'selector'`) or `null`, which is not in the list and is not a boolean.
**Fix:** Add `contactMountVia` to the list at `README.md:158` and note it is a string naming which contact-mount strategy resolved (`toolbar-anchor` or `selector`), or `null`.

---

_Reviewed: 2026-09-25T01:57:37Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_

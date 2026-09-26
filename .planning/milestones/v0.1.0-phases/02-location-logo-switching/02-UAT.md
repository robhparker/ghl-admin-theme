---
status: complete
phase: 02-location-logo-switching
source: [02-VERIFICATION.md]
started: 2026-09-24T22:37:53Z
updated: 2026-09-24T23:01:04Z
---

## Current Test

number: —
name: all tests complete
expected: |
  —
awaiting: nothing

## Tests

### 1. Harness walkthrough (a)-(h)
expected: `npm run serve`; open `http://localhost:5173/test/harness.html?ghlc-debug=1`; run PLAN 02-02 steps (a)-(h). One visible logo at all times; Native on agency/unconfigured/broken; green A / orange B pills; exactly one `rebrand` per control press; logo click routes to the agency dashboard; focus lands on the anchor.
result: pass — all eight steps observed as expected in Chrome on the post-review tree (PASS 101/101); src sequence A → native → B with A never returning; one image and one rebrand per control; details in 02-02-SUMMARY.md "Harness walkthrough".

### 2. Live HighLevel (i)-(o)
expected: Inject script + css + temporary config (Dummy Clinic → HTTPS PNG with alpha; `sendInvite.action.url` → `https://example.invalid/hooks/disabled`) into the logged-in tab; run steps (j)-(o). PNG at native logo size, aspect preserved, transparency intact, alt "Dummy Clinic"; `verify().branding` = `{ mount:'sidebar', found:true, applied:'location', resolving:false, failed:0, loaded:1 }`, `observers.branding:true`; click navigates as native; collapse/expand keeps one logo; native back on unconfigured + agency; console prints no URL/name/alt.
result: pass — captured `branding: { mount:'sidebar', found:true, applied:'location', resolving:false, failed:0, loaded:1 }`, `observers.branding: true`; PNG 53×40 with transparency, alt "Dummy Clinic"; native logo has no anchor and no click navigation both before and after injection; collapse/expand kept one branded image; unconfigured + agency routes restored the exact native src/alt; 0 console leaks; no selector correction needed. Details in 02-02-SUMMARY.md "Live-account branding verification".

### 3. Prohibition P-03 review
expected: `test/fixtures/logos/*.svg` and NOTICE.md show original pills only; nothing borrowed from the unlicensed dachi-khelashvili/ghl-customizer reference project.
result: pass — all four SVGs are a single rounded rect plus a text label (388–396 bytes each, no external refs, no scripts); NOTICE.md records that nothing was copied from the reference revision and lists its rejected selectors, none of which appear in the adapter.

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

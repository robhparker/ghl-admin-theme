---
status: testing
phase: 02-location-logo-switching
source: [02-VERIFICATION.md]
started: 2026-09-24T22:37:53Z
updated: 2026-09-24T22:37:53Z
---

## Current Test

number: 1
name: Harness walkthrough (a)-(h)
expected: |
  One visible logo at all times; Native on agency/unconfigured/broken; green A / orange B pills; exactly one `rebrand` per control press; logo click routes to the agency dashboard; focus lands on the anchor.
awaiting: user response

## Tests

### 1. Harness walkthrough (a)-(h)
expected: `npm run serve`; open `http://localhost:5173/test/harness.html?ghlc-debug=1`; run PLAN 02-02 steps (a)-(h). One visible logo at all times; Native on agency/unconfigured/broken; green A / orange B pills; exactly one `rebrand` per control press; logo click routes to the agency dashboard; focus lands on the anchor.
result: [pending]

### 2. Live HighLevel (i)-(o)
expected: Inject script + css + temporary config (Dummy Clinic `iDPNGKoFsjvf9wUCrk3V` -> HTTPS PNG with alpha; `sendInvite.action.url` -> `https://example.invalid/hooks/disabled`) into the logged-in tab per 01-HARNESS-WALKTHROUGH.md; run steps (j)-(o). PNG at native logo size, aspect preserved, transparency intact, alt "Dummy Clinic"; `verify().branding` = `{ mount:'sidebar', found:true, applied:'location', resolving:false, failed:0, loaded:1 }`, `observers.branding:true`; click navigates as native; HighLevel collapse/expand keeps one logo; native back on unconfigured + agency; console prints no URL/name/alt. Record the object in 02-02-SUMMARY.md.
result: [pending]

### 3. Prohibition P-03 review
expected: `test/fixtures/logos/*.svg` and NOTICE.md show original pills only; nothing borrowed from the unlicensed dachi-khelashvili/ghl-customizer reference project.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

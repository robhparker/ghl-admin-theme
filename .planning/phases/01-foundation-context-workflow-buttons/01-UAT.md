---
status: testing
phase: 01-foundation-context-workflow-buttons
source: [01-VERIFICATION.md]
started: 2026-09-24T17:11:01Z
updated: 2026-09-24T17:11:01Z
---

## Current Test

number: 2
name: Live HighLevel selector verification
expected: |
  In a logged-in HighLevel account, open a contact record with ?ghlc-debug=1 (or run GHLC.verify() in the console) and paste the report into 01-03-SUMMARY.md under "Live-account verify output". All candidate mounts should be true except sidebarLogo/headerLogo; contactFields.email or .phone should be true with candidate counts of 1. Any false names a selector in the adapter object to fix before Phase 2.
awaiting: user response

## Tests

### 1. Browser harness walkthrough
expected: npm run serve, open http://localhost:5173/test/harness.html?ghlc-debug=1, run Contact X / Send Invite / repeat click / 500 / cors / offline / re-render header and toolbar / Location B / agency / Back-Forward / stale click / Tab+Enter. States, labels, single-restore on re-render, overrides, and a leak-free verify object as detailed in 01-VERIFICATION.md.
result: pass — run by the orchestrator in Chrome on 2026-09-24 against commit f34463b; evidence in 01-HARNESS-WALKTHROUGH.md (all 13 steps ✓, plus the post-review cooldown-restore check)

### 2. Live HighLevel selector verification
expected: On a real contact record, GHLC.verify() reports the candidate mounts (sidebar, header, headerMount, contactMount, contactRegion, locationSwitcher, backToAgency) as true and contactFields email/phone readable with exactly one candidate each. Paste the report into 01-03-SUMMARY.md.
result: [pending]

### 3. Live Inbound Webhook delivery and CORS
expected: With a real Inbound Webhook trigger URL in config (replacing hooks/REPLACE_ME), pressing Send Invite on a designated test contact produces exactly one workflow execution carrying contactId, locationId, email/phone, and requestId. The button label reads "Workflow triggered" if the endpoint returns CORS headers, or "Sent (unconfirmed)" if it does not.
result: [pending]

## Summary

total: 3
passed: 1
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

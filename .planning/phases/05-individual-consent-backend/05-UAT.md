---
status: testing
phase: 05-individual-consent-backend
source: [05-VERIFICATION.md]
started: 2026-10-08T00:00:00-04:00
updated: 2026-10-08T00:00:00-04:00
---

## Current Test

number: 1
name: Rob answers Q-1, Q-2, Q-3, Q-5 in the proposal README
expected: |
  Decisions recorded. Defaults: Q-1 ships as-is (Child preselected), Q-2 not changed, Q-3 two token lengths coexist, Q-5 shared-email risk accepted with the staff rule.
awaiting: user response

## Tests

### 1. Decisions Q-1, Q-2, Q-3, Q-5 (README "Open questions")
expected: Each answered or default accepted.
result: pass
note: Rob 2026-10-08. Q-1 keep Child (the member link equals the owner view). Q-2 leave the family heading. Q-3 the two token lengths coexist. Q-5 accept the shared-email risk with the staff rule (confirm the email belongs to that member before pressing). These match the README defaults, so no deliverable changes.

### 2. Build the ClinX consent workflow per BUILD-SPEC, including build-time checks V-02, V-03, V-04, V-06, V-07 (first half), V-08, V-11 and the V-12 probe
expected: Built as Draft. All build-time checks match the spec, or deviations are recorded.
result: [pending]

### 3. Pilot gate (spec §6.3) on two test contacts: V-01, V-05, V-07, V-09, V-10, V-13
expected: All pass. Any failure returns the workflow to Draft.
result: [pending]

### 4. Publish wf2 v9 in n8n, then a real owner's hub link loads unchanged; a member's adhoc_ link shows one card; ?t=adhoc, ?t=adhoc_, truncated and altered tokens show "could not load"
expected: As stated. Roll back to v8 if the owner hub breaks.
result: [pending]

### 5. Refusals R-01..R-12 on test contacts
expected: Each produces its Note plus its internal notification, and no email.
result: [pending]

### 6. Rename "WEBHOOK TEST Send Hint JOIN LINK & Reminders" to "[Ready] Admin Menu: Send Invite (webhook)"
expected: Renamed. Trigger and URL unchanged.
result: [pending]

### 7. Set member_type=owner on any legacy-shaped test token holder used for testing
expected: Done before test 4.
result: [pending]

## Summary

total: 7
passed: 1
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

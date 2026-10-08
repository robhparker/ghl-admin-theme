---
status: testing
phase: 04-actions-menu
source: [04-VERIFICATION.md]
started: 2026-10-07T21:40:00-04:00
updated: 2026-10-07T21:40:00-04:00
---

## Current Test

number: 1
name: Harness walkthrough at Location M · Contact X
expected: |
  Actions button at the right of the name row. Enter, Space, or ArrowDown opens it. Arrow keys wrap. Home and End jump. Esc and Tab close it with focus back on the trigger. The visible focus ring follows the arrow keys. "Resend hub link (harness)" is unavailable with the tooltip "Not configured". "Send Invite (harness)" turns green and the trigger reads "Actions · Workflow triggered" for about 4 s. Location A contacts show no Actions menu.
awaiting: user response

## Tests

### 1. Harness walkthrough at Location M · Contact X
How: `npm run serve`, open http://localhost:5173/test/harness.html?ghlc-debug=1, then click "Location M · Contact X (Actions menu)"
expected: As described under Current Test.
result: [pending]

### 2. Harness synthetic email at Location M · Contact S, and Contact X after "Toggle synthetic email"
expected: "Send consent (harness)" is unavailable with "Needs the member's own email". Toggling back and reopening the menu makes it ready again.
result: [pending]

### 3. Trigger "Sending..." while a request is in flight (scope decision)
expected: Either accept the current behavior (the trigger stays "Actions" until the result lands, then flashes the result) or schedule IN-05 (a "Sending..." flash on the trigger).
result: pass
note: Rob chose "add it now" (2026-10-07). The trigger reads "Actions · Sending…" while an item is in flight, and the result replaces it. Covered by the "menu busy" scenario (165/165).

### 4. Live HighLevel: menu panel not clipped (WR-03). Run in the Phase 6 live test.
expected: On an Xcelsior contact record the panel opens below the Actions button, fully visible, and is not clipped by any overflow ancestor in the left record column.
result: [pending]

### 5. Live HighLevel: email flip (after Phase 6 fills the consent URL)
expected: With an owner+N@ email, "Send individual consent" reads "Needs the member's own email" while the other items stay usable. After editing to a real email and reopening the menu, it becomes ready.
result: [pending]

## Summary

total: 5
passed: 1
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

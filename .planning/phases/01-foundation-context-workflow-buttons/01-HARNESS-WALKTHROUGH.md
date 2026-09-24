# Phase 1 — Harness walkthrough evidence (2026-09-24)

Run by the orchestrator in Chrome against `http://127.0.0.1:5173/test/harness.html?ghlc-debug=1` (python3 http.server) after all three waves merged (commit 3d2c37d, `PASS 73/73`). Steps mirror Plan 03 Task 2's `<human-check>` (a)–(g).

| Step | Observed | Verdict |
|---|---|---|
| Boot on agency route | `GHLC.verify()` reports config loaded, schemaVersion 1, enabled true, 6 button IDs; route `isAgency: true`; 0 buttons, 0 observers; mounts: sidebar/header/headerMount/locationSwitcher/backToAgency true, contact* false | ✓ |
| Navigate Location A · Contact X | 2 groups; header: Support, Location Settings (anchors), Bad Type (unavailable); contact: Send Invite (ready), Bad Handler (unavailable), Copy Contact ID (ready); all stamped `locA|cX`; observers header+contact true | ✓ |
| Click Send Invite (stub 200) | `submitting` "Sending…" (disabled) → `queued` "Workflow triggered"; harness log shows exactly one POST `{contactId: cX, locationId: locA, buttonId: sendInvite, requestId: <uuid>, status: 200}` | ✓ |
| Repeat click during cooldown | No new log entry; state stays `queued` | ✓ |
| Navigate A · Contact Y, then B · Contact Z | ctx re-stamped `locA|cY` then `locB|cZ`; in B the `sendInvite` override hides the button, `supportLink` relabels "B Support", `locOnlyLink` (scoped to A) absent | ✓ |
| Re-render header on B/Z | Header group restored exactly once with the same buttons; observer count unchanged | ✓ |
| Browser Back | Returns to A/Y with A's button set | ✓ |
| Agency dashboard | 0 buttons, 0 groups, observers both false | ✓ |
| Stub 500 | `failed` "Failed — retry / Workflow did not accept the request (HTTP 500)…", button re-enabled | ✓ |
| Stub CORS (TypeError then opaque) | Retry in `no-cors` with the same requestId; final `queued` "Sent (unconfirmed)…" disabled for cooldown | ✓ |
| Stub offline (TypeError twice) | `failed` "Could not reach the workflow…" | ✓ |
| Stale click: pushState to cX then click the cY button synchronously | 0 webhook calls; old element `unavailable` "Context changed — reopen the contact and try again", detached; new button bound `locA|cX` | ✓ |
| Keyboard | Send Invite is a native `<button type="button">`, tabIndex 0, receives focus | ✓ |

Not covered here (needs Rob's logged-in HighLevel session): live selector verification via `GHLC.verify()` on a real contact record, and real CORS behavior of the Inbound Webhook endpoint.

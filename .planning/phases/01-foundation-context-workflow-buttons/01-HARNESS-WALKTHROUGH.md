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


# Live HighLevel walkthrough (2026-09-24, after commit 1d43272)

Script, stylesheet, and config served from HTTPS webhook.site tokens (temporary, 7-day expiry) and injected into a logged-in app.gohighlevel.com tab via a `<script src data-config data-css>` element, which is exactly how HighLevel's Custom JS setting loads it.

| Step | Observed | Verdict |
|---|---|---|
| Agency dashboard probe | `#sidebar-v2`, `.sidebar-v2-agency` (wrapper div), `#location-switcher-sidbar-v2`, `.hl_header.--agency`, two `.hl_header--controls`, `#sidebar-v2 img.agency-logo` all present; `#backButtonv2` absent | ✓ (adapter updated) |
| Location view (Dummy Clinic) | wrapper class `.sidebar-v2-location iDPNGKoFsjvf9wUCrk3V`; switcher text shows the location name | ✓ |
| Contact record probe | none of `.hl_contact-details-header` / `.contact-detail-header` / `[class*=contact-detail]` / `mailto:` exist; real structure is `#record-details-lhs` → name row with `#delete-contact-trigger`, `div#contact.email > input`, `div#contact.phone > input` | ✗ candidates → ✓ after commit 9e173b9 |
| Inject on contact record | config loaded, styles injected, Help Center in header, Send Invite on the name row, both observers attached, `contactMountVia: toolbar-anchor`, email readable | ✓ |
| Press Send Invite | ready → submitting → queued "Workflow triggered"; listener log: 1 × OPTIONS (preflight) + 1 × POST with contactId, locationId, buttonId, requestId (uuid v4), sentAt, email, source | ✓ |
| Repeat click | no additional request; stays queued | ✓ |
| Next-contact arrow (SPA) | generation 2 → 3, button re-stamped to the new contact ID, email readable | ✓ |
| Open contact from list (SPA) | button first rendered `unavailable` (email field empty at mount), recovered to `ready` ~200 ms later via the new bounded field poll | ✗ → ✓ after commit 1d43272 |
| Full page navigation | injected script is gone after a real reload (expected: HighLevel re-injects Custom JS on each load) | n/a |

Visual note for Phase 3: the name row is narrow; Send Invite pushes the contact name to "(Ex…". A compact/icon-only variant for the contact placement, or mounting on the "Contact Details ‹ ›" row instead, is worth considering.

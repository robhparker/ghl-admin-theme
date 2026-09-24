# Phase 1 Context: Foundation, Context & Workflow Buttons

Captured from the kickoff questioning on 2026-09-24 with Rob Parker (product owner). No separate discuss-phase was run; these are the locked decisions.

<decisions>

### Locked decisions

- **D-01 Workflow trigger path:** Buttons trigger HighLevel workflows via the workflow's **Inbound Webhook trigger**, POSTed directly from the browser. No companion service in v1. Server-side hardening is v2.
- **D-02 Contact identification:** HighLevel's Inbound Webhook requires **email or phone** in the payload to find the contact. The button reads the contact's email and/or phone from the open contact record via adapter selectors and sends `contactId`, `locationId`, `email`, `phone`, `buttonId`, `requestId` (UUID v4), `sentAt`, plus optional `extraFields` from config. If neither email nor phone can be read, the button renders `unavailable` with "contact email/phone not found".
- **D-03 Phase 1 buttons:** One contact-record webhook button ("Send Invite") plus header link buttons. No bulk/list actions.
- **D-04 Hosting:** GitHub repo under Rob's account, served via jsDelivr pinned to a version tag. Script reads its config URL from a `data-config` attribute on its own `<script>` tag, falling back to a constant.
- **D-05 Stack:** Vanilla JavaScript IIFE (ES2019+, no build step, no bundler, no framework) plus one scoped CSS file. All HighLevel selectors and route regexes live in a single `adapter` object.
- **D-06 Reference code:** Nothing copied from dachi-khelashvili/ghl-customizer (no license). Original code only. `NOTICE.md` already exists and records this.
- **D-07 Logo mount point:** Deferred to live inspection (Phase 2). The adapter reserves both `sidebarLogo` and `headerLogo` mount selectors now.
- **D-08 Config security:** Config JSON is public to staff. No API keys, tokens, or contact data in it. The webhook URL is in config; this is an accepted trade-off for a staff-only tool (rotate the trigger URL in HighLevel if compromised).
- **D-09 Location state:** In-memory per tab. No localStorage/sessionStorage for location or contact context.
- **D-10 Stale-context protection:** Every context change increments a generation counter; async completions compare generation before touching the DOM or reporting state.
- **D-11 Webhook fetch strategy:** Try a normal CORS `fetch` with `Content-Type: application/json`. If the request fails with a network/CORS `TypeError`, retry once with `mode: "no-cors"` and report state `queued` with the label "Sent (unconfirmed)". A non-2xx CORS response is `failed`. Whether HighLevel's webhook endpoint returns CORS headers is unverified; the harness stubs both outcomes.
- **D-12 Local testing:** `test/harness.html` mimics the HighLevel shell (sidebar with `#sidebar-v2`, `.hl_header`, a contact detail region with email/phone fields, and a fake history-based router) so switching, re-render, and webhook states can be exercised offline. Uses no build tooling; open the file directly or with a static server.

### Candidate HighLevel selectors (unverified — verify mode exists so Rob can confirm live)

| Purpose | Candidate |
|---|---|
| Sidebar container | `#sidebar-v2` |
| Sidebar state classes | `.sidebar-v2-agency`, `.sidebar-v2-location` on the sidebar |
| Location switcher | `#location-switcher-sidbar-v2` (HighLevel's own typo) |
| Back-to-agency | `#sidebar-v2 #backButtonv2` |
| Header container | `.hl_header` |
| Header controls area (header button mount) | `.hl_header--controls` (fallback: `.hl_header`) |
| Location URL | `/v2/location/{locationId}/...` |
| Contact detail URL | `/v2/location/{locationId}/contacts/detail/{contactId}` |
| Agency URLs | `/v2/agency/...`, `/agency_dashboard/...`, any URL without `/v2/location/` |
| Contact toolbar (contact button mount) | `.hl_contact-details-header, .contact-detail-header, [class*="contact-details"] .hl_header--controls` (first match wins; verify live) |
| Contact email on record | `a[href^="mailto:"]` within the contact detail region, then any `input[type="email"]` value |
| Contact phone on record | `a[href^="tel:"]` within the contact detail region, then `input[type="tel"]` value |
| Route change signal | `popstate`, custom `routeChangeEvent` on `window`, plus patched `history.pushState`/`replaceState` dispatching `ghlc:navigate` |

### Claude's Discretion

- Exact module layout inside the single IIFE (context, config, adapter, branding, buttons, ui/state).
- CSS class naming (prefix `ghlc-`).
- Icon set: a small inline SVG map (`mail`, `link`, `external`, `send`); unknown icon keys render no icon.
- Harness fixture details.

### Deferred Ideas

- Companion service with operator auth and contact-to-location verification (v2 INV-01..05).
- Logo switching (Phase 2), accent colors and README (Phase 3).

</decisions>

<constraints>
- Config never executes JavaScript; action types limited to `link`, `webhook`, `handler`.
- Diagnostics log IDs and states only. Never log webhook URLs, payloads, email, or phone.
- If a mount point is missing, omit the customization and leave native UI untouched.
- Bounded, scoped MutationObservers: one per mount region, disconnected when the region leaves the DOM.
</constraints>

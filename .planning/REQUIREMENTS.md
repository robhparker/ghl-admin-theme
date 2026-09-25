# Requirements: GHL Customizer (admin-theme)

**Defined:** 2026-09-24
**Core Value:** From an open contact record, a staff member can press one button and reliably trigger the right HighLevel workflow for that exact contact and location, with no stale context and no duplicate sends.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation & Adapter

- [x] **FND-01**: Repo contains `src/ghl-customizer.js` (vanilla IIFE), `src/ghl-customizer.css`, and `config/agency-config.json` with a documented schema (`schemaVersion`, `enabled`, `agency`, `locations`, `buttons`)
- [x] **FND-02**: `NOTICE.md` records the reference project URL, commit hash, its lack of license, and that no code was copied
- [x] **FND-03**: All HighLevel selectors and route regexes live in a single `adapter` object; no selector strings appear elsewhere in the script
- [x] **FND-04**: Adapter exposes a verify mode (`?ghlc-debug=1` or `window.GHLC.verify()`) that logs which mount points and route patterns resolve on the current page, so selectors can be confirmed in a live account
- [x] **FND-05**: Script fetches config from a configurable HTTPS URL, validates `schemaVersion`, and does nothing when `enabled` is false or the fetch/parse fails
- [x] **FND-06**: Disabling or removing the script from HighLevel custom JS restores the native UI after reload (no persisted DOM or storage changes)

### Location Context

- [x] **LOC-01**: Active location ID is resolved from the URL on initial load
- [x] **LOC-02**: Location changes are detected on in-app navigation, browser back/forward, and location-switcher use (popstate, `routeChangeEvent`, and pushState/replaceState hooks)
- [x] **LOC-03**: Agency-level routes resolve to a null location and restore agency branding
- [x] **LOC-04**: Each browser tab keeps independent active-location state (in-memory only; no localStorage for location)
- [x] **LOC-05**: Each context change carries a generation token; async work from an older generation is discarded and cannot apply to the DOM

### Location Branding

- [x] **BRD-01**: A configured location's logo replaces the agency logo in the agreed mount point (sidebar or header, selected in adapter config) with preserved proportions, transparent-image support, and alt text
- [x] **BRD-02**: The existing logo's click/navigation behavior is preserved
- [x] **BRD-03**: On location change the previous override is removed immediately and the agency fallback shows until the new location resolves
- [x] **BRD-04**: A missing, unconfigured, or broken (onerror) client logo falls back to the agency logo, then to the native HighLevel logo; the previous client logo is never the fallback
- [x] **BRD-05**: Branding is reapplied when HighLevel re-renders the logo element, without duplicate observers

### Accent Colors

- [x] **CLR-01**: Config supports optional theme tokens (`primary`, `sidebarBg`, `sidebarText`, `navActive`) at agency and location levels
- [x] **CLR-02**: When tokens are present they are applied as CSS custom properties on a scoped root and used only by the customizer's own buttons and the verified sidebar surfaces
- [x] **CLR-03**: Invalid color values are ignored; sidebar text/background pairs below 4.5:1 contrast fall back to safe defaults
- [x] **CLR-04**: Native success, warning, and error colors are untouched

### Configurable Buttons

- [x] **BTN-01**: Each button has `id`, `label`, optional `icon` (from an approved icon set), `placement` (`header` or `contact`), `scope` (all locations or a list of location IDs), and `action` (`{type:"link", href, target}` or `{type:"handler", handler}`)
- [x] **BTN-02**: Location overrides can enable, disable, or override buttons by stable button ID
- [x] **BTN-03**: Header buttons render in the global header mount point for locations in scope, exactly once even after native re-render
- [x] **BTN-04**: Contact buttons render in the contact record toolbar only when both a location and a contact ID are resolved
- [x] **BTN-05**: Contact buttons revalidate location and contact at click time and refuse to act if either changed or is missing
- [x] **BTN-06**: Navigating away from a contact removes contact buttons and any pending UI state; the previous contact ID is never reused
- [x] **BTN-07**: Buttons support ready, submitting, queued, unavailable, and failed states with visible feedback; repeat clicks are disabled while submitting
- [x] **BTN-08**: Buttons are keyboard accessible (real `<button>`/`<a>`, focus ring, Enter/Space) and match surrounding HighLevel styling
- [x] **BTN-09**: Action types are limited to `link`, `webhook`, and `handler` (in-script allowlisted registry); any other type or unknown handler renders as unavailable, and no JavaScript is ever executed from config
- [x] **BTN-10**: A `webhook` action POSTs JSON to the configured HighLevel Inbound Webhook URL (HTTPS only) with `contactId`, `locationId`, `buttonId`, `requestId` (UUID per click), `sentAt`, and the contact's `email` and/or `phone` read from the open record via adapter selectors (HighLevel's Inbound Webhook requires email or phone to match the contact); if neither can be read the button renders unavailable with "contact email/phone not found"; optional `extraFields` from config are merged in
- [x] **BTN-11**: Webhook buttons move ready → submitting → queued on a 2xx response and → failed otherwise, showing "Workflow triggered" (never "Email delivered") and an actionable failure message that excludes the URL and payload
- [x] **BTN-12**: A webhook button cannot be re-fired while submitting; after queued it stays disabled for a configurable cooldown (default 10 s) so double-clicks and accidental resends are blocked client-side
- [x] **BTN-13**: Sample config ships one contact-record webhook button ("Send Invite") pointed at a placeholder Inbound Webhook URL, plus one header link button

### Delivery

- [ ] **DLV-01**: README documents installation in HighLevel (Agency Settings → Custom JS/CSS snippet), config schema, hosting via jsDelivr with a pinned tag, and rollback
- [ ] **DLV-02**: Sample config includes agency defaults, two location logo overrides, one header link button, and the contact-record webhook button
- [x] **DLV-03**: A local test harness (`test/harness.html`) mimics the HighLevel DOM shell so location switching, fallbacks, and re-render behavior can be exercised without a live account
- [x] **DLV-04**: Diagnostics never log credentials, contact content, or config payloads beyond IDs and states

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Send Invite hardening (companion service)

- **INV-01**: Companion endpoint authenticates the operator and authorizes location + action before enrolling
- **INV-02**: Endpoint verifies the contact belongs to the location and rejects mismatches
- **INV-03**: Server-side duplicate rejection by `requestId`
- **INV-04**: Webhook URL moves out of the public config into server-side configuration
- **INV-05**: Resend policy enforced server-side

### Later

- **LTR-01**: Automatic logo/color sync from HighLevel location data
- **LTR-02**: Spark-style folders or submenus
- **LTR-03**: Configuration UI

## Out of Scope

| Feature | Reason |
|---------|--------|
| Companion service / server-side authorization | v1 triggers workflows via HighLevel Inbound Webhook directly from the browser (Rob's decision 2026-09-24); server-side hardening is v2 |
| Full theme redesign | PRD restricts colors to verified surfaces |
| Bulk invitations / contacts list action | Excluded by PRD |
| Arbitrary JS from config | Security boundary |
| Marketplace, billing, plugin loading, custom DB fields | Excluded by PRD |
| Copying reference code | Reference repo has no license |
| Mobile layouts | Desktop web app only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| FND-03 | Phase 1 | Complete |
| FND-04 | Phase 1 | Complete |
| FND-05 | Phase 1 | Complete |
| FND-06 | Phase 1 | Complete |
| LOC-01 | Phase 1 | Complete |
| LOC-02 | Phase 1 | Complete |
| LOC-03 | Phase 1 | Complete |
| LOC-04 | Phase 1 | Complete |
| LOC-05 | Phase 1 | Complete |
| BRD-01 | Phase 2 | Complete |
| BRD-02 | Phase 2 | Complete |
| BRD-03 | Phase 2 | Complete |
| BRD-04 | Phase 2 | Complete |
| BRD-05 | Phase 2 | Complete |
| CLR-01 | Phase 3 | Complete |
| CLR-02 | Phase 3 | Complete |
| CLR-03 | Phase 3 | Complete |
| CLR-04 | Phase 3 | Complete |
| BTN-01 | Phase 1 | Complete |
| BTN-02 | Phase 1 | Complete |
| BTN-03 | Phase 1 | Complete |
| BTN-04 | Phase 1 | Complete |
| BTN-05 | Phase 1 | Complete |
| BTN-06 | Phase 1 | Complete |
| BTN-07 | Phase 1 | Complete |
| BTN-08 | Phase 1 | Complete |
| BTN-09 | Phase 1 | Complete |
| BTN-10 | Phase 1 | Complete |
| BTN-11 | Phase 1 | Complete |
| BTN-12 | Phase 1 | Complete |
| BTN-13 | Phase 1 | Complete |
| DLV-01 | Phase 3 | Pending |
| DLV-02 | Phase 3 | Pending |
| DLV-03 | Phase 1 | Complete |
| DLV-04 | Phase 1 | Complete |

**Coverage:**

- v1 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-24*
*Last updated: 2026-09-24 after Rob moved buttons + webhook trigger into Phase 1*

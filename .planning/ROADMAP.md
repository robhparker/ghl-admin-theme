# Roadmap: GHL Customizer (admin-theme)

## Overview

Three phases, ordered by what Rob rated most important. Phase 1 ships the core value end to end: the script loads its config, knows which location and contact are open, and puts a working "Send Invite" button on the contact record that fires a HighLevel Inbound Webhook workflow trigger exactly once for exactly that contact, alongside configurable header link buttons. Phase 2 layers per-location client logo switching on top of the same location-context engine, with fallbacks and stale-response protection. Phase 3 adds optional accent colors on verified surfaces and finishes delivery: README, hosting/rollback instructions, and a complete sample config. Every phase changes what staff see in the HighLevel DOM, so every phase carries a UI hint.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation, Context & Workflow Buttons** - Config-driven script with adapter, location/contact detection, header link buttons, and a contact-record webhook button that triggers the right workflow once (completed 2026-09-24)
- [ ] **Phase 2: Location Logo Switching** - Client logo per location with agency/native fallbacks and no stale branding across switches
- [ ] **Phase 3: Accent Colors & Delivery** - Optional per-location accent colors on verified surfaces, README, and the full sample config

## Phase Details

### Phase 1: Foundation, Context & Workflow Buttons

**Goal**: From an open contact record, a staff member presses one button and reliably triggers the right HighLevel workflow for that exact contact and location, with no stale context and no duplicate sends; header link buttons appear where configured.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, FND-06, LOC-01, LOC-02, LOC-03, LOC-04, LOC-05, BTN-01, BTN-02, BTN-03, BTN-04, BTN-05, BTN-06, BTN-07, BTN-08, BTN-09, BTN-10, BTN-11, BTN-12, BTN-13, DLV-03, DLV-04
**Success Criteria** (what must be TRUE):

  1. With the snippet installed and a contact record open in a configured location, a staff member presses "Send Invite" and sees the button go ready → submitting → queued with "Workflow triggered" feedback; the HighLevel workflow's Inbound Webhook trigger receives one event carrying that contact's ID, the location ID, the button ID, and a unique request ID.
  2. Pressing the button repeatedly while it is submitting, or again within the cooldown after it is queued, produces no additional webhook events; a non-2xx response shows a failed state with an actionable message that never reveals the webhook URL or payload.
  3. After navigating between contacts or locations by in-app links, browser back/forward, or the location switcher, the contact button is always bound to the contact currently on screen: it refuses to fire if the contact or location changed since it rendered, it disappears when no contact record is open, and it never appears on agency-level pages.
  4. Configured header link buttons appear exactly once in the global header for in-scope locations (including after HighLevel re-renders the header), open their configured href, are operable by keyboard with a visible focus ring, and are absent in out-of-scope locations; a button with an unknown action type or handler renders as unavailable and no config-supplied JavaScript ever runs.
  5. Running `window.GHLC.verify()` (or loading with `?ghlc-debug=1`) prints which mount points and route patterns resolve on the current page, logging only IDs and states; setting `enabled: false` or removing the snippet restores the native UI on reload; and `test/harness.html` lets a developer exercise location switching, contact navigation, and header re-render locally without a live HighLevel account.

**Plans**: 3/3 plans executed
**UI hint**: yes

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking skeleton: config -> context -> Send Invite -> stubbed webhook -> queued, plus harness and stylesheet

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Context engine (navigation signals, generation tokens, click-time revalidation) and webhook hardening (cooldown, no-cors fallback, messaging, log hygiene)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Header buttons, location overrides, action allowlist and handler registry, scoped observers, verify mode, disabled/no-op paths

### Phase 2: Location Logo Switching

**Goal**: When a staff member is inside a configured location, that client's logo is showing in the agreed mount point, and nothing stale from a previous location ever remains.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: BRD-01, BRD-02, BRD-03, BRD-04, BRD-05
**Success Criteria** (what must be TRUE):

  1. Entering a location that has a configured logo replaces the agency logo in the agreed mount point (sidebar or header, per adapter config) with the client logo at correct proportions, transparent images rendered cleanly, and meaningful alt text; clicking the logo still navigates exactly as the native logo did.
  2. Switching from location A to location B clears A's logo immediately, shows the agency logo while B resolves, and then shows B's logo; A's logo is never visible while B is active.
  3. Opening an unconfigured location, returning to an agency-level view, or having a client logo fail to load shows the agency logo, and if that is unavailable the native HighLevel logo; the previous client's logo is never used as a fallback.
  4. Rapidly switching A → B → A leaves A's logo showing even when B's image or config resolves late; a slow response from an earlier location never overwrites the current one.
  5. When HighLevel re-renders the logo element (route change, sidebar collapse/expand), the client logo is restored without duplicate images, and verify mode reports a single branding observer.

**Plans**: 2 plans
**UI hint**: yes

Plans:
**Wave 1**

- [ ] 02-01-PLAN.md — Tracer: config -> location context -> sidebar logo mount -> preload -> in-place src/alt swap -> native restore; then switching/fallback semantics (interim agency logo, location -> agency -> native error chain, stale-result discard, alt chain, scoped .ghlc-logo rule, log hygiene)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02-PLAN.md — Single branding MutationObserver (img replaced, sidebar replaced, foreign src/alt writes), verify() branding report, harness sidebar logo + mutation controls, SVG fixture logos, sample-config logoMount, end-of-phase harness + live HighLevel check

### Phase 3: Accent Colors & Delivery

**Goal**: Locations can optionally carry their own accent colors on verified surfaces without breaking readability or native status colors, and an agency admin can install, host, configure, and roll back the customizer from the README alone.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: CLR-01, CLR-02, CLR-03, CLR-04, DLV-01, DLV-02
**Success Criteria** (what must be TRUE):

  1. A location whose config defines theme tokens (`primary`, `sidebarBg`, `sidebarText`, `navActive`) shows those colors on the customizer's own buttons and the verified sidebar surfaces; locations without tokens inherit agency tokens or look fully native; switching locations swaps the colors with no bleed-through.
  2. An invalid color value is silently ignored, and a sidebar text/background pair below 4.5:1 contrast falls back to safe defaults, while HighLevel's native success, warning, and error colors remain visibly unchanged on every themed page.
  3. A new agency admin can follow the README to paste the snippet into Agency Settings → Custom JS/CSS, point it at a jsDelivr URL pinned to a version tag, understand every field in the config schema, and roll back by changing only the tag.
  4. The shipped sample config loads without validation errors and demonstrates agency defaults, two location logo overrides, one header link button, and the contact-record "Send Invite" webhook button.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Context & Workflow Buttons | 3/3 | Complete    | 2026-09-24 |
| 2. Location Logo Switching | 0/TBD | Not started | - |
| 3. Accent Colors & Delivery | 0/TBD | Not started | - |

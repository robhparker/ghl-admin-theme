# GHL Customizer (admin-theme)

## What This Is

A small, configuration-driven browser customization layer for our HighLevel agency workspace. It shows the right client logo when staff switch locations, optionally applies per-location accent colors, and adds configurable buttons where staff work (global header and the individual contact record). It is one hosted vanilla JavaScript file, one optional scoped stylesheet, and one manually maintained JSON config.

## Core Value

From an open contact record, a staff member can press one button and reliably trigger the right HighLevel workflow for that exact contact and location, with no stale context and no duplicate sends.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Resolve the active location ID on initial load, in-app navigation, back/forward, and location switching
- [ ] Replace the agency logo with the configured client logo for the active location, in one agreed position
- [ ] Fall back to the agency logo, then the native HighLevel appearance, when a location is unknown or its logo fails
- [ ] Immediately clear the previous location's branding on switch; late responses from a previous location never overwrite the current one
- [ ] Optional accent colors (primary, sidebar background, sidebar text, active nav) applied only to verified surfaces, with contrast-safe fallbacks
- [ ] Configurable link buttons in a global header placement, scoped by location
- [ ] Contact action button on the individual contact record that POSTs contact and location IDs to a HighLevel Inbound Webhook workflow trigger (Send Invite)
- [ ] Button states: ready, submitting, queued, unavailable, failed; keyboard accessible; no duplicate clicks
- [ ] Reapply on native re-render without duplicating buttons, listeners, or observers
- [ ] HighLevel selectors and route parsing isolated in a small adapter with a debug/verify mode
- [ ] Global `enabled` flag; disabling or removing the script restores native UI after reload
- [ ] Original code with a NOTICE file recording the reference project, its revision, and that no code was copied

### Out of Scope

- Companion service / server-side authorization — v1 fires the workflow via HighLevel Inbound Webhook directly from the browser; server-side auth, contact-to-location verification, and dedupe are v2 hardening
- Full theme redesign / broad restyling — PRD limits colors to verified surfaces
- Marketplace distribution, billing, arbitrary plugin loading, custom database fields — explicitly excluded by PRD
- Bulk invitation sending / contacts-list bulk action — excluded by PRD
- Spark-style folders/submenus, configuration UI, automatic brand-data sync — "later only" per PRD
- Executing arbitrary JavaScript from configuration — security boundary; only link and registered-handler actions
- Mobile app / non-desktop layouts — desktop web application only

## Context

- **Product owner:** Rob Parker. PRD v0.1 (2026-09-24) at `docs/GHL_Customizer_PRD_v0_1.docx`.
- **Environment:** One agency, multiple locations, HighLevel desktop web app. Script is injected via Agency Settings → Company → Custom JavaScript/CSS. HighLevel warns custom JS/CSS is unsupported and may break on UI updates.
- **Reference project:** https://github.com/dachi-khelashvili/ghl-customizer at commit `ff7c8e49f5e2f2db96cae3db16142642ccc5a6e7` (2025-11-11). **It has no LICENSE file**, so it is all-rights-reserved by default and no code may be copied. It is 108 lines, fires `alert()` on load, hardcodes a config URL to a different GitHub user, and uses selectors (`.hl-header-logo`, `.hl-header-nav`, `.hl-user-menu`) that do not match the current HighLevel DOM. Treated as an idea reference only; recorded in `NOTICE.md`.
- **Spark GHL Hub** (https://github.com/pedropoleza/spark-ghl-hub) is a future reference, not a dependency.
- **Candidate HighLevel selectors** (from community CSS guides, to be verified live in Phase 1):
  - Sidebar container `#sidebar-v2`; state classes `.sidebar-v2-agency` / `.sidebar-v2-location`; open state `.v2-open`
  - Location dropdown `#location-switcher-sidbar-v2` (HighLevel's own typo)
  - Back-to-agency button `#sidebar-v2 #backButtonv2`
  - Header `.hl_header`
  - Nav items `#sidebar-v2 .hl_nav-item a`, active `.hl_nav-item--active`
  - Location URL pattern `/v2/location/{locationId}/...`; contact detail `/v2/location/{locationId}/contacts/detail/{contactId}`
  - Agency views under `/v2/agency/...` or `/agency_dashboard/...`
  - Window event `routeChangeEvent` fires on in-app navigation (unofficial)
- **Live verification is blocked on a logged-in HighLevel session.** No HighLevel tab was open during planning. Phase 1 includes a verify mode in the adapter that logs which selectors resolve, so Rob can run it in his account and paste the output.
- **Logo position** is undecided until live inspection; the adapter supports both sidebar and header mount points.
- **Hosting:** GitHub repo under Rob's account, served via jsDelivr pinned to a version tag. Rollback = change the tag in the HighLevel snippet.
- Different browser tabs must keep independent active-location state (no shared storage for location).

## Constraints

- **Tech stack**: Vanilla JavaScript (ES2019+, IIFE, no build step) and scoped CSS — PRD requires no framework, single hosted script
- **Configuration**: Manually maintained public JSON — no secrets, tokens, patient data, or contact records in it
- **Security**: No arbitrary JS from config; only `link` and `handler` action types with an allowlisted handler registry
- **Compatibility**: Must degrade gracefully — if a mount point is missing, omit the customization and leave native UI usable
- **Performance**: Bounded, scoped MutationObservers; no whole-page polling
- **Licensing**: Reference project has no license; all code must be original
- **Delivery**: Versioned assets on jsDelivr; `enabled` flag; pilot in selected locations

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Write original code; no copying from reference | Reference repo has no LICENSE (all rights reserved) | — Pending |
| Location detection primarily from URL `/v2/location/{id}/` plus `popstate` and `routeChangeEvent`, with a lightweight `history` patch as backup | Stable ID, works across load/nav/back/forward; reference provides no context API | — Pending |
| Adapter supports sidebar and header logo mounts; choice deferred to live inspection | Rob chose to decide after seeing the live DOM | — Pending |
| GitHub + jsDelivr with pinned tag for hosting | Zero infra, trivial rollback | — Pending |
| Send Invite fires a HighLevel Inbound Webhook workflow trigger directly from the browser | Rob wants a working workflow trigger in Phase 1 without a server; webhook URL lives in public config, accepted trade-off for a staff-only tool | — Pending |
| Phase order: buttons + webhook first, logo switching second | Rob rated workflow trigger as more important than branding | — Pending |
| Skip GSD research | PRD is detailed; selectors gathered during questioning | — Pending |
| Keep existing `.planning/config.json` | Preferences already set by Rob before kickoff | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-24 after roadmap adjustment (buttons first, webhook trigger in v1)*

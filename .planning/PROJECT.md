# GHL Customizer (admin-theme)

## What This Is

A small, configuration-driven browser customization layer for our HighLevel agency workspace. It shows the right client logo when staff switch locations, optionally applies per-location accent colors, and adds configurable buttons where staff work (global header and the individual contact record). It is one hosted vanilla JavaScript file, one optional scoped stylesheet, and one manually maintained JSON config.

## Core Value

From an open contact record, a staff member can press one button and reliably trigger the right HighLevel workflow for that exact contact and location, with no stale context and no duplicate sends.

## Current State

**Shipped:** milestone v0.1.0 (2026-09-25). Release tags on GitHub: `v0.1.0` (first publish), `v0.1.1` (live sidebar theming, active-nav detection, readable hover, script-tag install), `v0.1.2` (Xcelsior Health location entry). jsDelivr serves each tag immutably. Installed in the Park Health Systems agency through Agency Settings > Company > Custom JavaScript (v0.1.1 at close; the snippet moves to v0.1.2 by changing the tag in both URLs).

**Configured locations:** Dummy Clinic (test, full theme) and Xcelsior Health (HighLevel-hosted logo, navy `primary` only, native sidebar). Every other location shows the native UI plus the scope-`all` buttons.

**Codebase:** one 2,513-line vanilla IIFE (`src/ghl-customizer.js`), a 154-line scoped stylesheet, a 1,510-byte public JSON config, and a zero-dependency test suite (119 checks over a 1,153-line DOM shim plus an offline harness). No build step, no packages.

**Known limits:** HighLevel's nav icons are black images, so a dark `sidebarBg` leaves them low-contrast; the sidebar logo slot is 40px tall, so padded logos render small; a location logo hosted by HighLevel keeps its URL only until someone re-uploads it.

## Current Milestone: v0.2.0 Actions menu + "Send individual consent" for family members

**Goal:** From an Xcelsior contact record, staff open one Actions menu and send the Hint join link, a family member's own consent forms, or the owner's Consent Hub link (or copy the contact ID), each reaching exactly the open contact.

**Target features:**
- Actions menu in the contact name row (`menus[]` config, backward compatible with plain buttons), keyboard accessible, per-item states and a 60 s per-item cooldown
- Four Xcelsior-only items: Send Invite (unchanged trigger), Send individual consent, Resend Consent Hub link, Copy contact ID; Xcelsior actions scoped to `Cp2XxBsRoyKS2CUf1Hwi`
- ClinX 365 build spec for one consent Inbound Webhook workflow (Find Contact by payload `contactId`, branch on `buttonId`, guards, refusal notes) and the Send Invite workflow rename
- wf2 Build Status change so a member-held `consent_hub_token` shows only that member's card; member consent email (MJML)
- Release v0.2.0 with a live-test checklist and rollback to v0.1.2

## Requirements

### Validated

- ✓ Resolve the active location ID on initial load, in-app navigation, back/forward, and location switching — Phase 1
- ✓ Configurable link buttons in a global header placement, scoped by location — Phase 1
- ✓ Contact action button on the individual contact record that POSTs contact and location IDs to a HighLevel Inbound Webhook workflow trigger (Send Invite) — Phase 1
- ✓ Button states: ready, submitting, queued, unavailable, failed; keyboard accessible; no duplicate clicks — Phase 1
- ✓ Reapply on native re-render without duplicating buttons, listeners, or observers — Phase 1
- ✓ HighLevel selectors and route parsing isolated in a small adapter with a debug/verify mode — Phase 1
- ✓ Original code with a NOTICE file recording the reference project, its revision, and that no code was copied — Phase 1
- ✓ Replace the agency logo with the configured client logo for the active location, in one agreed position (sidebar) — Phase 2
- ✓ Fall back to the agency logo, then the native HighLevel appearance, when a location is unknown or its logo fails — Phase 2
- ✓ Immediately clear the previous location's branding on switch; late responses from a previous location never overwrite the current one — Phase 2
- ✓ Optional accent colors (primary, sidebar background, sidebar text, active nav) applied only to verified surfaces, with contrast-safe fallbacks — Phase 3 (live-verified on Dummy Clinic, v0.1.1)
- ✓ Global `enabled` flag; disabling or removing the script restores native UI after reload — Phase 3 (kill switch and rollback rehearsed live)

### Active

- [ ] Actions menu replaces the single Send Invite button on Xcelsior contact records (v0.2.0)
- [ ] Staff can send a family member their own consent forms by email, completing through the existing family consent path (v0.2.0)
- [ ] Staff can resend the family owner's Consent Hub link from the owner's or a member's record (v0.2.0)
- [ ] Per-client onboarding path as a routine (location entry, logo, theme, tag) — carried from v0.1.0, not in v0.2.0 scope

### Out of Scope

- Companion service / server-side authorization — v1 fires the workflow via HighLevel Inbound Webhook directly from the browser; server-side auth, contact-to-location verification, and dedupe are v2 hardening
- Full theme redesign / broad restyling — PRD limits colors to verified surfaces
- Marketplace distribution, billing, arbitrary plugin loading, custom database fields — explicitly excluded by PRD
- Bulk invitation sending / contacts-list bulk action — excluded by PRD
- Spark-style folders/submenus, configuration UI, automatic brand-data sync — "later only" per PRD
- Executing arbitrary JavaScript from configuration — security boundary; only link and registered-handler actions
- Mobile app / non-desktop layouts — desktop web application only
- Server-side dedupe, n8n-by-contactId routing, INV-01..05 in v0.2.0 — deferred in `seeds/consent-actions-hardening.md`; client cooldown only (Rob, 2026-10-07)
- Age/DOB gate for individual consent — eligibility is staff judgment; parents often reuse their own email for children
- "Send Longevity Plus invite" menu item — deferred with the hardening seed
- Hiding menu items by role or contact field values — same items for every Xcelsior contact; only the synthetic/empty-email pre-check disables an item

## Context

- **Product owner:** Rob Parker. PRD v0.1 (2026-09-24) at `docs/GHL_Customizer_PRD_v0_1.docx`.
- **Environment:** One agency, multiple locations, HighLevel desktop web app. Staff use the white-label domain `365.clinx.net` (same app and DOM as app.gohighlevel.com; the script keys off the URL path, never the host). The Send Invite workflow is "WEBHOOK TEST Send Hint JOIN LINK & Reminders" in location `Cp2XxBsRoyKS2CUf1Hwi` (workflow id 3dff9d94-403f-41ae-8496-c47320fc0ea6). Script is injected via Agency Settings → Company → Custom JavaScript/CSS. HighLevel warns custom JS/CSS is unsupported and may break on UI updates.
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
- **Live verification done 2026-09-24** in Rob's account (agency Park Health Systems, location Dummy Clinic, sample contacts). Sidebar/header/switcher candidates were right; every class-based contact-record candidate was wrong. Real structure: `#record-details-lhs` panel, name row containing `#delete-contact-trigger` (button mount), stateful fields with element ids `contact.email` / `contact.phone`. `#backButtonv2` does not exist. Send Invite delivered one POST end to end to an HTTPS listener with CORS; Rob's real Inbound Webhook trigger (location Cp2XxBsRoyKS2CUf1Hwi) is now in `config/agency-config.json`; it accepted the mapping sample and serves CORS `*`, so the browser gets the confirmed "Workflow triggered" path.
- **Logo position:** sidebar (`#sidebar-v2 img.agency-logo`), decided in Phase 2 after live inspection; the adapter still supports the header mount.
- **Hosting:** GitHub repo under Rob's account, served via jsDelivr pinned to a version tag. Rollback = change the tag in the HighLevel snippet.
- Different browser tabs must keep independent active-location state (no shared storage for location).
- **Send Invite workflow audit (2026-10-07, `notes/webhook-test-workflow-audit.md`):** "WEBHOOK TEST Send Hint JOIN LINK & Reminders" is published (v5), triggered by Inbound Webhook `bde416ab`, and resolves the contact with a **Find Contact by `{{inboundWebhookRequest.contactId}}`** step (not email). It then branches on Longevity tags to one of two Hint link emails; no waits, reminders, or field writes. It is a copy of "[Ready] Send Hint JOIN LINK & Reminders" (c140f93c, Packet Sent pipeline trigger, 49 runs).
- **Family consent system** lives in `~/Repos/clients/xcelsior/hint-api/` (design doc, n8n wf1 fan-out, wf2 hub status, wf3 consent-completed) with email templates in `~/Repos/clients/xcelsior/Email-Templates/`. Exploration decisions: `notes/actions-menu-individual-consent.md`.

## Constraints

- **Tech stack**: Vanilla JavaScript (ES2019+, IIFE, no build step) and scoped CSS — PRD requires no framework, single hosted script
- **Configuration**: Manually maintained public JSON — no secrets, tokens, patient data, or contact records in it
- **Security**: No arbitrary JS from config; only `link`, `webhook`, and `handler` action types; handlers resolve against an in-script allowlist
- **Compatibility**: Must degrade gracefully — if a mount point is missing, omit the customization and leave native UI usable
- **Performance**: Bounded, scoped MutationObservers; no whole-page polling
- **Licensing**: Reference project has no license; all code must be original
- **Delivery**: Versioned assets on jsDelivr; `enabled` flag; pilot in selected locations

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Write original code; no copying from reference | Reference repo has no LICENSE (all rights reserved) | ✓ Held through v0.1.1; D-06 originality check passed (Phase 3 UAT) |
| Location detection primarily from URL `/v2/location/{id}/` plus `popstate` and `routeChangeEvent`, with a lightweight `history` patch as backup | Stable ID, works across load/nav/back/forward; reference provides no context API | ✓ Works live across location switches and contact records |
| Adapter supports sidebar and header logo mounts; choice deferred to live inspection | Rob chose to decide after seeing the live DOM | ✓ Sidebar (`#sidebar-v2 img.agency-logo`) chosen in Phase 2 |
| GitHub + jsDelivr with pinned tag for hosting | Zero infra, trivial rollback | ✓ robhparker/ghl-admin-theme, tags v0.1.0 and v0.1.1; rollback and kill switch rehearsed live |
| Send Invite fires a HighLevel Inbound Webhook workflow trigger directly from the browser | Rob wants a working workflow trigger in Phase 1 without a server; webhook URL lives in public config, accepted trade-off for a staff-only tool | ✓ Shipped; exposure accepted as AR-03-01 in 03-SECURITY.md |
| Phase order: buttons + webhook first, logo switching second | Rob rated workflow trigger as more important than branding | ✓ Followed |
| Skip GSD research | PRD is detailed; selectors gathered during questioning | ✓ Live verification replaced research where guides were wrong |
| Keep existing `.planning/config.json` | Preferences already set by Rob before kickoff | ✓ Kept |
| Theme rules win on specificity with two `:not(#ghlc-boost)` pseudo-classes, never `!important` | HighLevel paints the sidebar with id+4-class rules; the suite forbids importance overrides so native UI can always out-rank the customizer where it matters | ✓ v0.1.1; live sidebar themed, badges and toasts untouched |
| Active nav item detected by Vue Router's `active` / `exact-active` classes | The three guessed selectors matched nothing live | ✓ v0.1.1; `mounts.sidebarNavActive` true live |
| Member consent link reuses the member's own `consent_hub_token`; wf2 shows only the holder's card when the holder is not the owner | No new field; completion path (Parts 1-3, 5.8 workflow, wf3 recount) unchanged | — Pending |
| Consent actions resolve the contact with Find Contact by payload `contactId`, never email or phone | Proven in the live Send Invite workflow; removes the shared-email wrong-member risk | — Pending |
| Send Invite keeps its own trigger (`bde416ab`); consent actions share one new Inbound Webhook branching on `buttonId` | Live path stays untouched, rollback to v0.1.2 needs no ClinX change; one premium trigger for consent | — Pending |
| Refusals are written by the ClinX workflow as a contact Note + internal notification; client pre-check disables the consent item for empty or synthetic (`+<digits>@`) email | The browser cannot read a webhook workflow's outcome | — Pending |
| Install snippet is the `<script>` tag form | HighLevel's Custom JavaScript field takes HTML; raw JS is rendered as inert text | ✓ Installed in the agency 2026-09-25; README updated |

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
*Last updated: 2026-10-07 at start of milestone v0.2.0*

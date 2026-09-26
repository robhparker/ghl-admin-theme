# Milestones

## v0.1.0 GHL Customizer v0.1.0 (Shipped: 2026-09-26)

**Delivered:** A single hosted vanilla-JS customizer for the Park Health Systems HighLevel agency: per-location client logos and accent colors, header link buttons, and a contact-record "Send Invite" button that fires a HighLevel Inbound Webhook workflow trigger once per contact, published on GitHub, served immutably by jsDelivr (tags v0.1.0, v0.1.1, v0.1.2), and installed in the agency.

**Phases completed:** 1-3 (7 plans, 16 tasks) plus quick task 260925-cf3 (Xcelsior Health entry, v0.1.2)

**Stats:**
- 53 files created/modified, 89 commits
- 2,667 lines of shipped JavaScript and CSS; 4,906 lines of zero-dependency tests and harness (119 checks)
- 3 phases, 7 plans, 16 tasks (+3 quick-task tasks)
- 2 days from first commit (2026-09-24) to ship (2026-09-25); archived 2026-09-26

**Git range:** `6e4071a` (initial planning) → `b887b70` (v0.1.2 quick task docs); release tags `v0.1.0` a6ab42c, `v0.1.1` 1076b44, `v0.1.2` d8f6719

**Closeout type:** override_closeout. Known verification overrides: 3 (phases 1, 2, and 3 each hold a `status: passed` VERIFICATION.md, but all three read `stale` at close because the v0.1.2 release changed covered files after their verifiers ran; Rob chose to close on the passing 119/119 suite, the completed 9/9 phase-3 live UAT, and the phase-3 security review rather than re-run the verifiers). 0 carried forward. Requirements: 37/37 Complete.

**What's next:** per-client onboarding as a routine (location entry, logo, colors, tag, snippet bump); v2 hardening with a companion service so the webhook trigger URL leaves the public config; a lighter release path for config-only changes.

**Key accomplishments:**

- One vanilla IIFE that reads a public config, resolves location/contact from the URL through a single adapter, renders Send Invite on the contact toolbar, and POSTs the D-02 payload to a HighLevel Inbound Webhook — proven end-to-end headlessly (`node test/run.mjs`, 21/21) and offline in a browser harness.
- The Send Invite button now follows every HighLevel navigation path (patched pushState/replaceState, popstate, routeChangeEvent) through one coalesced generation-stamped context check, refuses stale clicks at click time, degrades CORS failures to a single honest no-cors retry, enforces a per-button cooldown, renders unavailable when the record has no email/phone and recovers when they appear — all proven headlessly (`node test/run.mjs`, 45/45) with a static gate that keeps `console.` behind `safe()`.
- Header link buttons with per-location overrides and a frozen handler registry now render as native anchors/buttons, survive HighLevel re-renders through exactly two region-scoped MutationObservers per placement (root + shallow parent anchor, swapped not accumulated), pick up late mounts with a 15 s tick-bounded wait, and are diagnosable through `GHLC.verify()` / `?ghlc-debug=1` — while a disabled, unsupported, or unreachable config leaves zero footprint. Proven headlessly: `node test/run.mjs` 73/73 (was 45/45).
- In-place sidebar logo swap per location behind a generation-guarded detached preload, with an agency-or-native interim on every switch, a location -> agency -> native error chain that never reuses the previous client logo, session-scoped loaded/failed URL memory, a bounded mount wait, and a deterministic image stub in the headless harness (91/91 tests).
- One scoped MutationObserver instance keeps the client logo on the sidebar across HighLevel re-renders (img swap, whole-sidebar swap, src/alt reset) with value-based self-inflicted filtering and a coalesced rebrand, verify() reports the branding block and the single observer, the offline harness gained a real logo with four re-render controls and original SVG fixtures, and the production sample declares the sidebar mount (98/98 tests).
- Per-location accent colors delivered as inline CSS custom properties through one agency-to-location resolver: primary/primary-text/focus on the customizer's own button groups, sidebar-bg/sidebar-text/nav-active plus a `data-ghlc-theme` marker on the verified sidebar container and its active nav items, WCAG 4.5:1 readability rules with a safe-text fallback, hex-only color grammar, a single scoped theme observer that exists only while a sidebar token is applied, a marker-scoped stylesheet proven by a static gate, and `verify().theme` — 116/116 headless (Phase 2's 101 plus 15 new).
- README-only install path with tag-pinned jsDelivr URLs, a full sample config proven by a headless boot, and the repository published as robhparker/ghl-admin-theme with tag v0.1.0 served live by jsDelivr (5/5 assets HTTP 200)

---

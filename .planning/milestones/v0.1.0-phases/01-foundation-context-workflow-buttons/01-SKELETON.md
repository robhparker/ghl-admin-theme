# Walking Skeleton — GHL Customizer (admin-theme)

**Phase:** 1
**Generated:** 2026-09-24

## Capability Proven End-to-End

A staff member with a contact record open in a configured HighLevel location presses "Send Invite" and one JSON POST carrying that contact's ID, the location ID, the button ID, a fresh requestId, and the contact's email/phone reaches the configured Inbound Webhook URL, after which the button reads "Workflow triggered" — exercised headlessly by `node test/run.mjs` and in a browser by `test/harness.html`.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Runtime shape | One vanilla JavaScript IIFE (`src/ghl-customizer.js`, ES2019+), no build step, no bundler, no framework, no imports (D-05) | Pasted into HighLevel's Custom JS as a single hosted script; anything more than one file plus one stylesheet adds hosting and rollback surface |
| Module layout | Eight ordered sections inside the IIFE, marked by comment lines: constants, adapter, config, context, buttons, observers, verify, boot | Sections are the seams later phases extend (Phase 2 adds branding next to buttons; Phase 3 adds theme tokens in config/constants) without restructuring |
| HighLevel knowledge | A single frozen `adapter` object holds every selector, route regex, event name, and DOM reader (D-05, FND-03); a static test forbids selector literals elsewhere | HighLevel's DOM is unsupported and unverified; when it changes, exactly one object changes |
| Configuration | Public JSON (`config/agency-config.json`, `schemaVersion` 1) fetched from the script tag's `data-config` attribute with a constant fallback (D-04); no secrets, no contact data (D-08) | Zero infrastructure; staff-only tool; the webhook URL in config is an accepted v1 trade-off with rotation as the remedy |
| Data layer | None. Context (`locationId`, `contactId`) is derived from the URL on every check and held in memory per tab (D-09); nothing is persisted (FND-06) | Independent tabs, no stale storage, disable/remove restores the native UI on reload |
| Identity / staleness | A generation counter bumped on every real context change (D-10); every async completion compares it and every button element is bound to one `locationId|contactId` pair and re-validated at click time | The core value is "the right contact, once"; this is the mechanism that makes it true |
| Navigation signals | `popstate`, HighLevel's `routeChangeEvent`, and patched `history.pushState`/`replaceState` dispatching `ghlc:navigate`, coalesced into one zero-delay check | Covers in-app links, back/forward, and the location switcher without polling |
| Workflow trigger | Browser `fetch` POST to the HighLevel Inbound Webhook URL (D-01); CORS attempt first, one `no-cors` retry reported as "Sent (unconfirmed)" (D-11); per-button cooldown | Works with no server in v1; honest about unconfirmed delivery; v2 companion service hardens it |
| Action safety | Action types allowlisted to `link`/`webhook`/`handler`; handlers resolve against a frozen in-script registry via own-property lookup; DOM built only with `createElement`/`createElementNS` + `textContent`/`setAttribute` | Config can never become code or markup |
| Re-render resilience | One scoped MutationObserver set per active mount region (mount + its parent), disconnected when the region leaves the DOM; a bounded 15 s / 250 ms wait for mounts that appear after navigation; no whole-page polling | HighLevel re-renders header and toolbar freely; buttons must come back exactly once |
| Styling | One stylesheet (`src/ghl-customizer.css`), every selector prefixed `.ghlc-`, state via `data-state`, tokens as `--ghlc-*` custom properties on `.ghlc-group`, injected by the script from `data-css` or its own `src` | Scoped, themeable per location in Phase 3, cannot bleed into native styles |
| Testing | `test/run.mjs` (Node 18+, builtins only) vm-runs the real IIFE inside `test/dom-shim.mjs` — a minimal fake window/document/history/fetch/MutationObserver/timers — plus static source gates; `test/harness.html` (D-12) is the browser-side twin served by `python3 -m http.server 5173` | End-to-end verification without a HighLevel session or any dependency; the harness is where Rob sees it |
| Diagnostics | `log()`/`warn()` pass fields through `safe()` (booleans, numbers, short ID-shaped strings only); `GHLC.verify()` and `?ghlc-debug=1` report mounts/routes/fields as booleans (FND-04, DLV-04) | Selectors can be confirmed live without ever printing contact data or the webhook URL |
| Hosting / rollback | GitHub repo under Rob's account served via jsDelivr pinned to a version tag (D-04); rollback = change the tag | Zero infra; README in Phase 3 (DLV-01) |
| Licensing | Original code only; `NOTICE.md` records the unlicensed reference project and that nothing was copied (D-06) | Reference repo is all-rights-reserved by default |

## Stack Touched in Phase 1

- [x] Project scaffold — `package.json` (`type: module`, `test`, `serve`), `src/`, `config/`, `test/`; no lint/build tooling by design
- [x] Routing — real URL parsing through `adapter.parseRoute` for `/v2/location/{id}/contacts/detail/{contactId}`, `/v2/location/{id}/...`, and agency routes; pushState/replaceState/popstate/`routeChangeEvent` handled
- [x] Database — not applicable (no persistence by requirement); the "read" is config JSON over HTTPS, the "write" is the webhook POST
- [x] UI — the Send Invite `<button>` and header `<a>` links wired to the action dispatcher with five visible states
- [x] Deployment — documented local full-stack run: `npm run serve` then `http://localhost:5173/test/harness.html`; production install is a pasted snippet pointing at jsDelivr (README in Phase 3)

## Out of Scope (Deferred to Later Slices)

- Client logo switching per location, agency/native fallbacks, stale-logo protection (Phase 2, BRD-01..05); the adapter already reserves `sidebarLogo`/`headerLogo` selectors (D-07)
- Per-location accent colors and contrast fallbacks (Phase 3, CLR-01..04); `--ghlc-*` tokens exist but are not populated from config yet
- README, hosting/rollback instructions, and the full sample config with two logo overrides (Phase 3, DLV-01/02)
- Companion service with operator auth, contact-to-location verification, server-side dedupe, and moving the webhook URL out of public config (v2, INV-01..05)
- Bulk/list actions, configuration UI, automatic brand sync, folders/submenus (out of scope per PRD)
- Live HighLevel selector confirmation — blocked on a logged-in session; `GHLC.verify()` exists so Rob can paste the output

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: a location's configured logo replaces the agency logo in the agreed mount (sidebar or header), with agency/native fallbacks and generation-guarded image loads, using the same context engine, adapter mounts, and observer pattern
- Phase 3: optional per-location theme tokens applied as `--ghlc-*` custom properties on the scoped root and the verified sidebar surfaces, plus README, jsDelivr pinning, and the complete sample config

---
phase: 02-location-logo-switching
plan: 02
subsystem: ui
tags: [vanilla-js, mutation-observer, branding, verify-mode, harness, svg-fixtures, live-verification]

# Dependency graph
requires:
  - phase: 02-location-logo-switching (plan 01)
    provides: branding state machine (renderBranding/applyLogo/restoreNativeLogo/captureNativeLogo, preload lifecycle), adapter.findLogoMount/findLogoRoot, state.branding.timer reserved, shim.observers()[i].observer, verify().waiting.branding
  - phase: 01-foundation-context-workflow-buttons
    provides: observers section pattern (watchMount/unwatchMount/anchorFor/scheduleRender, self-inflicted filtering), verify(), dom-shim + run.mjs harness, offline harness page
provides:
  - One branding MutationObserver instance (state.brandingWatch) with three scoped registrations — logo root (childList+subtree), its parent (childList, shallow), the img (attributes filtered to src/alt) — attached while a non-native tier is applied or resolving, detached while native shows
  - watchBranding / unwatchBranding / onBrandingMutation / scheduleBranding / cancelScheduledBranding in the observers section; self-inflicted rule by appliedSrc/appliedAlt; foreign src/alt writes re-capture native (logo-native-updated); one coalesced setTimeout(0) rebrand per burst
  - verify().branding { mount, found, applied, resolving, failed, loaded } and verify().observers.branding
  - Offline harness sidebar logo (a#hx-logo-link > img.agency-logo) with Location C / Location Z routes and four mutation controls (#hx-rerender-logo, #hx-reset-logo, #hx-toggle-sidebar, #hx-replace-sidebar)
  - Original transparent SVG fixture logos test/fixtures/logos/{native,agency,loc-a,loc-b}.svg
  - config/agency-config.json agency.logoMount = "sidebar"
  - Static checks in run.mjs for the harness controls/base, the sample logoMount, logoUrl safety, and the fixture SVGs
affects: [03-colors-delivery, harness, sample-config, verify-work]

# Actuals (#2632) — estimateTokens scale: chars/4 over the realized diff (git diff dee845e..7d39869 = 56,606 chars)
actuals:
  tokens: 14151
  tasks: 2
  commits: 2
plan_head_before: dee845ef9c12e44b2a93707906c706f8942f88aa

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One observer instance, many registrations: a single MutationObserver observes root (subtree), parent (shallow), and the mount's attributes, so verify() can report a single instance and the footprint swaps instead of accumulating"
    - "Self-inflicted attribute records are identified by value, not by timing: a record is ours when the attribute now equals what the script last recorded (appliedSrc/appliedAlt); everything else is HighLevel's and re-captures native before the tier is re-applied"
    - "Watch before writing, unwatch before restoring: writes made while watched only yield self-inflicted records; the native restore is never observed at all"
    - "Harness page pins <base href=\"/test/\"> so relative fixture asset URLs survive the fake router's pushState paths"

key-files:
  created:
    - test/fixtures/logos/native.svg
    - test/fixtures/logos/agency.svg
    - test/fixtures/logos/loc-a.svg
    - test/fixtures/logos/loc-b.svg
  modified:
    - src/ghl-customizer.js
    - test/run.mjs
    - test/harness.html
    - config/agency-config.json

key-decisions:
  - "Native showing means no branding observer at all (A-11): an agency page with no agency logo carries zero branding footprint; the bounded mount wait, not an observer, finds a missing mount"
  - "Self-inflicted attribute records are recognised by value equality with appliedSrc/appliedAlt, and childList records are always foreign; the rebrand is an idempotent reconcile, so unrelated sidebar churn costs one no-op pass"
  - "captureNativeLogo re-reads an unbranded element on every render so a HighLevel rewrite made while native was showing (unobserved by design) is what restore later puts back"
  - "applyLogo writes only the attributes that differ, so an alt-only foreign rewrite never re-requests the image"
  - "The offline harness carries <base href=\"/test/\">: the fixture's ./fixtures/logos/*.svg URLs are written raw (02-01) and would otherwise resolve under the fake /v2/location/... path after pushState"
  - "Commits landed on main per the orchestrator's sequential dispatch (branching_strategy: none), as in 02-01; the base-branch probe still reports main as protected"

patterns-established:
  - "Branding observer lifecycle is decided inside renderBranding from the candidate list: no first candidate -> unwatch then restore; a candidate -> watch then apply/preload; missing mount -> unwatch and wait"
  - "Harness controls perform the exact DOM mutation HighLevel would (node swap through the anchor, attribute reset on the same element, class toggle + node swap, whole-container swap through its parent) and log one hxLog entry each"

requirements-completed: [BRD-05, BRD-01, BRD-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "HighLevel replacing the logo img, replacing the whole sidebar, or rewriting the img's src/alt re-applies the current tier exactly once (one coalesced rebrand per burst) with no duplicate images and no second observer instance"
    requirement: BRD-05
    verification:
      - kind: e2e
        ref: "test/run.mjs#observers: replacing the sidebar logo img re-brands once through a single branding observer instance"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#observers: wholesale sidebar replacement re-brands and swaps registrations"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#observers: HighLevel rewriting the logo src on the same element is re-branded and the new native value is remembered"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#observers: unrelated sidebar mutations cost one coalesced no-op rebrand"
        status: pass
    human_judgment: false
  - id: D2
    description: "verify() reports observers.branding true backed by exactly one MutationObserver instance with three scoped registrations while a non-native tier is applied or resolving, and false with zero branding registrations while native shows; never a page-wide subtree observer"
    requirement: BRD-05
    verification:
      - kind: e2e
        ref: "test/run.mjs#observers: native branding keeps no observer; an agency logo keeps one on agency routes"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#observers: wholesale header replacement restores header buttons once and swaps the observer set"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#observers: context change cancels the wait and leaving to agency disconnects everything"
        status: pass
      - kind: other
        ref: "static: awk watchBranding | grep -c 'new MutationObserver' == 1; grep -c setInterval == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The customizer's own src/alt writes never schedule a rebrand; a foreign write is recorded as the new native value (logo-native-updated) and then overridden by the current tier; the updated native value is what an agency route restores"
    requirement: BRD-05
    verification:
      - kind: e2e
        ref: "test/run.mjs#observers: own src and alt writes never schedule a rebrand"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#observers: HighLevel rewriting the logo src on the same element is re-branded and the new native value is remembered"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#observers: own writes do not cause render loops"
        status: pass
    human_judgment: false
  - id: D4
    description: "verify() carries branding { mount, found, applied, resolving, failed, loaded }, observers.branding, and waiting.branding, with no URL, alt text, or location name anywhere in the report; the header mount and an unknown mount name are reported correctly"
    requirement: BRD-01
    verification:
      - kind: e2e
        ref: "test/run.mjs#verify: branding report shape, header mount, and hygiene"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#verify: report shape and hygiene"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#verify: missing mounts are reported false and native DOM stays untouched"
        status: pass
    human_judgment: false
  - id: D5
    description: "Harness carries the sidebar logo in an anchor, Location C/Z routes, and four mutation controls; the fixture SVGs exist (missing.svg absent); the sample config declares agency.logoMount = sidebar with an empty logoUrl and no location logos; every logoUrl is https or ./-relative; all served assets return 200"
    requirement: BRD-01
    verification:
      - kind: other
        ref: "test/run.mjs#harness: test/harness.html carries the required HighLevel shell, router hook, config, and stub"
        status: pass
      - kind: other
        ref: "test/run.mjs#config: both JSON files parse, validate, use HTTPS webhooks, and carry no secret-like keys"
        status: pass
      - kind: other
        ref: "curl http://localhost:5173/test/fixtures/logos/{loc-a,loc-b,native,agency}.svg -> 200; missing.svg -> 404; node --check on the harness inline script"
        status: pass
    human_judgment: false
  - id: D6
    description: "Harness walkthrough (a)-(h): the sidebar logo switches across Location A, B, C (broken), Z (unconfigured), and the agency route in a real browser; each mutation control restores the client logo exactly once with one rebrand and one observer instance; clicking the logo routes to the agency dashboard; focus lands on the anchor"
    requirement: BRD-02
    verification: []
    human_judgment: true
    rationale: "Visual behaviour in a real browser (one visible pill, no broken-image icon, focus order) is not asserted headlessly; the executor context had no browser tool, so the verifier runs steps (a)-(h) per the 'Harness walkthrough' section below with `npm run serve`"
  - id: D7
    description: "Live HighLevel (i)-(o): the configured location's logo appears in the sidebar element at native proportions with transparency intact and the configured alt; clicking navigates exactly as native did; collapse/expand keeps it; GHLC.verify() reports one branding observer; the console never prints the URL, name, or alt"
    requirement: BRD-01
    verification: []
    human_judgment: true
    rationale: "Requires Rob's logged-in HighLevel session and a temporary config on an HTTPS test host (A-13); not runnable by the executor. Steps and the expected verify() object are recorded under 'Live-account branding verification'"

# Metrics
duration: 14 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 02: Location Logo Switching (single branding observer, harness, fixtures, live check) Summary

**One scoped MutationObserver instance keeps the client logo on the sidebar across HighLevel re-renders (img swap, whole-sidebar swap, src/alt reset) with value-based self-inflicted filtering and a coalesced rebrand, verify() reports the branding block and the single observer, the offline harness gained a real logo with four re-render controls and original SVG fixtures, and the production sample declares the sidebar mount (98/98 tests).**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-24T22:11:27Z
- **Completed:** 2026-09-24T22:25:39Z
- **Tasks:** 2
- **Files modified:** 8 (4 created)

## Accomplishments

- BRD-05 is implemented and automated: `watchBranding` creates exactly one `MutationObserver` registered on the logo root (`childList`, `subtree`), the root's parent (`childList`, shallow), and the img (`attributes`, `attributeFilter: ['src', 'alt']`). Replacing the img through its anchor, replacing the whole `#sidebar-v2`, and rewriting `src`/`alt` on the same element each produce exactly one `rebrand`, one re-apply, one `img.agency-logo` in the document, and a registration set that follows the new nodes without accumulating.
- Own writes are invisible to the observer by construction: `applyLogo`/`restoreNativeLogo` record `appliedSrc`/`appliedAlt` synchronously and records arrive in a microtask, so `onBrandingMutation` drops any attribute record whose current value equals the recorded one. Foreign writes update `state.branding.native` first (`logo-native-updated`) so an agency route later restores what HighLevel last rendered, not a stale capture.
- Native is observer-free (A-11): `observers.branding` is `false` with zero registrations on unconfigured locations and agency routes without an agency logo; `true` while a location logo is applied *or still resolving*, and on agency routes when an agency logo is configured.
- `verify()` now carries `branding: { mount, found, applied, resolving, failed, loaded }` and `observers.branding`; the report contains no URL, alt, or location name (asserted against every fixture string).
- The offline harness shows the sidebar logo inside `a#hx-logo-link`, adds Location C (broken logo) and Location Z (unconfigured) routes, and four controls that perform the exact mutations HighLevel would; the sidebar lookups became dynamic so the page keeps working after "Replace whole sidebar". `<base href="/test/">` makes the fixture's relative logo URLs survive the fake router's pushState paths.
- Four original SVG pills (grey Native, dark-blue Agency, green Location A, orange Location B) with transparent backgrounds; `missing.svg` deliberately absent. `config/agency-config.json` gains only `agency.logoMount: "sidebar"`.

## Task Commits

Each task was committed atomically:

1. **Task 1: One branding observer — re-brand on img/sidebar replacement and foreign src/alt writes; verify() branding report** - `cb900b8` (feat)
2. **Task 2: Harness sidebar logo and mutation controls, SVG fixture logos, sample-config logoMount, static checks** - `7d39869` (feat)

**Plan metadata:** the `docs(02-02)` commit that adds this file.

## Observer strategy as implemented

**State:** `state.brandingWatch = null | { mo, img, root, anchor }`; `state.branding.timer` is the coalescing slot.

**Targets and options (one instance, three `observe` calls):**

| Registration | Target | Options | Catches |
|---|---|---|---|
| root | `adapter.findLogoRoot(mountName, img)` — `img.closest('#sidebar-v2')` (or `.hl_header` for the header mount), falling back to the img's parent | `{ childList: true, subtree: true }` | the img replaced anywhere inside the sidebar; unrelated sidebar churn |
| anchor | `anchorFor(root)` — the root's parent element, else `document.body` | `{ childList: true, subtree: false }` | the whole sidebar replaced (invisible from inside) |
| img | the mount | `{ attributes: true, attributeFilter: ['src', 'alt'] }` | HighLevel resetting the logo on the same element |

`document` is never observed with `subtree`; the anchor registration on `body` is shallow (the shell's sidebar parent is `body`, and the existing "never a page-wide subtree observer" assertion now also proves the branding root is the sidebar).

**Lifecycle (decided inside `renderBranding`):**
- mount missing -> `unwatchBranding()`; the bounded mount wait finds it later.
- no surviving candidate -> `cancelLogoPreload()`, `unwatchBranding()`, then `restoreNativeLogo` — the restore's writes are never delivered.
- a candidate -> `watchBranding(mountName, mount)` *before* `applyLogo`/interim/`startLogoPreload`. No-op when the same img is watched, its anchor is connected, and the root's parent is still the anchor; otherwise the old instance is disconnected and a new one built (never two).
- `applyContext` calls `cancelScheduledBranding()` after the generation bump: a rebrand queued for the old route is moot because `renderAll` reconciles.

**Self-inflicted rule (`onBrandingMutation`):** attribute record on the watched img -> compare `img.getAttribute(name)` with `appliedSrc` (`src`) or `appliedAlt` (`alt`); equal -> ignore; different -> if `native.el === img`, write the value into `native.src`/`native.alt`, log `logo-native-updated { attribute, generation }`, mark foreign. Any `childList` record marks foreign. Foreign -> `scheduleBranding('mutation')`: one `setTimeout(0)` (replaced on each call) whose callback nulls the slot, runs `renderBranding('rebrand')`, and logs `rebrand { reason }`.

**Log events added:** `branding-observer-attached { mount }`, `branding-observer-detached { mount }`, `rebrand { reason }`, `logo-native-updated { attribute, generation }`.

## Final verify() shape (branding-relevant fields)

```js
{
  ...,
  mounts: { ..., sidebarLogo: boolean, headerLogo: boolean, ... },
  branding: {
    mount: 'sidebar' | 'header',           // state.branding.mountName, else resolveLogoMount(config)
    found: boolean,                        // adapter.findLogoMount(mount) resolves
    applied: null | 'location' | 'agency' | 'native',
    resolving: boolean,                    // a detached preload is pending
    failed: number,                        // session count of URLs that errored
    loaded: number                         // session count of URLs that loaded
  },
  observers: { header: boolean, contact: boolean, branding: boolean },
  waiting: { header: boolean, contact: boolean, contactFields: boolean, branding: boolean }
}
```

Expected on Location A with the shipped fixture: `branding: { mount: 'sidebar', found: true, applied: 'location', resolving: false, failed: 0, loaded: 1 }`, `observers.branding: true`.

## Harness walkthrough

**Not run by this executor.** This agent context had no browser tool (the Chrome skill loaded but its tools are outside this executor's tool set), so steps (a)-(h) are handed to the end-of-phase verifier. Everything automatable was done: `python3 -m http.server 5173` served `/test/harness.html`, `/test/fixtures/config.json`, `/src/ghl-customizer.js`, `/src/ghl-customizer.css`, and all four logo SVGs with 200 (`missing.svg` 404 as intended); the harness inline script passes `node --check`; and every step has a headless equivalent that passes (table below). Open `http://localhost:5173/test/harness.html?ghlc-debug=1` after `npm run serve`.

| Step | Expected in the browser | Headless equivalent (run.mjs) | Status |
|---|---|---|---|
| (a) Agency dashboard on load | grey Native pill; `GHLC.verify().branding.applied === 'native'`, `observers.branding === false` | `observers: native branding keeps no observer ...` (agency route -> false, 0 registrations) | pending human |
| (b) Location A · Contact X | green Location A pill, alt "Location A logo", `data-ghlc-logo="location"`, `observers.branding === true` | `branding tracer ...`; `verify: branding report shape ...` | pending human |
| (c) Location B · Contact Z | Native for an instant, then orange Location B; A never visible | `branding: with no agency logo the interim is the native logo` | pending human |
| (d) Location C · broken logo | console `logo-failed`; Native shows; no broken-image icon | `branding: broken location logo falls back ...`; D2 sub-case (failed preload -> native, no observer) | pending human |
| (e) Location Z · unconfigured | Native | `branding: unconfigured location and agency route ...` | pending human |
| (f) Back to A, then each of the four controls | exactly one Location A pill, one `rebrand` per press, `observers.branding` stays true on one instance | scenarios 1, 2, 4, 5 of the `observers:` group (img swap, src/alt reset, whole-sidebar swap, unrelated churn) | pending human |
| (g) Click the logo | routes to the agency dashboard; logo returns to Native | tracer (agency route restores native; anchor href untouched; zero click listeners) | pending human |
| (h) Tab to the logo link | focus lands on the anchor; nothing the customizer added is focusable | tracer (no listener, no attribute beyond src/alt/referrerpolicy/class/data attr) | pending human |

Note for step (f): "HighLevel resets logo src" also proves the `logo-native-updated` path — after pressing it, navigating to the agency dashboard shows the harness's native SVG (unchanged here because the control resets to the same native URL).

## Live-account branding verification

**Not run: requires Rob's logged-in HighLevel session and a temporary config on an HTTPS test host (A-13).** The executor cannot open that session. To run it exactly as planned:

1. Temporary config = `config/agency-config.json` with `locations.iDPNGKoFsjvf9wUCrk3V: { "name": "Dummy Clinic", "logoUrl": "<HTTPS PNG with alpha, e.g. https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png>", "logoAlt": "Dummy Clinic" }` and `sendInvite.action.url` replaced by `https://example.invalid/hooks/disabled`. Serve script, stylesheet, and this config from the HTTPS test host used in Phase 1; inject with `<script src data-config data-css>` per `01-HARNESS-WALKTHROUGH.md`.
2. On Dummy Clinic, `GHLC.verify()` should report `mounts.sidebarLogo: true` and `branding: { mount: 'sidebar', found: true, applied: 'location', resolving: false, failed: 0, loaded: 1 }`, `observers.branding: true`. Record the object and a screenshot here.
3. Steps (k)-(n): native click navigation, collapse/expand persistence with exactly one logo image, native restore on an unconfigured location and the agency dashboard (`applied: 'native'`, `observers.branding: false`), and a console free of the PNG URL / "Dummy Clinic" / alt text.
4. Step (o): if the live img carries `srcset`, sits in a wrapper the adapter did not anticipate, or `mounts.sidebarLogo` is false, correct `selectors.sidebarLogo` / `adapter.findLogoRoot`, re-run `node test/run.mjs`, and note the commit.

Live `verify().branding` object captured on Dummy Clinic: **not captured (live check not run; see above).**

## Files Created/Modified

- `src/ghl-customizer.js` — `state.brandingWatch`; `applyContext` -> `cancelScheduledBranding()`; `captureNativeLogo` re-reads an unbranded element; `applyLogo` writes only differing `alt`/`src`; `renderBranding` watch/unwatch decision; new `watchBranding`, `unwatchBranding`, `onBrandingMutation`, `scheduleBranding`, `cancelScheduledBranding` in the observers section; `verify().branding` and `observers.branding`
- `test/run.mjs` — `brandingRegs` helper; seven new `observers:`/`verify:` scenarios; exact updates to the Phase 1 observer-count and verify-shape assertions (`placementRegs` filtering in the header-replacement scenario, 7/5 totals, `branding: false` in the disabled/agency/missing-mount reports, `assertNoFootprint` checks `observers.branding`); harness and config static checks extended
- `test/harness.html` — `<base href="/test/">`; sidebar logo anchor + img; Location C/Z buttons; Sidebar logo control row; dynamic sidebar lookups, `buildSidebar`/`rerenderLogo` builders, delegated logo/back/switcher handlers; banner text
- `test/fixtures/logos/native.svg`, `agency.svg`, `loc-a.svg`, `loc-b.svg` — original transparent pill logos
- `config/agency-config.json` — `agency.logoMount: "sidebar"`

## Decisions Made

- One instance, three registrations (A-11), and no observer while native shows — so the verify report can truthfully say "one branding observer" and agency pages have zero branding footprint.
- Value-based self-inflicted detection (A-12) rather than a "we are writing" flag: records arrive after the synchronous write, and comparing the attribute's current value with what was recorded is immune to ordering.
- Watch before writing, unwatch before restoring: keeps the observer's view limited to records that need judging.
- `applyLogo` skips unchanged attributes so an alt-only rebrand costs no image request (verified: an alt reset produces no extra mount write).
- Harness `<base href="/test/">` instead of changing the fixture to absolute paths: the node tests and 02-01's raw-string contract stay untouched; only test tooling changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Harness relative logo URLs broke after the fake router pushStates**
- **Found during:** Task 2 (harness logo)
- **Issue:** The fixture's `./fixtures/logos/loc-a.svg` is written to `src` as the raw config string (02-01). After the harness pushStates to `/v2/location/locA/dashboard`, the document base URL is that fake path, so the browser would request `/v2/location/locA/fixtures/logos/loc-a.svg` -> 404 from `python3 -m http.server`; walkthrough steps (b)/(c) could never pass.
- **Fix:** `<base href="/test/">` in the harness head (test tooling only); the `harness:` check pins it.
- **Files modified:** test/harness.html, test/run.mjs
- **Verification:** static check; asset URLs curl 200 from the served root
- **Committed in:** 7d39869

**2. [Rule 2 - Missing critical] Native re-captured from an unbranded element**
- **Found during:** Task 1 (observer lifecycle design)
- **Issue:** With no observer while native shows (A-11), a HighLevel rewrite of its own logo `src`/`alt` during that time would go unnoticed; the next branded->native restore would write back the stale capture (T-02-08).
- **Fix:** `captureNativeLogo` re-reads `src`/`alt`/`srcset` whenever the element carries no `data-ghlc-logo` marker (an unbranded element is native by definition). No log; identical to the first capture's semantics.
- **Files modified:** src/ghl-customizer.js
- **Verification:** all branding scenarios unchanged; restore paths still exact
- **Committed in:** cb900b8

**3. [Rule 1 - Bug] `applyLogo` re-requested the image on an alt-only mismatch**
- **Found during:** Task 1 (scenario 2, alt rewrite)
- **Issue:** `applyLogo` wrote every attribute unless all three matched, so a foreign alt reset led the rebrand to set `src` to its current value — a needless image request per HighLevel alt write.
- **Fix:** `alt` and `src` are written only when they differ (referrerpolicy still precedes any `src` write).
- **Files modified:** src/ghl-customizer.js
- **Verification:** scenario `observers: HighLevel rewriting the logo src ...` asserts the alt-only rebrand adds no mount write
- **Committed in:** cb900b8

**4. [Process] Commits on `main` although the base-branch probe reports it protected**
- Same situation as 02-01: `gsd-tools query git.base-branch --is-protected main` is `true`, `git.allow_default_branch_commits` unset, but the orchestrator dispatched this plan explicitly as sequential on `main` with `branching_strategy: "none"`. Followed the dispatch; no configuration changed.

**5. [Scope] Harness walkthrough and live check not executed by the executor**
- The plan's `<human-check>` is end-of-phase (`human_verify_mode: end-of-phase`, auto mode active). This executor context had no browser tool, so the harness walkthrough is recorded as pending with headless equivalents, and the live HighLevel check is recorded as not run with exact instructions (allowed by the acceptance criterion). No plan file was skipped; `test/dom-shim.mjs` needed no change.

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 bug) + 1 process note + 1 scope note
**Impact on plan:** The three code deviations are necessary for the harness to work and for the observer to be correct across unobserved native rewrites and alt-only resets. No scope creep; every artifact, log event, and gate in the plan is present as specified.

## Issues Encountered

- One first-run assertion failure was a realm artifact: the vm-created `attributeFilter` array is not reference-equal to a host array under strict `deepEqual`; wrapped in the existing `plain()` helper. Not a source defect.
- The eight Phase 1 assertions that failed after Task 1's source change were exactly the observer-count and verify-shape assertions the plan listed; each was updated to an exact new value (never loosened to `>=`).

## Known Stubs

None. `locC.logoUrl` -> `./fixtures/logos/missing.svg` is the intentional BRD-04 demonstration (404 by design, asserted absent by the `config:` check).

## Threat Flags

None beyond the plan's register. The branding observer never observes `document` with `subtree`; the verify block carries names/tiers/booleans/counts only; harness JS lives only in `test/harness.html` and is not referenced by `src/`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 code is complete: BRD-01..05 implemented and headlessly proven (98/98). The end-of-phase verifier owns the harness walkthrough (a)-(h) and the live HighLevel check (i)-(o); any live selector correction (step o) is a small inline fix in `selectors.sidebarLogo` / `adapter.findLogoRoot` followed by `node test/run.mjs`.
- Phase 3: theme tokens can reuse the mount-write pattern (`applyLogo`'s idempotent attribute writes + `ghlc-` class + `data-ghlc-*` marker + observer-guarded reconcile); DLV-02 adds the two demo location logo overrides to `config/agency-config.json` (the `config:` check already accepts https or `./` logo URLs and asserts the sample currently ships none).
- Open live risk (unchanged from 02-01): whether HighLevel's own logo styling beats `.ghlc-logo { object-fit: contain }`, and whether the live sidebar swaps its logo `src` natively on collapse — the `logo-native-updated` path and the one-instance observer are what keep restore correct if it does.

## Self-Check: PASSED

- Files: src/ghl-customizer.js, test/run.mjs, test/harness.html, config/agency-config.json, test/fixtures/logos/{native,agency,loc-a,loc-b}.svg — all present on disk.
- Commits: cb900b8, 7d39869 — both present in `git log`; `git rev-list --count dee845e..HEAD` = 2 (matches `commits: 2`).
- `node test/run.mjs` — PASS 98/98 on the committed tree; `node --check src/ghl-customizer.js` exits 0; every grep/awk gate from both tasks holds (re-run before this file was written); served assets return 200 (missing.svg 404).

---
*Phase: 02-location-logo-switching*
*Completed: 2026-09-24*

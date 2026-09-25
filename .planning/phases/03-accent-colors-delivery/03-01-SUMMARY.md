---
phase: 03-accent-colors-delivery
plan: 01
subsystem: ui
tags: [vanilla-js, theme, css-custom-properties, contrast, wcag, scoped-css, mutation-observer, dom-shim, verify-mode, harness]

# Dependency graph
requires:
  - phase: 02-location-logo-switching
    provides: single-instance observer pattern (watchBranding/unwatchBranding/scheduleBranding), mount-write idempotency, bounded mount wait slots, verify() report shape, dom-shim buildShell/observers(), bootBranding/go/brandingRegs helpers, live facts about #sidebar-v2
  - phase: 01-foundation-context-workflow-buttons
    provides: adapter object, applyContext/renderAll generation model, ensureGroup/findGroups, hasOwn/isPlainObject/safe/log, static gates in run.mjs, offline harness router
provides:
  - "Theme engine (CLR-01..03): resolveTheme merges agency.theme overlaid by locations[id].theme key by key over THEME_TOKENS through the one locationEntry lookup; parseColor accepts #rgb/#rrggbb only and normalizes to lowercase #rrggbb; WCAG 2.x contrastRatio; readability rules (unpaired sidebarText dropped, pair below 4.5:1 falls back to #ffffff/#101828, navActive below 4.5:1 against the text dropped, primaryText always readable)"
  - "renderTheme reconcile (CLR-02): inline --ghlc-primary/--ghlc-primary-text/--ghlc-focus on every .ghlc-group (also applied by ensureGroup on creation), --ghlc-sidebar-bg/--ghlc-sidebar-text/--ghlc-nav-active plus data-ghlc-theme marker on the adapter-located sidebar container, data-ghlc-theme=nav-active on adapter-located active nav items; everything removed when the context no longer resolves it"
  - "One theme MutationObserver instance (state.themeWatch) with two scoped registrations (sidebar root: childList+subtree+attributes filtered to class/aria-current; root parent: shallow childList), attached only while a sidebar token is applied; coalesced setTimeout(0) retheme; own writes filtered by attributeFilter and by target (branding mount)"
  - "adapter.findThemeRoot(), adapter.findNavActive() over selectors.sidebarNavActive (three unverified candidates), probe().sidebarNavActive"
  - "verify().theme { root, applied, navActive, ignored, fallback }, observers.theme, waiting.theme, mounts.sidebarNavActive; log events theme-applied, theme-token-ignored, theme-contrast-fallback, theme-root-missing, theme-observer-attached/detached, retheme, mount-missing{placement:theme}"
  - "Scoped stylesheet rules [data-ghlc-theme~=sidebar-bg], [data-ghlc-theme~=sidebar-text] (+ descendant a), [data-ghlc-theme~=nav-active]; static gate proving every selector carries a ghlc marker and no importance override exists (CLR-04)"
  - "Fixture themes (agency primary, locA full, locB invalid primary + low-contrast pair), dom-shim buildShell({ nav }), harness nav with route-driven active class and #hx-toggle-nav"
affects: [03-02-readme-sample-config-delivery, verify-work, live-install-check, harness]

# Actuals (#2632) — estimateTokens scale: chars/4 over the realized diff (git diff a236a88..b63a7be = 96,472 chars)
actuals:
  tokens: 24118
  tasks: 3
  commits: 3
plan_head_before: a236a88b8450ff608e1696662caa3fadea8b2ed8

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One per-scope resolver, many facets: locationEntry(config, locationId) is the single own-property lookup that resolveBranding, resolveButtons, and resolveTheme all read through; a fourth per-location facet is one more caller"
    - "Config strings never reach style text: parseColor is the only path from a theme value to the DOM and its normalized '#rrggbb' is the only value ever passed to style.setProperty; no style element, no stylesheet text, never html/body"
    - "Marker-scoped stylesheet: every selector carries a ghlc marker (class or data attribute the script writes), so with no marker present the stylesheet cannot style anything native; proven by a static gate over the CSS"
    - "Write-only-when-different custom properties (setVar/removeVar) so renderTheme is a true idempotent reconcile and observer-driven re-entry is a no-op pass"
    - "Observer attached only while there is something to defend (mirrors Phase 2 A-11): no sidebar token, no theme observer, zero theme footprint"

key-files:
  created: []
  modified:
    - src/ghl-customizer.js
    - src/ghl-customizer.css
    - test/run.mjs
    - test/dom-shim.mjs
    - test/fixtures/config.json
    - test/harness.html

key-decisions:
  - "The theme observer (watchTheme/unwatchTheme/onThemeMutation/scheduleTheme) was implemented in Task 1 rather than left as a placeholder: the plan's own Task 1 assertions (observers.theme true at locA, updated exact registration counts) require it"
  - "Custom-property writes go through two helpers (setVar/removeVar) that write only when the value differs; style.setProperty/removeProperty therefore have exactly one call site each, which is a stronger guarantee than the plan's literal call-count gate"
  - "A sidebar container that slips out of the adapter's reach still wearing theme properties is cleaned (clearSidebarTheme) before it is forgotten, and a root swap cleans the previous root; extends T-03-03 to detached nodes exactly as Phase 2 restores a lost branding mount"
  - "theme-root-missing is logged once per generation whenever the sidebar is absent (branding precedent), but the bounded theme mount wait runs only when the context has a sidebar token to show"
  - "Commits landed on main per the orchestrator's sequential dispatch (branching_strategy: none), as in Phase 2; the base-branch probe still reports main as protected"

patterns-established:
  - "Theme lifecycle decided inside renderTheme: no root -> clean previous root, unwatch, log once, wait only if sidebar tokens; root + sidebar tokens -> watch then apply then mark nav; root without sidebar tokens -> clear then unwatch"
  - "Nav marking is a diff: items no longer returned by the adapter lose the marker, new ones gain it, the container's own marker is never touched, zero matches marks nothing and reports 0"
  - "Harness controls perform the exact DOM mutation HighLevel would (class toggle between nav items without navigating) and log one hxLog entry"

requirements-completed: [CLR-01, CLR-02, CLR-03, CLR-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Optional theme tokens at the agency level and per location; a location value overrides the agency value key by key, an absent or invalid location value falls through to the agency value, a location without a theme inherits the agency tokens, agency-level pages resolve the agency tokens alone"
    requirement: CLR-01
    verification:
      - kind: unit
        ref: "test/run.mjs#unit: resolveTheme merges agency and location tokens through locationEntry and drops invalid values"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#theme tracer: a location's primary and sidebarBg land on the customizer's groups and the sidebar; the agency route removes them"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#theme: empty, null, non-string, and unknown tokens are ignored and write nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tokens are written only as inline CSS custom properties on the script's own .ghlc-group elements and on the adapter-located sidebar container (with the data-ghlc-theme marker) and its active nav items; switching A -> B -> agency -> A leaves no previous color anywhere; a replaced sidebar or moved active class is re-themed once through a single scoped observer that exists only while a sidebar token is applied; a missing sidebar is waited for within the existing bound"
    requirement: CLR-02
    verification:
      - kind: e2e
        ref: "test/run.mjs#theme: switching A -> B -> agency swaps tokens with no bleed-through"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#theme: navActive marks the adapter's active nav items and moves when the active class moves"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#theme: sidebar replaced wholesale is re-themed once through a single theme observer instance"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#theme: native sidebar keeps no theme observer and no marker"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#theme: missing sidebar root themes the groups, waits bounded, and themes the root when it appears"
        status: pass
      - kind: other
        ref: "grep -n 'new MutationObserver' src/ghl-customizer.js -> exactly four lines (watchMount x2, watchBranding, watchTheme); grep -c setInterval == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Only #rgb/#rrggbb is accepted and normalized to lowercase #rrggbb; empty/null are silently absent; invalid values are ignored with a scope+token diagnostic; a sidebar text/background pair below 4.5:1 falls back to whichever of #ffffff/#101828 reads better (verify().theme.fallback true); unpaired sidebarText and low-contrast navActive are dropped; an applied primary always carries a readable primaryText"
    requirement: CLR-03
    verification:
      - kind: unit
        ref: "test/run.mjs#unit: parseColor accepts 3- and 6-digit hex only and normalizes to #rrggbb"
        status: pass
      - kind: unit
        ref: "test/run.mjs#unit: contrastRatio follows WCAG relative luminance (21:1 black/white, #777777 fails, #767676 passes)"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#theme: sidebarText requires sidebarBg and a pair below 4.5:1 falls back to the safe default text"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nothing native is restyled: every stylesheet selector carries a ghlc marker and no importance override exists; native look-alike badge and toast elements keep byte-identical inline styles and classes across locA -> locB -> agency -> locA; the only elements carrying data-ghlc-theme are the sidebar root and its nav items; the only elements carrying --ghlc- properties are the sidebar root and .ghlc-group; html and body carry nothing"
    requirement: CLR-04
    verification:
      - kind: other
        ref: "test/run.mjs#static: every stylesheet selector is ghlc-scoped and nothing is marked important"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#theme: native status colors and classes outside the customizer's surfaces are untouched (CLR-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "verify().theme carries names, counts, and booleans only and the debug console never prints a color value, hex body, or the sidebar selector across a full A -> B -> agency -> A flow"
    requirement: CLR-02
    verification:
      - kind: e2e
        ref: "test/run.mjs#verify: theme report shape and hygiene"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#logs: theme diagnostics never contain color values or the sidebar selector"
        status: pass
    human_judgment: false
  - id: D6
    description: "A disabled, unsupported, unreachable, or malformed config leaves zero theme footprint: no data-ghlc-theme, no --ghlc- property on the sidebar, no theme observer"
    requirement: CLR-02
    verification:
      - kind: e2e
        ref: "test/run.mjs#disable: enabled false is a complete no-op (assertNoFootprint)"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#disable: unsupported schemaVersion is a no-op with one warning"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#disable: config fetch failure is a no-op"
        status: pass
      - kind: e2e
        ref: "test/run.mjs#disable: malformed JSON is a no-op"
        status: pass
    human_judgment: false
  - id: D7
    description: "Harness walkthrough (a)-(g): in a real browser the theme follows the route (Location A dark sidebar/orange buttons/grey active item, Location B fallback text and agency teal buttons, native elsewhere), Toggle active nav item / Replace whole sidebar / Collapse-expand each cost exactly one retheme and keep one highlighted item, and the harness's own controls keep their colors"
    requirement: CLR-02
    verification: []
    human_judgment: true
    rationale: "Visual behaviour in a real browser is not asserted headlessly and this executor context has no browser tool; the assets serve 200 from `npm run serve` and every step has a headless equivalent in the theme:* scenarios. Steps are recorded under 'Harness walkthrough (pending)' below for the end-of-phase verifier"
  - id: D8
    description: "Live HighLevel: the sidebar container takes the location's background/text, the active nav item is located by one of the three adapter candidates (A-06) and marked, native status colors and badges inside the sidebar are unchanged, and no stylesheet rule loses to a HighLevel rule"
    requirement: CLR-02
    verification: []
    human_judgment: true
    rationale: "Requires Rob's logged-in HighLevel session; the active-nav selector is unverified by design and is confirmed or corrected (one-line edit to selectors.sidebarNavActive) in Plan 03-02's install check"

# Metrics
duration: 20 min
completed: 2026-09-25
status: complete
---

# Phase 3 Plan 01: Accent Colors (theme engine, scoped observer, CLR-04 guards) Summary

**Per-location accent colors delivered as inline CSS custom properties through one agency-to-location resolver: primary/primary-text/focus on the customizer's own button groups, sidebar-bg/sidebar-text/nav-active plus a `data-ghlc-theme` marker on the verified sidebar container and its active nav items, WCAG 4.5:1 readability rules with a safe-text fallback, hex-only color grammar, a single scoped theme observer that exists only while a sidebar token is applied, a marker-scoped stylesheet proven by a static gate, and `verify().theme` — 116/116 headless (Phase 2's 101 plus 15 new).**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-25T01:04:17Z
- **Completed:** 2026-09-25T01:24:04Z
- **Tasks:** 3
- **Files modified:** 6 (0 created)

## Accomplishments

- **CLR-01** `agency.theme` and `locations[id].theme` are optional plain objects with `primary`, `sidebarBg`, `sidebarText`, `navActive`; `resolveTheme` overlays the location's tokens on the agency's key by key through the new `locationEntry` lookup (which `resolveBranding` and `resolveButtons` now also use, unchanged in behaviour — the Phase 1/2 units are re-pinned inside the new resolveTheme unit). Unknown keys are never read; `validateConfig` gained no error condition.
- **CLR-02** `renderTheme` runs from `renderAll` (after branding), from the theme observer's coalesced timer, and from the `theme` mount-wait tick. It writes `--ghlc-primary`, `--ghlc-primary-text`, `--ghlc-focus` inline on every `.ghlc-group` (and `ensureGroup` applies them to a group the instant it is created, so an observer-driven placement re-render never shows a default-coloured button), and `--ghlc-sidebar-bg`, `--ghlc-sidebar-text`, `--ghlc-nav-active` plus `data-ghlc-theme="sidebar-bg sidebar-text"` (subset) on the sidebar container returned by `adapter.findThemeRoot()`; the items returned by `adapter.findNavActive()` carry `data-ghlc-theme="nav-active"`. Switching A -> B -> agency -> A rewrites everything in the same synchronous pass as `applyContext`; scenario 4 walks every element for stale hex values after each hop.
- **CLR-03** `parseColor` accepts exactly `#rgb`/`#rrggbb` (either case, exact match) and returns the normalized lowercase `#rrggbb` — the only value that ever reaches `style.setProperty`. `''`/`null` are silently absent; other rejected values log `theme-token-ignored { scope, token, reason: 'invalid' }`. After the merge: unpaired `sidebarText` dropped (`unpaired`); a pair below 4.5:1 replaces the text with whichever of `#ffffff`/`#101828` contrasts more and sets `fallback`; `navActive` below 4.5:1 against the applied text is dropped (`contrast`); `primaryText` is always the readable safe colour. Boundary values pinned: black/white 21:1, `#777777`/white 4.48 fails, `#767676`/white 4.54 passes.
- **CLR-04** Every stylesheet selector (including inside `@media`) carries a `ghlc` marker and there is no importance override — a static gate parses the CSS and fails on any bare selector. A scenario injects native look-alikes (a red badge inside the sidebar, a green success toast in the header) and proves their inline `style` and `class` attributes are byte-identical, and every other non-group element's class/style attribute unchanged, across locA -> locB -> agency -> locA; the only marked elements are the sidebar root and its nav anchors; nothing lands on `html` or `body`.
- **One theme observer** (`state.themeWatch`): a single `MutationObserver` registered on the sidebar root (`childList`, `subtree`, `attributes` filtered to `class`/`aria-current`) and its parent (`childList`, shallow). Attached only while a sidebar token is applied — a native sidebar has zero theme footprint. The script adds no nodes inside the sidebar and its own writes (custom properties, the marker) fall outside the filter, so every delivered record is HighLevel's except a `class` record on the branding mount (filtered by target). Wholesale sidebar replacement and a moved active class each cost exactly one `retheme`; registrations swap, never accumulate.
- **verify()** gains `theme: { root, applied, navActive, ignored, fallback }`, `observers.theme`, `waiting.theme`, `mounts.sidebarNavActive` — names, counts, booleans only. The debug console across a full switching flow contains no `#`, no hex body, and no sidebar selector.
- **Test surface**: `GHLC.__test` exports `resolveTheme`, `renderTheme`, `parseColor`, `contrastRatio`, `locationEntry`; the shim's `buildShell({ nav })` adds a nav with `hl_nav-item` anchors (first active); `themeRegs(shim)` identifies the theme instance by its `aria-current` filter; the harness gained the nav, a route-driven active class, `#hx-toggle-nav`, and a banner note.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): location primary and sidebarBg as inline tokens via one resolver** - `cb5ddbd` (feat)
2. **Task 2: sidebarText/navActive contrast rules, nav marking, no-bleed switching, theme observer scenarios** - `1ebc71b` (feat)
3. **Task 3: CLR-04 stylesheet gate and native-untouched scenario, disabled-path footprint, diagnostics hygiene, harness nav** - `b63a7be` (test)

**Plan metadata:** the `docs(03-01)` commit that adds this file.

Tracer feedback gate: auto mode is active (`auto_advance: true`), so after Task 1 the `<verify>` was re-run (`node test/run.mjs` PASS 104/104) and execution expanded without a checkpoint.

## Theme resolution and contrast rules as implemented

```
resolveTheme(config, locationId)
  entry  = locationEntry(config, locationId)            // null on agency pages / unknown / prototype names
  for scope in [agency: config.agency.theme, location: entry.theme]:
    skip unless plain object
    for token in THEME_TOKENS (primary, sidebarBg, sidebarText, navActive):
      skip unless own property; '' or null -> absent (silent)
      parseColor(raw) -> tokens[token] = '#rrggbb', owner[token] = scope
                       | ignored.push({ scope, token, reason: 'invalid' })
  sidebarText && !sidebarBg              -> drop sidebarText, ignored { scope: owner, reason: 'unpaired' }
  contrast(sidebarBg, sidebarText) < 4.5 -> sidebarText = pickReadableText(sidebarBg), fallback = true
  contrast(navActive, sidebarText) < 4.5 -> drop navActive, ignored { scope: owner, reason: 'contrast' }
  primary                                -> primaryText = pickReadableText(primary)
  return { tokens, ignored, fallback }
```

`contrastRatio` uses WCAG 2.x linearization (`c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4`), luminance `0.2126R + 0.7152G + 0.0722B`, `(L1+0.05)/(L2+0.05)` lighter on top; an unparseable input yields 0 (unreadable). Fixture outcomes: locA pair 14.05:1 and nav 9.87:1 (all kept); locB pair 1.09:1 -> text `#101828` with `fallback: true`, nav `#e5e7eb` vs `#101828` 14.3:1 kept, invalid primary falls through to the agency `#0f766e`.

## Exact DOM writes

| Element | Written | Removed when |
|---|---|---|
| every `.ghlc-group` (header, contact) | `--ghlc-primary`, `--ghlc-primary-text`, `--ghlc-focus` (inline, via `setVar`: only when different) | no `primary` resolves |
| sidebar container (`adapter.findThemeRoot()`) | `--ghlc-sidebar-bg`, `--ghlc-sidebar-text`, `--ghlc-nav-active` (only the tokens present) and `data-ghlc-theme` = space-separated subset of `sidebar-bg`, `sidebar-text` | the token is absent / no sidebar token at all / the root is swapped or lost (previous root cleaned) |
| each active nav item (`adapter.findNavActive()`) | `data-ghlc-theme="nav-active"` | it is no longer returned by the adapter, or `navActive` is absent |

Never `html`, never `body`, never a `style` element, never stylesheet text (awk gates over the theme section prove `documentElement`, `document.body`, `createElement('style')`, `textContent`, `console.` and every selector literal are absent from it). Stylesheet rules added: `[data-ghlc-theme~="sidebar-bg"] { background-color: var(--ghlc-sidebar-bg) }`, `[data-ghlc-theme~="sidebar-text"], [data-ghlc-theme~="sidebar-text"] a { color: var(--ghlc-sidebar-text) }`, `[data-ghlc-theme~="nav-active"] { background-color: var(--ghlc-nav-active) }`.

## Observer registrations

| Registration | Target | Options | Catches |
|---|---|---|---|
| root | the sidebar container | `{ childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-current'] }` | nav items re-rendered, the active class/attribute moved |
| anchor | `anchorFor(root)` (its parent, else body) | `{ childList: true, subtree: false }` | the whole container replaced |

`onThemeMutation` skips records whose target `isOwnNode` or is the branding mount (`state.branding.native.el`); anything else -> `scheduleTheme('mutation')` -> one `setTimeout(0)` -> `renderTheme('retheme')` + `log('retheme')`. `applyContext` cancels the pending retheme and the theme mount wait alongside the branding ones. `grep -n 'new MutationObserver'` prints exactly four lines.

## verify().theme shape

```js
theme: {
  root: boolean,       // adapter.findThemeRoot() resolves right now
  applied: string[],   // subset of ['primary','sidebarBg','sidebarText','navActive'] in that order;
                       // sidebar tokens listed only when the root was found (regardless of how many nav items were marked)
  navActive: number,   // nav items currently carrying the marker
  ignored: number,     // resolveTheme.ignored.length for the current context
  fallback: boolean    // the sidebar text fell back to a safe colour
},
observers: { header, contact, branding, theme },
waiting:   { header, contact, contactFields, branding, theme },
mounts:    { ..., sidebarNavActive }
```

Shipped fixture at Location A (contact page): `{ root: true, applied: ['primary','sidebarBg','sidebarText','navActive'], navActive: 1, ignored: 0, fallback: false }`; Location B: `{ ..., ignored: 1, fallback: true }`; agency route: `{ root: true, applied: ['primary'], navActive: 0, ignored: 0, fallback: false }` with `observers.theme: false`.

## Exact assertion values updated (A-15)

| Assertion | Before | After | Why |
|---|---|---|---|
| `observers: contact toolbar re-render`, `own writes do not cause render loops`, `mount appearing after navigation` — `shim.observers().length` | 7 | 9 | two theme registrations at locA (placements 4 + branding 3 + theme 2) |
| `observers: context change cancels the wait` — total while waiting for the contact mount | 5 | 7 | header set 2 + branding 3 + theme 2 |
| `observers: wholesale header replacement` — `placementRegs` | excluded branding only | excludes branding and theme (`themeMo`); asserts theme 2 and total 9 | the theme anchor also targets body |
| `verify: missing mounts` — `shim.observers().length` after 16 s | 0 | 2 | the hand-built sidebar is present and themed, so the theme observer legitimately remains |
| `verify: report shape and hygiene` — `mounts`, `observers`, `waiting` | — | `sidebarNavActive: true`, `theme: true`, `theme: false`, plus the `theme` block | new report fields |
| `disable:`, agency-route, `verify: branding report` deepEquals | — | `theme: false` / `theme: true` as the scenario dictates | new report fields |

Never loosened to `>=`.

## Harness walkthrough (pending — end-of-phase UAT)

Not run in this executor context (no browser tool); `npm run serve` was started and `test/harness.html`, `src/ghl-customizer.js`, `src/ghl-customizer.css`, `test/fixtures/config.json` all returned 200. Steps for the verifier at `http://localhost:5173/test/harness.html?ghlc-debug=1`:

| Step | Expected |
|---|---|
| (a) Agency dashboard on load | native dark sidebar, no `data-ghlc-theme`, `GHLC.verify().theme.applied` = `['primary']` with no groups, `observers.theme` false |
| (b) Location A · Dashboard | sidebar `#1f2937` with `#f9fafb` text, Dashboard item `#374151`, Support/Location Settings buttons `#c2410c` with white text, `theme.applied` all four, `theme.navActive` 1 |
| (c) Location A · Contact X | Contacts item highlighted, Dashboard not; Send Invite orange |
| (d) Location B · Contact Z | sidebar white with `#101828` text, active item `#e5e7eb`, buttons `#0f766e`; `theme.fallback` true, `theme.ignored` 1 |
| (e) Location Z / Agency dashboard | native sidebar, no marker |
| (f) Back on A: Toggle active nav item, Replace whole sidebar, Collapse/expand | after each: exactly one highlighted item, sidebar keeps its colours, exactly one `retheme` in the console |
| (g) Webhook stub radios, log, banner | native harness colours throughout |

Headless equivalents: scenarios 3 (toggle), 6 (replace), 4 (route switching), and the CLR-04 native-untouched scenario.

## Files Created/Modified

- `src/ghl-customizer.js` — constants (`THEME_TOKENS`, `HEX_COLOR_RE`, `MIN_CONTRAST`, `SAFE_TEXT_COLORS`, `CSS_VARS`, `OWN.themeAttr/themeAttrSel`, schema comment `Theme` line); adapter (`selectors.sidebarNavActive`, `findThemeRoot`, `findNavActive`, `probe().sidebarNavActive`); config (`locationEntry`, `parseColor`, `resolveTheme`; `resolveBranding`/`resolveButtons` refactored); context (`state.theme`, `state.themeWatch`, `mountWaits.theme`, `applyContext` cancels); `ensureGroup` applies group tokens; new `// ==== theme ====` section (luminance/contrast/pickReadableText/setVar/removeVar/applyGroupTheme/applySidebarTheme/clearNavMarks/clearSidebarTheme/markNavActive/renderTheme); observers (`watchTheme`, `unwatchTheme`, `onThemeMutation`, `scheduleTheme`, `cancelScheduledTheme`, `scheduleMountTick` routes `theme`); verify block; `__test` exports
- `src/ghl-customizer.css` — header comment; three `[data-ghlc-theme~=...]` rules
- `test/run.mjs` — ten-marker gate; schema check pins; `themeRegs`/`themeMo`; A-15 updates; Phase 3 sections: `parseColor`/`resolveTheme`/`contrastRatio` units, `theme tracer`, eight `theme:*` scenarios, `verify: theme report shape and hygiene`, `static: every stylesheet selector is ghlc-scoped`, CLR-04 scenario, `logs: theme diagnostics`; `assertNoFootprint` and `harness:` extended
- `test/dom-shim.mjs` — `buildShell({ nav })`, `shell.nav`, `shell.navActive`
- `test/fixtures/config.json` — `agency.theme.primary`, `locA.theme`, `locB.theme` per A-12 (every existing key kept)
- `test/harness.html` — `nav.hx-nav` with `hl_nav-item` anchors, route-driven active class in `render()`, `buildNav()` in `buildSidebar()`, nav clicks routed through the fake router, `#hx-toggle-nav`, row heading "Sidebar logo and theme", banner note, nav styles

## Decisions Made

- Implemented the theme observer in Task 1 (see Deviations 1) so Task 1's own assertions are satisfiable; Task 2 then completed `markNavActive` and the contrast rules exactly as planned.
- `setVar`/`removeVar` helpers make every custom-property write conditional on the value differing (the plan asks for idempotent attribute writes on the sidebar; the same rule applied to the groups costs nothing and keeps a real browser's `style` attribute records to a minimum).
- A previous theme root is cleaned before it is forgotten (missing branch) or replaced (root swap): a detached container re-attached by HighLevel later can never reappear wearing a stale colour.
- `theme-root-missing` logs once per generation regardless of tokens (branding precedent); the bounded wait runs only when a sidebar token exists (plan A-08).
- The head-comment schema uses a `Theme` type line, like the existing `Action` line, rather than repeating the object literal inline on both `agency` and `locations`; the `'#rrggbb'` grammar and the 4.5:1 fallback are documented there.
- No selector or HighLevel string appears in the theme section, and the adapter comment documents that the active-nav candidates are unverified (A-06).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Theme observer implemented in Task 1 instead of left as a placeholder**
- **Found during:** Task 1 (reading the plan's Task 1 test expectations)
- **Issue:** The plan calls `watchTheme`/`unwatchTheme` "empty-safe placeholders" in Task 1 but the same task's `verify: report shape and hygiene` expectation (`observers.theme: true`) and its A-15 instruction to update every exact `shim.observers().length` value "because the theme observer now registers two targets at locA" are only true if the observer registers. The two instructions cannot both hold.
- **Fix:** `watchTheme`, `unwatchTheme`, `onThemeMutation`, `scheduleTheme`, `cancelScheduledTheme` were written in Task 1, mirroring `watchBranding` exactly as the plan specifies for Task 2; Task 2 verified the lifecycle and added the scenarios. `markNavActive` stayed a clearing-only stub in Task 1 as planned.
- **Files modified:** src/ghl-customizer.js, test/run.mjs
- **Verification:** Task 1 suite PASS 104/104 with the planned exact values; Task 2 observer scenarios pass unchanged
- **Committed in:** cb5ddbd

**2. [Rule 1 - Bug] Test needle fixed: `#ffffff` is a shared value**
- **Found during:** Task 2 (scenario 4, first run)
- **Issue:** My extra "no stale B value after agency -> A" walk used `#ffffff` (locB's background) as a needle, but `#ffffff` is also locA's readable `--ghlc-primary-text`. Test bug, not a source defect.
- **Fix:** The back-to-A check uses only B-exclusive values (`#101828`, `#e5e7eb`, `#0f766e`); the planned A -> B check for stale A values is unchanged.
- **Files modified:** test/run.mjs
- **Verification:** scenario passes; the A -> B stale-hex walk still covers all four A values
- **Committed in:** 1ebc71b

### Acceptance-criteria notes (intent met, literal count differs)

**3. `grep -c 'setProperty('` / `grep -c 'removeProperty('` are 1 each (plan: ≥ 4)**
- All custom-property writes go through `setVar`/`removeVar`, which are the only `style.setProperty`/`style.removeProperty` call sites. This is a stronger guarantee than the count (one write path, write-only-when-different) and the tracer, switching, and CLR-04 scenarios prove the DOM outcome. Inlining six duplicate calls to satisfy a grep count would make the code worse, so the helpers were kept. `grep -c 'setVar('` is 5 and `grep -c 'removeVar('` is 7.

**4. `grep -c "'aria-current'"` is 1 (plan: ≥ 2)**
- The adapter candidate is written as `'#sidebar-v2 [aria-current="page"]'` (no single quotes around `aria-current`), so the single-quoted grep sees only the `attributeFilter`. `grep -c 'aria-current'` is 3 (adapter candidate, attributeFilter, comment). Both required occurrences exist.

### Process notes

**5. Commits on `main` although the base-branch probe reports it protected** — identical to 02-01/02-02: `gsd-tools query git.base-branch --is-protected main` is `true`, `git.allow_default_branch_commits` is unset, and the orchestrator dispatched this plan explicitly as sequential on `main` with `branching_strategy: "none"` and "Do NOT create branches". Followed the dispatch; no configuration changed.

**6. Harness walkthrough not executed by the executor** — `human_verify_mode: end-of-phase`; no browser tool in this context. Assets verified to serve (200); steps recorded above for the verifier. Allowed by the plan's `<human-check>` wording.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 test bug) + 2 acceptance-count notes + 2 process notes
**Impact on plan:** Every artifact, log event, config key, DOM write, observer registration, and test named in the plan is present as specified; the observer moved one task earlier to make the plan's own assertions consistent. No scope creep; `src/ghl-customizer.css` needed no change in Task 3 (the gate passed on the Task 1 rules).

## Issues Encountered

- One first-run failure in Task 2 was the shared-`#ffffff` test needle described in Deviations 2. No source change was needed at any point after Task 1's first green run (104/104 on the first execution).

## Known Stubs

None. `markNavActive` was completed in Task 2; `selectors.sidebarNavActive` is an intentionally unverified candidate list (A-06) that degrades to "mark nothing, report 0" and is confirmed live in Plan 03-02.

## Threat Flags

None beyond the plan's register. T-03-01 (hex-only grammar, normalized value is the only style value), T-03-02 (marker-scoped stylesheet gate + CLR-04 scenario), T-03-03 (synchronous reconcile + stale-hex walk, extended to detached roots), T-03-04 (one instance, two scoped registrations, coalesced timer, bounded wait, no `setInterval`), T-03-05 (names/counts only; `#` needle over the console), T-03-06 (contrast rules with pinned boundaries), T-03-07 (`locationEntry` `hasOwn`, `'constructor'`/`'__proto__'` units), T-03-08 (adapter candidates only) are each implemented and tested. No packages installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CLR-01..CLR-04 are implemented and headlessly proven (116/116). Plan 03-02 (README, sample config, jsDelivr delivery) can document the `theme` keys exactly as the head-comment schema states them: `primary`, `sidebarBg`, `sidebarText`, `navActive`, 3- or 6-digit hex only, location overrides agency key by key, a sidebar pair below 4.5:1 falls back to a safe text colour.
- Open live risk for the 03-02 install check: (1) which of the three `selectors.sidebarNavActive` candidates matches the live active nav item — a miss marks nothing and reports `theme.navActive: 0` (graceful), and the fix is a one-line edit to the candidate list; (2) whether a HighLevel rule beats `[data-ghlc-theme~="sidebar-bg"]`/`~="sidebar-text"` — if so, raise specificity by repeating the attribute selector, never with `!important` (the static gate forbids it); (3) whether the live sidebar's own badges/status spans declare their colours inline or via classes (the CLR-04 scenario models inline; class-declared colours are also untouched because the stylesheet only sets `color` on the root and its anchors).
- The end-of-phase verifier owns the harness walkthrough (a)-(g) above.

## Self-Check: PASSED

- Files: src/ghl-customizer.js, src/ghl-customizer.css, test/run.mjs, test/dom-shim.mjs, test/fixtures/config.json, test/harness.html — all present on disk and modified in this plan.
- Commits: cb5ddbd, 1ebc71b, b63a7be — all present in `git log`; `git rev-list --count a236a88..HEAD` = 3 (matches `commits: 3`).
- `node test/run.mjs` — PASS 116/116 on the committed tree (zero `not ok` lines); `node --check src/ghl-customizer.js` exits 0; the harness inline script passes `node --check`; every grep/awk/node gate from the three tasks holds except the two literal-count notes above; served assets return 200.

---
*Phase: 03-accent-colors-delivery*
*Completed: 2026-09-25*

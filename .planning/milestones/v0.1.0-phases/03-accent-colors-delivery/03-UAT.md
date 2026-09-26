---
status: complete
phase: 03-accent-colors-delivery
source: [03-VERIFICATION.md]
started: 2026-09-25T02:15:52Z
updated: 2026-09-25T12:43:51Z
---

## Current Test

[testing complete]

## Tests

### 1. Live install / snippet form
test: Live install (DLV-01 edge, B-02): in HighLevel Agency Settings -> Company -> Custom JavaScript paste the README loader snippet (raw-JS IIFE form), save, hard-reload. If it is rejected, try the <script> tag form.
expected: The customizer loads; GHLC.verify() in the console reports config.loaded true, config.schemaVersion 1. Record which form the field accepted; if only the script-tag form works, update README 'Install in HighLevel' and ship as v0.1.1.
result: pass
reported: "GHLC.verify() pasted from Rob's console: version 0.1.1, config.loaded true, config.enabled true, config.schemaVersion 1, buttonIds [sendInvite, helpCenter], branding.applied location, theme.applied all four, mounts.sidebarNavActive true"
note: The raw-JS loader form did NOT work: HighLevel rendered it as plain text inside div#customJS (335 chars, no script element) and GHLC was undefined. The <script> tag form works: it lands as a SCRIPT child of div#customJS with defer and data-config intact (confirmed from a second logged-in tab). README 'Install in HighLevel' now leads with the script tag and warns against raw JavaScript (commit c97b9cb, documentation only; the served v0.1.1 assets are unchanged, so no new tag).

### 2. Live Dummy Clinic colors, verify(), active-nav selector
test: Live Dummy Clinic (SC1, A-06, CLR-02 judgment prohibition): open location iDPNGKoFsjvf9wUCrk3V, then a contact record, and run GHLC.verify().
expected: Sidebar logo is the green 'Location A' pill with alt 'Dummy Clinic'; sidebar background #0b3b3a with pale #e6fffa text; Help Center (header) and Send Invite (contact) buttons #0f766e with white text; verify().branding.applied 'location', theme.applied ['primary','sidebarBg','sidebarText','navActive'], theme.fallback false, theme.ignored 0, mounts.sidebarNavActive true, theme.navActive >= 1. If sidebarNavActive is false / navActive 0: inspect the active nav element's classes, add the live class to selectors.sidebarNavActive, npm test, release v0.1.1 (never re-tag v0.1.0). The native active-item styling must still be visible in that case (graceful omission, no guess).
result: pass
source: automated
verified: 2026-09-25, served build injected into Rob's logged-in Dummy Clinic session (contact Q7c2…, sample data). With v0.1.1: logo = green 'Location A' pill, alt 'Dummy Clinic'; #sidebar-v2 background rgb(11,59,58), nav labels rgb(230,255,250); Help Center (header) and Send Invite (contact, via toolbar-anchor) rgb(15,118,110) on white; verify().branding.applied 'location', theme.applied all four, fallback false, ignored 0, mounts.sidebarNavActive true, theme.navActive 1; the active Contacts anchor rgb(17,94,89) with pale label; the sidebar's native 'Beta' badge keeps rgb(255,188,0)/rgb(12,45,63). Screenshot: dummy-clinic-v0.1.1.jpg in the job tmp dir.
note: v0.1.0 FAILED this test two ways (see Gaps G-03-2, resolved): the sidebar background stayed white and no active-nav selector matched. Fixed in 407c834 and f84042f, released as v0.1.1 (1076b44) per this test's own instruction. Icons in the nav are black SVG images HighLevel serves, so on the dark teal they are low-contrast; that is a config color choice, not a customizer defect.

### 3. Live inherit/native on unconfigured location + agency page
test: Live inherit/native (SC1): open any location not in config/agency-config.json, then an agency-level page.
expected: Native logo, native sidebar colors, no data-ghlc-theme attribute on #sidebar-v2; header buttons blue #155eef (agency default); verify().theme.applied ['primary'], observers.theme false. On the agency page: no customizer buttons at all.
result: pass
source: automated
verified: 2026-09-25 live. Unconfigured location Cp2XxBsRoyKS2CUf1Hwi (Xcelsior Health): native 'agency logo' img with class object-contain agency-logo only, sidebar white with no data-ghlc-theme attribute and no inline --ghlc-* properties, Help Center rgb(21,94,239) on white, theme.applied ['primary'], observers.theme false, no nav marks. Agency page /agency_dashboard/: GHLC present but zero .ghlc-group and zero .ghlc-btn, branding 'native', no marker.

### 4. Live native status colors untouched
test: Live native status colors (SC2, CLR-04): on Dummy Clinic trigger a native success toast (e.g. save a contact note) and, if available, a warning/error toast and any sidebar badge.
expected: HighLevel's own success/warning/error colors and badges are visibly unchanged; only the sidebar container background/text and the active nav item are themed; no HighLevel rule is overridden by a customizer rule.
result: pass
reported: "pass"
note: Automated part done 2026-09-25: on themed Dummy Clinic every element carrying a ghlc class, marker, or inline property is exactly the sidebar aside, its logo img, one active nav anchor, and the two button groups (13 elements); the native 'Beta' badge inside the nav keeps its own yellow/dark colors; the stylesheet has no importance override and every selector is ghlc-scoped (suite check). Remaining for Rob: eyeball one native success/warning toast on Dummy Clinic (e.g. after saving during test 1) to confirm it looks native; no write was made to the account during automation.

### 5. Rollback rehearsal via tag change
test: Rollback rehearsal (SC3): change the tag in both snippet URLs to v0.0.0, save, reload; then restore v0.1.0 and reload.
expected: At v0.0.0 the script 404s and the page is fully native (no buttons, native logo, native sidebar, no console errors beyond the 404). At v0.1.0 everything returns exactly as before. Nothing but the tag changed.
result: pass
source: automated
verified: 2026-09-25 live via the same two URLs the snippet carries. At v0.0.0 the script element fires its error event (jsDelivr 404), window.GHLC stays undefined, no stylesheet link, zero ghlc elements, native logo and white sidebar. At v0.1.1 everything returns (test 2). jsDelivr serves v0.1.0 and v0.1.1 byte-identical to their tags (sha256 checked for js, css, config). The snippet-field edit itself is covered by test 1.

### 6. Kill switch: snippet removal leaves no leftovers
test: Kill switch (SC3/FND-06): remove the snippet entirely, save, reload.
expected: Native UI with no leftovers: no .ghlc-group, no data-ghlc-theme, no --ghlc-* inline properties, no ghlc-logo class, no storage/cookies.
result: pass
source: automated
verified: 2026-09-25 live. A plain reload with no script: zero elements with a ghlc class, data-ghlc-theme, or --ghlc-* inline property; window.GHLC undefined; no localStorage key or cookie containing ghlc (sessionStorage could not be read through the browser tool, but the source has zero references to localStorage, sessionStorage, document.cookie, or indexedDB). Removing the snippet is exactly this state.

### 7. Harness walkthrough (a)-(g)
test: Harness walkthrough (03-01 human-check): npm run serve; open http://localhost:5173/test/harness.html?ghlc-debug=1 and step (a) Agency dashboard, (b) Location A Dashboard, (c) Location A Contact X, (d) Location B Contact Z, (e) Location Z / Agency, (f) back on A press Toggle active nav item / Replace whole sidebar / Collapse-expand, (g) inspect the harness's own controls.
expected: (a) native dark sidebar, no marker, theme.applied ['primary'], observers.theme false. (b) sidebar #1f2937 / #f9fafb, Dashboard item #374151, orange #c2410c buttons with white text, theme.applied all four, theme.navActive 1. (c) Contacts item highlighted, Dashboard not; Send Invite orange. (d) sidebar white with #101828 text (fallback), active item #e5e7eb, teal #0f766e buttons; theme.fallback true, theme.ignored 1. (e) native sidebar, no marker. (f) after each press exactly one highlighted item, colors kept, exactly one 'retheme' log per press. (g) webhook stub radios, log, banner keep native harness colors.
result: pass
source: automated
verified: 2026-09-25 via Playwright against http://localhost:5173/test/harness.html?ghlc-debug=1. (a) route null, theme.applied ['primary'], observers.theme false, no marker. (b) sidebar rgb(31,41,55)/rgb(249,250,251), Dashboard item rgb(55,65,81), buttons rgb(194,65,12) on white, applied all four, navActive 1. (c) Contacts marked, Dashboard not, Send Invite orange. (d) sidebar white / rgb(16,24,40), active rgb(229,231,235), buttons rgb(15,118,110), fallback true, ignored 1. (e) native, marker null. (f) toggle nav / replace sidebar / collapse / expand: exactly one marked item each time, colors kept, exactly one 'retheme' log per press. (g) log, radios, banner and controls keep native colors, no ghlc marker.
note: First pass showed the sidebar container's computed colors unchanged in (b) and (d) although the marker and --ghlc-* properties were set. Cause: the harness linked the customizer stylesheet BEFORE its own <style>, so .hx-sidebar (same specificity, later in source) won the tie. Harness-only artifact (the script appends its link at runtime after HighLevel's sheets). Fixed inline in 35c9f08, suite 119/119, re-verified; see Gaps G-03-7 (resolved).

### 8. D-06 originality judgment (README vs reference repo)
test: D-06 judgment prohibition (DLV-01): skim README.md against the reference project's README (https://github.com/dachi-khelashvili/ghl-customizer, revision ff7c8e4).
expected: No copied prose, installation steps, or configuration examples; the reference is named only in NOTICE.md.
result: pass
source: automated
verified: 2026-09-25. Fetched the reference README at ff7c8e4 (137 lines). Only three shared 6-word sequences exist and all are the generic 'script src https cdn jsdelivr net gh' URL pattern; no shared prose, install steps, or config examples. None of the reference's config keys (branding, headerButtons, userMenu, widgets, dashboardCustomizer, featureToggles, primaryColor, dashboardTitle) or selectors (hl-header-*, hl-sidebar, hl-user-menu) appear in README.md. The reference repo is named only in NOTICE.md. Reference tree at ff7c8e4 = README.md, agency-config.json, ghl-customizer.js (no LICENSE file, as NOTICE.md states), although its README's last section claims 'MIT License'; nothing was copied so this does not change the originality finding.

### 9. Release decision: tag v0.1.1 for WR-01 drift
test: Release decision (WR-01 drift): decide whether to tag v0.1.1 from HEAD 6d357f1 so the served script matches the README.
expected: Served v0.1.0 JS (byte-identical to tag a6ab42c) does NOT contain the WR-01 rule that drops navActive without an applied sidebarText, while README@HEAD line 107 documents that rule. A v0.1.1 tag per README 'Releasing a new version' closes the drift; until then any config that sets navActive without sidebarText gets an unchecked nav color on v0.1.0. The shipped sample sets all four tokens and is unaffected.
result: pass
verified: 2026-09-25. Tagged v0.1.1 at 1076b44 and pushed; jsDelivr returned 200 after about a minute and serves js/css/config byte-identical to the tag. The decision was forced by test 2: v0.1.0 could not theme the live sidebar or find the active nav item, and this test's own instruction says to release v0.1.1. v0.1.1 also closes the WR-01 drift (the served script now drops navActive without an applied sidebarText, as the README documents). v0.1.0 was not re-tagged.

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-03-7
  truth: "Harness walkthrough (b) shows sidebar #1f2937 / #f9fafb and (d) white / #101828"
  status: resolved
  reason: "Automated run: sidebar container computed colors stayed native (#101828 / #d0d5dd) in (b) and (d) while marker and custom properties were set"
  severity: minor
  test: 7
  root_cause: "test/harness.html linked src/ghl-customizer.css before its own <style>; the harness .hx-sidebar rule has the same specificity as [data-ghlc-theme~=sidebar-bg] and, being later in source, won the cascade. Harness-only: the script appends its link at runtime after the app stylesheets in HighLevel."
  artifacts:
    - path: "test/harness.html"
      issue: "customizer <link> placed before the harness <style>"
  missing:
    - "Move the customizer <link> after the harness <style> so the harness mirrors HighLevel's load order"
  resolved_by: "commit 35c9f08 (inline fix during UAT, suite 119/119, re-verified in Playwright)"
  resolved_at: 2026-09-25

- gap_id: G-03-2
  truth: "Live Dummy Clinic: sidebar background #0b3b3a, mounts.sidebarNavActive true, theme.navActive >= 1"
  status: resolved
  reason: "Automated live run of v0.1.0: sidebar background stayed white (rgb 255,255,255) and nav labels black although data-ghlc-theme and --ghlc-* were set; mounts.sidebarNavActive false, theme.navActive 0"
  severity: major
  test: 2
  root_cause: "HighLevel paints #sidebar-v2 and its .nav-title labels with rules of the shape body[data-theme] .sidebar-v2-location #sidebar-v2.default-bg-color (one id, four classes), which outranks the stylesheet's lone attribute selectors; and the active anchor carries Vue Router's 'active'/'exact-active' classes, none of the three guessed selectors. A third finding surfaced while fixing: HighLevel's hover background (light grey, same as its active item) under the themed pale text was unreadable."
  artifacts:
    - path: "src/ghl-customizer.css"
      issue: "theme rules lose on specificity; nav label span colored directly by HighLevel; hover background unreadable under themed text"
    - path: "src/ghl-customizer.js"
      issue: "selectors.sidebarNavActive had no selector matching live markup"
  missing:
    - "Add two :not(#ghlc-boost) pseudo-classes to the three theme rules and cover a .nav-title (no importance override, suite forbids it)"
    - "Lead selectors.sidebarNavActive with '#sidebar-v2 nav a.exact-active' and '#sidebar-v2 nav a.active'"
    - "Themed hover rule: a hovered item takes navActive when set, otherwise no highlight"
    - "Release v0.1.1 and point README, config, and DEFAULT_CONFIG_URL at it"
  resolved_by: "commits 407c834, f84042f, 1076b44 (tag v0.1.1); re-verified live with the served v0.1.1 URLs"
  resolved_at: 2026-09-25

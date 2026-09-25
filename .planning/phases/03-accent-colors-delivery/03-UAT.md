---
status: testing
phase: 03-accent-colors-delivery
source: [03-VERIFICATION.md]
started: 2026-09-25T02:15:52Z
updated: 2026-09-25T02:15:52Z
---

## Current Test

number: 1
name: Live install / snippet form
expected: |
  The customizer loads; GHLC.verify() in the console reports config.loaded true, config.schemaVersion 1. Record which form the field accepted; if only the script-tag form works, update README 'Install in HighLevel' and ship as v0.1.1.
awaiting: user response

## Tests

### 1. Live install / snippet form
test: Live install (DLV-01 edge, B-02): in HighLevel Agency Settings -> Company -> Custom JavaScript paste the README loader snippet (raw-JS IIFE form), save, hard-reload. If it is rejected, try the <script> tag form.
expected: The customizer loads; GHLC.verify() in the console reports config.loaded true, config.schemaVersion 1. Record which form the field accepted; if only the script-tag form works, update README 'Install in HighLevel' and ship as v0.1.1.
result: [pending]

### 2. Live Dummy Clinic colors, verify(), active-nav selector
test: Live Dummy Clinic (SC1, A-06, CLR-02 judgment prohibition): open location iDPNGKoFsjvf9wUCrk3V, then a contact record, and run GHLC.verify().
expected: Sidebar logo is the green 'Location A' pill with alt 'Dummy Clinic'; sidebar background #0b3b3a with pale #e6fffa text; Help Center (header) and Send Invite (contact) buttons #0f766e with white text; verify().branding.applied 'location', theme.applied ['primary','sidebarBg','sidebarText','navActive'], theme.fallback false, theme.ignored 0, mounts.sidebarNavActive true, theme.navActive >= 1. If sidebarNavActive is false / navActive 0: inspect the active nav element's classes, add the live class to selectors.sidebarNavActive, npm test, release v0.1.1 (never re-tag v0.1.0). The native active-item styling must still be visible in that case (graceful omission, no guess).
result: [pending]

### 3. Live inherit/native on unconfigured location + agency page
test: Live inherit/native (SC1): open any location not in config/agency-config.json, then an agency-level page.
expected: Native logo, native sidebar colors, no data-ghlc-theme attribute on #sidebar-v2; header buttons blue #155eef (agency default); verify().theme.applied ['primary'], observers.theme false. On the agency page: no customizer buttons at all.
result: [pending]

### 4. Live native status colors untouched
test: Live native status colors (SC2, CLR-04): on Dummy Clinic trigger a native success toast (e.g. save a contact note) and, if available, a warning/error toast and any sidebar badge.
expected: HighLevel's own success/warning/error colors and badges are visibly unchanged; only the sidebar container background/text and the active nav item are themed; no HighLevel rule is overridden by a customizer rule.
result: [pending]

### 5. Rollback rehearsal via tag change
test: Rollback rehearsal (SC3): change the tag in both snippet URLs to v0.0.0, save, reload; then restore v0.1.0 and reload.
expected: At v0.0.0 the script 404s and the page is fully native (no buttons, native logo, native sidebar, no console errors beyond the 404). At v0.1.0 everything returns exactly as before. Nothing but the tag changed.
result: [pending]

### 6. Kill switch: snippet removal leaves no leftovers
test: Kill switch (SC3/FND-06): remove the snippet entirely, save, reload.
expected: Native UI with no leftovers: no .ghlc-group, no data-ghlc-theme, no --ghlc-* inline properties, no ghlc-logo class, no storage/cookies.
result: [pending]

### 7. Harness walkthrough (a)-(g)
test: Harness walkthrough (03-01 human-check): npm run serve; open http://localhost:5173/test/harness.html?ghlc-debug=1 and step (a) Agency dashboard, (b) Location A Dashboard, (c) Location A Contact X, (d) Location B Contact Z, (e) Location Z / Agency, (f) back on A press Toggle active nav item / Replace whole sidebar / Collapse-expand, (g) inspect the harness's own controls.
expected: (a) native dark sidebar, no marker, theme.applied ['primary'], observers.theme false. (b) sidebar #1f2937 / #f9fafb, Dashboard item #374151, orange #c2410c buttons with white text, theme.applied all four, theme.navActive 1. (c) Contacts item highlighted, Dashboard not; Send Invite orange. (d) sidebar white with #101828 text (fallback), active item #e5e7eb, teal #0f766e buttons; theme.fallback true, theme.ignored 1. (e) native sidebar, no marker. (f) after each press exactly one highlighted item, colors kept, exactly one 'retheme' log per press. (g) webhook stub radios, log, banner keep native harness colors.
result: [pending]

### 8. D-06 originality judgment (README vs reference repo)
test: D-06 judgment prohibition (DLV-01): skim README.md against the reference project's README (https://github.com/dachi-khelashvili/ghl-customizer, revision ff7c8e4).
expected: No copied prose, installation steps, or configuration examples; the reference is named only in NOTICE.md.
result: [pending]

### 9. Release decision: tag v0.1.1 for WR-01 drift
test: Release decision (WR-01 drift): decide whether to tag v0.1.1 from HEAD 6d357f1 so the served script matches the README.
expected: Served v0.1.0 JS (byte-identical to tag a6ab42c) does NOT contain the WR-01 rule that drops navActive without an applied sidebarText, while README@HEAD line 107 documents that rule. A v0.1.1 tag per README 'Releasing a new version' closes the drift; until then any config that sets navActive without sidebarText gets an unchecked nav color on v0.1.0. The shipped sample sets all four tokens and is unaffected.
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

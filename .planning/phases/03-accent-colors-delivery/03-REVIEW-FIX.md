---
phase: 03-accent-colors-delivery
fixed_at: 2026-09-25T02:06:00Z
review_path: .planning/phases/03-accent-colors-delivery/03-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-09-25T02:06:00Z
**Source review:** .planning/phases/03-accent-colors-delivery/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (fix_scope: all; 0 critical, 1 warning, 2 info)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `navActive` contrast guard documented as unconditional but only runs when `sidebarText` is applied

**Files modified:** `src/ghl-customizer.js`, `README.md`, `test/run.mjs`
**Commit:** a59b132
**Status:** fixed: requires human verification (behavior change in a readability rule; syntax and the 119-scenario suite pass, but the rule's intent should be confirmed by the developer)
**Applied fix:** Took the review's first option (enforce the pairing) rather than documenting the gap. In `resolveTheme`, a new rule directly after the existing `sidebarText`-without-`sidebarBg` rule drops `navActive` when no `sidebarText` survives, recording `{ scope, token: 'navActive', reason: 'unpaired' }` in `ignored` (so `verify().theme.ignored` and the `theme-token-ignored` diagnostic report it). Placing it after rule 1 means a `navActive` orphaned by a dropped `sidebarText` is caught too. The later contrast check no longer needs its `tokens.sidebarText &&` guard because the new rule guarantees the invariant, so it was simplified. The `resolveTheme` doc comment was renumbered to five rules, and the head-comment `Theme` schema now states that `sidebarText` applies only with `sidebarBg` and `navActive` only with an applied `sidebarText`. README theme-token table: `navActive` is "Only applied together with `sidebarBg` and `sidebarText` ...; dropped when its contrast against the applied sidebar text is below 4.5:1" (keeps the `4.5:1` string the static README gate pins). Coverage: extended the existing scenario `theme: sidebarText requires sidebarBg and a pair below 4.5:1 falls back to the safe default text` with two blocks in the existing `unpaired` style: (a) a location theme of only `navActive` -> nothing written on the sidebar, no nav item marked, `resolveTheme.ignored` is exactly the one `unpaired` navActive entry, `verify().theme` is `{ root: true, applied: ['primary'], navActive: 0, ignored: 1, fallback: false }`, no theme observer, one `theme-token-ignored` log with `token: 'navActive'` and `reason: 'unpaired'`, no color leak in the console; (b) `sidebarText` + `navActive` with no `sidebarBg` -> both reported `unpaired` in rule order and only the agency primary survives. No existing assertion was weakened; no shipped fixture or sample config hits the new rule (the sample gate `the sample theme has no ignored token` still passes).

### IN-01: Release steps understate where the version tag lives

**Files modified:** `README.md`
**Commit:** 22a08db
**Applied fix:** Step 2 of "Releasing a new version" now lists every location that carries the version: `"version"` in `package.json`; the `VERSION` constant, head-comment `Version` line, and the tag in `DEFAULT_CONFIG_URL` in `src/ghl-customizer.js`; both logo URLs in `config/agency-config.json`; and every jsDelivr URL in the README (install snippets and the example location entry). It gives `grep -rn 'ghl-admin-theme@v' README.md config src` to find every tagged URL (chosen over the review's `@v0\.` so it still works after a major bump) and states that `npm test` checks all of them against `package.json`. Step 4 was also made version-agnostic ("with its tag replaced by the new one" instead of a literal `@v0.1.0`) so the release steps cannot drift at the next bump.

### IN-02: Verify-mode `mounts` description omits `contactMountVia` and calls every key a boolean

**Files modified:** `README.md`, `src/ghl-customizer.js`
**Commit:** a88d3de
**Applied fix:** The README `mounts` bullet under "Verify mode" now adds `contactMountVia`: "a string naming the contact-mount strategy that resolved (`toolbar-anchor` or `selector`), or `null` when neither did" (values confirmed against `contactMountVia()` in the adapter and the existing verify-report assertions). The `probe()` head comment in the source, which made the same "only true/false" claim, was corrected to say booleans plus that strategy name; no behavior change.

## Skipped Issues

None.

## Verification

- Each fix: Tier 1 re-read of the changed region; Tier 2 `node -c src/ghl-customizer.js` and `node --check test/run.mjs` (where touched); then the project gate `node test/run.mjs` after every fix, ending `PASS 119/119` with zero `not ok` lines each time (the suite has static gates over README and source text, so README-only fixes were also gated).
- Verification ran inside an isolated git worktree (`.claude/worktrees/rf-03-97331-1790301641`, branch `gsd-reviewfix/03-97331`, created from `main` at `9aa973b`) with no `node_modules` (the project has no dependencies, so this is the same environment as the main checkout). The temp branch was fast-forwarded into `main` on cleanup; re-run `node test/run.mjs` in the main checkout to reproduce.
- Nothing was pushed; the published `v0.1.0` tag was not touched. The three fix commits are on `main` after the tag.

---

_Fixed: 2026-09-25T02:06:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

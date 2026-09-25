---
phase: quick-260925-cf3
plan: 01
subsystem: config
tags: [config, jsdelivr, release, xcelsior-health, highlevel, tests]

# Dependency graph
requires:
  - phase: 03-colors-delivery
    provides: tag-pinned jsDelivr delivery, theme tokens, the sample config as the production config (DLV-02), the version-consistency suite gates
provides:
  - Xcelsior Health location entry (Cp2XxBsRoyKS2CUf1Hwi) in the shipped sample config, using the logo HighLevel already hosts and a `primary` accent only
  - Suite gates that accept any credential-free https location logo while keeping the Dummy Clinic fixture tag-pinned, rejecting floating jsDelivr refs, and checking the stylesheet header version
  - Release v0.1.2 (annotated tag on origin) verified byte-for-byte on jsDelivr
affects: [per-client onboarding, HighLevel snippet switch to v0.1.2, next release]

# Actuals (#2632) — chars/4 over the realized diff (git diff 534c340..d8f6719), not a harness token count.
actuals:
  tokens: 4778
  tasks: 3
  commits: 2
plan_head_before: 534c3406e442f05f2b38d6982865f91722da2aa1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Location logos may be any credential-free https URL; only jsDelivr-hosted logos must be pinned at the published slug and TAG"
    - "A location with an opaque-background logo sets theme.primary only, so the native sidebar carries zero theme footprint"

key-files:
  created: []
  modified:
    - config/agency-config.json
    - test/run.mjs
    - README.md
    - package.json
    - src/ghl-customizer.js
    - src/ghl-customizer.css

key-decisions:
  - "Xcelsior Health reuses the logo HighLevel hosts for the location (msgsndr-private.storage.googleapis.com) instead of a repository fixture; the config gate pins the sample host to that bucket"
  - "Xcelsior Health sets theme.primary #2d3e50 only (logo is opaque white), leaving the native white sidebar untouched"
  - "The suite's version-consistency gate now also checks the stylesheet head-comment version, so README step 2's claim covers every bump site"
  - "v0.1.2 released; v0.1.1 (1076b44) untouched, so rollback is a snippet tag change only"

patterns-established:
  - "Sample config gate: Rule A (Dummy Clinic) fixture tag-pinned; Rule B (every location) isSafeHttpsUrl plus jsDelivr-must-start-with-CDN"

requirements-completed: [DLV-01, DLV-02, DLV-04]

coverage:
  - id: D1
    description: "config/agency-config.json ships Dummy Clinic (unchanged, logo at @v0.1.2) and Xcelsior Health (Cp2XxBsRoyKS2CUf1Hwi, HighLevel-hosted https logo, theme.primary #2d3e50 only); no REPLACE_WITH_LOCATION_ID placeholder remains anywhere"
    requirement: DLV-02
    verification:
      - kind: unit
        ref: "npm test # config: both JSON files parse, validate, use HTTPS webhooks, and carry no secret-like keys"
        status: pass
      - kind: integration
        ref: "npm test # sample: the shipped config boots at Dummy Clinic ... (now also navigates to the Xcelsior Health dashboard)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every jsDelivr URL in README, config, and src pins v0.1.2; package.json, VERSION, head-comment Version, and stylesheet header all say 0.1.2"
    requirement: DLV-01
    verification:
      - kind: unit
        ref: "npm test # static: DEFAULT_CONFIG_URL slug and tag match package.json and VERSION; readme: every jsDelivr URL pins TAG"
        status: pass
      - kind: other
        ref: "grep -rnoE 'ghl-admin-theme@v[0-9]+\\.[0-9]+\\.[0-9]+' README.md config src -> 7 matches, all @v0.1.2"
        status: pass
    human_judgment: false
  - id: D3
    description: "jsDelivr serves src/ghl-customizer.js, src/ghl-customizer.css, config/agency-config.json, and test/fixtures/logos/loc-a.svg at @v0.1.2 sha256-identical to git tag v0.1.2"
    requirement: DLV-01
    verification:
      - kind: other
        ref: "Task 3 verify block: curl + shasum -a 256 vs git cat-file -p v0.1.2:<path> for all four files -> TAG-SERVED-AND-BYTE-IDENTICAL"
        status: pass
    human_judgment: false
  - id: D4
    description: "Diagnostics never carry the new logo URL or color (SAMPLE_LEAKS extended with Xcelsior, #2d3e50, msgsndr, googleapis, locationPhotos)"
    requirement: DLV-04
    verification:
      - kind: integration
        ref: "npm test # sample: ... assertNoLeak(shim.console.lines, SAMPLE_LEAKS, 'sample')"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live HighLevel: after switching both snippet URLs to @v0.1.2, the Xcelsior Health location shows its hosted logo, navy #2d3e50 buttons, and an unthemed native sidebar"
    requirement: DLV-02
    verification: []
    human_judgment: true
    rationale: "The HighLevel snippet is not changed by this task; Rob switches it per README step 5 and runs GHLC.verify() at the Xcelsior Health location"

# Metrics
duration: 9min
completed: 2026-09-25
status: complete
---

# Quick 260925-cf3: Add the Xcelsior Health location entry and release v0.1.2 Summary

**Xcelsior Health (Cp2XxBsRoyKS2CUf1Hwi) replaces the REPLACE_WITH_LOCATION_ID placeholder in the shipped config, using the logo HighLevel already hosts and a navy `primary` accent only; released as v0.1.2 and verified byte-identical on jsDelivr.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-09-25T13:05Z (approx.)
- **Completed:** 2026-09-25T13:14Z (approx.)
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- `config/agency-config.json` now ships exactly two locations: Dummy Clinic (byte-identical apart from its logo tag, now `@v0.1.2`) and Xcelsior Health with `name`/`logoAlt` "Xcelsior Health", `logoUrl` `https://msgsndr-private.storage.googleapis.com/locationPhotos/096434c9-83e6-42da-9644-8a93aed64980.png`, and `theme: { primary: "#2d3e50" }` only.
- `test/run.mjs` `config:` gate rewritten as Rule A (Dummy Clinic must be a tag-pinned repository fixture that exists) and Rule B (every location logo must pass `isSafeHttpsUrl`; any `cdn.jsdelivr.net/gh/` logo must start with `CDN`, so `@main`/`@latest`/untagged refs fail naming the location id); the sample host is pinned to `msgsndr-private.storage.googleapis.com/`; Xcelsior's theme keys deep-equal `['primary']`, `resolveTheme` reports no fallback and nothing ignored. Negative check performed: switching the Dummy Clinic URL to `@main` fails 2/119.
- Version-consistency gate now reads the first 400 chars of `src/ghl-customizer.css` and requires `version <pkgVersion>`.
- `sample:` scenario boots the Xcelsior Health dashboard: HighLevel-hosted logo at tier `location`, every group's `--ghlc-primary` is `#2d3e50`, no `data-ghlc-theme` marker and no `--ghlc-` sidebar property, `GHLC.verify().theme` = `{ root: true, applied: ['primary'], navActive: 0, ignored: 0, fallback: false }`, `branding.applied` = `location`. `SAMPLE_LEAKS` extended with `Xcelsior`, `#2d3e50`, `msgsndr`, `googleapis`, `locationPhotos`.
- README: sample description sentence, `locations[id].logoUrl` row, and release step 2 updated; all five jsDelivr URLs pin `@v0.1.2`.
- Version 0.1.2 across `package.json`, `VERSION`, the head-comment `Version` line, `DEFAULT_CONFIG_URL`, the stylesheet header, the Dummy Clinic logo URL, and the README (7 tag URLs total, no `0.1.1` remains in package.json, src/, config/, README.md).
- Annotated tag `v0.1.2` pushed to origin; `v0.1.1` still resolves to `1076b44985c406594f12d57dca8409478d5f9394`.

## Commits and tag

| Task | Commit | Message |
|------|--------|---------|
| 1 | `6874581` | feat(config): add Xcelsior Health location entry, drop the placeholder |
| 2 | `d8f6719` | chore(release): bump to v0.1.2 |
| 3 | (tag only) | `v0.1.2` annotated tag object `b395107d4d4225162a6f44f95921d89cce775ce4` -> commit `d8f67191f104a975df3d5bd797d8edaa62e3758e`; `git push origin main --tags` moved `main` 534c340..d8f6719 |

## jsDelivr verification (Task 3)

Polling command returned `200` on the first attempt (no purge needed).

| Path | HTTP | sha256 at tag `v0.1.2` | sha256 served by jsDelivr | Result |
|------|------|------------------------|---------------------------|--------|
| `src/ghl-customizer.js` | 200 | `74c1bdcfa0a01641b32ff9bb246f956a74cefe1330d14456732261fd78b8dd9a` | `74c1bdcfa0a01641b32ff9bb246f956a74cefe1330d14456732261fd78b8dd9a` | MATCH |
| `src/ghl-customizer.css` | 200 | `640e647d1aa88abe763ed86357cddf28e38aedb75682e6222f1fe22c7891b374` | `640e647d1aa88abe763ed86357cddf28e38aedb75682e6222f1fe22c7891b374` | MATCH |
| `config/agency-config.json` | 200 | `09131f0e144552ae32a3cc8e9b9447507187a273efca893cc90584d853af869f` | `09131f0e144552ae32a3cc8e9b9447507187a273efca893cc90584d853af869f` | MATCH |
| `test/fixtures/logos/loc-a.svg` | 200 | `c6ce069ce50db030d0b3d372c0efc3255ec854af770b5548f4885aafdd6752fd` | `c6ce069ce50db030d0b3d372c0efc3255ec854af770b5548f4885aafdd6752fd` | MATCH |

Served config parsed: `locations` has 2 keys; `locations.Cp2XxBsRoyKS2CUf1Hwi.theme.primary` = `#2d3e50`; Dummy Clinic logo URL pins `@v0.1.2`. The plan's full Task 3 verify block printed `TAG-SERVED-AND-BYTE-IDENTICAL`.

Final `npm test`: `PASS 119/119` (count unchanged; checks were modified, none added or removed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] README line 35 prose still named the `v0.1.1` tag**
- **Found during:** Task 2
- **Issue:** The paragraph explaining the jsDelivr URL anatomy ends "The install URLs above are that pattern filled in with this repository and the `v0.1.1` tag." After the bump the install URLs above read `@v0.1.2`, so the sentence was untruthful, and it also tripped the plan's own Task 2 gate (`! grep -rn '0\.1\.1' package.json src config README.md`). The plan's list of bump sites missed this prose reference.
- **Fix:** Changed that single backticked value to `v0.1.2`. No other text touched.
- **Files modified:** README.md
- **Commit:** `d8f6719`

Everything else executed exactly as written.

## Auth gates

None.

## Known Stubs

None. `agency.logoUrl` is intentionally `""` (native fallback, unchanged from Phase 2/3).

## Remaining manual step (not in this plan)

Rob switches both HighLevel snippet URLs (`src` and `data-config`) from `@v0.1.1` to `@v0.1.2` per README "Releasing a new version" step 5, then opens the Xcelsior Health location and runs `GHLC.verify()` in the console: expect `branding.applied === 'location'` and `theme.applied` equal to `['primary']`. Rollback, if ever needed, is pointing the snippet back at `@v0.1.1`; `v0.1.2` is never moved.

## Threat Flags

None. The only new trust-boundary surface (the HighLevel-hosted logo host) is already registered as T-Q1-01 in the plan's threat model and is pinned by the `config:` gate.

## Self-Check: PASSED

- FOUND: config/agency-config.json, test/run.mjs, README.md, package.json, src/ghl-customizer.js, src/ghl-customizer.css
- FOUND: commit 6874581, commit d8f6719, tag v0.1.2 on origin
- FOUND: jsDelivr 200 for all four paths, sha256 MATCH x4
- FOUND: npm test PASS 119/119

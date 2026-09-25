---
phase: "03"
slug: "accent-colors-delivery"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-25"
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| config JSON -> CSS custom properties | Public config strings become inline style property values on the sidebar and on script-owned groups | Color strings (public, low sensitivity) |
| HighLevel DOM -> script | The sidebar container and its nav items are HighLevel's; writes are custom properties plus one data attribute, reversible, never structural | DOM attributes only |
| stylesheet -> page | Selectors decide what the theme can touch; every selector carries a ghlc marker | Styling only |
| sidebar mutations -> script | HighLevel re-renders the sidebar; the theme observer re-applies without loops or accumulation | Mutation records |
| GitHub public repo -> the world | Everything tracked (code, config with the webhook trigger URL, .planning/ notes) is world-readable | Public code and config; the Inbound Webhook trigger URL (accepted, see AR-03-01) |
| jsDelivr -> HighLevel page | A CDN-served script runs in every staff session; the pinned tag decides what runs | Executable script and stylesheet |
| README -> admin | Instructions the admin follows verbatim | Install snippet and URLs |
| sample config -> browser | Public JSON the script fetches and acts on | URLs it requests, colors it applies |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering | config color strings reaching style (`parseColor`, `applyGroupTheme`, `applySidebarTheme`) | high | mitigate | `parseColor` accepts only `HEX_COLOR_RE` matches and returns a normalized `#rrggbb`; that value is the only thing passed to `style.setProperty` (`src/ghl-customizer.js` ~556, ~1869); no style text is ever generated | closed |
| T-03-02 | Tampering | stylesheet selectors restyling native HighLevel UI | high | mitigate | Static suite check "every stylesheet selector is ghlc-scoped and nothing is marked important" (`test/run.mjs` 215); zero `!important` in `src/ghl-customizer.css`; the v0.1.1 specificity boost uses `:not(#ghlc-boost)` pseudo-classes under the same markers; CLR-04 scenario; live UAT test 4 confirmed native badges and toasts untouched | closed |
| T-03-03 | Spoofing | previous location's colors persisting after a switch | medium | mitigate | `renderTheme` reconciles synchronously; unset tokens are removed with `removeProperty` and marker removal (~1873, ~1903-1923); live UAT test 3 confirmed no marker or inline property on an unconfigured location | closed |
| T-03-04 | Denial of Service | theme observer churn or unbounded waits | medium | mitigate | One observer with scoped `attributeFilter` registrations (~2265), coalesced retheme, bounded `waitForMount('theme')` (~1990), zero `setInterval`; harness walkthrough showed exactly one retheme per mutation | closed |
| T-03-05 | Information Disclosure | diagnostics or `verify()` leaking color values | low | mitigate | `safe()` passes only booleans, numbers, and whitelisted strings (~136); scenarios "verify: theme report shape and hygiene" and "logs: theme diagnostics never contain color values or the sidebar selector" | closed |
| T-03-06 | Tampering | unreadable UI from a valid-looking config | medium | mitigate | `MIN_CONTRAST = 4.5`, `contrastRatio`, `pickReadableText` (~77, ~1844, ~1854); unpaired tokens dropped; v0.1.1 also keeps hovered items readable under a themed text color | closed |
| T-03-07 | Tampering | prototype-named theme keys or location IDs | low | mitigate | `locationEntry` guards with `isPlainObject` and `hasOwn` (~512); `constructor` / `__proto__` units | closed |
| T-03-08 | Elevation of Privilege | theme applied to an element the adapter did not identify | low | mitigate | `findNavActive` returns only matches of `selectors.sidebarNavActive`; the live check corrected the list to `#sidebar-v2 nav a.exact-active` / `a.active` (v0.1.1) and verify reports exactly one marked item | closed |
| T-03-09 | Information Disclosure | webhook trigger URL and `.planning/` notes in a public repository | medium | mitigate | Accepted knowingly at the blocking-human publish checkpoint (AR-03-01); README "Security notes" documents rotation; `SECRET_KEY_RE` gate keeps tokens, keys, and passwords out of both JSON files | closed |
| T-03-10 | Tampering | jsDelivr supply chain via a mutable ref | high | mitigate | Every jsDelivr URL in README, config, and `DEFAULT_CONFIG_URL` is pinned to `@v0.1.1`; suite ties them to `package.json`; tags v0.1.0 and v0.1.1 are immutable and never moved; README forbids floating refs | closed |
| T-03-11 | Information Disclosure | unintended files pushed to the public repo | medium | mitigate | `git ls-files docs/ .gsd/ .planning/state.json .planning/milestone.lock` is empty at HEAD; tree clean | closed |
| T-03-12 | Denial of Service | wrong slug or tag in the snippet leaves the customizer silently absent | low | mitigate | jsDelivr returns 200 for the v0.1.1 script, stylesheet, and config, byte-identical to the tag; UAT test 5 proved a 404 (v0.0.0) leaves the native UI intact | closed |
| T-03-13 | Spoofing | sample logo URLs on a third-party host | low | mitigate | Sample logos are the repository's own SVGs under `test/fixtures/logos/` at the tag; `isSafeImageUrl` and `referrerpolicy="no-referrer"` (~480, ~1611, ~1667) | closed |
| T-03-14 | Elevation of Privilege | README instructing the admin to paste arbitrary code or widen action types | low | mitigate | README states config never executes code, lists the three action types and the handler allowlist, contains no `innerHTML`; the install snippet loads only the pinned script | closed |
| T-03-SC | Tampering | npm/pip/cargo supply chain | high | mitigate | `package.json` declares zero dependencies and zero devDependencies; no `node_modules`; tests use `node:` builtins only | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-09 | The Send Invite Inbound Webhook trigger URL and the `.planning/` history are world-readable in the public repository. Staff-only tool; anyone holding the URL can enqueue the workflow but cannot read data. Rotation procedure is in README "Security notes" (regenerate the trigger in HighLevel, update the config, tag, update the snippet). | Rob Parker (blocking-human checkpoint, 03-02 Task 2) | 2026-09-25 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-25 | 15 | 15 | 0 | /gsd-secure-phase 3 (Claude, L1 grep-depth; register authored at plan time; live UAT evidence in 03-UAT.md) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-25

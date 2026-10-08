# Phase 4: Actions Menu - Context

**Gathered:** 2026-10-07
**Status:** Ready for planning
**Source:** Rob's decisions captured during /gsd-explore and /gsd-new-milestone. Not re-asked, per Rob.

<domain>
## Phase Boundary

Admin-theme code, tests, config, and README only (`src/ghl-customizer.js`, `src/ghl-customizer.css`, `config/agency-config.json`, `test/run.mjs`, `test/harness.html`, `test/dom-shim.mjs`, `README.md`). This phase does **not** build anything in ClinX 365 or n8n and does **not** bump the version or tag (Phase 6).
</domain>

<decisions>
## Implementation Decisions

### Menu model
- **D-01:** `menus[]` is a new top-level config array beside `buttons[]`. Entry: `id`, `label`, `icon`, `placement: "contact"` (contact placement is the only one required this milestone), `scope`, `items[]`. Each item is a normal button definition (`id`, `label`, `icon`, `action`, optional `scope`). Item ids share the `buttons[]` id namespace and must be unique across both.
- **D-02:** Per-location overrides work per item through the existing `locations[id].buttons[itemId]` map (false hides; object overrides). A menu whose visible item list is empty is not rendered.
- **D-03:** A config with only `buttons[]` renders byte-for-byte as in v0.1.2 (same DOM, same states, same observer count).

### Rendering and accessibility
- **D-04:** Render inside the existing `.ghlc-group` in the contact name row (mount next to `#delete-contact-trigger`, through `adapter`). Trigger is a native `<button>` labelled "Actions" with `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`. Panel is a container with `role="menu"` holding native `<button role="menuitem">` items. Build with DOM APIs only (no HTML strings).
- **D-05:** Keyboard: Enter, Space, or ArrowDown on the trigger opens it and focuses the first enabled item. ArrowUp and ArrowDown wrap. Home and End jump. Esc closes and returns focus to the trigger. Tab closes (focus moves on naturally). Disabled (unavailable) items stay focusable, use `aria-disabled="true"`, and are skipped on activation, not on navigation.
- **D-06:** Closes on outside pointer down, item activation, Esc, Tab, SPA navigation, and contact change (the existing generation counter path). Only one document-level listener exists while open, and it is removed on close.
- **D-07:** The panel must not be clipped by the name row: absolutely positioned relative to the group, with overflow tests in the suite (and a harness control). CSS stays scoped with the `ghlc-` prefix and no `!important`.
- **D-08:** The panel lives inside `.ghlc-group` so `isOwnNode` ignores its mutations. If it ever needs to live elsewhere, extend `isOwnNode` and prove there is no re-render loop. Observer count is unchanged from v0.1.2.

### States, cooldown, feedback
- **D-09:** Each item reuses the v0.1.2 webhook pipeline unchanged in spirit: ready, Sending..., Workflow triggered (or queued/unconfirmed), Failed, unavailable. Per-item cooldown is keyed by `ctxKey() + '|' + itemId`, exactly like buttons.
- **D-10:** Cooldown is **60 s** for every webhook item, set via `cooldownMs: 60000` in config (Send Invite moves from 10 s to 60 s).
- **D-11:** The result shows briefly on the trigger button (for example "Actions · Workflow triggered") and is announced through the existing screen-reader status span, so staff see it after the menu closes.

### Items (Xcelsior only, location `Cp2XxBsRoyKS2CUf1Hwi`)
- **D-12:** One menu `xcelsiorActions` scoped to `Cp2XxBsRoyKS2CUf1Hwi`, with items in this order:
  1. `sendInvite`: "Send Invite". The existing webhook to trigger `bde416ab-a074-4946-bf99-7266eb1b0f4e`, payload unchanged.
  2. `send-individual-consent`: "Send individual consent". Webhook to the NEW consent Inbound Webhook (URL not yet known; see D-15).
  3. `resend-consent-hub`: "Resend Consent Hub link". Same consent webhook.
  4. `copyContactId`: "Copy contact ID". Handler `copyContactId`.
- **D-13:** The Send Invite plain button leaves `buttons[]` (it moves into the menu). This fixes the `scope: "all"` bug: nothing Xcelsior-specific renders at other locations. Header link buttons (Help Center) are untouched.
- **D-14:** Payload is unchanged from v0.1.2 (`contactId, locationId, buttonId, requestId, sentAt, email, phone` plus `extraFields`). `buttonId` is the item id. No new fields, so Rob does not need to re-send a trigger sample.
- **D-15:** The consent webhook URL does not exist yet (Rob builds it in Phase 5). Phase 4 ships the two consent items with an empty `url`, which must render as **unavailable** ("Not configured") using the existing webhook-unavailable path. It must never POST anywhere. Phase 6 fills the real URL.
- **D-16:** Pre-check: "Send individual consent" is unavailable, with reason "Needs the member's own email", when the record's email field is empty or matches the synthetic dedupe pattern `/\+\d+@/`. Implement it as an optional per-item config rule (for example `"requires": { "email": "real" }`), not a hardcoded id check, so it stays configuration-driven. It re-evaluates when the email field changes, using the existing unavailable/recover mechanism.

### Static rules (must keep passing)
- **D-17:** All HighLevel selectors stay in `adapter`. No HTML strings, eval, storage, or cookies. `ghlc-` prefix. Scoped CSS with no `!important`. ES2019 only (no `?.` or `??`). Logging only through `safe()`. Keep the generation counter and the click-time URL recheck. Prefer fitting the code into the existing ten sections. If an eleventh section is needed, update the "ten section markers" test deliberately.

### Claude's Discretion
- Exact panel styling (reuse the button group tokens/primary color), icon choice, the wording of the trigger flash, and internal function names.
- Whether `menus[]` items are normalized into the same internal button records the renderer already uses (preferred, to maximize reuse).
</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md`: MENU-01..08, ITEM-01..07, REL-01, REL-04
- `.planning/notes/actions-menu-individual-consent.md`: Rob's decisions
- `.planning/notes/webhook-test-workflow-audit.md`: the live Send Invite workflow (Find Contact by payload `contactId`)
- `src/ghl-customizer.js`: `resolveAction` (~1026), `setState` (~1058), `renderPlacement` (~1185), webhook send (~1275-1355), `findContactMount` (~257), `watchMount`/`isOwnNode` (~2108)
- `test/run.mjs`, `test/harness.html`, `test/dom-shim.mjs`: the zero-dependency suite (119 checks) and offline harness
- `README.md`: config documentation and the "Releasing a new version" checklist (not run in this phase)
- `.planning/milestones/v0.1.0-phases/`: Phase 1-3 plans and summaries (patterns, security notes, AR-03-01)
</canonical_refs>

<deferred>
## Deferred Ideas

- Server-side dedupe, n8n routing, INV-01..05, and the Longevity Plus item (`seeds/consent-actions-hardening.md`)
- Header-placement menus
- Hiding items by role or contact fields beyond the email pre-check
</deferred>

---
*Phase: 04-actions-menu*

---
phase: 04-actions-menu
plan: 03
subsystem: config
tags: [config, sample-config, harness, readme, docs, xcelsior]

requires:
  - phase: 04-actions-menu (Plans 04-01, 04-02)
    provides: menus[] widget, per-item outcomes and cooldowns, D-15 "Not configured", D-16 requires rule, verify().config.menuIds
provides:
  - Shipped Xcelsior-only `xcelsiorActions` menu in config/agency-config.json (Send Invite, Send individual consent, Resend Consent Hub link, Copy contact ID)
  - Send Invite no longer renders at every location (the v0.1.2 `scope: "all"` bug is fixed); same URL and payload, 60 s cooldown
  - Headless proof of every shipped item against the exact served file
  - Offline harness menu at Location M with the D-07 name-row control and a mutation-free synthetic-email toggle
  - README documentation of menus[], requires, "Not configured", the keyboard/close model, and the consent item IDs
affects: [Phase 5 consent workflow (branches on buttonId send-individual-consent / resend-consent-hub), Phase 6 release (fills the consent URL, bumps the version and tags)]

actuals:
  tokens: 8873
  tasks: 2
  commits: 2
plan_head_before: a804f43addaf39e297789e8b8895299df618de00

tech-stack:
  added: []
  patterns:
    - "Shipped-config scenarios boot the exact served JSON (sampleText); a Phase 6 URL is simulated by cloning the sample and substituting a /hooks/ URL the shim intercepts"
    - "Checks that must prove a buttons-only config delete `menus` from a loaded fixture copy instead of relying on the fixture shape"

key-files:
  created: []
  modified:
    - config/agency-config.json
    - test/fixtures/config.json
    - test/harness.html
    - README.md
    - test/run.mjs

key-decisions:
  - "The harness synthetic-email toggle flips Contact S (whose own address is already synthetic) to a stand-in real address, member@example.test, so the toggle works in both directions on every Location M contact"
  - "Two Plan 04-02 unit checks (validateConfig 'buttons-only fixture validates' / 'buttons-only messages unchanged', and resolveMenus 'a config without menus') still passed with the new fixture but no longer proved what their labels said; they now delete `menus` from a loaded copy, and resolveMenus gained an assertion that the fixture menu is locM-only"

requirements-completed: [ITEM-01, ITEM-02, ITEM-03, ITEM-04, ITEM-05, ITEM-06, ITEM-07, MENU-05, REL-01, REL-04]

coverage:
  - id: D1
    description: "Shipped config: one Xcelsior-only Actions menu with the four D-12 items in order; buttons hold only helpCenter; consent urls ''; Send Invite URL unchanged with 60 s cooldown"
    requirement: ITEM-01
    verification:
      - kind: unit
        ref: "test/run.mjs#config: both JSON files parse, validate, use HTTPS webhooks, and carry no secret-like keys"
        status: pass
    human_judgment: false
  - id: D2
    description: "Xcelsior contact record: menu is the contact group's only element; Send Invite posts the unchanged eight-key payload to the bde416ab URL and cools down 60 s; consent items never POST; Copy contact ID copies c1"
    requirement: ITEM-02
    verification:
      - kind: integration
        ref: "test/run.mjs#sample: an Xcelsior contact record shows one Actions menu with the four items in order; Send Invite posts the unchanged payload and cools down 60 s"
        status: pass
    human_judgment: false
  - id: D3
    description: "With a consent URL filled in: both consent items post the standard payload with their own buttonId; empty, synthetic, or missing email disables only Send individual consent"
    requirement: ITEM-03
    verification:
      - kind: integration
        ref: "test/run.mjs#sample: with the consent URL filled in, both consent items post the standard payload with their own buttonId, and a synthetic email disables only Send individual consent"
        status: pass
    human_judgment: false
  - id: D4
    description: "No Xcelsior action at Dummy Clinic, an unconfigured location, or agency pages; Help Center unchanged"
    requirement: ITEM-01
    verification:
      - kind: integration
        ref: "test/run.mjs#sample: the shipped config boots at Dummy Clinic with its logo override, theme, and header link, and no contact actions"
        status: pass
      - kind: integration
        ref: "test/run.mjs#sample: no Xcelsior action renders at any other location or at agency level (D-13)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Harness fixture: Location M renders the harnessActions menu (working, Not configured, requires-real-email, copy) after the scope-all plain buttons; Location A has no menu; the fixture outside menus is byte-identical to v0.1.2"
    requirement: REL-01
    verification:
      - kind: integration
        ref: "test/run.mjs#harness fixture: Location M shows the harness Actions menu and the fixture's other locations render as before"
        status: pass
      - kind: unit
        ref: "test/run.mjs#harness: test/harness.html carries the required HighLevel shell, router hook, config, and stub"
        status: pass
      - kind: integration
        ref: "test/run.mjs#menu D-03: a buttons-only config renders byte-for-byte as v0.1.2"
        status: pass
    human_judgment: false
  - id: D6
    description: "README documents menus[], requires, Not configured, keyboard/close model, overrides, xcelsiorActions, consent item IDs, menuIds; eleven H2s and v0.1.2 pins kept"
    requirement: REL-04
    verification:
      - kind: unit
        ref: "test/run.mjs#readme: README.md documents install, hosting, config schema, and rollback with tag-pinned jsDelivr URLs"
        status: pass
    human_judgment: false
  - id: D7
    description: "In a browser, the open panel overlays the (tightened) name row without clipping; keyboard and visible focus behave as in the shim; synthetic-email toggle flips the consent item on reopen"
    requirement: MENU-05
    verification: []
    human_judgment: true
    rationale: "The shim has no layout or real focus model; the harness controls exist for Rob's end-of-phase check"

duration: 4min
completed: 2026-10-07
status: complete
---

# Phase 4 Plan 03: Ship the Xcelsior Actions Menu Summary

**The public config now ships one Xcelsior-only "Actions" menu with Send Invite, Send individual consent, Resend Consent Hub link, and Copy contact ID. Send Invite no longer appears at every location. It keeps the same trigger URL and payload and now has a 60 s cooldown. The two consent items stay "Not configured" until Phase 6 fills in their URL. Headless tests check every item against the exact file that is served, the offline harness has a menu to try at Location M, and the README documents `menus[]` and the two consent `buttonId` values.**

## Performance

- **Duration:** about 4 min
- **Started:** 2026-10-08T01:12:52Z
- **Completed:** 2026-10-08T01:16:30Z
- **Tasks:** 2 (2 commits)
- **Files modified:** 5
- **Suite:** `node test/run.mjs` and `npm test` both print `PASS 158/158`. That is the 154 from Plan 04-02 plus 3 new sample scenarios and 1 harness fixture scenario; edited checks keep their count.

## Accomplishments

- **config/agency-config.json:**
  - `buttons` is now just `[helpCenter]`, unchanged.
  - New `menus[0]` is `xcelsiorActions` (label "Actions", icon `menu`, placement `contact`, scope `["Cp2XxBsRoyKS2CUf1Hwi"]`), with items in D-12 order:
    - `sendInvite`: the same `bde416ab` URL, `cooldownMs` 60000, `source` ghl-customizer.
    - `send-individual-consent`: `url ""`, plus `requires { email: real }`.
    - `resend-consent-hub`: `url ""`.
    - `copyContactId`: handler.
  - `agency` and `locations` are byte-identical to before.
- **Config check:**
  - Every webhook URL, on plain buttons and menu items, must be `''` or https.
  - It also pins the menu shape, order, labels, URLs, cooldowns, `extraFields`, `requires`, the copy action, and that no item has a `placement`. Every sample button must also not be a contact button.
- **Sample scenarios:**
  - The Dummy Clinic scenario now asserts there are no contact actions there (header group only; `buttonIds ['helpCenter']`, `menuIds ['xcelsiorActions']`).
  - **Xcelsior record:** the menu is the contact group's only element. Enter opens it. Send Invite posts the eight-key payload to the unchanged URL and is still queued at 59 999 ms, then ready at 60 000 ms. Clicking either consent item sends nothing. Copy contact ID puts `c1` on the clipboard and shows "Actions · Contact ID copied".
  - **Consent URL filled in** (simulates Phase 6): Resend Consent Hub link posts `buttonId: resend-consent-hub`. Send individual consent posts `buttonId: send-individual-consent` with Jane's email. It is unavailable for a synthetic email and for a phone-only contact.
  - **Other location and agency page:** no menu, none of the four item ids, and Help Center still in the header.
- **Fixture:** a `harnessActions` menu scoped to `locM`, with items `menuInvite`, `menuConsent` (requires a real email), `menuHub` (empty url), and `menuCopy`. Without its `menus` key the fixture is deep-equal to the v0.1.2 fixture.
- **Harness:**
  - Two new navigation buttons for Location M: Contact X and Contact S. Contact S has the synthetic email `owner+12@example.test`.
  - An "Actions menu" control row:
    - `hx-clip-name-row` toggles `.hx-tight`, which shrinks the name row to 24px with a tint.
    - `hx-synthetic-email` changes only the email input's `value` property, which causes no DOM mutation.
  - A banner sentence explaining the menu.
- **README:**
  - New `menus[]` table rows, including `menus[].items[].requires`.
  - Updated override, id, and icon rows.
  - The webhook bullet now explains "Not configured".
  - New `### Actions menu` section: where the menu appears, per-item states and cooldowns, keyboard and closing behavior, unavailable items, overrides, the `xcelsiorActions` JSON, and a consent item ID table.
  - The description of the shipped sample is updated.
  - The verify `config` bullet now lists `buttonIds` and `menuIds`.
  - A note about Location M under Local development.
  - Still exactly eleven H2s, and every jsDelivr URL is still pinned to v0.1.2.

## Task Commits

1. **Task 1: Ship the Xcelsior Actions menu and prove the shipped file headlessly:** `93c7e6b` (feat)
2. **Task 2: Harness menu at Location M, README docs, harness/readme/verify checks:** `d902571` (feat)

## Files Created/Modified

- `config/agency-config.json`: Send Invite moved into the `xcelsiorActions` menu; two consent items and Copy contact ID added.
- `test/fixtures/config.json`: the `harnessActions` menu (locM).
- `test/harness.html`: Location M navigation, contact cS, the two Actions menu controls, a harness-scoped `.hx-tight` CSS rule, and the banner sentence.
- `README.md`: the REL-04 documentation listed above.
- `test/run.mjs`:
  - The config check is rewritten for menus.
  - The Dummy Clinic scenario is rewritten, and 3 new sample scenarios plus 1 harness fixture scenario are added.
  - New constants `SAMPLE_XCELSIOR_CONTACT_PATH`, `SAMPLE_INVITE_URL`, `SAMPLE_ITEM_IDS`, `SAMPLE_ITEM_LABELS`, and `PAYLOAD_KEYS`.
  - Added readme and harness string requirements.
  - Verify `menuIds` is now `['harnessActions']`.
  - The buttons-only unit checks were made explicit.
  - The Phase 4 block comment is updated.

## Decisions Made

- The synthetic-email toggle flips Contact S, whose own address is already synthetic, to `member@example.test`. That way it works in both directions on every Location M contact. The plan's wording would have made it a no-op on Contact S.
- New sample scenarios sit right after the Dummy Clinic scenario and use the Phase 4 helpers declared later in the file (`same`, `menuParts`, `bootMenu`, `MENU_CONSENT_HOOK`, `assertNeedsReal`). This is safe because scenario bodies only run after the whole module has been evaluated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] Buttons-only unit checks silently changed meaning**
- **Found during:** Task 2
- **Issue:** Once the fixture carried `menus`, three checks still passed but no longer tested a buttons-only config: `validateConfig` "the buttons-only fixture validates" and "buttons-only messages unchanged", and `resolveMenus` "a config without menus". Their labels no longer matched what they tested.
- **Fix:** `delete base.menus` / `delete noMenus.menus` on a loaded copy, as the plan prescribes. Also added an assertion that `resolveMenus(fixture, 'locA')` is empty because the fixture menu is locM-only. The `menu D-03` snapshot already deleted `menus`, so it needed no change.
- **Files modified:** test/run.mjs
- **Commit:** `d902571`

**2. [Minor] The harness toggle has a real-address side for Contact S**
- See Decisions. This is harness-only and not covered by the shipped config or the suite.
- **Commit:** `d902571`

**3. [Minor] The README "What it does" paragraph mentions the Actions menu**
- It previously described only a plain "Send Invite" button on the contact record, which is no longer accurate for the shipped sample. It now mentions plain buttons or an Actions menu. The H2 set is unchanged.
- **Commit:** `d902571`

**Total deviations:** 3 (1 test-correctness fix, 2 small doc and harness refinements). **Impact:** None on runtime. `src/` and `package.json` are untouched.

## Issues Encountered

None. Every new scenario passed on its first run, and each edited check failed only where expected before its matching data or docs change: the Dummy Clinic contact group, verify `menuIds`, and readme "menus".

## Pending Human Verification (collected at phase end)

**Harness check (Task 2 `<human-check>`).** Run `npm run serve` and open `http://localhost:5173/test/harness.html?ghlc-debug=1`. Click "Location M · Contact X (Actions menu)" and confirm each of these:

1. **Placement:** one Actions button sits at the right of the name row.
2. **Panel overlay:** it opens a panel below the button that overlays the email field without being clipped. Check again after clicking "Tighten name row".
3. **Keyboard:** Enter, Space, and ArrowDown each open the menu. Arrows wrap, Home and End jump, and Esc and Tab close it. Esc returns focus to the trigger.
4. **Not configured:** "Resend hub link (harness)" shows as unavailable, with a "Not configured" tooltip.
5. **Send Invite:** "Send Invite (harness)" turns green, and the trigger reads "Actions · Workflow triggered" for a few seconds.
6. **Synthetic email:** "Send consent (harness)" is unavailable on "Location M · Contact S", and also on Contact X after "Toggle synthetic email (no mutation)" and reopening the menu.
7. **No menu elsewhere:** Location A contacts show no Actions menu.

**Live check (carried from 04-01 and 04-02).** On a live Xcelsior contact record, confirm the Actions menu renders in the name row and that the panel is not clipped. Once Phase 6 fills in the consent URL, also check the synthetic-email flip.

## Known Stubs

- `config/agency-config.json` ships `send-individual-consent` and `resend-consent-hub` with `"url": ""`. This is intentional (D-15): the consent Inbound Webhook does not exist until Rob builds it in Phase 5. **Phase 6 must put the real consent webhook URL on both items before the release commit and tag.** Until then both render "Not configured" and never POST, so neither the plan goal nor the user is blocked.

## Threat Flags

None. No new endpoint, auth path, or storage was added. T-04-15, T-04-16, T-04-17, T-04-19, and T-04-20 are mitigated as planned:
- The menu scope and the absence of any contact plain button are asserted.
- Both consent URLs are exactly `''`, and the test asserts that clicking them sends nothing.
- The secret-key scan covers the new keys.
- The buttonIds are pinned in config, README, and scenarios.
- The harness URLs all contain `/hooks/`, under the fake locM.

## User Setup Required

None for this plan. Phase 5 builds the consent workflow, which branches on `{{inboundWebhookRequest.buttonId}}` with the values `send-individual-consent` and `resend-consent-hub`.

## Next Phase Readiness

- **Phase 5:** the consent workflow can be built against the documented buttonIds and the standard payload (no new fields).
- **Phase 6:**
  - Fill in both consent item URLs in `config/agency-config.json`. The config check already accepts any https URL there.
  - Bump the version everywhere.
  - Tag the release.
  - Update the README pins.

---
*Phase: 04-actions-menu*
*Completed: 2026-10-07*

## Self-Check: PASSED

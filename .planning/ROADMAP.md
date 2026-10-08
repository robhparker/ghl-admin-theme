# Roadmap: GHL Customizer (admin-theme)

## Milestones

- ✅ **v0.1.0 GHL Customizer** — Phases 1-3 (shipped 2026-09-25, archived 2026-09-26) — [archive](milestones/v0.1.0-ROADMAP.md)
- 🚧 **v0.2.0 Actions menu + Send individual consent** — Phases 4-6 (in progress)

## Phases

<details>
<summary>✅ v0.1.0 GHL Customizer (Phases 1-3) — SHIPPED 2026-09-25</summary>

- [x] Phase 1: Foundation, Context & Workflow Buttons (3/3 plans) — completed 2026-09-24
- [x] Phase 2: Location Logo Switching (2/2 plans) — completed 2026-09-24
- [x] Phase 3: Accent Colors & Delivery (2/2 plans) — completed 2026-09-25
- Quick task 260925-cf3: Xcelsior Health location entry, released v0.1.2 — completed 2026-09-25

Full phase details, success criteria, and requirement mappings: `milestones/v0.1.0-ROADMAP.md`. Requirements (37/37 Complete): `milestones/v0.1.0-REQUIREMENTS.md`. Phase artifacts: `milestones/v0.1.0-phases/`.

</details>

### 🚧 v0.2.0 Actions menu + Send individual consent (In Progress)

**Milestone Goal:** From an Xcelsior contact record, staff open one Actions menu and send the Hint join link, a family member's own consent forms, or the owner's Consent Hub link (or copy the contact ID), each reaching exactly the open contact.

Three coarse phases. Phase 4 is the admin-theme code in this repo (menu, Xcelsior items, tests, README). Phase 5 produces the backend artifacts that live outside this repo: the ClinX 365 build spec for the consent Inbound Webhook workflow, the wf2/hub diffs in `~/Repos/clients/xcelsior/hint-api/`, and the member email MJML in `~/Repos/clients/xcelsior/Email-Templates/`. Phases 4 and 5 do not depend on each other and can run in either order. Phase 6 joins them: real consent webhook URL in config, version bump, live-test checklist with rollback to v0.1.2, then tag and push only after Rob approves.

- [ ] **Phase 4: Actions Menu** - Config-driven, keyboard-accessible Actions menu on Xcelsior contact records with four items, per-item state and 60 s cooldown, tests and README
- [ ] **Phase 5: Individual Consent Backend** - ClinX 365 consent workflow build spec, Send Invite workflow rename, wf2 member-scoped hub diff, and the member consent email MJML
- [ ] **Phase 6: Release v0.2.0** - Version bump, live-test checklist on a real Xcelsior owner and member, rollback to v0.1.2, tag and push after Rob's approval

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Numbering is continuous across milestones (v0.2.0 starts at Phase 4).

## Phase Details

### Phase 4: Actions Menu

**Goal**: On an Xcelsior contact record, staff open one "Actions" menu in the name row and fire any of four actions (Send Invite, Send individual consent, Resend Consent Hub link, Copy contact ID) by mouse or keyboard, each with its own visible result and cooldown, while every other location and every plain-button config behaves exactly as in v0.1.2.
**Depends on**: Nothing in this milestone (builds on shipped v0.1.2)
**Requirements**: MENU-01, MENU-02, MENU-03, MENU-04, MENU-05, MENU-06, MENU-07, MENU-08, ITEM-01, ITEM-02, ITEM-03, ITEM-04, ITEM-05, ITEM-06, ITEM-07, REL-01, REL-04
**Success Criteria** (what must be TRUE):

  1. On an Xcelsior (`Cp2XxBsRoyKS2CUf1Hwi`) contact record, staff see one "Actions" button in the contact name row that opens a panel listing, in order, Send Invite, Send individual consent, Resend Consent Hub link, Copy contact ID; on any other location's contact record there is no Actions menu and no Xcelsior action, and a config with only `buttons[]` renders exactly as v0.1.2 did.
  2. Staff can open the menu with Enter, Space, or ArrowDown (focus lands on the first item), move with arrow keys, Home, and End, and close it with Esc (focus returns to the trigger) or Tab; the menu also closes on outside click, on item activation, and on navigating to another contact or page, and the panel is never clipped by the name row.
  3. Activating Send Invite posts the unchanged v0.1.2 payload to trigger `bde416ab`; Send individual consent and Resend Consent Hub link post the standard payload with `buttonId` `send-individual-consent` and `resend-consent-hub` to the consent webhook; Copy contact ID copies the ID; each webhook item shows its own Sending... / Workflow triggered / Failed result on the trigger and in the screen-reader status span, then refuses repeat presses for 60 s without blocking the other items.
  4. When the open record's email is empty or synthetic (`+<digits>@`), Send individual consent shows as unavailable with a reason while the other items stay usable; per-location overrides can hide or change single items, and a menu with no visible items does not render.
  5. `node test/run.mjs` is green with new checks for menu rendering, keyboard, per-item state and cooldown, scope rules, plain-button compatibility, the synthetic-email pre-check, and no re-render loop (observer count unchanged from v0.1.2), every v0.1.2 static rule still passes, `test/harness.html` exercises the menu offline, and the README documents the `menus[]` shape and the consent item IDs.

**Plans**: 3/3 plans executed (sequential waves 1 → 2 → 3; all share `src/ghl-customizer.js` or `test/run.mjs`)

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Actions menu widget: tracer (menus[] → validate → resolveMenus → trigger + panel in the contact group → item POST through the v0.1.2 pipeline → trigger flash), keyboard model, close paths with one document listener, no re-render loop, panel positioning check, byte-for-byte v0.1.2 snapshot for buttons-only configs

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Per-item behavior: states and trigger feedback, 60 s per-item cooldown, "Not configured" for an empty URL, the `requires: { email: "real" }` synthetic-email pre-check, per-item overrides, scope, empty menus, validation, verify menuIds

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03-PLAN.md — Ship it: Xcelsior `xcelsiorActions` menu in `config/agency-config.json` (Send Invite moved in, Xcelsior-only, 60 s), headless proof of all four items, harness Location M menu with name-row and synthetic-email controls, README `menus[]` and consent item IDs

**UI hint**: yes

### Phase 5: Individual Consent Backend

**Goal**: Rob has everything needed to build and deploy the consent side in ClinX 365 and n8n: a step-by-step build spec for one consent Inbound Webhook workflow that resolves the exact contact by ID and either sends or refuses with a clear reason, a wf2 change so a member's own hub link shows only that member's card, and a member consent email in house style.
**Depends on**: Nothing in this milestone (independent of Phase 4; the spec defines the `buttonId` values Phase 4 sends)
**Requirements**: CONS-01, CONS-02, CONS-03, CONS-04, CONS-05, CONS-06, HUB-01, HUB-02, HUB-03, HUB-04
**Success Criteria** (what must be TRUE):

  1. Following the build spec step by step, Rob can build one consent Inbound Webhook workflow in ClinX 365 that does Find Contact by `{{inboundWebhookRequest.contactId}}` (never email or phone), sends an internal notification when no contact is found, and branches on `{{inboundWebhookRequest.buttonId}}`; the spec also covers renaming "WEBHOOK TEST Send Hint JOIN LINK & Reminders" for production with trigger and steps unchanged, the reload-after-save check, and the "verify in ClinX UI" item on post-Find-Contact `{{contact.*}}` context.
  2. For the individual-consent branch, the spec lists every guard (`family-member` tag, no `synthetic-email` tag, email differs from owner, `owner_contact_id` and `consent_hub_token` present, `consent_status` not `complete`); each refusal writes a contact Note plus internal notification naming the reason and the staff fix (shared or synthetic email points to "Resend Consent Hub link" on the owner; legacy members are called out as legacy); a pass adds `consent-pending` and sends "Your Xcelsior consent forms" to the member's own address.
  3. For the resend-hub branch, the spec sends the Family Consent Hub Invite to the owner directly from the owner's record, or from a member's record after Find Contact by `{{contact.owner_contact_id}}`, and refuses with a Note when no owner or token resolves.
  4. With the wf2 Build Status diff applied, opening the hub with a member-held `consent_hub_token` shows only that member's card (and the hub page renders one card with return-to-hub still working), while an owner token shows the whole family exactly as today; diffs use placeholder secrets and carry a Publish-in-n8n reminder.
  5. The member email MJML matches the Consent Hub Invite style, has no GoHighLevel mention and no em or en dashes, has click tracking off, and links to `https://join.xcelsiorhealth.com/consent-hub?t={{contact.consent_hub_token}}`; tracing a member's completion shows it flows through the unchanged path (Parts 1-3, Family Consent Form Submitted workflow, wf3 recount against the owner) so the owner's hub shows that member as done.

**Plans**: 3 plans (wave 1: 05-01 and 05-02 in parallel; wave 2: 05-03). Canonical deliverables stay uncommitted in `~/Repos/clients/xcelsior/`; byte-identical mirrors are committed under `phases/05-individual-consent-backend/deliverables/`.

Plans:
**Wave 1**

- [ ] 05-01-PLAN.md — wf2 member scope: Build Status v9 on the live v8 base (the repo mirror is stale v6), edited workflow JSON and diff, offline harness (adhoc_ token end to end, owner byte-identity, hub v11 one-card render, return-to-hub), COMPLETION-PATH.md (HUB-04, D-11 no hub change)
- [ ] 05-02-PLAN.md — ClinX build spec: consent Inbound Webhook workflow (Find Contact by ID, buttonId branch, guards R-03..R-07, adhoc_ token mint via Custom Code, resend via the four d6cf9af1 invite leaves), Send Invite rename, AR-03-01, verify-in-ClinX-UI checklist V-01..V-11, staged spec checker

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 05-03-PLAN.md — Member email MJML compiled with build.sh, proposal README (apply order with Publish reminder, v9 paste block, rollback, open questions), phase gate check-phase05.sh (mirrors byte-identical, xcelsior repo untouched)
**UI hint**: yes

### Phase 6: Release v0.2.0

**Goal**: v0.2.0 ships to the agency with confidence: the release is versioned, every menu item and refusal path has been proven on a real Xcelsior owner and member, and staff can be put back on v0.1.2 by changing one tag.
**Depends on**: Phase 4, Phase 5
**Requirements**: REL-02, REL-03
**Success Criteria** (what must be TRUE):

  1. Every version string reads 0.2.0 per the README release checklist, the shipped config carries the real consent webhook URL, and the full test suite is green on the release commit.
  2. A live-test checklist exists and, run by injecting the build into a logged-in ClinX tab, walks every menu item on a real Xcelsior owner and a real member, plus each refusal path (shared or synthetic email, legacy member, already complete, contact not found), recording the observed email, Note, or notification for each.
  3. The checklist includes a rollback step (snippet tag back to `v0.1.2` in both URLs) that restores the plain Send Invite button with no ClinX change.
  4. The annotated tag `v0.2.0` is created and pushed only after Rob gives explicit approval; until then nothing is tagged or pushed, and after approval jsDelivr serves the v0.2.0 assets.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 4 → 5 → 6 (4 and 5 are independent; 6 needs both)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation, Context & Workflow Buttons | v0.1.0 | 3/3 | Complete | 2026-09-24 |
| 2. Location Logo Switching | v0.1.0 | 2/2 | Complete | 2026-09-24 |
| 3. Accent Colors & Delivery | v0.1.0 | 2/2 | Complete | 2026-09-25 |
| 4. Actions Menu | v0.2.0 | 3/3 | In Progress|  |
| 5. Individual Consent Backend | v0.2.0 | 0/3 | Planned | - |
| 6. Release v0.2.0 | v0.2.0 | 0/TBD | Not started | - |

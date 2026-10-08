# Requirements: GHL Customizer (admin-theme)

**Defined:** 2026-10-07
**Milestone:** v0.2.0 Actions menu + "Send individual consent" for family members
**Core Value:** From an open contact record, a staff member can press one button and reliably trigger the right HighLevel workflow for that exact contact and location, with no stale context and no duplicate sends.

Inputs: `notes/actions-menu-individual-consent.md` (decisions), `notes/webhook-test-workflow-audit.md` (live workflow audit), the brief (ghl-action-menu-family-consents), `seeds/consent-actions-hardening.md` (deferred).

## v1 Requirements (this milestone)

### Actions menu (admin theme)

- [x] **MENU-01**: Config accepts a `menus[]` entry (`id`, `label`, `icon`, `placement: "contact"`, `scope`, `items[]`), where each item is a normal button definition with a unique `id` and its own `action`. Configs with only `buttons[]` render exactly as in v0.1.2.
- [x] **MENU-02**: Per-location overrides work per menu item through the existing `locations[id].buttons[itemId]` (false hides the item, an object overrides fields). A menu with no visible items does not render.
- [x] **MENU-03**: Staff see one "Actions" trigger in the contact name row, inside the existing `.ghlc-group`. It is a native `<button>` with `aria-haspopup="menu"` and `aria-expanded`, and opens a panel of native `<button role="menuitem">` items.
- [x] **MENU-04**: Staff can operate the menu by keyboard. Enter, Space, or ArrowDown opens it and focuses the first item. Arrow keys, Home, and End move between items. Esc closes it and returns focus to the trigger. Tab closes it.
- [x] **MENU-05**: The menu closes on outside click, on item activation, and on SPA navigation or contact change. The panel is not clipped by the name row (overflow tested).
- [x] **MENU-06**: Each item keeps its own state (ready, Sending..., Workflow triggered, Failed, unavailable) and its own cooldown keyed by item `id`. The result shows briefly on the trigger button and in the screen-reader status span, so staff see it after the menu closes.
- [x] **MENU-07**: Opening, closing, and state changes cause no re-render loop. Panel mutations stay inside `.ghlc-group`, so `isOwnNode` ignores them, and the observer count is unchanged from v0.1.2.
- [x] **MENU-08**: Every v0.1.2 static rule still passes: selectors only in `adapter`, no HTML strings, eval, storage, or cookies, `ghlc-` prefix, scoped CSS with no `!important`, ES2019 syntax (no `?.` or `??`), logging only through `safe()`, the generation counter, and the click-time URL recheck.

### Menu items (Xcelsior only)

- [x] **ITEM-01**: On Xcelsior (`Cp2XxBsRoyKS2CUf1Hwi`) contact records the Actions menu offers, in order: Send Invite, Send individual consent, Resend Consent Hub link, Copy contact ID. Other locations get no Actions menu and no Xcelsior actions.
- [x] **ITEM-02**: Send Invite posts the unchanged v0.1.2 payload to the existing trigger `bde416ab`, now scoped to Xcelsior only (fixes the `scope: "all"` bug).
- [x] **ITEM-03**: Send individual consent posts the standard payload with `buttonId: "send-individual-consent"` to the new consent Inbound Webhook. No new payload fields.
- [x] **ITEM-04**: Resend Consent Hub link posts the standard payload with `buttonId: "resend-consent-hub"` to the same consent webhook.
- [x] **ITEM-05**: Copy contact ID uses the existing `copyContactId` handler.
- [x] **ITEM-06**: Each webhook item uses a 60 s per-item cooldown (Send Invite moves from 10 s to 60 s).
- [x] **ITEM-07**: Send individual consent shows as unavailable with a reason when the record's email is empty or matches the synthetic dedupe pattern (`+<digits>@`).

### Consent workflow (ClinX 365 build spec)

- [ ] **CONS-01**: A step-by-step build spec covers one new Inbound Webhook workflow for both consent items: its trigger, Find Contact by `{{inboundWebhookRequest.contactId}}` (never email or phone), a "not found" branch with an internal notification, and a branch on `{{inboundWebhookRequest.buttonId}}`.
- [ ] **CONS-02**: The individual-consent branch refuses unless all of these hold: the contact has the `family-member` tag; it lacks the `synthetic-email` tag; its email differs from the owner's; it has `owner_contact_id` and `consent_hub_token`; and `consent_status` is not `complete`.
- [ ] **CONS-03**: Each refusal writes a contact Note and an internal notification that state the reason and the staff fix. Shared or synthetic email points staff to "Resend Consent Hub link" on the owner. A legacy member without an owner link or token is called out as such.
- [ ] **CONS-04**: On pass, the individual-consent branch adds `consent-pending` and sends the member email "Your Xcelsior consent forms" to the member's own address, linking to their own `consent_hub_token`.
- [ ] **CONS-05**: The resend-hub branch re-sends the Family Consent Hub Invite to the owner. On a member record it first does Find Contact by `{{contact.owner_contact_id}}`; on the owner's record it sends directly. It refuses with a Note when no owner or token resolves.
- [ ] **CONS-06**: The spec renames "WEBHOOK TEST Send Hint JOIN LINK & Reminders" for production, leaving its trigger and steps unchanged. It includes the reload-after-save check (trigger multi-selects revert silently). It marks "verify in ClinX UI" on whether `{{contact.*}}` after Find Contact is the found contact.

### Hub and member email

- [x] **HUB-01**: The wf2 (hub status) Build Status diff returns only the token holder's card when the holder is not the owner (`owner_contact_id` set or `member_type` != owner). Owner tokens behave exactly as today.
- [ ] **HUB-02**: The hub-page diff (if any is needed) lets a member-scoped hub render one card and keeps the return-to-hub step working. Secrets are placeholders, and a Publish-in-n8n reminder is included.
- [ ] **HUB-03**: The member email MJML follows the Consent Hub Invite style. It has no GoHighLevel mention, no em or en dashes, click tracking off, and the link `https://join.xcelsiorhealth.com/consent-hub?t={{contact.consent_hub_token}}`.
- [x] **HUB-04**: A member completing via their own hub flows through the unchanged path (Parts 1-3, the Family Consent Form Submitted workflow, the wf3 recount against the owner), and the owner's hub shows that member as done.

### Release

- [x] **REL-01**: `test/run.mjs` and `test/harness.html` cover menu rendering, keyboard, per-item state and cooldown, scope rules, plain-button backward compatibility, no re-render loop, and the synthetic-email pre-check. The full suite is green.
- [ ] **REL-02**: Version strings are bumped to 0.2.0 per the README release checklist. The annotated tag `v0.2.0` and the push happen only after Rob approves.
- [ ] **REL-03**: A live-test checklist covers the inject-into-logged-in-tab run, every menu item on a real Xcelsior owner and member, and each refusal path. It includes a rollback step (snippet tag back to v0.1.2).
- [x] **REL-04**: The README documents the `menus[]` config shape and the consent webhook item IDs.

## Future Requirements

Deferred (see `seeds/consent-actions-hardening.md`):

- Server-side dedupe by `requestId` or a recent-send tag
- n8n-by-contactId routing for consent actions
- INV-01..05 companion service (moves the webhook URL out of public config, closes AR-03-01)
- "Send Longevity Plus invite" menu item
- Per-client onboarding routine and a lighter config-only release path (carried from v0.1.0)

## Out of Scope

| Feature | Reason |
|---------|--------|
| DOB or age gate for individual consent | Eligibility is staff judgment (Rob, 2026-10-07) |
| Hiding items by role or contact fields | Same items for every Xcelsior contact; needs field reads or API calls |
| Route (b) prefilled `/family-part-1?` links | Puts patient data in URLs and breaks return-to-hub |
| Route (c) individual `/patient-information` funnel | Never updates family consent status |
| Email or phone contact matching for consent actions | Find Contact by ID is exact; phone merges family members |
| Changing the Send Invite trigger or steps | Live path; kept on its own trigger so rollback needs no ClinX change |
| New webhook payload fields | Not needed; avoids re-sending trigger samples |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MENU-01 | Phase 4 | Complete |
| MENU-02 | Phase 4 | Complete |
| MENU-03 | Phase 4 | Complete |
| MENU-04 | Phase 4 | Complete |
| MENU-05 | Phase 4 | Complete |
| MENU-06 | Phase 4 | Complete |
| MENU-07 | Phase 4 | Complete |
| MENU-08 | Phase 4 | Complete |
| ITEM-01 | Phase 4 | Complete |
| ITEM-02 | Phase 4 | Complete |
| ITEM-03 | Phase 4 | Complete |
| ITEM-04 | Phase 4 | Complete |
| ITEM-05 | Phase 4 | Complete |
| ITEM-06 | Phase 4 | Complete |
| ITEM-07 | Phase 4 | Complete |
| CONS-01 | Phase 5 | Pending |
| CONS-02 | Phase 5 | Pending |
| CONS-03 | Phase 5 | Pending |
| CONS-04 | Phase 5 | Pending |
| CONS-05 | Phase 5 | Pending |
| CONS-06 | Phase 5 | Pending |
| HUB-01 | Phase 5 | Complete |
| HUB-02 | Phase 5 | Pending |
| HUB-03 | Phase 5 | Pending |
| HUB-04 | Phase 5 | Complete |
| REL-01 | Phase 4 | Complete |
| REL-02 | Phase 6 | Pending |
| REL-03 | Phase 6 | Pending |
| REL-04 | Phase 4 | Complete |

**Coverage:** 29/29 v1 requirements mapped (Phase 4: 17, Phase 5: 10, Phase 6: 2). No orphans, no duplicates.

---
*Requirements defined: 2026-10-07*
*Last updated: 2026-10-07 after v0.2.0 roadmap (traceability filled)*

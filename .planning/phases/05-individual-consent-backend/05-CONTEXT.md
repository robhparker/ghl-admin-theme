# Phase 5: Individual Consent Backend - Context

**Gathered:** 2026-10-07
**Status:** Ready for planning
**Source:** Rob's decisions from /gsd-explore and /gsd-new-milestone (2026-10-07), plus the live workflow audit. Not re-asked, per Rob.

<domain>
## Phase Boundary

This phase writes **artifacts Rob applies by hand**. Nothing here edits ClinX 365, publishes n8n, or sends email:
1. A step-by-step **ClinX 365 build spec** for ONE new Inbound Webhook workflow serving both consent menu items, plus the rename of the existing Send Invite workflow.
2. **n8n wf2 (Consent Hub Status) change**: an edited copy of the workflow JSON and a readable diff. Also the **hub page** change, if one is needed.
3. The **member email MJML** ("Your Xcelsior consent forms"), compiled to HTML with the repo's `build.sh`.
4. A **completion-path trace** proving a member's completion reaches the owner's hub unchanged (HUB-04). It is a document, not a code change.

No admin-theme source changes. No version bump.
</domain>

<locations>
## Where the files go (Rob approved: uncommitted files in the xcelsior repo)

- Canonical deliverables, **left uncommitted** in the `robhparker/xcelsior` repo (`~/Repos/clients/xcelsior/`, which also holds unrelated uncommitted work by Rob; never stage or commit anything there):
  - `hint-api/proposals/2026-10-07-individual-consent/BUILD-SPEC-clinx-consent-webhook.md`
  - `hint-api/proposals/2026-10-07-individual-consent/wf2-consent-hub-status.member-scope.json` (full edited copy of `hint-api/n8n/2-consent-hub-status.json`)
  - `hint-api/proposals/2026-10-07-individual-consent/wf2-member-scope.diff` (unified diff vs `hint-api/n8n/2-consent-hub-status.json`, plus a readable node-by-node edit list in the README)
  - `hint-api/proposals/2026-10-07-individual-consent/hub-page.diff` (only if the hub page needs a change; otherwise the README states why not, with evidence)
  - `hint-api/proposals/2026-10-07-individual-consent/README.md` (index, apply order, Publish-in-n8n reminder, rollback)
  - `hint-api/proposals/2026-10-07-individual-consent/COMPLETION-PATH.md` (HUB-04 trace)
  - `Email-Templates/Consent-Hub-Invite/consent-forms-member.mjml` + compiled `consent-forms-member.html`
- **Mirror copies, committed** in admin-theme under `.planning/phases/05-individual-consent-backend/deliverables/` (same filenames), so the milestone is traceable in this repo. The xcelsior copies are canonical; the mirror must be byte-identical at phase end.
</locations>

<decisions>
## Implementation Decisions (locked)

### Consent workflow (ClinX 365)
- **D-01:** ONE new workflow, suggested name "[Ready] Admin Menu: Consent Actions (webhook)", with ONE Inbound Webhook trigger (a new premium trigger; its URL will fill both consent items' `url` in Phase 6). Payload is unchanged from v0.1.2: `contactId, locationId, buttonId, requestId, sentAt, email, phone, source`. No new fields.
- **D-02:** First action **Find Contact** where `id == {{inboundWebhookRequest.contactId}}` (multi-path: found / not found), copying the live Send Invite workflow (audit: `.planning/notes/webhook-test-workflow-audit.md`). Never match on email or phone. The "not found" branch sends an **internal notification** to staff ("Consent action failed: contact not found") and ends.
- **D-03:** After found, an If/Else on `{{inboundWebhookRequest.buttonId}}`: `send-individual-consent`, `resend-consent-hub`, and a None branch that sends an internal notification ("unknown action") and ends.
- **D-04 (send-individual-consent guards, in this order, each a refusal with a Note plus an internal notification):**
  1. No `family-member` tag → "Not a family member. Use Resend Consent Hub link on the owner."
  2. Has the `synthetic-email` tag, or email is empty → "Member has no own email. Enter their real email first, or use Resend Consent Hub link on the owner."
  3. `owner_contact_id` empty (or `hint_membership_id` empty) → "Legacy member without an owner link. Needs backfill before an individual consent can be sent." (A missing member `consent_hub_token` is NOT a refusal; see D-05a.)
  4. Email equals the owner's email: the workflow must read the owner's email, so do a Find Contact by `{{contact.owner_contact_id}}`, compare, then **switch context back** to the member (Find Contact by `{{inboundWebhookRequest.contactId}}`) before sending. Mark "verify in ClinX UI" on how ClinX exposes the found-contact context and whether a second Find Contact restores the member. If that proves awkward, an acceptable alternative: rely on the synthetic-email tag (wf1 already converts shared signup emails to synthetic) and note the residual risk.
  5. `consent_status` == `complete` → "Already complete. Nothing to send."
- **D-05a (member token mint, Rob 2026-10-07):** members do not hold a `consent_hub_token` today (wf1 mints one per family and writes it to the owner only; design §4.3, §5.1 step 7). On pass, if the member's `consent_hub_token` is empty, a **ClinX Custom Code** action generates a cryptographically random token (32 bytes as hex, matching the format wf1 mints; read wf1 to confirm the format and length) and an **Update Contact Field** step writes it to the member's `consent_hub_token` BEFORE the email step. An existing member token is reused (the link never changes). Mark "verify in ClinX UI": Custom Code availability on the plan, its output variable name, crypto availability in its runtime (fallback: `Math.random` is NOT acceptable; if crypto is unavailable, stop and tell Rob), and that the Update Field value is visible to the next email step. Also confirm that a member holding a token does not break wf1's idempotency check (`already = existingToken && existingMembership === ev.object.id` runs on the owner record) or wf3's recount.
- **D-05 (send-individual-consent pass):** add tag `consent-pending` (if absent), send the email "Your Xcelsior consent forms" (template from this phase's MJML) to the member, add a contact Note "Individual consent email sent by staff via Actions menu", and end. Do NOT change `consent_status` or owner fields; the completion path does that.
- **D-06 (resend-consent-hub):** if the contact has `owner_contact_id` (it is a member), Find Contact by `{{contact.owner_contact_id}}` and send the existing **Family Consent Hub Invite** email to the owner. Otherwise (it is the owner; `member_type` == owner or a `consent_hub_token` present) send directly. Refuse with a Note plus a notification when no owner resolves or the owner has no `consent_hub_token`. Use the same email/template the existing "Consents Needed" workflow sends (find its name in the design doc §5.7 and Appendix C).
- **D-07 "verify in ClinX UI" markers** are required on: the post-Find-Contact `{{contact.*}}` context (D-02/D-04 #4); how `{{inboundWebhookRequest.buttonId}}` appears in If/Else; that the webhook sample includes `buttonId` (the existing payload already has it; a sample must be sent once to the new trigger after creation); and the click-tracking-off setting.
- **D-08:** Settings: allowMultiple on (re-entry allowed; the 60 s client cooldown is the only throttle, per the decision note #4). Reminders: reload after every save, because trigger multi-selects silently revert. Build as draft, test, then publish.
- **D-09 (Send Invite rename):** rename "WEBHOOK TEST Send Hint JOIN LINK & Reminders" (3dff9d94…) to "[Ready] Admin Menu: Send Invite (webhook)". Trigger and steps stay unchanged. Optional: add an internal notification on its "Contact not found" branch. Renaming does not change the webhook URL.

### wf2 + hub
- **D-10:** In wf2 "Build Status" (or equivalent node after "Find Owner by Token"), if the token holder is not the owner (holder has `owner_contact_id` set, or `member_type` != owner), return only the holder's card. Owner tokens are unchanged. Read the actual node names and code from `hint-api/n8n/2-consent-hub-status.json`; don't guess. Secrets/tokens in any copied JSON stay as the placeholders already used in the repo copies (never real values).
- **D-11:** Decide from the hub page source (`hint-api/ghl/consent-hub-v11-ELEMENT-PASTE.html` is the latest, by version number; confirm) whether a single-card response renders correctly and the return-to-hub step still works. If no change is needed, say so with line evidence; if needed, produce `hub-page.diff`.
- **D-12:** A Publish-in-n8n reminder appears in the README and the spec ("n8n changes do not ship until you click Publish").

### Member email
- **D-13:** MJML in the same style as `Email-Templates/Consent-Hub-Invite/consent-hub-invite.mjml` (read it and `consent-hub-invite-family.mjml`). Link `https://join.xcelsiorhealth.com/consent-hub?t={{contact.consent_hub_token}}`. Greeting uses `{{contact.first_name}}`. Patient-facing copy: **no em or en dashes**, no mention of GoHighLevel/HighLevel/ClinX, plain and warm, about ten minutes, "these forms are for you personally". Click tracking stays off in the workflow email step (stated in the spec). Compile with `Email-Templates/build.sh`.

### Security / privacy
- **D-14:** No patient data in URLs beyond the existing opaque hub token. No new PHI flows through n8n (wf2 already receives the token and returns card data; the change reduces what a member token sees). State in the spec what this changes for AR-03-01: more volume possible (spam), no new disclosure (mail only goes to the address on file).

### Claude's Discretion
- Exact wording of Notes and notifications, the email copy (within D-13), and the spec layout (numbered steps with exact field names, operators, values).
</decisions>

<canonical_refs>
## Canonical References (read, don't guess)

- `.planning/REQUIREMENTS.md`: CONS-01..06, HUB-01..04
- `.planning/notes/actions-menu-individual-consent.md` and `.planning/notes/webhook-test-workflow-audit.md`
- `~/Repos/clients/xcelsior/hint-api/GHL_Family_Consent_Flow_Design.md`: §4 data model, §5.2 wf2, §5.7 Consents Needed email, §5.8 Form Submitted, §9 item 1, Appendix C component IDs, Appendix D/E
- `~/Repos/clients/xcelsior/hint-api/n8n/README.md`, `n8n/2-consent-hub-status.json`, `n8n/1-hint-membership-fanout.json`, `n8n/3-consent-completed.json`
- `~/Repos/clients/xcelsior/hint-api/testing/2026-07-30-solo-hub/FINDINGS.md`, `testing/2026-08-24-phase2-wf1-patch/FINDINGS.md`, `testing/2026-08-25-phase4-verification/`, `testing/2026-08-26-unified-review/unified-summary.md`, `DECISION-hint-patient-id-remediation.md`, `HANDOFF-solo-hub.md`, `HANDOFF-owner-return-path.md`, `HANDOFF-legacy-hint-backfill.md`
- `~/Repos/clients/xcelsior/hint-api/ghl/consent-hub-v11-ELEMENT-PASTE.html` (hub page)
- `~/Repos/clients/xcelsior/Email-Templates/Consent-Hub-Invite/*.mjml`, `Email-Templates/build.sh`, `Email-Templates/README.md`
- `config/agency-config.json` + `README.md` in admin-theme: item ids `send-individual-consent`, `resend-consent-hub`
</canonical_refs>

<deferred>
## Deferred

- Server-side dedupe, n8n-by-contactId routing, INV-01..05, Longevity Plus item (`seeds/consent-actions-hardening.md`)
- Minting member tokens at signup in wf1 (only if the investigation shows members lack `consent_hub_token`; then document it as a prerequisite or backfill step, don't build it)
</deferred>

---
*Phase: 05-individual-consent-backend*

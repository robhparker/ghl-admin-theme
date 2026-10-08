# BUILD SPEC: ClinX consent Inbound Webhook workflow (and the Send Invite rename)

**Date:** 2026-10-07 · **Builder:** Rob, by hand in ClinX 365, location `Cp2XxBsRoyKS2CUf1Hwi` (Xcelsior Health) · **Milestone:** admin-theme v0.2.0, Phase 5 (CONS-01..CONS-06) · **Status:** not applied

This spec builds ONE new workflow, "[Ready] Admin Menu: Consent Actions (webhook)", that serves both consent items of the admin-theme Actions menu ("Send individual consent" and "Resend Consent Hub link"). The workflow resolves the exact contact staff clicked from by contact ID, branches on the menu item that was pressed, and then either sends one email or refuses with a Note on the record and an internal notification that state the reason and the staff fix. It also renames the existing Send Invite workflow so its name matches what it does. Nothing here is applied yet; nothing in this folder touches ClinX, n8n, or email until Rob builds it.

**How to read it.** Steps are numbered. Each step reads "Action type -> field = value". Two kinds of ids run through the spec:

- **R-01 .. R-09** are refusals. Each appears inline where it happens and once in the register (§9) with its exact Note text, notification text, and staff fix.
- **V-01 .. V-11** are "verify in ClinX UI" markers. A marker line says what to check while building and what to do if ClinX differs. Tick each in the checklist (§10). If a check fails and the marker gives no fallback, stop building and do not publish.

## 0. Before you start

0.1 **Apply order: wf2 first.** Publish the n8n wf2 change (Consent Hub Status, Build Status v9, files `wf2-consent-hub-status.member-scope.json` and `wf2-member-scope.diff` in this folder; steps in this folder's README) BEFORE this workflow sends anything. Under the live Build Status v8, a member's own hub link shows the whole family and puts the member on the owner's Part 1 link. n8n changes do not ship until you click Publish. Saving the n8n workflow is not enough: confirm the live Build Status header reads v9 after publishing.

0.2 **Email template "Member Consent Forms".** Marketing -> Emails -> Templates -> New -> Code editor. Name = "Member Consent Forms". Paste the compiled `Email-Templates/Consent-Hub-Invite/consent-forms-member.html` (never the `.mjml` source). Save, close, reopen, and confirm the preview renders the Xcelsior header, the button, and the footer. The workflow step in §4 uses the subject "Your Xcelsior consent forms".

0.3 **Premium actions.** The Inbound Webhook trigger and the Custom Code action are Premium. The Find Contact action is already in use in the Send Invite workflow (3dff9d94), so it is available on this location. Custom Code availability is checked in §4.6 (V-06).

0.4 **Fields and tags this spec reads or writes.** All exist on the location (phase0 FINDINGS, 2026-08-24). Pick them by name in the ClinX pickers; never type a field id.

| Custom field (key) | Display name used below | Read / written |
|---|---|---|
| `owner_contact_id` | Owner Contact ID | read |
| `hint_membership_id` | Hint Membership ID | read |
| `hint_patient_id` | Hint Patient ID | read (inside a merge field) |
| `member_type` | Member Type | read |
| `consent_status` | Consent Status | read |
| `consent_hub_token` | Consent Hub Token | read; written only for members in §4.6 |
| `dependent_count` | Dependent Count | read |
| `consents_received` | Consents Received | not used |

Tags: `family-member`, `synthetic-email`, `consent-pending` (added in §4.7), `longevity-member` (read in §5.4). Not touched: `family-consent-complete`, `consents-needed`, `all-consents-complete`.

0.5 **The refusal pattern (used by every R- step).** Every refusal is four actions, in this order:
1. **Restore the clicked contact, if the context moved.** If an earlier Find Contact switched the context to the owner, add Find Contact -> id == `{{inboundWebhookRequest.contactId}}` first, so the Note lands on the record staff clicked from.
2. **Add Note** (Add Note / Create Note action) -> body = the refusal's Note text from the step, followed by ` (R-xx, request {{inboundWebhookRequest.requestId}})`.
3. **Internal Notification** -> type = In-App to the staff user or users Rob picks (or type = Email to the same people with the same text) -> body = `Consent action refused (R-xx): <Note text> Action {{inboundWebhookRequest.buttonId}}, request {{inboundWebhookRequest.requestId}}, contact {{inboundWebhookRequest.contactId}}.` The notification carries only the reason, the fix, the buttonId, the requestId, and the contact id. Never add names, dates of birth, emails, phone numbers, or any clinical data.
4. **End** (End this workflow / Go to End).

0.6 **Recipients.** Pick the notification recipients once (for example Rob plus the front-desk lead) and use the same people on every refusal, so staff learn one place to look.

## 1. Create the workflow and its Inbound Webhook trigger

1.1 Automation -> Workflows -> open the folder that holds "WEBHOOK TEST Send Hint JOIN LINK & Reminders" (folder `e0a03a6d-…`, the same folder as the [Ready] Send Hint workflow) -> Create Workflow -> Start from scratch. Name = "[Ready] Admin Menu: Consent Actions (webhook)". Leave it in **Draft** until §6.

1.2 Add New Trigger -> **Inbound Webhook**. Trigger name = "Admin Menu consent action". Copy the webhook URL the trigger shows and keep it for Phase 6, where it goes into the `url` of BOTH admin-theme menu items (`send-individual-consent` and `resend-consent-hub` in `config/agency-config.json`). Do not paste the URL into this spec or any shared doc.

1.3 **Payload.** The admin-theme client posts this JSON body (v0.1.2 shape, unchanged; D-01). No new fields.

| Key | Example value | Used by this workflow |
|---|---|---|
| `contactId` | the ClinX contact id of the open record | §2 Find Contact; every restore step |
| `locationId` | `Cp2XxBsRoyKS2CUf1Hwi` | not used |
| `buttonId` | `send-individual-consent` or `resend-consent-hub` | §3 branch |
| `requestId` | a per-click id from the client | every Note and notification |
| `sentAt` | ISO 8601 time of the click | not used |
| `email` | the email shown on the record at click time | §4.4 owner compare only |
| `phone` | the phone shown on the record | never used |
| `source` | `ghl-customizer` | not used |

1.4 **Send ONE sample while still in Draft.** From a terminal, with the copied URL in place of the placeholder and obviously fake values only (no real contact data):

```bash
curl -sS -X POST "PASTE_CONSENT_WEBHOOK_URL_HERE" \
  -H "Content-Type: application/json" \
  -d '{"contactId":"SAMPLE_CONTACT_ID","locationId":"Cp2XxBsRoyKS2CUf1Hwi","buttonId":"resend-consent-hub","requestId":"sample-request-0001","sentAt":"2026-10-07T00:00:00.000Z","email":"sample@example.test","phone":"+15555550100","source":"ghl-customizer"}'
```

Then open the trigger -> fetch or select the captured sample request -> Save trigger. If the run log shows an enrollment from this sample, it ends at R-01, because `SAMPLE_CONTACT_ID` is not a real contact.

verify in ClinX UI (V-03): the captured sample under the trigger lists `buttonId` (and the other seven keys) as mappable fields. If it differs: re-send the curl once and fetch again. If `buttonId` is still missing, do not continue to §3, because every branch keys on it.

## 2. Find the contact by ID

2.1 First action after the trigger -> **Find Contact**. Copy the first action of the Send Invite workflow (3dff9d94, "Find Contact by Webhook Contact ID") exactly:
- Action name = "Find Contact by Webhook Contact ID"
- Match field = Contact ID (`id`), operator = is (==), value = `{{inboundWebhookRequest.contactId}}` (pick it from the trigger's merge fields)
- Multi-path = on: branches "Contact found" and "Contact not found"

Never match on email or phone. Two members of one family can share an email, and the payload `contactId` is the exact record staff clicked from, which is why the Send Invite workflow already resolves by ID (audit, 2026-10-07).

verify in ClinX UI (V-01): after Find Contact, `{{contact.*}}` merge fields (and the Send Email recipient) refer to the found contact. Runs 2 and 3 of the Send Invite audit suggest yes: the email went to the found contact. Check it in the run log of the first live test in Phase 6: the Note and the email land on the record staff clicked from. If it differs: do not publish; the whole design assumes the found contact is the context.

2.2 **Contact not found -> R-01.** There is no contact, so there is no Note. Internal Notification -> body = `Consent action failed: contact not found. Action {{inboundWebhookRequest.buttonId}}, request {{inboundWebhookRequest.requestId}}, contact {{inboundWebhookRequest.contactId}}.` Then End. (If an In-App notification needs a contact to exist, use type = Email with the same text.)

## 3. Branch on buttonId

3.1 On "Contact found" -> **If/Else**, action name = "Which consent action". Two named branches plus None:
- Branch A, name = "send-individual-consent": condition `{{inboundWebhookRequest.buttonId}}` is (equals) `send-individual-consent` -> continue at §4.
- Branch B, name = "resend-consent-hub": condition `{{inboundWebhookRequest.buttonId}}` is (equals) `resend-consent-hub` -> continue at §5.
- None -> R-02 (3.2).

These two strings are the admin-theme item ids. Phase 4 posts the pressed item's id as `buttonId`, so the values must match exactly (lowercase, hyphens, no spaces).

verify in ClinX UI (V-02): how `{{inboundWebhookRequest.buttonId}}` appears in the If/Else condition picker (an "Inbound Webhook" or trigger-data group, or a custom value or merge field typed into the left side). Pick it from the picker rather than typing it when the picker offers it. If it differs (If/Else cannot condition on trigger data at all): stop; branching on `buttonId` is D-03, and a workaround changes D-01.

3.2 **None -> R-02 (unknown action).** Follow the §0.5 pattern (no restore needed; the context is still the clicked contact):
- Note = `Consent action failed: unknown action ({{inboundWebhookRequest.buttonId}}). No email sent. Check the Actions menu item id in the admin-theme config.`
- Internal Notification with the same text.
- End.

## 4. Branch A: send-individual-consent

Goal (D-04, D-05, D-05a): email the member staff clicked on a link to their own consent forms, but only when the member has their own email, a working owner link, and forms still to do. The guards run in D-04 order. The first guard that matches refuses and ends, using the §0.5 pattern with the exact text given here. The context at the start of this branch is the clicked contact (the member).

4.1 **R-03, not a family member (D-04 #1).** If/Else, action name = "Is a family member": Branch "Not a member" -> Contact Tags does not include `family-member` -> refuse (§0.5, no restore needed): Note = "Not a family member. Use Resend Consent Hub link on the owner." Notification with the same text. End. None -> 4.2.

Owners never carry `family-member`, and neither do legacy (backfilled) dependents, whose tags the 2026-08-25 backfill left untouched, so both stop here. wf1 dependents carry it (Tag Dependent).

4.2 **R-04, no own email (D-04 #2, plus one planner addition).** If/Else, action name = "Has own email": Branch "No own email" -> conditions joined with OR:
- Contact Tags includes `synthetic-email` (D-04 #2)
- Email is empty (D-04 #2)
- Email contains `+{{contact.hint_patient_id}}@` (planner addition to D-04 #2, same refusal message)

-> refuse (§0.5, no restore needed): Note = "Member has no own email. Enter their real email first, or use Resend Consent Hub link on the owner." Notification with the same text. End. None -> 4.3.

verify in ClinX UI (V-10): the "contains" value field accepts the merge field `+{{contact.hint_patient_id}}@` and resolves it per contact (a member whose Hint Patient ID is `pat-abc` is checked against `+pat-abc@`, not the literal text). Check it in Phase 6 with a test member whose email is a synthetic address. If it differs (the value is compared literally, or the field rejects merge fields): delete the third condition, keep the two D-04 conditions alone, and accept the residual risk stated below.

Why the third condition: wf1 never applies the `synthetic-email` tag. Its Tag Dependent node writes only `family-member` and `consent-pending`. The tag exists only on the 17 contacts the 2026-08-26 unified review tagged (testing/2026-08-26-unified-review/unified-summary.md). wf1's Build Dependents gives every dependent without their own real email the synthetic address `ownerlocal+<hint_patient_id>@ownerdomain` (production ids look like `pat-…`, sandbox ids like `sbx-pat-…`). Such a member has a non-empty email and no tag, so the two D-04 conditions alone let it through. Residual risk if V-10 forces the two conditions alone: the member email goes to the synthetic address, and plus-addressing delivers it to the owner's inbox. The owner then gets a link that opens only the member's card (wf2 v9): a confusing email, not a disclosure. The admin-theme client also pre-checks synthetic addresses before posting (`/\+(?:\d+|pat-[A-Za-z0-9_-]+)@/`, admin-theme commit 86b53d7), but the client check is advisory and this server-side guard is the one that counts.

4.3 **R-05, legacy member (D-04 #3).** If/Else, action name = "Has owner link": Branch "Legacy" -> conditions joined with OR: Owner Contact ID is empty OR Hint Membership ID is empty -> refuse (§0.5, no restore needed): Note = "Legacy member without an owner link. Needs backfill before an individual consent can be sent." Notification with the same text. End. None -> 4.4.

A missing member Consent Hub Token is NOT a refusal. Step 4.6 mints one on the first send, which is how CONS-02's token condition is met.

4.4 **R-06, email equals the owner's (D-04 #4).**
1. **Find Contact**, action name = "Find owner (email compare)" -> match Contact ID (`id`) is `{{contact.owner_contact_id}}`. Multi-path on.
2. **Contact not found** -> restore the member (Find Contact -> id == `{{inboundWebhookRequest.contactId}}`) -> refuse with R-05's text plus a suffix: Note = "Legacy member without an owner link. Needs backfill before an individual consent can be sent. (owner contact not found)". Notification with the same text. End.
3. **Contact found** -> the context is now the owner. If/Else, action name = "Shares the owner's email": Branch "Same email" -> Email (the owner's `{{contact.email}}`) is (equals) `{{inboundWebhookRequest.email}}` (the member email shown on the record when staff clicked). None = different emails.
4. On BOTH outcomes, the first action is **Find Contact**, action name = "Restore member" -> id == `{{inboundWebhookRequest.contactId}}`, which switches the context back to the member. (Its own "not found" path cannot happen, because §2 found this id seconds earlier; route it to the R-01 notification and End.)
5. "Same email", after the restore -> refuse: Note = "Member's email matches the owner's. Use Resend Consent Hub link on the owner." Notification with the same text. End.
6. None (different), after the restore -> 4.5.

verify in ClinX UI (V-05): how ClinX exposes the found-contact context. Check three things on the run log of the first Phase 6 test: (a) after "Find owner (email compare)", `{{contact.email}}` is the owner's; (b) after "Restore member", `{{contact.*}}`, the Note, and the Send Email recipient are the member again; (c) after a Find Contact that finds nothing, the context is still the member (the R-05 Note lands on the member either way, because 4.4 step 2 restores explicitly). Also record whether the equals compare is case-sensitive (test with the owner's email typed in different case on a test member). If ClinX compares case-sensitively, write that in §10 and accept it: staff-typed emails are almost always lowercase. If (a) or (b) differ: use the D-04 alternative below.

The payload `email` is the on-screen value at click time, while 4.7 sends to the email saved on the record. If staff edited the email and did not save, the two can differ, so staff should save the record before pressing the item.

D-04's acceptable alternative: drop 4.4 entirely and rely on 4.2's synthetic checks. Residual risk: staff typed the owner's real email by hand onto the member record (wf1 never does this; Build Dependents swaps a shared signup email for the synthetic key). The member email then reaches the owner's inbox with a member-only link.

4.5 **R-07, already complete (D-04 #5).** If/Else, action name = "Already complete": Branch "Complete" -> Consent Status is `complete` -> refuse (§0.5; the context is the member after 4.4's restore): Note = "Already complete. Nothing to send." Notification with the same text. End. None -> 4.6. Use the value the Form Submitted workflow a56137e1 writes (`complete`, design §5.8); if Consent Status shows as a dropdown, pick that option.

4.6 **Member token (D-05a).** If/Else, action name = "Member has a hub token": Branch "No token" -> Consent Hub Token is empty -> steps 1-4 below, then 4.7. None (a token exists) -> reuse it, write nothing (the member's link never changes) -> 4.7. HighLevel branches do not rejoin, so under None either add a Go To action pointing at 4.7's first action (if the plan offers Go To) or repeat 4.7's three actions there.

1. **Custom Code**, action name = "Mint member hub token" -> Language = JavaScript -> Input properties = none (no `inputData` keys) -> Code = the block below, pasted exactly.

<!-- custom-code:js:start -->
```js
// Mint a member Consent Hub Token: "adhoc_" + 64 lowercase hex (32 cryptographic random bytes).
// Cryptographic sources only. If neither exists, throw: do not publish, stop and tell Rob.
var bytes = null;
if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
  bytes = crypto.getRandomValues(new Uint8Array(32));
} else if (typeof require === 'function') {
  try {
    bytes = require('crypto').randomBytes(32);
  } catch (e) {
    bytes = null;
  }
}
if (!bytes || bytes.length !== 32) {
  throw new Error('No cryptographic random source in this runtime. Do not publish: stop and tell Rob.');
}
var hex = '';
for (var i = 0; i < bytes.length; i++) {
  hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
}
output = { token: 'adhoc_' + hex };
```
<!-- custom-code:js:end -->

2. Click **Test your Code**. It is mandatory: HighLevel gives later steps no output from code that was never tested. The test result shows a sample `adhoc_` token. It is not written to any contact; do not copy it anywhere.
3. **Update Contact Field**, action name = "Save member hub token" -> field = Consent Hub Token -> value = the Custom Code output `token`.
4. Continue to 4.7.

verify in ClinX UI (V-06): Custom Code is available on this location's plan (it is a Premium action). If it differs (the action is missing or locked): do not build 4.6 another way; stop and tell Rob.

verify in ClinX UI (V-07): the Custom Code output variable name and merge syntax. HighLevel documents `output = { ... }` but not how later steps reference it. In the Update Contact Field value, open the merge-field picker, find the Custom Code step's `token`, insert it, and write the exact inserted text into §10. If it differs (no picker entry): re-run Test your Code, then reopen the picker; if `token` still does not appear, stop and tell Rob.

verify in ClinX UI (V-08): crypto is available in the Custom Code runtime, meaning Test your Code returns `adhoc_` plus 64 hex characters and no error. Math.random is not acceptable as a fallback, because the token is the only key to the member's hub. If neither crypto source works, do not publish: stop and tell Rob. Selecting Python with `secrets.token_hex(32)` (prefixed with `adhoc_`) is a cryptographic alternative Rob may approve.

verify in ClinX UI (V-09): the Update Contact Field value is visible to the next Send Email. In the first Phase 6 test send, the email's button link must end in `?t=adhoc_` plus 64 hex. If it differs (empty or stale token in the link): add a Find Contact -> id == `{{inboundWebhookRequest.contactId}}` right after "Save member hub token" to reload the member, and test again.

verify in ClinX UI (V-11): no other workflow triggers on a Consent Hub Token change. Automation -> Workflows -> filter by trigger type Contact Changed (and any custom-field-changed trigger) and confirm none watches Consent Hub Token. If one does: do not publish until Rob has read that workflow.

**F-2, token format.** wf1 mints owner tokens with `crypto.randomBytes(16).toString('hex')` (32 hex characters) in Build Dependents and in Prep Owner Update (Solo). This member token is `adhoc_` plus 64 hex per D-05a (32 bytes, 70 characters in total, the same lowercase hex alphabet). No consumer checks the token's length or format (Plan 05-01 harness: wf2 Has Token? and Find Owner by Token, and hub v11's `?t=` reading). The prefix means a member token can never equal a wf1 owner token, makes it recognizable in contact records and logs, and is URL-safe.

4.7 **Pass (D-05).** The context is the member.
1. **Add Contact Tag** -> `consent-pending` (adding a tag the contact already has is a no-op).
2. **Send Email**, action name = "Member consent email" -> Template = "Member Consent Forms" -> Subject = "Your Xcelsior consent forms" -> recipient = the member in context -> From Name blank, From Email blank -> Track link clicks = OFF (V-04). Save, then reopen the action and confirm the template still renders in the preview.
3. **Add Note** -> "Individual consent email sent by staff via Actions menu (request {{inboundWebhookRequest.requestId}})".
4. End.

This branch never changes `consent_status` or any owner field, because the completion path (Form Submitted a56137e1, then wf3) does that.

4.8 **Side effects checked (D-05a confirmations).** A member holding an `adhoc_` token breaks nothing downstream:
- wf1 **Check Idempotency** reads `consent_hub_token` and `hint_membership_id` from the Upsert Owner response, which is the owner's record, so a member's token can never trip `already`.
- wf1 **Build Dependents** never writes `consent_hub_token` (its upsert body carries hint_patient_id, hint_membership_id, member_type, and owner_contact_id only), so a re-signup leaves the member token alone.
- wf3 (`n8n/3-consent-completed.json`) has 0 `consent_hub_token` references, and its **Compute Completion** counts dependents found by `hint_membership_id` against the owner, so the member's completion still lands on the owner's hub.
- wf2 finds the holder by exact token match, and Build Status v9 scopes a member-held token to that member's card (Plan 05-01).

## 5. Branch B: resend-consent-hub

Goal (D-06): send the owner the same Consent Hub Invite the Consents Needed workflow ("Family Consent - Consents Needed Email", `d6cf9af1-7fed-4182-a8d6-69ca2725d427`) sends, whether staff clicked on the owner or on a member.

5.1 **If/Else**, action name = "Member or owner": Branch "Member" -> condition Owner Contact ID is not empty -> 5.2. None -> 5.3.

5.2 **Member path** (the clicked contact has an owner link):
1. **Find Contact** -> action name = "Find owner" -> match Contact ID (`id`) is `{{contact.owner_contact_id}}` (the context is still the member here, so this reads the member's owner link). Multi-path on.
2. **Contact not found -> R-08.** Follow §0.5, including the restore step (Find Contact -> id == `{{inboundWebhookRequest.contactId}}`): Note = "No owner found for this member. Check the owner link or use the owner's own record." Notification with the same text. End.
3. **Contact found.** The context is now the owner (V-05, checked in §4.4: both branches rely on the same Find Contact behavior).
4. **If/Else**, action name = "Owner has a hub link": Branch "No token" -> condition Consent Hub Token is empty -> R-09: follow §0.5, restoring the member first (Find Contact -> id == `{{inboundWebhookRequest.contactId}}`): Note = "The owner has no Consent Hub link (legacy or never invited). Needs a hub token before a link can be resent." Notification with the same text. End.
5. None (the owner has a token) -> 5.4.

5.3 **Owner path** (Owner Contact ID is empty):
1. **If/Else**, action name = "Is an owner": Branch "Owner" -> conditions joined with OR: Member Type is `owner` OR Consent Hub Token is not empty. None -> R-08 (neither: no owner link and not an owner, for example a legacy dependent whose owner link was never written): follow §0.5 (no restore needed): Note = "No owner found for this member. Check the owner link or use the owner's own record." Notification with the same text. End.
2. In Branch "Owner" -> **If/Else** "Owner has a hub link": Branch "No token" -> Consent Hub Token is empty -> R-09 (no restore needed): Note = "The owner has no Consent Hub link (legacy or never invited). Needs a hub token before a link can be resent." Notification with the same text. End. None -> 5.4.

Why "token not empty" counts as owner here: `adhoc_` member tokens (minted in §4.6) only ever exist on members, and members always carry Owner Contact ID (R-05 refuses any member without it), so 5.1 always routes them to the member path. The only contacts that reach 5.3 holding a token are wf1 owners.

5.4 **Send the same invite d6cf9af1 sends.** One If/Else, action name = "Which invite", with four branches in this order (first match wins, the same order d6cf9af1 uses; phase0 FINDINGS item 3, 2026-08-24):

| # | Branch name | Condition (AND within a branch) | Template (name in the LP handoff) | Template bound live in d6cf9af1 | Subject (copy from the matching d6cf9af1 action) |
|---|---|---|---|---|---|
| 1 | LP Family | Contact Tags includes `longevity-member` AND Dependent Count > 0 | "Longevity Plus Family Consent Hub Invite" | "Longevity Family Consent Invite" | "Complete your family's Longevity Plus forms" (2026-08-06 FINDINGS) |
| 2 | LP Solo | Contact Tags includes `longevity-member` | "Longevity Plus Consent Hub Invite" | "Longevity Consent Invite" | "{{contact.first_name}}, your Longevity Plus forms are ready" (2026-08-06 FINDINGS) |
| 3 | Family | Dependent Count > 0 | "Family Consent Hub Invite" | "Family Consent Hub Invite" | "Complete your family's consent forms" |
| 4 | None | (fallback) | "Consent Hub Invite" | "Consent Hub Invite" | "{{contact.first_name}}, your consent forms are ready" |

The LP handoff (HANDOFF-longevity-plus.md, 2026-08-06) suggested the names "Longevity Plus Family Consent Hub Invite" and "Longevity Plus Consent Hub Invite"; the templates actually saved and bound in d6cf9af1 are "Longevity Family Consent Invite" and "Longevity Consent Invite". Before building this step, open d6cf9af1 read-only, open each of its four email actions, and copy the template it binds and its subject exactly. Close with Cancel.

Under each branch -> **Send Email** (action names "Resend hub invite: LP Family", "... LP Solo", "... Family", "... Solo"):
- Template = the d6cf9af1 template for that leaf (the template picker needs a double-click to bind; 2026-08-06 FINDINGS trap)
- Subject = the d6cf9af1 subject for that leaf
- From Name = blank, From Email = blank (location defaults; From Email becomes mandatory once From Name is set, design Appendix C)
- Track link clicks = OFF, Sync edits = OFF (same as d6cf9af1)
- Recipient = the contact in context, which is the owner on both paths

verify in ClinX UI (V-04): Track link clicks is OFF on every Send Email action in this workflow (the four here and the one in §4.7), so the `?t=` hub link is never rewritten. If it differs (the toggle reverts after save): turn it off again, save, reload, reopen. Do not publish with tracking on.

After every save of this workflow, reopen all four actions and confirm each template still renders in the panel preview with the right subject. Template bindings can silently revert to quick compose after a save.

Why four leaves: D-06 says use the same email the Consents Needed workflow sends, and that workflow picks one of these four by the `longevity-member` tag and Dependent Count. A member record always reaches a family leaf (1 or 3), because its owner's Dependent Count is at least 1 (wf1 writes the number of dependents).

5.5 Under each of the four leaves, after the Send Email -> **Add Note** on the owner (the context) -> body = "Consent Hub link resent by staff via Actions menu (request {{inboundWebhookRequest.requestId}})". Then End.

## 6. Settings, saving, and publishing

6.1 Workflow -> Settings:
- Allow re-entry = ON (stored as `allowMultiple` = true, the same as the Send Invite workflow). Staff may press the same item again for the same contact; the admin-theme client's 60 s cooldown per item is the only throttle, accepted in decision note #4.
- Remove contact from last step = ON (the same as Send Invite).

6.2 Reload the page after every save and re-check the trigger and every If/Else, because trigger multi-selects revert silently. A "Saved" toast is not proof; the reloaded workflow is.

6.3 Order: build everything in Draft -> send the §1.4 sample -> review the run log (it should end at R-01 for `SAMPLE_CONTACT_ID`) -> reload and re-check every branch -> **Publish**. Phase 6 runs the live checklist with test contacts only (never a real patient), after the admin-theme items get this workflow's URL.

6.4 Remember the apply order from §0.1: wf2 Build Status v9 must already be published in n8n. n8n changes do not ship until you click Publish.

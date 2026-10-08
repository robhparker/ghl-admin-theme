# BUILD SPEC: ClinX consent Inbound Webhook workflow (and the Send Invite rename)

**Date:** 2026-10-07 · **Builder:** Rob, by hand in ClinX 365, location `Cp2XxBsRoyKS2CUf1Hwi` (Xcelsior Health) · **Milestone:** admin-theme v0.2.0, Phase 5 (CONS-01..CONS-06) · **Status:** not applied

This spec builds ONE new workflow, "[Ready] Admin Menu: Consent Actions (webhook)", that serves both consent items of the admin-theme Actions menu ("Send individual consent" and "Resend Consent Hub link"). The workflow resolves the exact contact staff clicked from by contact ID, branches on the menu item that was pressed, and then either sends one email or refuses with a Note on the record and an internal notification that state the reason and the staff fix. It also renames the existing Send Invite workflow so its name matches what it does. Nothing here is applied yet; nothing in this folder touches ClinX, n8n, or email until Rob builds it.

**How to read it.** Steps are numbered. Each step reads "Action type -> field = value". Two kinds of ids run through the spec:

- **R-01 .. R-12** are refusals. Each appears inline where it happens and once in the register (§9) with its exact Note text, notification text, and staff fix.
- **V-01 .. V-13** are "verify in ClinX UI" markers. A marker line says what to check while building and what to do if ClinX differs. Tick each in the checklist (§10). If a check fails and the marker gives no fallback, stop building and do not publish. Checks that need a real run log (V-01, V-05, V-07, V-09, V-10, V-13) are done in the §6.3 pilot gate, after Publish but before the URL goes into any admin-theme config; if one of those fails, set the workflow back to Draft immediately.

## 0. Before you start

0.1 **Apply order: wf2 first.** Publish the n8n wf2 change (Consent Hub Status, Build Status v9, files `wf2-consent-hub-status.member-scope.json` and `wf2-member-scope.diff` in this folder; steps in this folder's README) BEFORE this workflow sends anything. Under the live Build Status v8, a member's own hub link shows the whole family and puts the member on the owner's Part 1 link. n8n changes do not ship until you click Publish. Saving the n8n workflow is not enough: confirm the live Build Status header reads v9 after publishing.

0.2 **Email template "Member Consent Forms".** Marketing -> Emails -> Templates -> New -> Code editor. Name = "Member Consent Forms". Paste the compiled `Email-Templates/Consent-Hub-Invite/consent-forms-member.html` (never the `.mjml` source). Save, close, reopen, and confirm the preview renders the Xcelsior header, the button, and the footer. The workflow step in §4 uses the subject "Your Xcelsior consent forms".

0.3 **Premium actions.** The Inbound Webhook trigger and the Custom Code action are Premium. The Find Contact action is already in use in the Send Invite workflow (3dff9d94), so it is available on this location. Custom Code is first used in §4.2 ("Capture member email"); its availability is V-06 (§4.6).

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
| `email` | the email shown on the record at click time | never used. Every guard reads the email saved on the contact record (§4.4) |
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

verify in ClinX UI (V-01): after Find Contact, `{{contact.*}}` merge fields (and the Send Email recipient) refer to the found contact. Runs 2 and 3 of the Send Invite audit suggest yes: the email went to the found contact. Check it on the run logs of the §6.3 pilot gate, where every email goes to one of Rob's two test mailboxes: the Note and the email land on the record the request named. If it differs: set the workflow back to Draft immediately, before its URL goes into the admin-theme config, and stop; the whole design assumes the found contact is the context.

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

4.2 **R-04, no own email (D-04 #2, plus the client's synthetic-email pattern).**
1. **Custom Code**, action name = "Capture member email" (the context is the member) -> Language = JavaScript -> Input properties: `memberEmail` = `{{contact.email}}`, `hintPatientId` = `{{contact.hint_patient_id}}`, `memberToken` = `{{contact.consent_hub_token}}` -> Code = the block below, pasted exactly. Click **Test your Code** (see 4.6 step 2 for why). Its outputs `memberEmail` and `memberToken` are the member side of the owner checks in §4.4.

<!-- custom-code:capture:start -->
```js
// Capture the member's SAVED email (code review CR-01, WR-01). Trimmed and lowercased, so the
// owner compare in "Compare with owner" is case-insensitive. emailCheck is 'ok' only for a
// readable, non-synthetic address; R-04 refuses anything else (fail closed).
// SYNTHETIC_EMAIL_RE is the admin-theme client pattern, verbatim: +<digits>@ (the dedupe address
// HighLevel/Hint writes for a shared signup email, owner+12@...) or +pat-<id>@ (wf1's synthetic
// key). The hintPatientId test also catches this member's own key in any form (sandbox +sbx-pat-<id>@).
var SYNTHETIC_EMAIL_RE = /\+(?:\d+|pat-[A-Za-z0-9_-]+)@/;
var raw = String(inputData.memberEmail || '').trim();
var email = raw.toLowerCase();
var pid = String(inputData.hintPatientId || '').trim().toLowerCase();
var synthetic = SYNTHETIC_EMAIL_RE.test(raw) || SYNTHETIC_EMAIL_RE.test(email) || (pid !== '' && email.indexOf('+' + pid + '@') !== -1);
var emailCheck = email === '' ? 'empty' : (synthetic ? 'synthetic' : (/^[^\s@{}]+@[^\s@{}]+\.[^\s@{}]+$/.test(email) ? 'ok' : 'invalid'));
// The member's stored token, passed through unchanged for the owner check in "Compare with owner" (WR-03).
output = { memberEmail: email, emailCheck: emailCheck, memberToken: String(inputData.memberToken || '') };
```
<!-- custom-code:capture:end -->

2. **If/Else**, action name = "Has own email": Branch "No own email" -> conditions joined with OR:
- Contact Tags includes `synthetic-email` (D-04 #2)
- Email is empty (D-04 #2)
- the "Capture member email" output `emailCheck` is not `ok` (code review WR-01: empty, synthetic, or unreadable; an output that did not resolve is also "not `ok`", so this fails closed)

-> refuse (§0.5, no restore needed): Note = "Member has no own email. Enter their real email first, or use Resend Consent Hub link on the owner." Notification with the same text. End. None -> 4.3.

verify in ClinX UI (V-10): Custom Code input properties resolve `{{contact.*}}` merge fields to the contact in context. In the §6.3 pilot gate, the "Capture member email" input log must show the member's own saved email and Hint Patient ID (for a test member whose email is `ownerlocal+<their hint_patient_id>@...`, the output is `emailCheck: 'synthetic'`). If it differs (inputs blank or literal merge text): the step outputs `empty` or `invalid` and R-04 refuses every send, so nothing goes out; stop and tell Rob.

Why the Custom Code check: wf1 never applies the `synthetic-email` tag. Its Tag Dependent node writes only `family-member` and `consent-pending`. The tag exists only on the 17 contacts the 2026-08-26 unified review tagged (testing/2026-08-26-unified-review/unified-summary.md). wf1's Build Dependents gives every dependent without their own real email the synthetic address `ownerlocal+<hint_patient_id>@ownerdomain` (production ids look like `pat-…`, sandbox ids like `sbx-pat-…`), and HighLevel/Hint write `owner+<digits>@` dedupe addresses for a shared signup email. Such a member has a non-empty email and no tag, so the two D-04 conditions alone let it through, and the earlier draft's single condition (Email contains `+{{contact.hint_patient_id}}@`) missed the `+<digits>@` form, whose digits are not the member's Hint Patient ID. The admin-theme client pre-checks the same pattern before posting (`SYNTHETIC_EMAIL_RE`, `/\+(?:\d+|pat-[A-Za-z0-9_-]+)@/`, admin-theme commit 86b53d7), but the client check is advisory: this server-side check runs the same pattern, plus this member's own key, and is the one that counts. Residual risk: a plus-address that matches neither form (for example `owner+kids@`) still passes. It reaches whoever owns that inbox with a link that opens only this member's card (wf2 v9).

4.3 **R-05, legacy member (D-04 #3).** If/Else, action name = "Has owner link": Branch "Legacy" -> conditions joined with OR: Owner Contact ID is empty OR Hint Membership ID is empty -> refuse (§0.5, no restore needed): Note = "Legacy member without an owner link. Needs backfill before an individual consent can be sent." Notification with the same text. End. None -> 4.4.

A missing member Consent Hub Token is NOT a refusal. Step 4.6 mints one on the first send, which is how CONS-02's token condition is met.

4.4 **R-06, email equals the owner's (D-04 #4).** Both sides of this compare are emails saved on contact records: the owner's saved email against the member's saved email, trimmed and lowercased. The webhook payload `email` is never used here or anywhere else. It is whatever the browser sent: it can be missing, a different address read off the page, an unsaved edit, or anything a caller of the public URL typed. 4.7 mails the member's saved address, so the guard must compare that address.
1. **Find Contact**, action name = "Find owner (email compare)" -> match Contact ID (`id`) is `{{contact.owner_contact_id}}`. Multi-path on.
2. **Contact not found** -> restore the member (Find Contact -> id == `{{inboundWebhookRequest.contactId}}`) -> refuse with R-05's text plus a suffix: Note = "Legacy member without an owner link. Needs backfill before an individual consent can be sent. (owner contact not found)". Notification with the same text. End.
3. **Contact found** -> the context is now the owner. **Custom Code**, action name = "Compare with owner" -> Language = JavaScript -> Input properties: `ownerEmail` = `{{contact.email}}` and `ownerToken` = `{{contact.consent_hub_token}}` (the owner's saved values, because the context is the owner), `memberEmail` and `memberToken` = the "Capture member email" outputs of the same names from §4.2 step 1 (insert them from the merge-field picker, V-07) -> Code = the block below, pasted exactly. Click **Test your Code**.

<!-- custom-code:compare:start -->
```js
// Compare the OWNER's saved email with the MEMBER's saved email (review CR-01).
// emailCheck = 'different' (continue), 'same' (R-06), or 'unknown' (R-06: an email is
// missing, or an earlier output did not resolve). Fail closed: only 'different' passes.
var looksLikeEmail = function (s) { return /^[^\s@{}]+@[^\s@{}]+\.[^\s@{}]+$/.test(s); };
var o = String(inputData.ownerEmail || '').trim().toLowerCase();
var m = String(inputData.memberEmail || '').trim().toLowerCase();
var emailCheck = (!looksLikeEmail(o) || !looksLikeEmail(m)) ? 'unknown' : (o === m ? 'same' : 'different');
// tokenCheck (code review WR-03): 'none' (the member has no token: mint one in 4.6), 'reuse' (a
// complete member token that is not the owner's), or 'foreign' (anything else, R-11). A member
// link is only ever mailed with a token that can open nothing but this member's card.
var mt = String(inputData.memberToken || '');
var ot = String(inputData.ownerToken || '');
var tokenCheck = mt.trim() === '' ? 'none' : ((/^adhoc_[0-9a-f]{64}$/.test(mt) && mt !== ot) ? 'reuse' : 'foreign');
output = { emailCheck: emailCheck, tokenCheck: tokenCheck };
```
<!-- custom-code:compare:end -->

4. **Find Contact**, action name = "Restore member" -> id == `{{inboundWebhookRequest.contactId}}`, which switches the context back to the member. (Its own "not found" path cannot happen, because §2 found this id seconds earlier; route it to the R-01 notification and End.)
5. **If/Else**, action name = "Shares the owner's email", on the "Compare with owner" output `emailCheck` (the context is the member again, so every refusal Note below lands on the member):
   - Branch "Different": `emailCheck` is `different` -> 4.5.
   - Branch "Same email": `emailCheck` is `same` -> refuse: Note = "Member's email matches the owner's. Use Resend Consent Hub link on the owner." Notification with the same text. End.
   - None (any other value, including an output that did not resolve) -> refuse with R-06's second text: Note = "Could not confirm the member's email differs from the owner's. Check that both records have a saved email, then press again." Notification with the same text. End.

verify in ClinX UI (V-05): how ClinX exposes the found-contact context. Check four things on the run logs of the §6.3 pilot gate: (a) after "Find owner (email compare)", the "Compare with owner" input `ownerEmail` is the owner's saved email; (b) after "Restore member", `{{contact.*}}`, the Note, and the Send Email recipient are the member again; (c) after a Find Contact that finds nothing, the context is still the member (the R-05 Note lands on the member either way, because 4.4 step 2 restores explicitly); (d) the "Compare with owner" input `memberEmail` shows the member's saved email (not blank, not merge-tag text), so a Custom Code output survives a context switch. Case does not matter: both sides are lowercased in code. If (a), (b), or (d) differ: set the workflow back to Draft immediately, rebuild with the D-04 alternative below, and repeat the pilot gate. If (d) alone differs, the guard fails closed (every send refuses with R-06's second text), so nothing reaches the owner meanwhile.

Staff should still save the record before pressing the item: an unsaved edit on screen is neither compared nor mailed. R-06 compares against the owner only; an email shared with another member (not the owner) is an accepted residual risk, see §8 (code review WR-02).

D-04's acceptable alternative: drop 4.4 entirely and rely on 4.2's synthetic checks. Residual risk: staff typed the owner's real email by hand onto the member record (wf1 never does this; Build Dependents swaps a shared signup email for the synthetic key). The member email then reaches the owner's inbox with a member-only link. 4.6 still needs `tokenCheck` on this path: keep the "Compare with owner" Custom Code step, but place it right after 4.3 in the member's context, with `memberToken` from "Capture member email" and `ownerEmail` and `ownerToken` left empty. Use only its `tokenCheck` (`none`, `reuse` for a complete `adhoc_` token, otherwise R-11); its `emailCheck` then reads `unknown` and is not used. The only check lost is "differs from the owner's token", and wf1 never gives an owner an `adhoc_` token.

4.5 **R-07, already complete (D-04 #5).** If/Else, action name = "Already complete": Branch "Complete" -> Consent Status is `complete` -> refuse (§0.5; the context is the member after 4.4's restore): Note = "Already complete. Nothing to send." Notification with the same text. End. None -> 4.6. Use the value the Form Submitted workflow a56137e1 writes (`complete`, design §5.8); if Consent Status shows as a dropdown, pick that option.

4.6 **Member token (D-05a).** If/Else, action name = "Member has a hub token", on the "Compare with owner" output `tokenCheck` (§4.4 step 3):
- Branch "No token": `tokenCheck` is `none` -> steps 1-7 below (mint, save, settle, reload, verify), then 4.7.
- Branch "Reuse": `tokenCheck` is `reuse` (the member already holds a complete `adhoc_` token that differs from the owner's) -> reuse it, write nothing (the member's link never changes) -> 4.7. HighLevel branches do not rejoin, so under "Reuse" either add a Go To action pointing at 4.7's first action (if the plan offers Go To) or repeat 4.7's three actions there.
- None (any other value: the member holds something that is not a member token, such as a copy of the owner's family token, a backfilled or imported value, or an output that did not resolve) -> **R-11**, refuse (§0.5; the context is the member): Note = "This member holds a hub token that is not their own member token (it may be a copy of the family token). Nothing was sent. Rob must clear this member's Consent Hub Token, then press again." Notification with the same text. End. Never overwrite or mail such a value: a family token in a "for you personally" email would open the whole family hub (code review WR-03).

1. **Custom Code**, action name = "Mint member hub token" -> Language = JavaScript -> Input properties = none (no `inputData` keys) -> Code = the block below, pasted exactly.

<!-- custom-code:js:start -->
```js
// Mint a member Consent Hub Token: "adhoc_" + 64 lowercase hex (32 cryptographic random bytes).
// Cryptographic sources only. If neither exists, throw: do not publish, stop and tell Rob.
// Tripwire (code review WR-05): refuse a source whose own code calls Math random, the usual
// shape of a non-cryptographic polyfill. V-08 inspects the source by hand as well.
var looksShimmed = function (fn) { return /\bMath\b[^A-Za-z0-9]{0,4}random\b/.test(String(fn)); };
var bytes = null;
var source = '';
if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
  if (looksShimmed(crypto.getRandomValues)) {
    throw new Error('crypto.getRandomValues is a Math-based shim here. Do not publish: stop and tell Rob.');
  }
  bytes = crypto.getRandomValues(new Uint8Array(32));
  source = 'web-crypto';
} else if (typeof require === 'function') {
  try {
    var nodeCrypto = require('crypto');
    bytes = looksShimmed(nodeCrypto.randomBytes) ? null : nodeCrypto.randomBytes(32);
    source = 'node-crypto';
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
// mintedAt lets "Verify saved token" refuse a result that was not produced by THIS run.
// source records which generator ran (V-08 compares it with the probe).
output = { token: 'adhoc_' + hex, mintedAt: Date.now(), source: source };
```
<!-- custom-code:js:end -->

2. Click **Test your Code**. It is mandatory: HighLevel gives later steps no output from code that was never tested. The test result shows a sample `adhoc_` token. It is not written to any contact; do not copy it anywhere.
3. **Update Contact Field**, action name = "Save member hub token" -> field = Consent Hub Token -> value = the Custom Code output `token`.
4. **Wait**, action name = "Settle concurrent presses" -> 1 minute (code review WR-04). If two presses for the same member run at once, both mint and the last save wins; the wait lets the other run's save land before this run re-reads, so step 6 can tell which run won.
5. **Find Contact**, action name = "Reload member" -> id == `{{inboundWebhookRequest.contactId}}`. This re-reads the member, so the next steps (and 4.7's email link) see the value actually stored on the record, not a value cached before the write. It was the V-09 fallback; it is now always built.
6. **Custom Code**, action name = "Verify saved token" -> Language = JavaScript -> Input properties: `savedToken` = `{{contact.consent_hub_token}}` (the stored value, after the reload), `mintedToken` and `mintedAt` = the "Mint member hub token" outputs `token` and `mintedAt` -> Code = the block below, pasted exactly. Click **Test your Code** with the inputs as they are: the test result must be `tokenCheck: 'bad'` (if it shows `ok`, stop and tell Rob). That way, if HighLevel ever replays a test result after a runtime error (V-12), it replays a refusal.

<!-- custom-code:verify:start -->
```js
// Post-condition after "Save member hub token" (code review CR-02, WR-04). Fail closed:
// 'ok' only when the STORED token is a complete member token, the mint ran in this run
// (mintedAt within the last 15 minutes), and the stored token is the one THIS run minted.
// 'superseded': a concurrent press saved its own token after ours; that run sends, this one
// does not (R-12). 'bad': an empty write, merge-tag text, a constant, or a replayed Test your
// Code result (R-10). Nothing is emailed unless the result is 'ok'.
var saved = String(inputData.savedToken || '');
var minted = String(inputData.mintedToken || '');
var mintedAt = Number(inputData.mintedAt);
var age = Date.now() - mintedAt;
var fresh = isFinite(mintedAt) && mintedAt > 0 && age > -60000 && age < 15 * 60 * 1000;
var valid = /^adhoc_[0-9a-f]{64}$/.test(saved) && fresh;
var tokenCheck = !valid ? 'bad' : (saved === minted ? 'ok' : 'superseded');
output = { tokenCheck: tokenCheck };
```
<!-- custom-code:verify:end -->

7. **If/Else**, action name = "Saved token valid": Branch "Valid" -> the "Verify saved token" output `tokenCheck` is `ok` -> 4.7 (whose email link reads the verified stored value). Branch "Superseded" -> `tokenCheck` is `superseded` -> **R-12**, refuse (§0.5; the context is the member): Note = "Another press for this member saved a newer hub token and is sending the email. This run sent nothing." Notification with the same text. End. None (any other value, including an output that did not resolve) -> **R-10**, refuse (§0.5; the context is the member after the reload): Note = "Member hub token could not be created or saved. Nothing was sent. Rob must check the Mint member hub token step and clear this member's Consent Hub Token if it is not empty." Notification with the same text. End.

Why R-10 exists: the mint's only failure handling is `throw`. If HighLevel logs a failed Custom Code action and carries on (V-12), "Save member hub token" would write an empty value, merge-tag text, or a replayed sample, and the email would follow. An empty token gives the member a dead link; a constant shared by several members lets wf2 resolve one member's link to another member's card. R-10 stops both before the email. wf2 Build Status v9 also refuses any token held by more than one contact (review CR-03).

verify in ClinX UI (V-06): Custom Code is available on this location's plan (it is a Premium action). If it differs (the action is missing or locked): do not build 4.6 another way; stop and tell Rob.

verify in ClinX UI (V-07): the Custom Code output variable name and merge syntax. HighLevel documents `output = { ... }` but not how later steps reference it. In the Update Contact Field value, open the merge-field picker, find the Custom Code step's `token`, insert it, and write the exact inserted text into §10. Do the same for "Capture member email" `memberEmail` as an input of "Compare with owner" (§4.4 step 3): an output must be pickable in a later step even after a Find Contact moved the context. If it differs (no picker entry): re-run Test your Code, then reopen the picker; if the output still does not appear, stop and tell Rob.

verify in ClinX UI (V-08): crypto is available in the Custom Code runtime and is the runtime's own generator, not a JavaScript shim. Math.random is not acceptable as a fallback, because the token is the only key to the member's hub. Two parts:
(a) Test your Code on "Mint member hub token" returns `adhoc_` plus 64 hex characters, no error, and `source` = `web-crypto` or `node-crypto`.
(b) Source probe (code review WR-05). Before pasting the mint code, paste the probe below into the same Custom Code action, click Test your Code, copy the three output values into §10, then replace the probe with the mint code and test again.

<!-- custom-code:probe:start -->
```js
// V-08 source probe: shows what the runtime's random sources really are. Not part of the workflow.
var web = 'none';
var node = 'none';
if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
  web = String(crypto.getRandomValues).slice(0, 300);
}
try {
  if (typeof require === 'function') node = String(require('crypto').randomBytes).slice(0, 300);
} catch (e) {
  node = 'require failed: ' + e.message;
}
var runtime = (typeof process !== 'undefined' && process && process.versions) ? JSON.stringify(process.versions).slice(0, 200) : 'none';
output = { web: web, node: node, runtime: runtime };
```
<!-- custom-code:probe:end -->

Accept the source the mint reports (`source` in part (a)) only if its probe text is one of: `function getRandomValues() { [native code] }` (an engine built-in, as in browsers and V8 isolates); Node's own `getRandomValues` (starts `function getRandomValues(array) {` and checks `ERR_INVALID_THIS` or `webidl`); or Node's own `randomBytes` (starts `function randomBytes(size, callback) {` and calls `assertSize`). Reject anything else, and in particular any text that mentions Math random or builds bytes in a short loop: do not publish; stop and tell Rob. Selecting Python with `secrets.token_hex(32)` (prefixed with `adhoc_`) is a cryptographic alternative Rob may approve. Stated limitation: no check from inside the sandbox can prove a generator is cryptographic. A vendor could bind a weak native function, or change how functions print. The probe and the mint's tripwire rule out the common failure, a JavaScript polyfill over Math random; beyond that we rely on HighLevel exposing the platform's crypto (§8).

verify in ClinX UI (V-09): the stored token is the one the email carries. In the §6.3 pilot gate's first send, the email's button link must end in `?t=` plus exactly the Consent Hub Token now saved on the member's record (`adhoc_` plus 64 hex), and the run log must show "Verify saved token" = `ok`. If it differs (empty or stale token in the link, although the reload in step 5 is built): set the workflow back to Draft immediately; stop and tell Rob.

verify in ClinX UI (V-12): what a Custom Code runtime error does to a run. Test it on a throwaway probe workflow, never on this one: "[TEST] Custom Code error probe" -> Inbound Webhook trigger (its own URL; never put it in admin-theme config) -> Find Contact by `{{inboundWebhookRequest.contactId}}` -> Custom Code with input `mode` = `{{inboundWebhookRequest.buttonId}}` and code `if (inputData.mode === 'throw') { throw new Error('V-12 probe'); } output = { token: 'probe-sample' };` (click Test your Code once, so `token` is pickable) -> Add Note = `V-12 probe continued past a Custom Code error. token = [` + the probe's `token` output + `]`. Publish the probe, POST the §1.4 curl once to the probe's URL, with a test contact's id and `"buttonId":"throw"`, then read the run log and the test contact's Notes. Record in §10 which happened: (a) the run stopped at the Custom Code step (no Note); (b) it continued and the Note shows `token = []` (empty); (c) it continued and the Note shows merge-tag text; (d) it continued and the Note shows `probe-sample` (a replayed test result). All four are safe with this spec: (a) sends nothing; (b) and (c) fail the `adhoc_` pattern in "Verify saved token"; (d) fails the 15-minute `mintedAt` window in "Verify saved token" (a replayed mint sample is older than that once the build is done), and a replayed "Verify saved token" result is its test result `bad`. If the run did anything else (for example the Note shows a fresh-looking value), do not publish: stop and tell Rob. Delete the probe afterwards.

verify in ClinX UI (V-13): the Wait step and concurrent runs (code review WR-04). Check: (a) the Wait action offers 1 minute (if its shortest delay is longer, use the shortest); (b) after the Wait and the reload, "Verify saved token" still receives the mint's `token` and `mintedAt` (its input log shows both, not blank); (c) two curl posts of send-individual-consent for the test member with no token, a few seconds apart, produce exactly one "Member consent email" and one R-12 Note (or, if ClinX runs one enrollment at a time per contact, one email and no second run; write which in §10). If (b) differs, every first send refuses with R-10 (fail closed): remove the Wait step, keep everything else, and accept the dead-link race stated in §8. If (c) gives two emails with different links: stop and tell Rob.

verify in ClinX UI (V-11): no other workflow triggers on a Consent Hub Token change. Automation -> Workflows -> filter by trigger type Contact Changed (and any custom-field-changed trigger) and confirm none watches Consent Hub Token. If one does: do not publish until Rob has read that workflow.

**F-2, token format.** wf1 mints owner tokens with `crypto.randomBytes(16).toString('hex')` (32 hex characters) in Build Dependents and in Prep Owner Update (Solo). This member token is `adhoc_` plus 64 hex per D-05a (32 bytes, 70 characters in total, the same lowercase hex alphabet). Hub v11, wf2 Has Token?, and Find Owner by Token pass the token through unchecked (Plan 05-01 harness). The one validator is wf2 Build Status v9's token backstop (code review CR-03): `?t=` must be 16 to 256 characters, a value starting `adhoc` must be exactly `adhoc_` plus 64 lowercase hex, and exactly one contact may store exactly that value, so a partial value such as `?t=adhoc` or a token shared by two contacts opens nothing. The prefix means a member token can never equal a wf1 owner token, makes it recognizable in contact records and logs, and is URL-safe.

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
- wf2 Build Status v9 accepts a holder only when exactly one contact stores exactly the requested token (code review CR-03), and scopes a member-held token to that member's card (Plan 05-01).

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
1. **If/Else**, action name = "Is an owner": Branch "Owner" -> Member Type is `owner`, OR (Consent Hub Token is not empty AND Consent Hub Token does not contain `adhoc_`) (code review IN-02). If the If/Else cannot nest an AND group inside an OR, use two branches instead, "Owner" (Member Type is `owner`) and "Owner by token" (Consent Hub Token is not empty AND does not contain `adhoc_`), and continue both at step 2 (Go To, or repeat step 2 under each). None -> R-08 (neither: no owner link and not an owner, for example a legacy dependent whose owner link was never written): follow §0.5 (no restore needed): Note = "No owner found for this member. Check the owner link or use the owner's own record." Notification with the same text. End.
2. In Branch "Owner" -> **If/Else** "Owner has a hub link": Branch "No token" -> Consent Hub Token is empty -> R-09 (no restore needed): Note = "The owner has no Consent Hub link (legacy or never invited). Needs a hub token before a link can be resent." Notification with the same text. End. None -> 5.4.

Why a non-`adhoc_` token counts as owner here: wf1 writes family tokens only to owners, so a contact with no owner link that holds one is a (legacy) owner. An `adhoc_` token is a member token (§4.6). Members normally carry Owner Contact ID and take the 5.2 path, but if a member's owner link is later cleared (a staff edit or a backfill), the `adhoc_` exclusion sends them to R-08 instead of mailing the owner invite template with their own member link (code review IN-02).

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

verify in ClinX UI (V-04): Track link clicks is OFF on every Send Email action in this workflow (the four here and the one in §4.7, plus its copy if §4.6's "Reuse" branch repeats §4.7), so the `?t=` hub link is never rewritten. If it differs (the toggle reverts after save): turn it off again, save, reload, reopen. Do not publish with tracking on.

After every save of this workflow, reopen all four actions and confirm each template still renders in the panel preview with the right subject. Template bindings can silently revert to quick compose after a save.

Why four leaves: D-06 says use the same email the Consents Needed workflow sends, and that workflow picks one of these four by the `longevity-member` tag and Dependent Count. A member record always reaches a family leaf (1 or 3), because its owner's Dependent Count is at least 1 (wf1 writes the number of dependents).

5.5 Under each of the four leaves, after the Send Email -> **Add Note** on the owner (the context) -> body = "Consent Hub link resent by staff via Actions menu (request {{inboundWebhookRequest.requestId}})". Then End.

## 6. Settings, saving, and publishing

6.1 Workflow -> Settings:
- Allow re-entry = ON (stored as `allowMultiple` = true, the same as the Send Invite workflow). Staff may press the same item again for the same contact; the admin-theme client's 60 s cooldown per item (per browser tab) is the only throttle, accepted in decision note #4. Concurrent presses from two tabs or two staff are handled in §4.6 steps 4-7 (R-12) and stated in §8 (code review WR-04).
- Remove contact from last step = ON (the same as Send Invite).

6.2 Reload the page after every save and re-check the trigger and every If/Else, because trigger multi-selects revert silently. A "Saved" toast is not proof; the reloaded workflow is.

6.3 **Order, and the pilot gate (code review WR-06).** Some checks (V-01, V-05, V-07's second half, V-09, V-10, V-13) are only visible on the run log of a real run, and a Draft workflow does not run on contacts. So the first real runs happen on the published workflow, made harmless by three rules: the URL is in no admin-theme config yet, so only Rob's curl can reach it; the only contacts used are two test contacts whose emails are Rob's own mailboxes; and any failed check sets the workflow back to Draft immediately.
1. Build everything in Draft -> send the §1.4 sample -> review the run log (it should end at R-01 for `SAMPLE_CONTACT_ID`) -> reload and re-check every branch. Tick the build-time checks (V-02, V-03, V-04, V-06, V-07's first half, V-08, V-11) and run the V-12 probe on its throwaway workflow.
2. Create two test contacts, never a real patient. Test owner: Member Type `owner`, a Consent Hub Token (any 32 lowercase hex characters you generate), a Hint Membership ID in the test style, email = Rob's mailbox A. Test member: tag `family-member`, Owner Contact ID = the test owner's contact id, the same Hint Membership ID, a Hint Patient ID in the test style, no Consent Hub Token, email = Rob's mailbox B. Use a plus-tag of letters only (for example `rob+consent-owner@...` and `rob+consent-member@...`), because R-04 refuses `+<digits>@` and `+pat-...@` addresses. Different mailboxes make a wrong-context send visible; both being Rob's makes it harmless.
3. **Publish.** Do not put the URL into the admin-theme config yet.
4. Pilot runs, each a curl of the §1.4 shape to this workflow's URL with a test contact's real id and an empty payload email (which also proves no guard reads it):

```bash
curl -sS -X POST "PASTE_CONSENT_WEBHOOK_URL_HERE" \
  -H "Content-Type: application/json" \
  -d '{"contactId":"PASTE_TEST_MEMBER_CONTACT_ID","locationId":"Cp2XxBsRoyKS2CUf1Hwi","buttonId":"send-individual-consent","requestId":"pilot-0001","sentAt":"2026-10-08T00:00:00.000Z","email":"","phone":"","source":"pilot-gate"}'
```

   Run, in order, with a new `requestId` each time: send-individual-consent on the test member (mint path; email in mailbox B with `?t=` equal to the member's saved token: V-01, V-05, V-07, V-09, V-10); the same again (reuse path, same link); clear the member's Consent Hub Token and post twice a few seconds apart (V-13); resend-consent-hub on the test member and on the test owner (both to mailbox A). Read every run log.
5. **If any check differs: set the workflow back to Draft immediately**, before its URL goes into the admin-theme config. Fix it, publish again, and repeat step 4. The URL goes into admin-theme (Phase 6) only after every pilot check passes. Phase 6 then runs the README live checks, still with test contacts only.

6.4 Remember the apply order from §0.1: wf2 Build Status v9 must already be published in n8n. n8n changes do not ship until you click Publish.

## 7. Rename the Send Invite workflow

7.1 Automation -> Workflows -> open workflow `3dff9d94-403f-41ae-8496-c47320fc0ea6`, "WEBHOOK TEST Send Hint JOIN LINK & Reminders" (D-09). Rename it to "[Ready] Admin Menu: Send Invite (webhook)". Change nothing else: the Inbound Webhook trigger `bde416ab-a074-4946-bf99-7266eb1b0f4e`, the Find Contact by Webhook Contact ID step, the Longevity/DPC If/Else, and both emails stay exactly as they are. Renaming does not change the webhook URL, so the admin-theme Send Invite item keeps working with no config change.

7.2 Save -> reload -> confirm the new name, that the trigger id is still `bde416ab-a074-4946-bf99-7266eb1b0f4e`, and that the workflow is still Published. If a rename puts a published workflow into a draft state, publish it again and reload.

7.3 Optional (D-09; Rob's choice): on its "Contact not found" branch, which today ends silently, add Internal Notification -> body = `Send Invite failed: contact not found. Request {{inboundWebhookRequest.requestId}}, contact {{inboundWebhookRequest.contactId}}.` Then End. Same recipients as §0.6.

7.4 For information only: Send Invite inherits the Longevity branch. A contact tagged `longevity-interest` (or `form:longevity`, `trigger:longevity`, `reason:longevity`) without `trigger:direct` gets the Longevity Hint Link email from the Send Invite item. This milestone does not change that (STATE.md concern); keep it in mind during Phase 6 testing.

## 8. Security and privacy (AR-03-01)

What this workflow changes for the accepted risk AR-03-01 (D-14):

- **Volume grows; disclosure does not.** This adds a second public Inbound Webhook URL (the first is Send Invite's). Anyone holding it can post any `contactId` and `buttonId` and make the workflow send consent emails, so spam or confusing-email volume can grow. Disclosure does not grow: mail only ever goes to the address on file for the resolved contact (the member's own email, or the owner's), and every guard (R-01 to R-12) runs server-side in ClinX on values saved on the contact records. No guard reads the payload `email` or `phone`; only `contactId` (which record) and `buttonId` (which action) come from the request. The admin-theme 60 s cooldown per item is the only throttle.
- **No patient data in URLs** beyond the opaque hub token in the email link. The webhook payload is unchanged from v0.1.2. No new PHI flows through n8n: wf2 already receives the token and returns card data, and v9 reduces what a member token can see to that member's own card.
- **Tokens** are 256-bit cryptographic random values (32 bytes from web crypto or Node crypto, never Math random) with the `adhoc_` prefix. The test token shown by Test your Code is never stored. Limitation (code review WR-05): the Custom Code sandbox is HighLevel's, and no code inside it can prove its generator is cryptographic. V-08's source probe and the mint's tripwire refuse the common failure (a JavaScript shim over Math random); beyond that, the token's strength rests on HighLevel exposing the platform crypto unaltered. Python `secrets.token_hex(32)` is the alternative if V-08 rejects both JavaScript sources.
- **Notes and notifications** carry the reason, the staff fix, the buttonId, the requestId, and the contact id only. No names, dates of birth, contact details, or clinical data.
- **Contact resolution is by ID only**, never by email or phone (§2), so a shared email cannot redirect an action to the wrong family member.
- **Residual risk accepted (code review WR-02): two members sharing one saved email.** R-06 compares the member's saved email with the owner's only. If staff save member B's address on member A (two adult children sharing an inbox, or a copy-paste slip), A's email goes to that inbox, and A's link shows A's own card, including A's name, email, phone, and date of birth in the Part 1 prefill, to whoever reads it. Why it is accepted: the workflow resolves A by contact ID and mails exactly the address saved on A; ClinX has no reliable way to search the other family members by email inside the workflow (Find Contact returns one contact and moves the context, so it cannot prove that no other member holds the address). The exposure is bounded to one member's own card, never the family (wf2 v9), and only to an address staff deliberately saved on that member. Staff rule: press "Send individual consent" only after confirming with the member that the saved email is their own. A server-side check (search the membership by `hint_membership_id` for the same lowercased email) needs an API call with a credential and joins the deferred hardening work below.
- **Concurrent presses (code review WR-04).** The 60 s cooldown is per browser tab, so two staff, two tabs, or a direct POST can start two runs for the same member. Mint path: both runs mint and the last save wins. The 1-minute "Settle concurrent presses" wait, the reload, and "Verify saved token" (stored token must equal this run's minted token) make the run whose token was overwritten end with R-12 and send nothing, so one email goes out and its link is the stored token. This holds for presses less than about a minute apart, which is the realistic case; a second run would need more than a minute between reading the member and saving its token to slip past it. Reuse path (the member already holds a token), and presses more than a minute apart: the second run reuses the stored token and sends a second email. That email is a duplicate with the same working link, never a dead or different one. Accepted residual risk: duplicate sends are possible; dead links are not.
- **Deferred:** server-side dedupe and INV-01..05 stay in the hardening seed (`seeds/consent-actions-hardening.md` in admin-theme).

## 9. Refusal register

Every refusal follows §0.5: restore the clicked contact if needed, Note, Internal Notification, End. The notification body is `Consent action refused (R-xx): <Note text> Action {{inboundWebhookRequest.buttonId}}, request {{inboundWebhookRequest.requestId}}, contact {{inboundWebhookRequest.contactId}}.` except for R-01, which has its own text because there is no contact.

| Id | Branch/step | Condition | Note text | Notification text | Staff fix |
|---|---|---|---|---|---|
| R-01 | §2.2, any | Find Contact by `{{inboundWebhookRequest.contactId}}` finds nothing | none (there is no contact) | `Consent action failed: contact not found. Action {{inboundWebhookRequest.buttonId}}, request {{inboundWebhookRequest.requestId}}, contact {{inboundWebhookRequest.contactId}}.` | Reload the contact record and press the item again; if it repeats, the contact was deleted or merged |
| R-02 | §3.2, None branch | `buttonId` is neither `send-individual-consent` nor `resend-consent-hub` | "Consent action failed: unknown action ({{inboundWebhookRequest.buttonId}}). No email sent. Check the Actions menu item id in the admin-theme config." | §0.5 format with the Note text | Rob checks the item id in `config/agency-config.json` |
| R-03 | §4.1, A | Contact Tags does not include `family-member` | "Not a family member. Use Resend Consent Hub link on the owner." | §0.5 format with the Note text | Use Resend Consent Hub link on the owner |
| R-04 | §4.2 step 2, A | Tag `synthetic-email`, OR Email empty, OR "Capture member email" `emailCheck` is not `ok` (empty, unreadable, `+<digits>@`, `+pat-<id>@`, or `+<this member's hint_patient_id>@`) | "Member has no own email. Enter their real email first, or use Resend Consent Hub link on the owner." | §0.5 format with the Note text | Enter the member's real email and save, or use Resend Consent Hub link on the owner |
| R-05 | §4.3 and §4.4 step 2, A | Owner Contact ID empty OR Hint Membership ID empty; or the owner contact is not found (Note gets the suffix " (owner contact not found)") | "Legacy member without an owner link. Needs backfill before an individual consent can be sent." | §0.5 format with the Note text | This is a legacy member: Rob backfills the owner link and membership id first |
| R-06 | §4.4 step 5, A | "Compare with owner": the owner's saved Email equals the member's saved Email (trimmed, lowercased); second text when either is missing or did not resolve | "Member's email matches the owner's. Use Resend Consent Hub link on the owner." Second text: "Could not confirm the member's email differs from the owner's. Check that both records have a saved email, then press again." | §0.5 format with the Note text | Use Resend Consent Hub link on the owner, or give the member their own email; for the second text, save an email on both records |
| R-07 | §4.5, A | Consent Status is `complete` | "Already complete. Nothing to send." | §0.5 format with the Note text | None needed; the member's forms are done |
| R-08 | §5.2 step 2 and §5.3 step 1, B | Member's owner not found, or the contact has no owner link and is not an owner | "No owner found for this member. Check the owner link or use the owner's own record." | §0.5 format with the Note text | Open the owner's record and press Resend there, or ask Rob to fix the owner link |
| R-09 | §5.2 step 4 and §5.3 step 2, B | The owner's Consent Hub Token is empty | "The owner has no Consent Hub link (legacy or never invited). Needs a hub token before a link can be resent." | §0.5 format with the Note text | Rob mints or backfills the owner's hub token (legacy owners have none) |
| R-10 | §4.6 step 7, A | "Verify saved token" is not `ok`: the stored Consent Hub Token is not `adhoc_` plus 64 lowercase hex after the save and reload, or the mint did not run in this run | "Member hub token could not be created or saved. Nothing was sent. Rob must check the Mint member hub token step and clear this member's Consent Hub Token if it is not empty." | §0.5 format with the Note text | Rob reads the run log of "Mint member hub token", fixes it, clears the member's Consent Hub Token, then staff press again |
| R-11 | §4.6 None branch, A | "Compare with owner" `tokenCheck` is neither `none` nor `reuse`: the member's stored token is not `adhoc_` plus 64 lowercase hex, or equals the owner's token | "This member holds a hub token that is not their own member token (it may be a copy of the family token). Nothing was sent. Rob must clear this member's Consent Hub Token, then press again." | §0.5 format with the Note text | Rob checks where the value came from, clears the member's Consent Hub Token, then staff press again (a new member token is minted) |
| R-12 | §4.6 step 7, A | "Verify saved token" is `superseded`: the stored token is a valid member token but not the one this run minted (a concurrent press saved after it) | "Another press for this member saved a newer hub token and is sending the email. This run sent nothing." | §0.5 format with the Note text | None needed; confirm the member received exactly one email |

## 10. Verify in ClinX UI checklist

Tick each while building, or in the §6.3 pilot gate where the check needs a real run log. V-01 to V-09 are required by D-07 and D-05a; V-10 and V-11 are planner additions; V-12 and V-13 are code-review additions (2026-10-08).

| Id | Where | What to check | If it differs | Result |
|---|---|---|---|---|
| V-01 (D-07, required) | §2.1 | After Find Contact, `{{contact.*}}` and the Send Email recipient are the found contact (pilot gate) | Back to Draft immediately, before the URL goes into admin-theme config; stop | |
| V-02 (D-07, required) | §3.1 | How `{{inboundWebhookRequest.buttonId}}` appears in the If/Else picker | Stop; a workaround changes D-01 | |
| V-03 (D-07, required) | §1.4 | The captured trigger sample includes `buttonId` | Re-send the sample; if still missing, do not continue | |
| V-04 (D-07, required) | §5.4, §4.7 | Track link clicks OFF on every Send Email action (four in §5.4, one or two in §4.7) | Turn off, save, reload, reopen; never publish with tracking on | |
| V-05 (D-04 #4, required) | §4.4, §5.2 | Find Contact switches the context to the found contact; "Restore member" switches back; a failed Find Contact leaves the member; the "Capture member email" output still resolves after the switch | Back to Draft immediately; rebuild with the D-04 alternative (drop §4.4), accept the named residual risk, repeat the pilot gate | |
| V-06 (D-05a, required) | §4.6 | Custom Code is available on the plan (Premium) | Stop and tell Rob | |
| V-07 (D-05a, required) | §4.2 step 1, §4.4 step 3, §4.6 step 3 | Custom Code output variable name and the merge syntax inserted for `token` and `memberEmail` (write it here) | Re-test the code; if no picker entry, stop and tell Rob | |
| V-08 (D-05a, required) | §4.6 step 2 | (a) Test your Code returns `adhoc_` plus 64 hex and `source`; (b) the source probe's `web`, `node`, `runtime` (write them here) show the reported source is an engine built-in or Node's own `getRandomValues` / `randomBytes`, not a Math-based shim | Do not publish; stop and tell Rob (Python `secrets.token_hex(32)` only with Rob's approval) | |
| V-09 (D-05a, required) | §4.6 to §4.7 | The email link carries exactly the Consent Hub Token saved on the member (after "Reload member"), and "Verify saved token" logged `ok` (pilot gate) | Back to Draft immediately; stop and tell Rob | |
| V-10 (planner addition) | §4.2 step 1 | Custom Code inputs resolve `{{contact.email}}` and `{{contact.hint_patient_id}}` to the member in context (a synthetic test member gives `emailCheck: 'synthetic'`) | R-04 then refuses every send (fail closed); stop and tell Rob | |
| V-11 (planner addition) | §4.6 | No other workflow triggers on a Consent Hub Token change | Do not publish until Rob reads that workflow | |
| V-12 (review CR-02) | §4.6 | What a Custom Code runtime error does to a run, on the throwaway probe workflow: (a) stops, (b) continues with empty output, (c) continues with merge-tag text, (d) continues with the replayed test result (write which) | Anything other than (a) to (d): do not publish; stop and tell Rob | |
| V-13 (review WR-04) | §4.6 step 4 | The Wait offers 1 minute; the mint's `token` and `mintedAt` still reach "Verify saved token" after the Wait and reload; two quick presses give one email plus one R-12 Note (or one run only; write which) | (b) fails: remove the Wait, accept the dead-link race in §8; two different links mailed: stop and tell Rob | |

## 11. Rollback

- **Consent workflow:** set "[Ready] Admin Menu: Consent Actions (webhook)" back to Draft. The two admin-theme consent items then fail as requests (the client shows its unconfirmed or failed state), and the Phase 6 rollback to the admin-theme v0.1.2 tag removes the items entirely. Nothing else depends on this workflow.
- **Send Invite rename:** renaming it back to "WEBHOOK TEST Send Hint JOIN LINK & Reminders" is cosmetic; the trigger URL never changed.
- **wf2:** the rollback order lives in this folder's README. Unpublish (Draft) the consent workflow FIRST, then clear or ignore member `adhoc_` tokens, and only then roll wf2 back to v8, because under v8 a member's own link shows the whole family.
- **Minted member tokens** (`adhoc_` values in members' Consent Hub Token) are harmless while wf2 v9 is live: each opens only that member's card. Clearing them is optional; no other workflow reads them (§4.8, V-11).

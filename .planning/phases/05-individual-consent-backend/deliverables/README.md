# Individual consent backend: apply order, wf2 member scope, member email, rollback (2026-10-07)

**Proposal folder:** `hint-api/proposals/2026-10-07-individual-consent/` · **Milestone:** admin-theme v0.2.0, Phase 5 (HUB-01..HUB-04, CONS-01..CONS-06) · **Status:** not applied. Nothing in this folder has touched n8n, ClinX, or any email yet. Rob applies every step by hand, in the order below.

What this delivers: staff press "Send individual consent" on a family member's record and the member gets their own email with their own hub link, which shows only their own card. "Resend Consent Hub link" resends the owner's invite from either record. Every refusal leaves a Note and an internal notification that state the reason and the fix.

## Files

| File | Where | Purpose |
|---|---|---|
| `README.md` | this folder | This index: apply order, wf2 change list, the Build Status v9 paste block, rollback, Phase 6 checks, open questions |
| `BUILD-SPEC-clinx-consent-webhook.md` | this folder | Click-by-click build of the ClinX workflow "[Ready] Admin Menu: Consent Actions (webhook)", refusals R-01..R-10, checklist V-01..V-12, the Send Invite rename |
| `wf2-consent-hub-status.member-scope.json` | this folder | wf2 Consent Hub Status (`RxnpkyL0jng8hVx7`) with Build Status v9, synced to the live v8 roster. Reference only: never import it (see F-1) |
| `wf2-member-scope.diff` | this folder | Unified diff of the JSON above against the stale repo mirror `n8n/2-consent-hub-status.json` (shows the v8 sync and v9 together) |
| `COMPLETION-PATH.md` | this folder | How a member's own completion reaches the owner's hub (HUB-04), the hub no-change decision (D-11), Q-1 and Q-2 |
| `consent-forms-member.mjml` | `Email-Templates/Consent-Hub-Invite/` | Source of the member email "Your Xcelsior consent forms", Consent Hub Invite house style |
| `consent-forms-member.html` | `Email-Templates/Consent-Hub-Invite/` | Compiled by `build.sh` (26.5 KB, under Gmail's 102 KB clip). This is what you paste into the ClinX template "Member Consent Forms" |

No `hub-page.diff`: the hub page needs no change (D-11). Byte-identical mirrors of all seven files, plus the offline harnesses that prove them, live in admin-theme under `.planning/phases/05-individual-consent-backend/deliverables/` and `.../harness/`. None of these files is committed in this repo.

## Read first: the repo wf2 mirror is stale (F-1)

- `hint-api/n8n/2-consent-hub-status.json` is Build Status v6 with a `Lookup Member Docs` node. Live wf2 `RxnpkyL0jng8hVx7` is v8 (versionId `dbe383be-ac63-433a-af8e-5564d948aec9` as of the 2026-08-24 export): `Lookup Member Docs` is gone and `Refetch Member` connects straight to `Build Status`.
- `wf2-consent-hub-status.member-scope.json` is that mirror synced to live v8 plus the v9 change, so `wf2-member-scope.diff` shows both the sync and v9. Only the Build Status code is new for live.
- Before pasting, open the live Build Status node and confirm its first line reads `// v8: PART-1 PREFILL`. If it does not, stop: the base has moved, and v9 must be rebuilt on the new base.
- Do not import the JSON into n8n. An import creates a second workflow with the placeholder PIT and a webhook path that clashes with the live one. Paste the code block below into the existing node instead.

## Apply order

1. **n8n wf2 (Consent Hub Status, `RxnpkyL0jng8hVx7`).** Open the Build Status node and confirm the first line reads `// v8: PART-1 PREFILL`. Select all of its code, replace it with the Build Status v9 block below, Save, then **Publish**. n8n changes do not ship until you click Publish. After publishing, reopen the node and confirm the first line reads `// v9: MEMBER SCOPE (2026-10-07)`. Smoke check: open an existing owner's hub link; it still shows the whole family exactly as before (owner responses are byte-identical to v8).
2. **Hub page:** nothing to change. Hub v11 renders a member's single card and recovers the member's token on return as-is. Evidence: [COMPLETION-PATH.md, D-11 section](COMPLETION-PATH.md#hub-page-v11-with-a-member-scoped-response-d-11).
3. **ClinX email template "Member Consent Forms".** Marketing -> Emails -> Templates -> New -> Code editor. Paste the compiled `Email-Templates/Consent-Hub-Invite/consent-forms-member.html`, never the `.mjml` source. Save, close, reopen, and confirm the preview shows the header, the "Complete My Forms" button, and the footer (BUILD-SPEC §0.2). The subject "Your Xcelsior consent forms" is set in the workflow's Send Email action, not in the template.
4. **Build the consent workflow** "[Ready] Admin Menu: Consent Actions (webhook)" per `BUILD-SPEC-clinx-consent-webhook.md` §0 to §6, ticking §10 (V-01..V-12) as you go: build in Draft, send the §1.4 fake-data sample, review the run log, reload and re-check every branch, then Publish. Track link clicks stays OFF on every Send Email (V-04).
5. **Rename Send Invite** per BUILD-SPEC §7: workflow `3dff9d94-403f-41ae-8496-c47320fc0ea6` becomes "[Ready] Admin Menu: Send Invite (webhook)". The webhook URL does not change.
6. **Phase 6 (admin-theme):** put the consent workflow's Inbound Webhook URL into both consent items ("Send individual consent" and "Resend Consent Hub link") in `config/agency-config.json`, release, then run the Phase 6 live checks below with test contacts only.

## wf2 change, node by node

Status is relative to live v8. "sync" means the repo mirror is behind live and the JSON simply catches up; there is nothing to do in n8n for those rows.

| # | Node | Status |
|---|---|---|
| 1 | Status Webhook | unchanged |
| 2 | Config | unchanged |
| 3 | Has Token? | unchanged |
| 4 | Respond 404 | unchanged |
| 5 | Fetch GHL Custom Fields | unchanged |
| 6 | Build CF Map | unchanged |
| 7 | Find Owner by Token | unchanged |
| 8 | Owner Found? | unchanged |
| 9 | Extract Owner | unchanged |
| 10 | Find Members | unchanged |
| 11 | List Members | unchanged |
| 12 | Refetch Member | unchanged node; its connection to Build Status is a sync, already live since 2026-08-11 (no action) |
| 13 | Lookup Member Docs | removed: sync, already live since 2026-08-11 (no action) |
| 14 | Build Status | **changed, apply** (v8 to v9: paste the block below) |
| 15 | Respond 200 Status | unchanged |

The whole live change, v8 to v9 (generated with `diff -u` from `proposals/2026-08-11-part1-prefill/build-status-v8-PROPOSED.js`, which equals the live v8 code, against the v9 code):

```diff
--- a/build-status-v8-live.js
+++ b/build-status-v9-member-scope.js
@@ -1,3 +1,29 @@
+// v9: MEMBER SCOPE (2026-10-07). Changes vs v8:
+//   * Token backstop (code review CR-03, 2026-10-08), before both paths: ?t= must be 16 to
+//     256 characters, any value starting 'adhoc' must be the full 'adhoc_' plus 64 lowercase
+//     hex, and EXACTLY ONE 'Find Owner by Token' hit may store that exact value, which must be
+//     the contact Extract Owner used. Otherwise the body is empty (owner null, no members),
+//     which hub v11 shows as its could-not-load message. This does not depend on how the
+//     contacts-search 'eq' filter matches. A well-formed single-match request passes it
+//     untouched, so owner responses stay byte-identical to v8.
+//   * The token holder is that single exact hit - the same record Extract Owner used, so
+//     own.ownerId is the HOLDER's id, whoever that is.
+//   * The holder is a MEMBER when owner_contact_id is non-empty OR member_type (trimmed,
+//     lowercased) is not 'owner' - the n8n/README role rule (2026-08-25: owner = empty
+//     owner_contact_id plus member_type 'owner'). A legacy holder with neither field set
+//     is treated as a member (fail closed: it can never see the family).
+//   * A member token returns ONLY the holder's card, built with exactly the fields and
+//     helpers the v8 members loop uses (first_name, member_type, status, then form_params
+//     via formParamsFor(c) or doc_status/doc_ref via docStateFor(c)), with owner null.
+//     No other family member's name, contact id, or email leaves this node. A holder
+//     missing from the refetch, or without hint_patient_id, gets no card (hub shows its
+//     could-not-load message).
+//   * Owner tokens skip the member-scope block and run the v8 code below UNCHANGED, so
+//     owner responses are byte-identical to v8.
+//   * Ad hoc member tokens ('adhoc_' plus 64 hex) minted by the ClinX consent workflow need
+//     no change anywhere else in wf2: Has Token? only tests notEmpty, and Find Owner by Token
+//     passes the raw value to an 'eq' contacts-search filter. The backstop above is the only
+//     place that validates the token.
 // v8: PART-1 PREFILL. Changes vs v7:
 //   * formParamsFor adds demographic params for the Part 1 querystring: phone, and
 //     date_of_birth as MM/DD/YYYY (the form IGNORES ISO dates - probe-proven
@@ -67,6 +93,36 @@
   if (!signed) out.doc_ref = docRef;
   return out;
 };
+// --- v9 token backstop (see header) ------------------------------------------
+const sw = $('Status Webhook').first().json;
+const q = String(sw.query && sw.query.t ? sw.query.t : '');
+const hits = ($('Find Owner by Token').first().json.contacts || []).filter(h => String(val(h, 'consent_hub_token')) === q);
+const wellFormed = q.length >= 16 && q.length <= 256 && (!/^adhoc/i.test(q) || /^adhoc_[0-9a-f]{64}$/.test(q));
+if (!wellFormed || hits.length !== 1 || hits[0].id !== own.ownerId) {
+  return [{ json: { body: { practice: practice, owner_first_name: '', owner: null, members: [], all_complete: false, all_signed: false } } }];
+}
+// --- v9 member scope (see header) --------------------------------------------
+const holder = hits[0];
+const holderIsMember = String(val(holder, 'owner_contact_id') || '') !== '' || String(val(holder, 'member_type') || '').trim().toLowerCase() !== 'owner';
+if (holderIsMember) {
+  const members = [];
+  const c = freshItems.find(x => x.id === own.ownerId);
+  if (c && String(val(c, 'hint_patient_id') || '') !== '') {
+    const consentDone = String(val(c, 'consent_status')).toLowerCase() === 'complete';
+    const m = { first_name: c.firstName || '', member_type: String(val(c, 'member_type') || ''), status: consentDone ? 'complete' : 'pending' };
+    if (!consentDone) {
+      m.form_params = formParamsFor(c);
+    } else {
+      const d = docStateFor(c);
+      m.doc_status = d.doc_status;
+      if (d.doc_ref) m.doc_ref = d.doc_ref;
+    }
+    members.push(m);
+  }
+  const one = members.length === 1;
+  const body = { practice: practice, owner_first_name: own.ownerFirstName, owner: null, members: members, all_complete: one && members[0].status === 'complete', all_signed: one && members[0].doc_status === 'signed' };
+  return [{ json: { body: body } }];
+}
 let owner = null;
 let ownerSigned = false;
 const ownerIdx = freshItems.findIndex(c => c.id === own.ownerId);
```

## Build Status v9 (paste into the live Build Status node)

Paste everything between the fences, exactly. This is the Build Status `jsCode` from `wf2-consent-hub-status.member-scope.json`, and the admin-theme phase gate proves the two are identical.

<!-- build-status-v9:start -->
```js
// v9: MEMBER SCOPE (2026-10-07). Changes vs v8:
//   * Token backstop (code review CR-03, 2026-10-08), before both paths: ?t= must be 16 to
//     256 characters, any value starting 'adhoc' must be the full 'adhoc_' plus 64 lowercase
//     hex, and EXACTLY ONE 'Find Owner by Token' hit may store that exact value, which must be
//     the contact Extract Owner used. Otherwise the body is empty (owner null, no members),
//     which hub v11 shows as its could-not-load message. This does not depend on how the
//     contacts-search 'eq' filter matches. A well-formed single-match request passes it
//     untouched, so owner responses stay byte-identical to v8.
//   * The token holder is that single exact hit - the same record Extract Owner used, so
//     own.ownerId is the HOLDER's id, whoever that is.
//   * The holder is a MEMBER when owner_contact_id is non-empty OR member_type (trimmed,
//     lowercased) is not 'owner' - the n8n/README role rule (2026-08-25: owner = empty
//     owner_contact_id plus member_type 'owner'). A legacy holder with neither field set
//     is treated as a member (fail closed: it can never see the family).
//   * A member token returns ONLY the holder's card, built with exactly the fields and
//     helpers the v8 members loop uses (first_name, member_type, status, then form_params
//     via formParamsFor(c) or doc_status/doc_ref via docStateFor(c)), with owner null.
//     No other family member's name, contact id, or email leaves this node. A holder
//     missing from the refetch, or without hint_patient_id, gets no card (hub shows its
//     could-not-load message).
//   * Owner tokens skip the member-scope block and run the v8 code below UNCHANGED, so
//     owner responses are byte-identical to v8.
//   * Ad hoc member tokens ('adhoc_' plus 64 hex) minted by the ClinX consent workflow need
//     no change anywhere else in wf2: Has Token? only tests notEmpty, and Find Owner by Token
//     passes the raw value to an 'eq' contacts-search filter. The backstop above is the only
//     place that validates the token.
// v8: PART-1 PREFILL. Changes vs v7:
//   * formParamsFor adds demographic params for the Part 1 querystring: phone, and
//     date_of_birth as MM/DD/YYYY (the form IGNORES ISO dates - probe-proven
//     2026-08-11), plus the Self/Child attestation radio via query key 'form_behalf'
//     (probe-confirmed 2026-08-11; owner card -> Self, member_type child -> Child).
//   * Variant A (Rob, 2026-08-11): DOB rides in the URL. INCLUDE_DOB=false gives
//     Variant B (PHI-minimal: name+phone only) with no other change.
//   * Omit-when-missing everywhere: a contact without the field gets NO param, so
//     members created before this version render byte-identical links to v7.
//   * The owner card call passes isOwner=true (radio value 'Self'); everything else -
//     owner/member cards, doc status, solo semantics, response shape - is byte-identical
//     to v7. Hub v11 needs NO change: it already appends form_params to both card URLs.
// v7: EVENT-DRIVEN SIGNED DETECTION. Changes vs v6:
//   * Signed is now read from the contact custom field doc_status_agreement ('signed'),
//     written by the GHL workflow "Document Completed - Mark Agreement Signed"
//     (Documents & Contracts trigger, Status=Completed, hub template only).
//     v6 queried the documents API by contact NAME and matched links[].referenceId,
//     which permanently stranded any contact renamed after their doc was minted
//     (proven live 2026-07-30: Test3Mom signed-but-stuck vs Test6Dad matched-and-green).
//   * The Lookup Member Docs HTTP node is DELETED; Build Status's input is now
//     Refetch Member directly. This also removes the index-alignment hazard
//     (docItems[i] assumed 1:1 order with freshItems[i]).
//   * docStateFor no longer takes an index. Everything else - owner/member card
//     building, solo semantics, response shape - is byte-identical to v6.
//   * Legacy note: contacts whose doc was signed BEFORE the field existed read as
//     awaiting_signature until the field is backfilled (sandbox-only concern).
// v6: SOLO MODE - members==[] lets the OWNER alone decide all_complete/all_signed.
// v5: the OWNER gets the same journey as members (consent_status mechanism + form_params).
// Members come from fresh per-contact GETs (search index lags writes).
// form_params/doc_ref served HERE (token-authenticated fetch) - never baked into URLs/emails.
// --- v8 prefill config -------------------------------------------------------
const INCLUDE_DOB = true; // Variant A (Rob, 2026-08-11). false = Variant B.
// Attestation radio (Rob, 2026-08-11: prefill it). Query key 'form_behalf' read off
// the form builder by Rob and probe-CONFIRMED same day on BOTH funnels:
// /family-part-1?form_behalf=Child checks Child; /family-owner-part-1?form_behalf=Self
// checks Self. Values must match the option labels EXACTLY. Full set (Rob, 2026-08-11):
//   'Self' | 'Child' | 'Other: I have legal authority to fill out on behalf of the patient'
// Only Self/Child are ever auto-selected; 'Other' is a stronger legal claim and is
// deliberately never prefilled.
const RADIO_QUERY_KEY = 'form_behalf';
const RADIO_VALUE_FOR = (memberType, isOwner) => isOwner ? 'Self' : (String(memberType).toLowerCase() === 'child' ? 'Child' : '');
const map = $('Build CF Map').first().json.map;
const own = $('Extract Owner').first().json;
const practice = $('Config').first().json.PRACTICE_NAME;
const freshItems = $('Refetch Member').all().map(it => it.json.contact || it.json);
const val = (c, key) => { const f = (c.customFields || []).find(x => x.id === map['contact.' + key]); if (!f) return ''; return (f.value !== undefined && f.value !== null) ? f.value : (f.field_value || ''); };
const formParamsFor = (c, isOwner) => {
  const pairs = { contact_id: c.id, email: c.email || '', first_name: c.firstName || '', last_name: c.lastName || '', hint_patient_id: String(val(c, 'hint_patient_id') || ''), member_type: String(val(c, 'member_type') || '') };
  // v8 prefill params - omit-when-missing, never emit '' (see header).
  if (c.phone) pairs.phone = c.phone;
  if (INCLUDE_DOB && c.dateOfBirth) {
    const d = String(c.dateOfBirth).slice(0, 10).split('-');
    if (d.length === 3) pairs.date_of_birth = d[1] + '/' + d[2] + '/' + d[0];
  }
  if (RADIO_QUERY_KEY) {
    const rv = RADIO_VALUE_FOR(pairs.member_type, !!isOwner);
    if (rv) pairs[RADIO_QUERY_KEY] = rv;
  }
  return Object.keys(pairs).map(k => k + '=' + encodeURIComponent(pairs[k])).join('&');
};
const docStateFor = (c) => {
  const docRef = String(val(c, 'doc_ref_agreement') || '');
  const out = { doc_status: 'none', doc_ref: '' };
  if (!docRef) return out;
  const signed = String(val(c, 'doc_status_agreement') || '').toLowerCase() === 'signed';
  out.doc_status = signed ? 'signed' : 'awaiting_signature';
  if (!signed) out.doc_ref = docRef;
  return out;
};
// --- v9 token backstop (see header) ------------------------------------------
const sw = $('Status Webhook').first().json;
const q = String(sw.query && sw.query.t ? sw.query.t : '');
const hits = ($('Find Owner by Token').first().json.contacts || []).filter(h => String(val(h, 'consent_hub_token')) === q);
const wellFormed = q.length >= 16 && q.length <= 256 && (!/^adhoc/i.test(q) || /^adhoc_[0-9a-f]{64}$/.test(q));
if (!wellFormed || hits.length !== 1 || hits[0].id !== own.ownerId) {
  return [{ json: { body: { practice: practice, owner_first_name: '', owner: null, members: [], all_complete: false, all_signed: false } } }];
}
// --- v9 member scope (see header) --------------------------------------------
const holder = hits[0];
const holderIsMember = String(val(holder, 'owner_contact_id') || '') !== '' || String(val(holder, 'member_type') || '').trim().toLowerCase() !== 'owner';
if (holderIsMember) {
  const members = [];
  const c = freshItems.find(x => x.id === own.ownerId);
  if (c && String(val(c, 'hint_patient_id') || '') !== '') {
    const consentDone = String(val(c, 'consent_status')).toLowerCase() === 'complete';
    const m = { first_name: c.firstName || '', member_type: String(val(c, 'member_type') || ''), status: consentDone ? 'complete' : 'pending' };
    if (!consentDone) {
      m.form_params = formParamsFor(c);
    } else {
      const d = docStateFor(c);
      m.doc_status = d.doc_status;
      if (d.doc_ref) m.doc_ref = d.doc_ref;
    }
    members.push(m);
  }
  const one = members.length === 1;
  const body = { practice: practice, owner_first_name: own.ownerFirstName, owner: null, members: members, all_complete: one && members[0].status === 'complete', all_signed: one && members[0].doc_status === 'signed' };
  return [{ json: { body: body } }];
}
let owner = null;
let ownerSigned = false;
const ownerIdx = freshItems.findIndex(c => c.id === own.ownerId);
if (ownerIdx !== -1) {
  const c = freshItems[ownerIdx];
  const consentDone = String(val(c, 'consent_status')).toLowerCase() === 'complete' || ((c.tags || []).indexOf('consent-complete') !== -1);
  owner = { first_name: c.firstName || own.ownerFirstName || '', status: consentDone ? 'complete' : 'pending' };
  if (!consentDone) {
    owner.form_params = formParamsFor(c, true);
  } else {
    const d = docStateFor(c);
    owner.doc_status = d.doc_status;
    if (d.doc_ref) owner.doc_ref = d.doc_ref;
    ownerSigned = d.doc_status === 'signed';
  }
}
const members = [];
freshItems.forEach((c, i) => {
  if (c.id === own.ownerId) return;
  if (String(val(c, 'hint_patient_id') || '') === '') return;
  const consentDone = String(val(c, 'consent_status')).toLowerCase() === 'complete';
  const m = { first_name: c.firstName || '', member_type: String(val(c, 'member_type') || ''), status: consentDone ? 'complete' : 'pending' };
  if (!consentDone) {
    m.form_params = formParamsFor(c);
  } else {
    const d = docStateFor(c);
    m.doc_status = d.doc_status;
    if (d.doc_ref) m.doc_ref = d.doc_ref;
  }
  members.push(m);
});
// v6 solo mode: with no dependents the owner alone decides. With dependents the
// member tests apply exactly as in v5. Owner absent (should not happen) falls back to
// the member tests, which stay false for an empty members list - the hub then shows
// its expired-link message, which is the correct outcome for a token resolving nobody.
const solo = members.length === 0;
const membersComplete = members.length > 0 && members.every(x => x.status === 'complete');
const membersSigned = members.length > 0 && members.every(x => x.doc_status === 'signed');
const all_complete = owner ? (owner.status === 'complete' && (solo || membersComplete)) : membersComplete;
const all_signed = owner ? (ownerSigned && (solo || membersSigned)) : membersSigned;
const body = { practice: practice, owner_first_name: own.ownerFirstName, owner: owner, members: members, all_complete: all_complete, all_signed: all_signed };
return [{ json: { body: body } }];
```
<!-- build-status-v9:end -->

## Hub page: no change (D-11)

Hub v11 (`ghl/consent-hub-v11-ELEMENT-PASTE.html`, the live page) reads, stores, recovers, and URL-encodes `?t=` without validating it, and it renders a response with `owner: null` and one member as a single family-part-1 card. No `hub-page.diff` is needed; the line-by-line evidence is in [COMPLETION-PATH.md, D-11 section](COMPLETION-PATH.md#hub-page-v11-with-a-member-scoped-response-d-11).

## Token checks (adhoc_)

Member tokens are `adhoc_` plus 64 lowercase hex (32 cryptographic bytes), minted by the consent workflow's Custom Code step (BUILD-SPEC §4.6). Every place a token is read:

| Touchpoint | What it does with the token | Evidence |
|---|---|---|
| wf2 `Has Token?` | `notEmpty` on `query.t` only; `adhoc_` passes | admin-theme harness `wf2-member-scope.harness.cjs`, check `token:` |
| wf2 `Find Owner by Token` | Passes the raw `query.t` as the `eq` value of a `consent_hub_token` contacts search; no transform | same check; COMPLETION-PATH "What the member-held token touches" |
| wf2 `Build Status` v9 (token backstop, code review CR-03) | The only validator. `?t=` must be 16 to 256 characters; a value starting `adhoc` must be exactly `adhoc_` plus 64 lowercase hex; exactly one search hit may store exactly that value, and it must be the contact `Extract Owner` used. Otherwise the response is empty (owner null, no members) and the hub shows its could-not-load message. It does not rely on how the search `eq` matches | harness `backstop:` checks (`?t=adhoc`, `?t=adhoc_`, truncated, mismatched stored token, two holders, malformed stored value) |
| Hub v11 read, encode, sessionStorage | `params.get('t')`, `sessionStorage` save and recovery, `encodeURIComponent` (leaves letters, digits, and `_` unchanged); no regex, length, or hex test | harness `hub:` checks; COMPLETION-PATH D-11 section, lines 16-18 and 34 |
| Member email link | `https://join.xcelsiorhealth.com/consent-hub?t={{contact.consent_hub_token}}`, the member's own token; click tracking OFF so it is never rewritten | admin-theme `email-check.cjs` (`link:` and `header:` checks); BUILD-SPEC V-04, V-09 |
| wf1 idempotency | `Check Idempotency` reads the token from the Upsert Owner response (the owner's record), so a member token cannot trip `already`; `Build Dependents` never writes the field | BUILD-SPEC §4.8; COMPLETION-PATH |
| wf3 recount | No reference to `consent_hub_token`; keys on `contact_id`, `owner_contact_id`, `hint_membership_id` | `n8n/3-consent-completed.json` (0 references) |

The one thing only a live run can prove: that the GHL contacts search `eq` filter matches a value containing `adhoc_` (the underscore). Phase 6 check 1 below covers it; a member hub that shows the not-found page means it did not match. The reverse risk (the search returning a contact for a partial or prefix value such as `?t=adhoc`) is closed in code by the Build Status backstop, and Phase 6 checks 6 to 8 confirm it live.

## Rollback

Follow this order. Under v8, a member's own link shows the whole family and puts the member on the owner's Part 1 link, so wf2 must never go back to v8 while member `adhoc_` tokens exist and the consent workflow can mint more.

1. **ClinX:** set "[Ready] Admin Menu: Consent Actions (webhook)" to Draft. This stops all new member sends and token mints.
2. **Admin-theme:** move the snippet tag back to v0.1.2 (the Phase 6 rollback), or leave both consent items "Not configured" (empty URL) so they cannot fire.
3. **Only after step 1, and only if wf2 must go back to v8:** first clear member `adhoc_` tokens. In ClinX, build a smart list filtered on Consent Hub Token contains `adhoc_`, then bulk-edit Consent Hub Token to empty for those contacts (owner tokens never start with `adhoc_`, so owners are untouched). Then open wf2 Build Status, paste `proposals/2026-08-11-part1-prefill/build-status-v8-PROPOSED.js` back, Save, and Publish. n8n changes do not ship until you click Publish. Reopen the node and confirm the first line reads `// v8: PART-1 PREFILL`.
4. **The email template "Member Consent Forms"** can stay. Nothing sends it while the consent workflow is in Draft.
5. **Renaming Send Invite back** to "WEBHOOK TEST Send Hint JOIN LINK & Reminders" is cosmetic; its trigger URL never changed.

If wf2 stays on v9, step 3 is unnecessary: under v9 each `adhoc_` token opens only that member's card, and no other workflow reads it (BUILD-SPEC §11).

## Phase 6 live checks

Test contacts only, never a real patient. Record each result in the Phase 6 run log.

**Hub and completion path** (from COMPLETION-PATH.md):

1. On the first real member send, the GHL contacts search `eq` finds the member by their `adhoc_` token: the member's hub link opens their hub, not the not-found page.
2. The member's link opens one card with their own name and nothing about anyone else.
3. The owner's hub is unchanged (same cards and states as before the publish).
4. After the member completes Part 3 and signs, the owner's hub shows them complete.
5. Before testing v9, set `member_type` to `owner` on any sandbox or test token holder you will use whose `member_type` and `owner_contact_id` are both empty (6 of 10 holders in the 2026-08-25 pull, all sandbox or test contacts). v9 fails closed on that shape and their hubs would show the could-not-load message.
6. Negative (code review CR-03): open `https://join.xcelsiorhealth.com/consent-hub?t=adhoc` and `...?t=adhoc_` in a private window. Both must show "We could not load your consent forms" (or "This link has expired"), never a card.
7. Negative: open the test member's real link with the last character removed, and again with one character changed. Both must show the could-not-load message.
8. Negative: open a test owner's real link with one character changed. It must show the could-not-load message, not the family.

**Build checks** (BUILD-SPEC §10, record each result there): V-01 found-contact context, V-02 buttonId in the If/Else picker, V-03 buttonId in the trigger sample, V-04 Track link clicks OFF on every Send Email, V-05 Find Contact context switching and restore, V-06 Custom Code available, V-07 Custom Code output merge syntax, V-08 crypto in the Custom Code runtime, V-09 the email link carries exactly the token saved on the member (`?t=adhoc_` plus 64 hex) and "Verify saved token" logged `ok`, V-10 Custom Code inputs resolve `{{contact.email}}` and `{{contact.hint_patient_id}}` to the member (a synthetic test member gives `emailCheck: 'synthetic'`), V-11 no workflow triggers on a Consent Hub Token change, V-12 what a Custom Code runtime error does to a run (throwaway probe workflow only).

**Refusals.** For each id, set up the condition on a test contact, press the item, and confirm all four outcomes: (a) a Note with the register text on the clicked record (R-01 has no record, so no Note), (b) an internal notification with the reason, the buttonId, the requestId, and the contact id only, (c) the run ends at that refusal, (d) no email is sent.

| Id | Condition to set up | (a) Note | (b) Notification | (c) Run ends | (d) No email |
|---|---|---|---|---|---|
| R-01 | Payload contactId that does not exist (the §1.4 sample) | n/a | | | |
| R-02 | Unknown buttonId (sample with a wrong id) | | | | |
| R-03 | Send individual consent on a contact without `family-member` | | | | |
| R-04 | Member with an empty or synthetic-tagged email; repeat with an untagged member whose email is `ownerlocal+<their hint_patient_id>@...` and with `ownerlocal+12@...` (code review WR-01) | | | | |
| R-05 | Member with empty Owner Contact ID or Hint Membership ID, or a deleted owner | | | | |
| R-06 | Member whose saved email equals the owner's saved email; repeat with the member's email in different case (must still refuse), and with an owner who has no saved email (second Note text) | | | | |
| R-07 | Member whose Consent Status is `complete` | | | | |
| R-08 | Resend on a member whose owner is missing, or on a non-owner without an owner link | | | | |
| R-09 | Resend where the owner has no Consent Hub Token | | | | |
| R-10 | Test member only: temporarily change the last line of "Mint member hub token" to `output = { token: 'broken', mintedAt: Date.now() };`, press Send individual consent, then restore the line, re-run Test your Code, and clear the test member's Consent Hub Token | | | | |

**Pass outcomes.** Send individual consent on a valid member: tag `consent-pending`, the "Member Consent Forms" email at the member's own address with `?t=adhoc_` plus 64 hex, the Note "Individual consent email sent by staff via Actions menu". Pressing it again reuses the same token. Resend Consent Hub link from the owner and from a member: the owner receives the d6cf9af1 invite for their leaf, and the Note lands on the owner.

## Open questions and follow-ups for Rob

- **Q-1 (attestation radio).** An adult child opening their own link sees `form_behalf=Child` preselected on Part 1. v9 keeps it so the member's link equals the owner-view link (HUB-04). Switching to "Self" is one line in the v9 member-scope block (`formParamsFor(c)` becomes `formParamsFor(c, true)`). Details in COMPLETION-PATH.md. Ships as-is unless you say otherwise.
- **Q-2 (hub copy).** A member sees the "Family Consent Forms" eyebrow and the family intro on their own hub. Cosmetic; changing it means a hub re-paste with a member-mode copy swap. Not proposed.
- **Q-3 (token length, F-2).** wf1 owner tokens are 16 bytes (32 hex); member tokens are 32 bytes (`adhoc_` plus 64 hex) per D-05a. No consumer checks length. Kept at 32 bytes; confirm you are happy with the two lengths coexisting.
- **Q-4 (synthetic-email pre-check, F-3): resolved.** The admin-theme Phase 4 client pre-check `/\+\d+@/` missed wf1's synthetic `+pat-<id>@` addresses. It was widened to `/\+(?:\d+|pat-[A-Za-z0-9_-]+)@/` in admin-theme commit 86b53d7. R-04 runs the same pattern server-side in Custom Code ("Capture member email", code review WR-01), plus the member's own `+<hint_patient_id>@` key, regardless of the client.
- **Q-5 (shared email between members, code review WR-02): accepted residual risk.** R-06 compares a member's saved email with the owner's only. If staff save one member's address on another member, the second member's own card goes to that inbox. The workflow cannot reliably search the other family members by email, so BUILD-SPEC §8 accepts this with a staff rule (confirm the email is the member's own before pressing) and defers a server-side check to the hardening seed. Confirm you accept it.
- **Test contacts without `member_type` (05-01).** See Phase 6 check 5: stamp `owner` on any sandbox token holder you will test with before publishing v9.
- **V-01..V-12** are open until you tick them in BUILD-SPEC §10 during the build or the Phase 6 run.

Follow-ups for your hands, after apply:

- Refresh `hint-api/n8n/2-consent-hub-status.json` to the live v9 export (closes F-1).
- Update `n8n/README.md`'s field table: `consent_hub_token` is now also held by members, as `adhoc_` values.
- Update design doc §4.3: "one token per membership" no longer holds (owners hold the family token; members may hold their own `adhoc_` token).
- Make `testing/2026-08-25-phase3-backfill/backfill.py` class E12 skip `adhoc_` values before it is ever re-run.

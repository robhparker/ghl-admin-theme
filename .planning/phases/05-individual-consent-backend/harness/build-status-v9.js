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
//     is treated as a member (fail closed: it can never see the family). The role is read
//     from the holder's FRESH record (Refetch Member), not the lagging search hit; a holder
//     missing from the refetch is treated as a member (code review IN-03).
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
const holderFresh = freshItems.find(x => x.id === holder.id);
const holderIsMember = !holderFresh || String(val(holderFresh, 'owner_contact_id') || '') !== '' || String(val(holderFresh, 'member_type') || '').trim().toLowerCase() !== 'owner';
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

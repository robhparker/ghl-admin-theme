#!/usr/bin/env node
// Phase 05-01 offline harness: wf2 (Consent Hub Status) member scope, node level, no network.
//
// Proves, against the real files:
//   * the v8 base equals live Build Status, and the edited workflow carries the live roster
//   * only Build Status changed (besides the stale-mirror sync), with placeholder secrets
//   * an 'adhoc_' member token passes Has Token? and reaches Find Owner by Token unchanged
//   * Build Status v9 returns only the holder's card for a member token, and is byte-identical
//     to v8 for owner tokens
//   * hub v11 renders the member response as one family-part-1 card
//
// The live export holds the real PIT. It is read ONLY for node names, connections, and the
// Build Status equality check. Nothing from it is printed except node names.
//
// Usage: node wf2-member-scope.harness.cjs [--repo F] [--v8 F] [--live F] [--hub F]
//          [--edited F] [--v9 F] [--edited-js F]
//   --edited-js F  replaces the edited Build Status code for the BEHAVIOR checks only
//                  (negative control: feed it v8 and the member checks must fail).
// Output: one line per check, 'ok - <name>' or 'not ok - <name>: <reason>', then
//         'PASS n/n' or 'FAIL k/n'. Exit 0 only on PASS.
'use strict';
const fs = require('fs');
const path = require('path');
const util = require('util');

const X = '/Users/rhparker/Repos/clients/xcelsior';
const args = process.argv.slice(2);
function opt(name, def) { const i = args.indexOf(name); return i !== -1 && args[i + 1] ? args[i + 1] : def; }
const F = {
  repo: opt('--repo', path.join(X, 'hint-api/n8n/2-consent-hub-status.json')),
  v8: opt('--v8', path.join(X, 'hint-api/proposals/2026-08-11-part1-prefill/build-status-v8-PROPOSED.js')),
  live: opt('--live', path.join(X, 'hint-api/testing/2026-08-24-phase0-live-export/RxnpkyL0jng8hVx7.json')),
  hub: opt('--hub', path.join(X, 'hint-api/ghl/consent-hub-v11-ELEMENT-PASTE.html')),
  edited: opt('--edited', path.join(X, 'hint-api/proposals/2026-10-07-individual-consent/wf2-consent-hub-status.member-scope.json')),
  v9: opt('--v9', path.join(__dirname, 'build-status-v9.js')),
  editedJs: opt('--edited-js', null)
};

const read = f => fs.readFileSync(f, 'utf8');
const repoText = read(F.repo);
const repo = JSON.parse(repoText);
const editedText = read(F.edited);
const edited = JSON.parse(editedText);
const v8Code = read(F.v8);
const v9Code = read(F.v9);
const nodeOf = (wf, name) => wf.nodes.find(n => n.name === name);
const editedCode = nodeOf(edited, 'Build Status').parameters.jsCode;
const behaviorCode = F.editedJs ? read(F.editedJs) : editedCode;
const extractOwnerCode = nodeOf(edited, 'Extract Owner').parameters.jsCode;
const hubText = read(F.hub);
const hubScript = hubText.slice(hubText.indexOf('<script>') + 8, hubText.lastIndexOf('</script>'));

// ---------------------------------------------------------------- check runner
const results = [];
async function check(name, fn) {
  let res;
  try { res = await fn(); } catch (e) { res = 'threw ' + (e && e.message ? e.message : String(e)); }
  if (res === true) results.push({ name, ok: true });
  else results.push({ name, ok: false, reason: typeof res === 'string' ? res : 'returned ' + JSON.stringify(res) });
}

// ---------------------------------------------------------------- fixtures
const CF = {};
['hint_patient_id', 'hint_membership_id', 'member_type', 'owner_contact_id', 'consent_status',
  'consent_hub_token', 'doc_ref_agreement', 'doc_status_agreement'].forEach(k => { CF['contact.' + k] = 'cf_' + k; });
const hex = (n, seed) => { let s = ''; let x = seed; while (s.length < n) { x = (x * 1103515245 + 12345) % 2147483648; s += (x % 16).toString(16); } return s; };
const OWNER_TOKEN = hex(32, 7);
const ADHOC_TOKEN = 'adhoc_' + hex(64, 11);
const ADHOC_TOKEN_K = 'adhoc_' + hex(64, 13); // Kestrel's own member token (holder-K scenarios)
const MEMBERSHIP = 'mem-family-0001';

// contact factory: shape of GET /contacts/{id}.contact and of contacts/search results
function C(id, first, o) {
  o = o || {};
  const c = { id, firstName: first, lastName: o.lastName || 'Fixture', email: o.email || '', tags: o.tags || [] };
  if (o.phone) c.phone = o.phone;
  if (o.dateOfBirth) c.dateOfBirth = o.dateOfBirth;
  const f = {
    hint_patient_id: o.pid === undefined ? 'pat-' + id : o.pid,
    hint_membership_id: o.membership === undefined ? MEMBERSHIP : o.membership,
    member_type: o.member_type || '',
    owner_contact_id: o.owner_contact_id || '',
    consent_status: o.consent_status || '',
    consent_hub_token: o.token || '',
    doc_ref_agreement: o.doc_ref || '',
    doc_status_agreement: o.doc_status || ''
  };
  // GHL omits empty custom fields; keep only populated ones (val() then returns '')
  c.customFields = Object.keys(f).filter(k => f[k] !== '').map(k => ({ id: CF['contact.' + k], value: f[k] }));
  return c;
}
// The family: owner O, child K (synthetic email, DOB, adhoc_ token), spouse S (own email, adhoc_ token, phone).
const O_ID = 'ctcOwnerOdessa01';
const K_ID = 'ctcChildKestrel2';
const S_ID = 'ctcSpouseSorrel3';
const O_EMAIL = 'odessa.household@example.com';
const K_EMAIL = 'odessa.household+pat-pat-' + K_ID + '@example.com';
const S_EMAIL = 'sorrel.own@example.net';
function family(o) {
  o = o || {};
  const O = C(O_ID, 'Odessa', Object.assign({ member_type: 'owner', token: OWNER_TOKEN, email: O_EMAIL, phone: '+18135550100', dateOfBirth: '1980-04-02' }, o.O || {}));
  const K = C(K_ID, 'Kestrel', Object.assign({ member_type: 'child', owner_contact_id: O_ID, email: K_EMAIL, dateOfBirth: '2015-06-09', token: ADHOC_TOKEN_K }, o.K || {}));
  const S = C(S_ID, 'Sorrel', Object.assign({ member_type: 'spouse', owner_contact_id: O_ID, email: S_EMAIL, token: ADHOC_TOKEN, phone: '+18135550101' }, o.S || {}));
  return { O, K, S, all: [O, K, S] };
}
// A solo membership: one owner, no dependents (members == [] -> v6 solo semantics).
function solo(o) {
  const Q = C('ctcSoloQuill0004', 'Quill', Object.assign({ member_type: 'owner', token: OWNER_TOKEN, email: 'quill.solo@example.org', phone: '+18135550104', dateOfBirth: '1972-11-30', membership: 'mem-solo-0002' }, o || {}));
  return { O: Q, all: [Q] };
}
// Every string that would identify another family member if it reached a member's response:
// first name, contact id, email (raw and as encoded in form_params), phone, and DOB as prefilled.
function leakTerms(others) {
  const out = [];
  others.forEach(c => {
    out.push(c.firstName, c.id);
    if (c.email) out.push(c.email, encodeURIComponent(c.email));
    if (c.phone) out.push(c.phone, encodeURIComponent(c.phone));
    if (c.dateOfBirth) {
      const d = c.dateOfBirth.split('-');
      out.push(encodeURIComponent(d[1] + '/' + d[2] + '/' + d[0]));
    }
  });
  return out.filter(Boolean);
}

// ---------------------------------------------------------------- node runners
function makeDollar(nodes) {
  return name => {
    if (!nodes[name]) throw new Error('node not stubbed: ' + name);
    return { first: () => nodes[name][0], all: () => nodes[name] };
  };
}
function runCode(code, $, $input) { return new Function('$', '$input', code)($, $input); }
function evalExpr(expr, $) {
  if (expr.indexOf('={{') !== 0 || expr.slice(-2) !== '}}') throw new Error('not an n8n expression: ' + expr.slice(0, 20));
  return new Function('$', 'return (' + expr.slice(3, -2) + ');')($);
}
// Run wf2 from Find Owner by Token through Build Status for one token holder.
//   holder: the contact contacts/search returns for the token
//   fresh:  the contacts Refetch Member returns (one GET per membership member)
function runWf2(code, holder, fresh, token) {
  return runWf2Hits(code, holder ? [holder] : [], fresh, token);
}
// Same, with the exact list of contacts the search returns (to model fuzzy or duplicate matches).
function runWf2Hits(code, hits, fresh, token) {
  const search = { contacts: hits, total: hits.length };
  const nodes = {
    'Status Webhook': [{ json: { query: { t: token || '' } } }],
    'Config': [{ json: { PRACTICE_NAME: 'Xcelsior Health', FUNNEL_ORIGIN: 'https://join.xcelsiorhealth.com', PIT: 'PASTE_GHL_PIT_TOKEN_HERE' } }],
    'Build CF Map': [{ json: { map: CF } }],
    'Find Owner by Token': [{ json: search }]
  };
  // the REAL Extract Owner code from the edited workflow
  nodes['Extract Owner'] = runCode(extractOwnerCode, makeDollar(nodes), { first: () => ({ json: search }), all: () => [{ json: search }] });
  nodes['Refetch Member'] = fresh.map(c => ({ json: { contact: c } }));
  const out = runCode(code, makeDollar(nodes), { first: () => nodes['Refetch Member'][0], all: () => nodes['Refetch Member'] });
  return out[0].json.body;
}

// ---------------------------------------------------------------- hub runner
function runHub(body, o) {
  o = o || {};
  let html = '';
  const fetched = [];
  const store = new Map(Object.entries(o.session || {}));
  const root = { set innerHTML(v) { html = v; }, get innerHTML() { return html; }, querySelectorAll: () => [] };
  const sandbox = {
    document: {
      getElementById: () => root,
      createElement: () => {
        let t = '';
        return { set textContent(v) { t = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }, get innerHTML() { return t; } };
      },
      addEventListener: () => {},
      hidden: false
    },
    window: { location: { search: o.search === undefined ? '' : o.search } },
    sessionStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: k => { store.delete(k); } },
    fetch: url => { fetched.push(url); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) }); },
    setTimeout: () => 0,
    URLSearchParams,
    Error
  };
  new Function(...Object.keys(sandbox), hubScript)(...Object.values(sandbox));
  return new Promise(res => setImmediate(() => setImmediate(() => setImmediate(() => res({ html, fetched, store })))));
}
const STATUS_URL = (hubScript.match(/var STATUS_URL = '([^']+)'/) || [])[1];
const FAMILY_PART1 = 'https://join.xcelsiorhealth.com/family-part-1';
const cardCount = html => (html.match(/<div class="xh-card(?: [^"]*)?">/g) || []).length;
const KEY_ORDER = ['practice', 'owner_first_name', 'owner', 'members', 'all_complete', 'all_signed'];
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------- live graph helpers
function graph(wf) {
  const conns = {};
  Object.keys(wf.connections || {}).sort().forEach(k => {
    conns[k] = (wf.connections[k].main || []).map(outs => (outs || []).map(t => t.node + '|' + t.type + '|' + t.index));
  });
  return { names: wf.nodes.map(n => n.name).sort(), conns };
}

(async () => {
  // ======================================================== Task 1: tracer checks
  await check('base: build-status-v8-PROPOSED.js equals the live Build Status (2026-08-24 export)', () => {
    const live = JSON.parse(read(F.live));
    const draft = nodeOf(live, 'Build Status');
    if (!draft || draft.parameters.jsCode !== v8Code) return 'live draft Build Status differs from the v8 file';
    if (live.activeVersion && live.activeVersion.nodes) {
      const pub = nodeOf(live.activeVersion, 'Build Status');
      if (!pub || pub.parameters.jsCode !== v8Code) return 'live published Build Status differs from the v8 file';
    }
    return true;
  });

  await check('sync: edited workflow carries the live node roster and connections', () => {
    const live = JSON.parse(read(F.live));
    const L = graph(live.activeVersion && live.activeVersion.nodes ? live.activeVersion : live);
    const E = graph(edited);
    if (!util.isDeepStrictEqual(L.names, E.names)) return 'node names differ: live [' + L.names.join(', ') + '] edited [' + E.names.join(', ') + ']';
    if (!util.isDeepStrictEqual(L.conns, E.conns)) return 'connection maps differ';
    return true;
  });

  await check('scope: only Build Status changed besides the stale-mirror sync', () => {
    if (!util.isDeepStrictEqual(Object.keys(edited), Object.keys(repo))) return 'top-level keys differ';
    for (const k of ['name', 'settings', 'pinData']) if (!util.isDeepStrictEqual(edited[k], repo[k])) return k + ' differs from repo';
    const want = repo.nodes.filter(n => n.name !== 'Lookup Member Docs').map(n => n.name);
    const got = edited.nodes.map(n => n.name);
    if (!util.isDeepStrictEqual(want, got)) return 'node list/order differs from repo minus Lookup Member Docs';
    for (const n of edited.nodes) {
      const r = nodeOf(repo, n.name);
      if (n.name === 'Build Status') {
        const a = JSON.parse(JSON.stringify(n)); const b = JSON.parse(JSON.stringify(r));
        delete a.parameters.jsCode; delete b.parameters.jsCode;
        if (!util.isDeepStrictEqual(a, b)) return 'Build Status changed outside jsCode';
        if (n.parameters.jsCode !== v9Code) return 'Build Status jsCode != build-status-v9.js';
      } else if (!util.isDeepStrictEqual(n, r)) return 'node changed: ' + n.name;
    }
    const conns = JSON.parse(JSON.stringify(repo.connections));
    conns['Refetch Member'] = { main: [[{ node: 'Build Status', type: 'main', index: 0 }]] };
    delete conns['Lookup Member Docs'];
    if (!util.isDeepStrictEqual(edited.connections, conns)) return 'connections differ beyond the sync';
    return true;
  });

  await check('secrets: Config PIT is the placeholder and no live token pattern appears', () => {
    const pit = j => nodeOf(j, 'Config').parameters.assignments.assignments.find(a => a.name === 'PIT').value;
    if (pit(repo) !== 'PASTE_GHL_PIT_TOKEN_HERE') return 'repo PIT is not the expected placeholder';
    if (pit(edited) !== pit(repo)) return 'edited Config PIT is not the repo placeholder';
    const diffPath = path.join(path.dirname(F.edited), 'wf2-member-scope.diff');
    const texts = [['edited JSON', editedText]];
    if (fs.existsSync(diffPath)) texts.push(['diff', read(diffPath)]);
    for (const [label, t] of texts) if (/pit-[0-9a-f]{8}/i.test(t)) return label + ' carries a pit-<hex> token pattern';
    return true;
  });

  await check('token: adhoc_ token passes Has Token? and reaches Find Owner by Token unchanged', () => {
    const $ = makeDollar({ 'Status Webhook': [{ json: { query: { t: ADHOC_TOKEN } } }], 'Build CF Map': [{ json: { map: CF } }] });
    const cond = nodeOf(edited, 'Has Token?').parameters.conditions.conditions[0];
    if (cond.operator.operation !== 'notEmpty') return 'Has Token? operator is ' + cond.operator.operation;
    const left = evalExpr(cond.leftValue, $);
    if (typeof left !== 'string' || left === '') return 'Has Token? leftValue evaluated empty';
    if (left !== ADHOC_TOKEN) return 'Has Token? leftValue altered the token';
    const body = JSON.parse(evalExpr(nodeOf(edited, 'Find Owner by Token').parameters.jsonBody, $));
    const f = body.filters[0];
    if (f.operator !== 'eq') return 'Find Owner filter operator is ' + f.operator;
    if (f.field !== 'customFields.' + CF['contact.consent_hub_token']) return 'Find Owner filter field is not consent_hub_token';
    if (f.value !== ADHOC_TOKEN) return 'Find Owner filter value != token';
    return true;
  });

  await check('member: adhoc_ member token returns only the holder\'s card', () => {
    const fam = family();
    const b = runWf2(behaviorCode, fam.S, fam.all, ADHOC_TOKEN);
    if (!util.isDeepStrictEqual(Object.keys(b), KEY_ORDER)) return 'key order ' + Object.keys(b).join(',');
    if (b.owner !== null) return 'owner is not null';
    if (b.members.length !== 1) return 'members length ' + b.members.length;
    if (b.members[0].first_name !== 'Sorrel') return 'card is not the holder\'s';
    if (b.owner_first_name !== 'Sorrel') return 'owner_first_name is not the holder\'s first name';
    return true;
  });

  await check('owner: family owner token response byte-identical to v8', () => {
    const fam = family();
    const a = JSON.stringify(runWf2(behaviorCode, fam.O, fam.all, OWNER_TOKEN));
    const b = JSON.stringify(runWf2(v8Code, fam.O, fam.all, OWNER_TOKEN));
    return a === b || 'v9 and v8 responses differ for the owner token';
  });

  await check('hub: v11 renders the member response as one family-part-1 card', async () => {
    const fam = family();
    const body = runWf2(behaviorCode, fam.S, fam.all, ADHOC_TOKEN);
    const r = await runHub(body, { search: '?t=' + ADHOC_TOKEN });
    if (r.fetched.length !== 1) return 'fetch called ' + r.fetched.length + ' times';
    if (cardCount(r.html) !== 1) return 'card divs: ' + cardCount(r.html);
    if (r.html.indexOf('xh-card--owner') !== -1) return 'owner card rendered';
    if (r.html.indexOf('family-owner-part-1') !== -1) return 'owner Part-1 link rendered';
    const fp = body.members[0] && body.members[0].form_params;
    if (!fp) return 'member card has no form_params';
    if (r.html.indexOf(FAMILY_PART1 + '?' + fp) === -1) return 'family-part-1 link with the holder form_params not found';
    return true;
  });

  // ======================================================== Task 2: expansion checks
  // Owner byte-identity across family and solo states. Default family O carries phone
  // and dateOfBirth (v8 prefill), so every family scenario exercises the prefill path.
  const signedDoc = ref => ({ consent_status: 'complete', doc_ref: ref, doc_status: 'signed' });
  const awaitingDoc = ref => ({ consent_status: 'complete', doc_ref: ref });
  const OWNER_SCENARIOS = [
    ['family: nobody done (owner prefill phone + DOB)', () => family()],
    ['family: children done and signed, owner pending', () => family({ K: signedDoc('docref-K'), S: signedDoc('docref-S') })],
    ['family: everyone complete, owner doc awaiting', () => family({ O: awaitingDoc('docref-O'), K: signedDoc('docref-K'), S: signedDoc('docref-S') })],
    ['family: everyone complete and signed', () => family({ O: signedDoc('docref-O'), K: signedDoc('docref-K'), S: signedDoc('docref-S') })],
    ['family: owner complete via legacy consent-complete tag', () => family({ O: { tags: ['consent-complete'], doc_ref: 'docref-O', doc_status: 'signed' }, K: signedDoc('docref-K') })],
    ['family: one member not yet minted (no hint_patient_id) is skipped', () => family({ S: { pid: '' } })],
    ['solo: pending', () => solo()],
    ['solo: complete and signed', () => solo(signedDoc('docref-Q'))]
  ];
  await check('owner: byte-identical to v8 across ' + OWNER_SCENARIOS.length + ' scenarios', () => {
    for (const [label, mk] of OWNER_SCENARIOS) {
      const fam = mk();
      const a = JSON.stringify(runWf2(behaviorCode, fam.O, fam.all, OWNER_TOKEN));
      const b = JSON.stringify(runWf2(v8Code, fam.O, fam.all, OWNER_TOKEN));
      if (a !== b) return 'differs in "' + label + '"';
    }
    return true;
  });

  // A member-scoped response: owner null, exactly the holder's card, nothing about anyone else.
  function scopedTo(b, holderName, others) {
    if (b.owner !== null) return 'owner is not null';
    if (b.members.length !== 1) return 'members length ' + b.members.length;
    if (b.members[0].first_name !== holderName) return 'card is not the holder\'s';
    const s = JSON.stringify(b);
    for (const t of leakTerms(others)) if (s.indexOf(t) !== -1) return 'response carries another member\'s data';
    return true;
  }
  await check('member detect: owner_contact_id alone scopes the response', () => {
    const fam = family({ S: { member_type: 'owner' } }); // bad Hint value on a dependent
    return scopedTo(runWf2(behaviorCode, fam.S, fam.all, ADHOC_TOKEN), 'Sorrel', [fam.O, fam.K]);
  });
  await check('member detect: member_type other than owner alone scopes the response', () => {
    const fam = family({ K: { owner_contact_id: '' } }); // child with no owner link written
    return scopedTo(runWf2(behaviorCode, fam.K, fam.all, ADHOC_TOKEN_K), 'Kestrel', [fam.O, fam.S]);
  });
  await check('member detect: legacy holder with no owner link and empty member_type is scoped', () => {
    const fam = family({ S: { member_type: '', owner_contact_id: '' } }); // phase4 FINDINGS legacy dependent shape
    return scopedTo(runWf2(behaviorCode, fam.S, fam.all, ADHOC_TOKEN), 'Sorrel', [fam.O, fam.K]);
  });

  await check('member detect: role comes from the fresh record, not the lagging search hit (code review IN-03)', () => {
    // stale search hit says 'owner', fresh GET says the holder is a spouse with an owner link: member view
    const fam = family();
    const staleHit = C(S_ID, 'Sorrel', { member_type: 'owner', token: ADHOC_TOKEN, email: S_EMAIL });
    const r = scopedTo(runWf2(behaviorCode, staleHit, fam.all, ADHOC_TOKEN), 'Sorrel', [fam.O, fam.K]);
    if (r !== true) return 'stale owner hit: ' + r;
    // stale search hit says member, fresh GET says owner (e.g. just promoted): the owner view, as v8
    const ownerHit = C(O_ID, 'Odessa', { member_type: 'child', owner_contact_id: 'ctcSomeoneElse08', token: OWNER_TOKEN, email: O_EMAIL });
    const a = JSON.stringify(runWf2(behaviorCode, ownerHit, fam.all, OWNER_TOKEN));
    const b = JSON.stringify(runWf2(v8Code, fam.O, fam.all, OWNER_TOKEN));
    return a === b || 'fresh owner record did not get the v8 owner view';
  });

  await check('member: holder missing from the refetch returns no cards and no family data', () => {
    const fam = family();
    const b = runWf2(behaviorCode, fam.S, [fam.O, fam.K], ADHOC_TOKEN);
    if (b.owner !== null) return 'owner is not null';
    if (b.members.length !== 0) return 'members length ' + b.members.length;
    if (b.all_complete !== false || b.all_signed !== false) return 'completion flags not false';
    const s = JSON.stringify(b);
    for (const t of leakTerms([fam.O, fam.K])) if (s.indexOf(t) !== -1) return 'response carries family data';
    return true;
  });
  await check('member: holder without hint_patient_id returns no cards', () => {
    const fam = family({ S: { pid: '' } });
    const b = runWf2(behaviorCode, fam.S, fam.all, ADHOC_TOKEN);
    if (b.owner !== null) return 'owner is not null';
    return b.members.length === 0 || 'members length ' + b.members.length;
  });
  await check('member: complete and signed holder sets all_complete and all_signed', () => {
    const fam = family({ S: signedDoc('docref-S') }); // O and K still pending: must not matter
    const b = runWf2(behaviorCode, fam.S, fam.all, ADHOC_TOKEN);
    const r = scopedTo(b, 'Sorrel', [fam.O, fam.K]);
    if (r !== true) return r;
    if (b.members[0].status !== 'complete' || b.members[0].doc_status !== 'signed') return 'card state ' + b.members[0].status + '/' + b.members[0].doc_status;
    return (b.all_complete === true && b.all_signed === true) || 'flags ' + b.all_complete + '/' + b.all_signed;
  });
  await check('member: awaiting signature exposes only the holder\'s doc_ref', () => {
    const fam = family({ O: awaitingDoc('docref-O'), K: awaitingDoc('docref-K'), S: awaitingDoc('docref-S') });
    const b = runWf2(behaviorCode, fam.S, fam.all, ADHOC_TOKEN);
    const r = scopedTo(b, 'Sorrel', [fam.O, fam.K]);
    if (r !== true) return r;
    if (b.members[0].doc_status !== 'awaiting_signature' || b.members[0].doc_ref !== 'docref-S') return 'holder doc state wrong';
    const s = JSON.stringify(b);
    if (s.indexOf('docref-O') !== -1 || s.indexOf('docref-K') !== -1) return 'another member\'s doc_ref leaked';
    return (b.all_complete === true && b.all_signed === false) || 'flags ' + b.all_complete + '/' + b.all_signed;
  });

  await check('leak: member response contains no other member\'s name, id, or email', () => {
    const states = [{}, { O: signedDoc('docref-O'), K: awaitingDoc('docref-K'), S: awaitingDoc('docref-S') }];
    for (const st of states) {
      const fam = family(st);
      for (const [holder, others, tok] of [[fam.S, [fam.O, fam.K], ADHOC_TOKEN], [fam.K, [fam.O, fam.S], ADHOC_TOKEN_K]]) {
        const b = runWf2(behaviorCode, holder, fam.all, tok);
        if (b.members.length !== 1 || b.members[0].first_name !== holder.firstName) return 'holder ' + holder.firstName + ' did not get exactly their own card';
        const s = JSON.stringify(b);
        for (const t of leakTerms(others)) if (s.indexOf(t) !== -1) return 'holder ' + holder.firstName + ' response carries another member\'s data';
      }
    }
    return true;
  });

  await check('HUB-04: member-view form_params equal the owner-view form_params for the same member', () => {
    const fam = family();
    const ownerView = runWf2(behaviorCode, fam.O, fam.all, OWNER_TOKEN);
    for (const [m, tok] of [[fam.S, ADHOC_TOKEN], [fam.K, ADHOC_TOKEN_K]]) {
      const mine = runWf2(behaviorCode, m, fam.all, tok).members[0];
      const card = ownerView.members.find(x => x.first_name === m.firstName);
      if (!mine || !card) return 'card missing for ' + m.firstName;
      if (!mine.form_params || mine.form_params !== card.form_params) return 'form_params differ for ' + m.firstName;
    }
    return true;
  });

  await check('baseline: v8 returns the whole family for a member token (the bug v9 fixes)', () => {
    const fam = family();
    const b = runWf2(v8Code, fam.S, fam.all, ADHOC_TOKEN);
    const cards = (b.owner ? 1 : 0) + b.members.length;
    return cards > 1 || 'v8 returned ' + cards + ' card(s)';
  });

  await check('hub: return visit without ?t= recovers the adhoc_ token and fetches with it', async () => {
    if (!STATUS_URL) return 'STATUS_URL not found in hub v11';
    const fam = family();
    const body = runWf2(behaviorCode, fam.S, fam.all, ADHOC_TOKEN);
    const first = await runHub(body, { search: '?t=' + ADHOC_TOKEN });
    if (first.store.get('consentToken') !== ADHOC_TOKEN) return 'first visit did not store the exact token';
    if (first.fetched[0] !== STATUS_URL + '?t=' + ADHOC_TOKEN) return 'first visit fetched a different URL';
    const back = await runHub(body, { search: '', session: { consentToken: first.store.get('consentToken') } });
    if (back.fetched.length !== 1) return 'return visit fetched ' + back.fetched.length + ' times';
    if (back.fetched[0] !== STATUS_URL + '?t=' + ADHOC_TOKEN) return 'return visit fetched a different URL';
    if (cardCount(back.html) !== 1 || back.html.indexOf('This link has expired') !== -1) return 'return visit did not render the one card';
    return true;
  });

  await check('hub: no regex, length, or hex check on the token in hub v11, Has Token?, or Find Owner by Token', () => {
    const hits = [];
    const tokenValidation = [
      /\btoken\s*\.\s*(length|test|match|matchAll|search|replace|split)\b/,
      /\.\s*(test|exec)\s*\(\s*token\b/,
      /\/(?:[^/\\\n]|\\.)+\/[dgimsuy]*\s*\.\s*(test|exec)\s*\(\s*token\b/,
      /\b(isHex|parseInt)\s*\(\s*token\b/
    ];
    hubText.split('\n').forEach((line, i) => {
      if (!/\btoken\b/.test(line)) return;
      if (tokenValidation.some(re => re.test(line))) hits.push('hub v11 line ' + (i + 1));
    });
    const cond = nodeOf(edited, 'Has Token?').parameters.conditions.conditions;
    cond.forEach(c => {
      if (c.operator.operation !== 'notEmpty') hits.push('Has Token? operator ' + c.operator.operation);
      if (/\.length\b|\.test\(|\.match\(|\/[^/]+\/[dgimsuy]*\./.test(c.leftValue)) hits.push('Has Token? leftValue');
    });
    const jb = nodeOf(edited, 'Find Owner by Token').parameters.jsonBody;
    if (!/operator: 'eq', value: \$\('Status Webhook'\)\.first\(\)\.json\.query\.t \}/.test(jb)) hits.push('Find Owner by Token value is not the raw query.t');
    // every node that reads the token must be one of the three audited readers: the two pass-through
    // nodes above, and Build Status, whose only use of it is the CR-03 exact-match backstop
    edited.nodes.forEach(n => {
      if (/json\.query\.t\b|query\.t\b/.test(JSON.stringify(n.parameters)) && ['Has Token?', 'Find Owner by Token', 'Build Status'].indexOf(n.name) === -1) hits.push('unaudited token reader: ' + n.name);
    });
    return hits.length === 0 || hits.join('; ');
  });

  // ======================================================== code review CR-03: token backstop
  // Build Status must not trust the contacts-search 'eq' result: the holder is the ONE hit whose
  // stored consent_hub_token equals ?t= exactly, and it must be the contact Extract Owner used.
  const EMPTY = { practice: 'Xcelsior Health', owner_first_name: '', owner: null, members: [], all_complete: false, all_signed: false };
  const isEmpty = b => sameJson(b, EMPTY) || 'expected the empty could-not-load body, got ' + JSON.stringify(b).slice(0, 120);
  await check('backstop: Build Status reads ?t= only for the exact-match, single-hit test', () => {
    const code = nodeOf(edited, 'Build Status').parameters.jsCode;
    const reads = code.split('\n').filter(l => /query\.t\b/.test(l));
    if (reads.length !== 1) return 'Build Status reads query.t on ' + reads.length + ' lines';
    if (!/\.filter\(h => String\(val\(h, 'consent_hub_token'\)\) === q\)/.test(code)) return 'no exact === filter on the stored consent_hub_token';
    if (!/hits\.length !== 1/.test(code) || !/hits\[0\]\.id !== own\.ownerId/.test(code)) return 'uniqueness or Extract Owner identity test missing';
    const iGuard = code.indexOf('hits.length !== 1');
    const iMember = code.indexOf('if (holderIsMember)');
    const iOwner = code.indexOf('let owner = null;');
    return (iGuard > 0 && iGuard < iMember && iGuard < iOwner) || 'backstop does not run before both paths';
  });
  await check('backstop: ?t=adhoc and ?t=adhoc_ return the empty body even if the search returns a member', () => {
    const fam = family();
    for (const t of ['adhoc', 'adhoc_', 'ADHOC_', 'adhoc_' + 'f'.repeat(10)]) {
      const r = isEmpty(runWf2Hits(behaviorCode, [fam.S], fam.all, t));
      if (r !== true) return '?t=' + t + ': ' + r;
    }
    return true;
  });
  await check('backstop: a truncated or extended real member token returns the empty body', () => {
    const fam = family();
    for (const t of [ADHOC_TOKEN.slice(0, -1), ADHOC_TOKEN.slice(0, 20), ADHOC_TOKEN + '0', ADHOC_TOKEN.toUpperCase()]) {
      const r = isEmpty(runWf2Hits(behaviorCode, [fam.S], fam.all, t));
      if (r !== true) return r;
    }
    return true;
  });
  await check('backstop: a search hit whose stored token differs from ?t= is refused (owner and member)', () => {
    const fam = family();
    // GHL 'eq' returning a near match: the owner for an owner-like token with one character changed,
    // and Sorrel for Kestrel's token
    const nearOwner = OWNER_TOKEN.slice(0, -1) + (OWNER_TOKEN.slice(-1) === 'a' ? 'b' : 'a');
    let r = isEmpty(runWf2Hits(behaviorCode, [fam.O], fam.all, nearOwner));
    if (r !== true) return 'owner near match: ' + r;
    r = isEmpty(runWf2Hits(behaviorCode, [fam.S], fam.all, ADHOC_TOKEN_K));
    return r === true || 'member mismatch: ' + r;
  });
  await check('backstop: two contacts holding the same token return the empty body', () => {
    const fam = family();
    const twin = C('ctcOtherFamily05', 'Wren', { member_type: 'spouse', owner_contact_id: 'ctcOtherOwner006', token: ADHOC_TOKEN, membership: 'mem-other-0003', email: 'wren@example.org' });
    let r = isEmpty(runWf2Hits(behaviorCode, [fam.S, twin], fam.all, ADHOC_TOKEN));
    if (r !== true) return 'member twins: ' + r;
    // an owner and a member sharing the owner's token (copied by hand) must never render the family
    const fam2 = family({ S: { token: OWNER_TOKEN } });
    r = isEmpty(runWf2Hits(behaviorCode, [fam2.O, fam2.S], fam2.all, OWNER_TOKEN));
    return r === true || 'owner/member twins: ' + r;
  });
  await check('backstop: an exact hit that is not the contact Extract Owner used is refused', () => {
    const fam = family();
    const fuzzy = C('ctcFuzzyFirst007', 'Ash', { member_type: 'owner', token: 'adhoc_' + hex(64, 17), membership: 'mem-other-0004', email: 'ash@example.org' });
    return isEmpty(runWf2Hits(behaviorCode, [fuzzy, fam.S], fam.all, ADHOC_TOKEN));
  });
  await check('backstop: a malformed adhoc value stored on a contact is refused even on an exact match', () => {
    // e.g. a failed mint that wrote a constant (CR-02), or a hand-typed value
    for (const bad of ['adhoc_' + 'f'.repeat(10), 'adhoc_' + 'F'.repeat(64), 'adhoc_' + 'a'.repeat(63) + 'z', 'adhoc-' + 'a'.repeat(64), 'adhoc_{{custom_code.token}}']) {
      const fam = family({ S: { token: bad } });
      const r = isEmpty(runWf2Hits(behaviorCode, [fam.S], fam.all, bad));
      if (r !== true) return JSON.stringify(bad) + ': ' + r;
    }
    return true;
  });
  await check('backstop: a too-short token returns the empty body', () => {
    const fam = family({ O: { token: 'abc123' } });
    return isEmpty(runWf2Hits(behaviorCode, [fam.O], fam.all, 'abc123'));
  });
  await check('backstop: hub v11 shows its could-not-load message for the empty body', async () => {
    const fam = family();
    const body = runWf2Hits(behaviorCode, [fam.S], fam.all, 'adhoc_');
    const r = await runHub(body, { search: '?t=adhoc_' });
    if (cardCount(r.html) !== 0) return 'rendered ' + cardCount(r.html) + ' card(s)';
    return r.html.indexOf('We could not load your consent forms') !== -1 || 'could-not-load message not shown';
  });

  await check('hub: v11 carries the live markers from phase0 FINDINGS item 8', () => {
    const want = ['signPollCount <= 12 ? 5000 : 10000', 'signPollCount < 24'];
    const miss = want.filter(w => hubText.indexOf(w) === -1);
    return miss.length === 0 || 'missing: ' + miss.join(' | ');
  });

  // ---------------------------------------------------------------- report
  let failed = 0;
  for (const r of results) {
    if (r.ok) console.log('ok - ' + r.name);
    else { failed++; console.log('not ok - ' + r.name + ': ' + r.reason); }
  }
  const n = results.length;
  console.log(failed ? 'FAIL ' + failed + '/' + n : 'PASS ' + n + '/' + n);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log('not ok - harness crashed: ' + (e && e.message)); console.log('FAIL 1/1'); process.exit(1); });

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
// The family: owner O, child K (synthetic email, DOB), spouse S (own email, adhoc_ token, phone).
const O_ID = 'ctcOwnerOdessa01';
const K_ID = 'ctcChildKestrel2';
const S_ID = 'ctcSpouseSorrel3';
const O_EMAIL = 'odessa.household@example.com';
const K_EMAIL = 'odessa.household+pat-pat-' + K_ID + '@example.com';
const S_EMAIL = 'sorrel.own@example.net';
function family(o) {
  o = o || {};
  const O = C(O_ID, 'Odessa', Object.assign({ member_type: 'owner', token: OWNER_TOKEN, email: O_EMAIL, phone: '+18135550100', dateOfBirth: '1980-04-02' }, o.O || {}));
  const K = C(K_ID, 'Kestrel', Object.assign({ member_type: 'child', owner_contact_id: O_ID, email: K_EMAIL, dateOfBirth: '2015-06-09' }, o.K || {}));
  const S = C(S_ID, 'Sorrel', Object.assign({ member_type: 'spouse', owner_contact_id: O_ID, email: S_EMAIL, token: ADHOC_TOKEN, phone: '+18135550101' }, o.S || {}));
  return { O, K, S, all: [O, K, S] };
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
  const search = { contacts: holder ? [holder] : [], total: holder ? 1 : 0 };
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

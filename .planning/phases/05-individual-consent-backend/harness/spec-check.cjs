#!/usr/bin/env node
'use strict';
// spec-check.cjs: staged content checks for BUILD-SPEC-clinx-consent-webhook.md (Plan 05-02).
//
// Usage: node spec-check.cjs [--spec PATH] --stage N     (N = 1, 2 or 3; stages are cumulative)
//
// Prints one "ok - ..." or "not ok - ...: reason" line per check, then "PASS n/n" or "FAIL k/n".
// Exits 0 only on PASS. Node built-ins only (no installs).
//
// Stage 2 check (m) executes the spec's own Custom Code snippet (the region between the
// custom-code:js markers) with new Function, deliberately, to prove the token mint works on
// both cryptographic paths and throws when neither exists. The snippet is repo-authored text,
// not external input.

const fs = require('fs');

const DEFAULT_SPEC = '/Users/rhparker/Repos/clients/xcelsior/hint-api/proposals/2026-10-07-individual-consent/BUILD-SPEC-clinx-consent-webhook.md';

const H2 = [
  '## 0. Before you start',
  '## 1. Create the workflow and its Inbound Webhook trigger',
  '## 2. Find the contact by ID',
  '## 3. Branch on buttonId',
  '## 4. Branch A: send-individual-consent',
  '## 5. Branch B: resend-consent-hub',
  '## 6. Settings, saving, and publishing',
  '## 7. Rename the Send Invite workflow',
  '## 8. Security and privacy (AR-03-01)',
  '## 9. Refusal register',
  '## 10. Verify in ClinX UI checklist',
  '## 11. Rollback',
];

const REFUSALS = {
  'R-03': 'Not a family member. Use Resend Consent Hub link on the owner.',
  'R-04': 'Member has no own email. Enter their real email first, or use Resend Consent Hub link on the owner.',
  'R-05': 'Legacy member without an owner link. Needs backfill before an individual consent can be sent.',
  'R-06': "Member's email matches the owner's. Use Resend Consent Hub link on the owner.",
  'R-07': 'Already complete. Nothing to send.',
};

// Highest refusal and verify ids (raised by the 2026-10-08 code-review fixes).
const R_MAX = 12;
const V_MAX = 13;

const START = '<!-- custom-code:js:start -->';
const END = '<!-- custom-code:js:end -->';

function parseArgs(argv) {
  const out = { spec: DEFAULT_SPEC, stage: NaN };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--spec') out.spec = argv[++i];
    else if (argv[i] === '--stage') out.stage = Number(argv[++i]);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (![1, 2, 3].includes(args.stage)) {
  console.error('usage: node spec-check.cjs [--spec PATH] --stage 1|2|3');
  process.exit(2);
}

let text = '';
try {
  text = fs.readFileSync(args.spec, 'utf8');
} catch (e) {
  console.log('not ok - read spec: ' + e.message);
  console.log('FAIL 1/1');
  process.exit(1);
}

const results = [];
function check(name, fn) {
  let reason = '';
  try {
    const r = fn();
    if (r !== true) reason = (typeof r === 'string' && r) ? r : 'condition false';
  } catch (e) {
    reason = 'threw: ' + e.message;
  }
  results.push({ name, ok: reason === '' });
  console.log(reason === '' ? 'ok - ' + name : 'not ok - ' + name + ': ' + reason);
}

const h2Lines = text.split('\n').filter((l) => /^## /.test(l));

function section(title) {
  // Text from the H2 line up to (not including) the next H2 line.
  const lines = text.split('\n');
  const i = lines.indexOf(title);
  if (i < 0) return null;
  let j = i + 1;
  while (j < lines.length && !/^## /.test(lines[j])) j++;
  return lines.slice(i, j).join('\n');
}

function count(re) {
  const m = text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
  return m ? m.length : 0;
}

function idRe(id) {
  return new RegExp('(?<![A-Za-z0-9])' + id + '(?![0-9])', 'g');
}

function missing(list) {
  const miss = list.filter((s) => !text.includes(s));
  return miss.length ? 'missing ' + miss.map((s) => JSON.stringify(s)).join(', ') : true;
}

function region() {
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  if (a < 0 || b < 0 || b < a) return null;
  return text.slice(a + START.length, b);
}

function snippetCode() {
  const r = region();
  if (r === null) throw new Error('custom-code region markers not found');
  const lines = r.split('\n');
  const open = lines.findIndex((l) => /^```js\s*$/.test(l));
  let close = -1;
  for (let k = lines.length - 1; k > open; k--) {
    if (/^```\s*$/.test(lines[k])) { close = k; break; }
  }
  if (open < 0 || close < 0) throw new Error('js fence not found inside the region');
  return lines.slice(open + 1, close).join('\n');
}

function runSnippet(code, cryptoArg, requireArg, inputData) {
  // eslint-disable-next-line no-new-func
  const fn = new Function('inputData', 'crypto', 'require', 'let output;\n' + code + '\nreturn output;');
  return fn(inputData || {}, cryptoArg, requireArg);
}

// Named Custom Code regions (review fixes): <!-- custom-code:NAME:start --> ... <!-- custom-code:NAME:end -->
function namedSnippet(name) {
  const s = '<!-- custom-code:' + name + ':start -->';
  const e = '<!-- custom-code:' + name + ':end -->';
  const a = text.indexOf(s);
  const b = text.indexOf(e);
  if (a < 0 || b < 0 || b < a) throw new Error('custom-code:' + name + ' region markers not found');
  if (text.indexOf(s, a + 1) >= 0) throw new Error('custom-code:' + name + ' region appears twice');
  const m = text.slice(a + s.length, b).match(/\n```js\n([\s\S]*?)\n```\n/);
  if (!m) throw new Error('js fence not found inside custom-code:' + name);
  return m[1];
}
// Run a named snippet the way ClinX does: inputData in, output out. No crypto, no require.
function runNamed(name, inputData) {
  return runSnippet(namedSnippet(name), undefined, undefined, inputData);
}
function allRegions() {
  const re = /<!-- custom-code:([a-z]+):start -->([\s\S]*?)<!-- custom-code:\1:end -->/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) out.push({ name: m[1], body: m[2] });
  return out;
}

const TOKEN_RE = /^adhoc_[0-9a-f]{64}$/;

// ---------------- Stage 1 ----------------

check('(a) H2s 0,1,2,3,5,6 present in ascending order', () => {
  const want = [H2[0], H2[1], H2[2], H2[3], H2[5], H2[6]];
  let last = -1;
  for (const t of want) {
    const idx = h2Lines.indexOf(t);
    if (idx < 0) return 'missing ' + JSON.stringify(t);
    if (idx <= last) return 'out of order at ' + JSON.stringify(t);
    last = idx;
  }
  return true;
});

check('(b) required tracer strings present', () => missing([
  '[Ready] Admin Menu: Consent Actions (webhook)',
  'contactId', 'locationId', 'buttonId', 'requestId', 'sentAt', 'email', 'phone', 'source',
  '{{inboundWebhookRequest.contactId}}',
  'Consent action failed: contact not found',
  '{{inboundWebhookRequest.buttonId}}',
  'send-individual-consent', 'resend-consent-hub', 'unknown action',
  '{{contact.owner_contact_id}}',
  'Family Consent Hub Invite', 'Consent Hub Invite',
  'Longevity Plus Family Consent Hub Invite', 'Longevity Plus Consent Hub Invite',
  'longevity-member', 'Dependent Count',
  'd6cf9af1-7fed-4182-a8d6-69ca2725d427',
  'allowMultiple', 'Allow re-entry',
  'n8n changes do not ship until you click Publish',
]));

check('(b2) payload table lists all eight keys as code', () => {
  const keys = ['contactId', 'locationId', 'buttonId', 'requestId', 'sentAt', 'email', 'phone', 'source'];
  const miss = keys.filter((k) => !new RegExp('^\\|\\s*`' + k + '`\\s*\\|', 'm').test(text));
  return miss.length ? 'payload table rows missing for ' + miss.join(', ') : true;
});

check('(c) a sentence says never match on email or phone', () =>
  /never[^.\n]*email or phone/i.test(text) || 'no /never ... email or phone/ sentence');

check('(d) a sentence covers reload after every save and trigger multi-selects reverting', () =>
  /reload[^.\n]*after every save[^.\n]*multi-selects?[^.\n]*revert/i.test(text) ||
  /multi-selects?[^.\n]*revert[^.\n]*reload[^.\n]*after every save/i.test(text) ||
  'no single sentence with both');

check('(e) R-01, R-02, R-08, R-09 each appear', () => {
  const miss = ['R-01', 'R-02', 'R-08', 'R-09'].filter((id) => count(idRe(id)) < 1);
  return miss.length ? 'missing ' + miss.join(', ') : true;
});

check('(f) verify in ClinX UI (V-01)..(V-04) each appear', () => {
  const miss = ['V-01', 'V-02', 'V-03', 'V-04'].filter((v) => !text.includes('verify in ClinX UI (' + v + ')'));
  return miss.length ? 'missing markers ' + miss.join(', ') : true;
});

// ---------------- Stage 2 ----------------

if (args.stage >= 2) {
  check('(g) H2 "## 4. Branch A: send-individual-consent" sits between section 3 and section 5', () => {
    const i3 = h2Lines.indexOf(H2[3]);
    const i4 = h2Lines.indexOf(H2[4]);
    const i5 = h2Lines.indexOf(H2[5]);
    if (i4 < 0) return 'section 4 H2 missing';
    return (i3 >= 0 && i5 >= 0 && i3 < i4 && i4 < i5) || 'section 4 not between 3 and 5';
  });

  check('(h) the five D-04 refusal texts appear verbatim', () => missing(Object.values(REFUSALS)));

  check('(i) R-03..R-07 and V-05..V-11 each appear', () => {
    const ids = ['R-03', 'R-04', 'R-05', 'R-06', 'R-07', 'V-05', 'V-06', 'V-07', 'V-08', 'V-09', 'V-10', 'V-11', 'V-12', 'V-13'];
    const miss = ids.filter((id) => count(idRe(id)) < 1);
    return miss.length ? 'missing ' + miss.join(', ') : true;
  });

  check('(i2) V-05..V-11 inline markers use the "verify in ClinX UI (V-xx)" form', () => {
    const miss = ['V-05', 'V-06', 'V-07', 'V-08', 'V-09', 'V-10', 'V-11', 'V-12', 'V-13']
      .filter((v) => !text.includes('verify in ClinX UI (' + v + ')'));
    return miss.length ? 'missing markers ' + miss.join(', ') : true;
  });

  check('(j) section 4 required strings present', () => missing([
    '+{{contact.hint_patient_id}}@', 'adhoc_', 'Custom Code', 'Test your Code', 'Update Contact Field',
    'consent-pending', 'Member Consent Forms', 'Your Xcelsior consent forms',
    'Individual consent email sent by staff via Actions menu', 'stop and tell Rob', 'randomBytes(16)',
    'Check Idempotency', 'Compute Completion',
  ]));

  check('(k) in section 4: R-07 refusal, then first Update Contact Field, then first Member Consent Forms', () => {
    const s4 = section(H2[4]);
    if (s4 === null) return 'section 4 missing';
    const r7 = s4.search(idRe('R-07'));
    const ucf = s4.indexOf('Update Contact Field');
    const mcf = s4.indexOf('Member Consent Forms');
    if (r7 < 0 || ucf < 0 || mcf < 0) return 'R-07=' + r7 + ' UCF=' + ucf + ' MCF=' + mcf;
    if (!(r7 < ucf)) return 'Update Contact Field occurs before R-07';
    if (!(r7 < mcf)) return 'Member Consent Forms occurs before R-07';
    if (!(ucf < mcf)) return 'Member Consent Forms occurs before Update Contact Field';
    return true;
  });

  check('(l) a sentence in section 4 says Math.random is not acceptable', () => {
    const s4 = section(H2[4]) || '';
    return /Math\.random[^\n]*?not acceptable/.test(s4) || 'no such sentence in section 4';
  });

  // (m) runtime test of the Custom Code snippet
  let code = null;
  check('(m0) custom-code region found with a js fence', () => {
    code = snippetCode();
    return code.trim().length > 0 || 'empty snippet';
  });

  const tokens = [];
  check('(m1) web-crypto path (globalThis.crypto, no require) yields adhoc_ + 64 lowercase hex, twice', () => {
    if (code === null) return 'no snippet';
    if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') return 'this Node lacks globalThis.crypto';
    for (let k = 0; k < 2; k++) {
      const out = runSnippet(code, globalThis.crypto, undefined);
      if (!out || !TOKEN_RE.test(out.token)) return 'bad output ' + JSON.stringify(out && out.token);
      tokens.push(out.token);
    }
    return true;
  });

  check('(m6) the mint also outputs mintedAt = the current time in ms (review CR-02)', () => {
    if (code === null) return 'no snippet';
    const t0 = Date.now();
    const out = runSnippet(code, globalThis.crypto, undefined);
    const t1 = Date.now();
    if (!out || typeof out.mintedAt !== 'number') return 'mintedAt is ' + JSON.stringify(out && out.mintedAt);
    return (out.mintedAt >= t0 && out.mintedAt <= t1) || 'mintedAt not within the run';
  });

  check('(m2) require path (no crypto, real require) yields adhoc_ + 64 lowercase hex', () => {
    if (code === null) return 'no snippet';
    const out = runSnippet(code, undefined, require);
    if (!out || !TOKEN_RE.test(out.token)) return 'bad output ' + JSON.stringify(out && out.token);
    tokens.push(out.token);
    return true;
  });

  check('(m3) the three tokens are all distinct', () =>
    (tokens.length === 3 && new Set(tokens).size === 3) || 'got ' + tokens.length + ' tokens, ' + new Set(tokens).size + ' distinct');

  check('(m4) no-crypto path (neither crypto nor require) throws', () => {
    if (code === null) return 'no snippet';
    try {
      runSnippet(code, undefined, undefined);
    } catch (e) {
      return true;
    }
    return 'did not throw';
  });

  // ---- review WR-05: the mint refuses Math-based shims and reports its source ----
  const shimRandom = ['Ma', 'th'].join('') + '.' + 'random';
  check('(m7) a web-crypto getRandomValues shim built on Math random makes the mint throw', () => {
    if (code === null) return 'no snippet';
    // eslint-disable-next-line no-new-func
    const gv = new Function('a', 'for (var i = 0; i < a.length; i++) { a[i] = Math.floor(' + shimRandom + '() * 256); } return a;');
    try { runSnippet(code, { getRandomValues: gv }, undefined); } catch (e) { return true; }
    return 'did not throw';
  });
  check('(m8) a require(crypto).randomBytes shim built on Math random makes the mint throw', () => {
    if (code === null) return 'no snippet';
    // eslint-disable-next-line no-new-func
    const rb = new Function('n', 'var b = []; for (var i = 0; i < n; i++) { b.push(Math.floor(' + shimRandom + '() * 256)); } return b;');
    try { runSnippet(code, undefined, () => ({ randomBytes: rb })); } catch (e) { return true; }
    return 'did not throw';
  });
  check('(m9) the mint reports source = web-crypto or node-crypto for the path it used', () => {
    if (code === null) return 'no snippet';
    const a = runSnippet(code, globalThis.crypto, undefined);
    const b = runSnippet(code, undefined, require);
    return (a && a.source === 'web-crypto' && b && b.source === 'node-crypto') || 'got ' + JSON.stringify([a && a.source, b && b.source]);
  });
  check('(m10) the V-08 source probe runs and shows both generators in this Node', () => {
    const out = runSnippet(namedSnippet('probe'), globalThis.crypto, require);
    if (!out) return 'no output';
    if (!/^function getRandomValues\(/.test(out.web)) return 'web = ' + JSON.stringify(String(out.web).slice(0, 40));
    if (!/^function randomBytes\(size, callback\)/.test(out.node)) return 'node = ' + JSON.stringify(String(out.node).slice(0, 40));
    if (!/"node"/.test(out.runtime)) return 'runtime = ' + JSON.stringify(String(out.runtime).slice(0, 40));
    const none = runSnippet(namedSnippet('probe'), undefined, undefined);
    return (none.web === 'none' && none.node === 'none') || 'no-crypto probe gave ' + JSON.stringify(none);
  });

  check('(m5) the custom-code region has no Math random reference', () => {
    const r = region();
    if (r === null) return 'region missing';
    return !/Math\s*\.\s*random/.test(r) || 'region references Math random';
  });

  // ---- review CR-01: R-06 compares SAVED emails only, never the payload email ----
  check('(t) no guard reads the payload email: {{inboundWebhookRequest.email}} appears nowhere', () =>
    !text.includes('{{inboundWebhookRequest.email}}') || 'spec still references {{inboundWebhookRequest.email}}');

  check('(u1) "Capture member email" snippet trims and lowercases the saved member email', () => {
    const tok = 'adhoc_' + 'b2'.repeat(32);
    const a = runNamed('capture', { memberEmail: '  Sorrel.Own@Example.NET ', hintPatientId: 'pat-abc', memberToken: tok });
    if (!a || a.memberEmail !== 'sorrel.own@example.net' || a.emailCheck !== 'ok') return 'got ' + JSON.stringify(a);
    if (a.memberToken !== tok) return 'memberToken not passed through unchanged';
    const b = runNamed('capture', {});
    if (!b || b.memberEmail !== '' || b.emailCheck !== 'empty') return 'missing input gave ' + JSON.stringify(b);
    return true;
  });

  // ---- review WR-01: R-04 runs the client's synthetic-email pattern server-side ----
  check('(w1) "Capture member email" flags +<digits>@, +pat-<id>@ and the member\'s own key; passes real emails', () => {
    const cases = [
      [{ memberEmail: 'sorrel.own@example.net', hintPatientId: 'pat-EXAMPLEa1B2c' }, 'ok'],
      [{ memberEmail: 'rob+membertest@example.com', hintPatientId: 'pat-x' }, 'ok'],
      [{ memberEmail: 'owner+12@example.com', hintPatientId: 'pat-EXAMPLEa1B2c' }, 'synthetic'],
      [{ memberEmail: 'owner+7@example.com' }, 'synthetic'],
      [{ memberEmail: 'owner+pat-EXAMPLEa1B2c@example.com', hintPatientId: 'pat-OTHER' }, 'synthetic'],
      [{ memberEmail: 'owner+pat-EXAMPLEd4E5f-4@example.com' }, 'synthetic'],
      [{ memberEmail: 'Owner+PAT-ABC@Example.com' }, 'synthetic'],
      [{ memberEmail: 'owner+sbx-pat-Q1w2@example.com', hintPatientId: 'sbx-pat-Q1w2' }, 'synthetic'],
      [{ memberEmail: 'owner+sbx-pat-q1w2@example.com', hintPatientId: 'SBX-PAT-Q1W2' }, 'synthetic'],
      [{ memberEmail: '', hintPatientId: 'pat-x' }, 'empty'],
      [{ memberEmail: '   ' }, 'empty'],
      [{ memberEmail: '{{contact.email}}' }, 'invalid'],
      [{ memberEmail: 'no-at-sign.example.com' }, 'invalid'],
    ];
    for (const [input, want] of cases) {
      const out = runNamed('capture', input);
      if (!out || out.emailCheck !== want) return JSON.stringify(input) + ' gave ' + JSON.stringify(out) + ', want ' + want;
    }
    return true;
  });

  check('(w2) the server-side SYNTHETIC_EMAIL_RE equals the admin-theme client regex', () => {
    const src = fs.readFileSync(require('path').join(__dirname, '../../../../src/ghl-customizer.js'), 'utf8');
    const client = (src.match(/var SYNTHETIC_EMAIL_RE = (\/.*\/[a-z]*);/) || [])[1];
    if (!client) return 'client SYNTHETIC_EMAIL_RE not found in src/ghl-customizer.js';
    const server = (namedSnippet('capture').match(/var SYNTHETIC_EMAIL_RE = (\/.*\/[a-z]*);/) || [])[1];
    if (!server) return 'SYNTHETIC_EMAIL_RE not found in the capture snippet';
    return server === client || 'server ' + server + ' != client ' + client;
  });

  check('(w3) R-04 refuses on the capture output, not on a contains-merge-field condition', () => {
    const s4 = section(H2[4]) || '';
    const r04 = s4.slice(s4.indexOf('4.2 **R-04'), s4.indexOf('4.3 **R-05'));
    if (!r04) return 'section 4.2 not found';
    if (!/`emailCheck` is not `ok`/.test(r04)) return 'R-04 has no "emailCheck is not ok" condition';
    if (/^- Email contains/m.test(r04)) return 'R-04 still lists an "Email contains" condition';
    return r04.indexOf('action name = "Capture member email"') < r04.indexOf('action name = "Has own email"') || 'capture does not run before Has own email';
  });

  check('(u2) "Compare with owner" passes only two different, readable saved emails (fail closed)', () => {
    const cases = [
      [{ ownerEmail: 'owner@example.com', memberEmail: 'member@example.net' }, 'different'],
      [{ ownerEmail: 'Owner@Example.com ', memberEmail: 'owner@example.com' }, 'same'],
      [{ ownerEmail: 'owner@example.com', memberEmail: ' OWNER@EXAMPLE.COM' }, 'same'],
      [{ ownerEmail: '', memberEmail: 'member@example.net' }, 'unknown'],
      [{ ownerEmail: 'owner@example.com', memberEmail: '' }, 'unknown'],
      [{ ownerEmail: 'owner@example.com' }, 'unknown'],
      [{ ownerEmail: 'owner@example.com', memberEmail: '{{custom_code.memberEmail}}' }, 'unknown'],
      [{ ownerEmail: 'owner@example.com', memberEmail: 'not an email' }, 'unknown'],
    ];
    for (const [input, want] of cases) {
      const out = runNamed('compare', input);
      if (!out || out.emailCheck !== want) return JSON.stringify(input) + ' gave ' + JSON.stringify(out) + ', want ' + want;
    }
    return true;
  });

  // ---- review WR-03: reuse only a complete member token that is not the owner's ----
  check('(y1) "Compare with owner" tokenCheck: none, reuse only a distinct adhoc_ + 64 hex, else foreign', () => {
    const mine = 'adhoc_' + 'c3'.repeat(32);
    const owner32 = 'd4'.repeat(16);
    const base = { ownerEmail: 'owner@example.com', memberEmail: 'member@example.net', ownerToken: owner32 };
    const cases = [
      [{ memberToken: '' }, 'none'],
      [{}, 'none'],
      [{ memberToken: '   ' }, 'none'],
      [{ memberToken: mine }, 'reuse'],
      [{ memberToken: mine, ownerToken: '' }, 'reuse'],
      [{ memberToken: owner32 }, 'foreign'],
      [{ memberToken: mine, ownerToken: mine }, 'foreign'],
      [{ memberToken: 'adhoc_' }, 'foreign'],
      [{ memberToken: 'adhoc_123' }, 'foreign'],
      [{ memberToken: mine.toUpperCase().replace('ADHOC_', 'adhoc_') }, 'foreign'],
      [{ memberToken: mine + ' ' }, 'foreign'],
      [{ memberToken: '{{custom_code.memberToken}}' }, 'foreign'],
    ];
    for (const [extra, want] of cases) {
      const input = Object.assign({}, base, extra);
      const out = runNamed('compare', input);
      if (!out || out.tokenCheck !== want) return JSON.stringify(extra).slice(0, 80) + ' gave ' + JSON.stringify(out) + ', want ' + want;
      if (out.emailCheck !== 'different') return 'emailCheck changed to ' + out.emailCheck;
    }
    return true;
  });

  check('(y2) 4.6 branches on tokenCheck: none mints, reuse sends, anything else is R-11', () => {
    const s4 = section(H2[4]) || '';
    const s46 = s4.slice(s4.indexOf('4.6 **Member token'), s4.indexOf('1. **Custom Code**, action name = "Mint member hub token"'));
    if (!s46) return '4.6 head not found';
    for (const x of ['`tokenCheck` is `none`', '`tokenCheck` is `reuse`', 'R-11']) if (!s46.includes(x)) return '4.6 head lacks ' + x;
    return !/Consent Hub Token is empty/.test(s46) || '4.6 still branches on a native "Consent Hub Token is empty" condition';
  });

  // ---- review CR-02: post-condition after the token save ----
  check('(v1) "Verify saved token" passes only the stored adhoc_ + 64 hex token THIS run minted', () => {
    const good = 'adhoc_' + 'a1'.repeat(32);
    const other = 'adhoc_' + 'e5'.repeat(32);
    const now = Date.now();
    const cases = [
      [{ savedToken: good, mintedToken: good, mintedAt: now }, 'ok'],
      [{ savedToken: good, mintedToken: good, mintedAt: String(now - 70 * 1000) }, 'ok'],
      // review WR-04: a concurrent press saved its own token after ours
      [{ savedToken: other, mintedToken: good, mintedAt: now }, 'superseded'],
      [{ savedToken: other, mintedToken: '', mintedAt: now }, 'superseded'],
      [{ savedToken: other, mintedToken: good, mintedAt: now - 2 * 60 * 60 * 1000 }, 'bad'],
      [{ savedToken: 'adhoc_', mintedToken: good, mintedAt: now }, 'bad'],
      [{ savedToken: '', mintedToken: good, mintedAt: now }, 'bad'],
      [{ savedToken: '', mintedAt: now }, 'bad'],
      [{ savedToken: 'adhoc_', mintedAt: now }, 'bad'],
      [{ savedToken: 'adhoc', mintedAt: now }, 'bad'],
      [{ savedToken: good.slice(0, -1), mintedAt: now }, 'bad'],
      [{ savedToken: good.toUpperCase().replace('ADHOC_', 'adhoc_'), mintedAt: now }, 'bad'],
      [{ savedToken: ' ' + good, mintedAt: now }, 'bad'],
      [{ savedToken: '{{custom_code.token}}', mintedAt: now }, 'bad'],
      [{ savedToken: 'a1'.repeat(16), mintedAt: now }, 'bad'],
      [{ savedToken: good, mintedAt: now - 2 * 60 * 60 * 1000 }, 'bad'],
      [{ savedToken: good, mintedAt: '' }, 'bad'],
      [{ savedToken: good, mintedAt: '{{custom_code.mintedAt}}' }, 'bad'],
      [{ savedToken: good }, 'bad'],
      [{}, 'bad'],
    ];
    for (const [raw, want] of cases) {
      const input = Object.assign({ mintedToken: raw.savedToken }, raw);
      const out = runNamed('verify', input);
      if (!out || out.tokenCheck !== want) return JSON.stringify(input).slice(0, 90) + ' gave ' + JSON.stringify(out) + ', want ' + want;
    }
    return true;
  });

  check('(v2) section 4 order: save, reload, verify, valid branch (R-10), then the member email', () => {
    const s4 = section(H2[4]);
    if (s4 === null) return 'section 4 missing';
    const marks = ['action name = "Mint member hub token"', 'action name = "Save member hub token"', 'action name = "Settle concurrent presses"', 'action name = "Reload member"',
      'action name = "Verify saved token"', 'action name = "Saved token valid"', 'action name = "Member consent email"'];
    let last = -1;
    for (const mk of marks) {
      const i = s4.indexOf(mk);
      if (i < 0) return 'missing ' + mk;
      if (i <= last) return 'out of order at ' + mk;
      last = i;
    }
    const valid = s4.slice(s4.indexOf('action name = "Saved token valid"'), s4.indexOf('action name = "Member consent email"'));
    if (!/\bR-10\b/.test(valid)) return 'R-10 refusal not on the Saved token valid branch';
    if (!/`tokenCheck` is `ok`/.test(valid)) return 'Saved token valid does not branch on tokenCheck is ok';
    if (!/`tokenCheck` is `superseded`[^\n]*\bR-12\b/.test(valid)) return 'no Superseded branch refusing with R-12 (review WR-04)';
    return true;
  });

  check('(u3) every Custom Code region is free of Math random and payload reads', () => {
    const regions = allRegions();
    if (regions.length < 3) return 'found ' + regions.length + ' custom-code regions, want at least 3';
    for (const r of regions) {
      if (/Math\s*\.\s*random/.test(r.body)) return r.name + ' references Math random';
      if (/inboundWebhookRequest/.test(r.body)) return r.name + ' reads the webhook payload';
    }
    return true;
  });
}

// ---------------- Stage 3 ----------------

if (args.stage >= 3) {
  check('(n) exactly the twelve H2s, in order, with exact titles', () => {
    if (h2Lines.length !== H2.length) return 'found ' + h2Lines.length + ' H2s: ' + JSON.stringify(h2Lines);
    for (let k = 0; k < H2.length; k++) {
      if (h2Lines[k] !== H2[k]) return 'H2 #' + k + ' is ' + JSON.stringify(h2Lines[k]) + ', want ' + JSON.stringify(H2[k]);
    }
    return true;
  });

  check('(o) R-01..R-' + R_MAX + ' and V-01..V-' + V_MAX + ' each appear at least twice', () => {
    const ids = [];
    for (let k = 1; k <= R_MAX; k++) ids.push('R-' + String(k).padStart(2, '0'));
    for (let k = 1; k <= V_MAX; k++) ids.push('V-' + String(k).padStart(2, '0'));
    const low = ids.filter((id) => count(idRe(id)) < 2).map((id) => id + '=' + count(idRe(id)));
    return low.length ? 'fewer than 2: ' + low.join(', ') : true;
  });

  check('(p) rename strings present', () => {
    const m = missing([
      'WEBHOOK TEST Send Hint JOIN LINK & Reminders',
      '[Ready] Admin Menu: Send Invite (webhook)',
      '3dff9d94-403f-41ae-8496-c47320fc0ea6',
      'bde416ab-a074-4946-bf99-7266eb1b0f4e',
    ]);
    if (m !== true) return m;
    return /Renaming does not change the webhook URL/.test(text) || 'rename sentence missing';
  });

  check('(q) section 8 carries AR-03-01, volume, disclosure, address on file', () => {
    const s8 = section(H2[8]);
    if (s8 === null) return 'section 8 missing';
    const miss = ['AR-03-01', 'volume', 'disclosure', 'address on file'].filter((s) => !s8.includes(s));
    return miss.length ? 'section 8 missing ' + miss.join(', ') : true;
  });

  check('(x1) section 8 accepts the member-to-member shared email risk with a staff rule (code review WR-02)', () => {
    const s8 = section(H2[8]);
    if (s8 === null) return 'section 8 missing';
    const req = ['Residual risk accepted (code review WR-02)', 'one member\'s own card, never the family', 'confirming with the member that the saved email is their own', '`hint_membership_id`'];
    const miss = req.filter((x) => !s8.includes(x));
    return miss.length ? 'section 8 missing ' + JSON.stringify(miss) : true;
  });

  check('(x2) section 8 states the concurrent-press residual risk (code review WR-04)', () => {
    const s8 = section(H2[8]) || '';
    const req = ['Concurrent presses (code review WR-04)', 'duplicate sends are possible; dead links are not', 'per browser tab', '`seeds/consent-actions-hardening.md`'];
    const miss = req.filter((x) => !s8.includes(x));
    return miss.length ? 'section 8 missing ' + JSON.stringify(miss) : true;
  });

  check('(r) section 11 mentions Draft and adhoc_', () => {
    const s11 = section(H2[11]);
    if (s11 === null) return 'section 11 missing';
    const miss = ['Draft', 'adhoc_'].filter((s) => !s11.includes(s));
    return miss.length ? 'section 11 missing ' + miss.join(', ') : true;
  });

  check('(s) no pit- token-like string; no 64-hex run outside the custom-code region', () => {
    const bad = text.split('\n').filter((l) => /pit-[0-9a-f]{8}/i.test(l));
    if (bad.length) return bad.length + ' line(s) match pit-<8 hex>';
    const a = text.indexOf(START);
    const b = text.indexOf(END);
    const outside = (a >= 0 && b > a) ? text.slice(0, a) + text.slice(b + END.length) : text;
    return !/[0-9a-fA-F]{64}/.test(outside) || '64-hex run outside the region';
  });
}

const failed = results.filter((r) => !r.ok).length;
if (failed === 0) {
  console.log('PASS ' + results.length + '/' + results.length);
  process.exit(0);
}
console.log('FAIL ' + failed + '/' + results.length);
process.exit(1);

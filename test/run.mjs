// End-to-end and static checks for src/ghl-customizer.js.
// Runs the real IIFE inside test/dom-shim.mjs under node:vm. No dependencies.
//
// Usage: node test/run.mjs   (exit 0 and a final "PASS n/n" line on success)

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createShim } from './dom-shim.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SRC_PATH = path.join(root, 'src', 'ghl-customizer.js');
const SAMPLE_CONFIG_PATH = path.join(root, 'config', 'agency-config.json');
const FIXTURE_PATH = path.join(root, 'test', 'fixtures', 'config.json');

const src = fs.readFileSync(SRC_PATH, 'utf8');
const sampleText = fs.readFileSync(SAMPLE_CONFIG_PATH, 'utf8');
const fixtureText = fs.readFileSync(FIXTURE_PATH, 'utf8');
const loadFixture = () => JSON.parse(fixtureText);

// ---------------------------------------------------------------------------
// Tiny runner
// ---------------------------------------------------------------------------

const items = [];
function check(name, fn) { items.push({ name, fn, async: false }); }
function scenario(name, fn) { items.push({ name, fn, async: true }); }

// ---------------------------------------------------------------------------
// Constants shared by static gates
// ---------------------------------------------------------------------------

// HTML-string injection setters, dynamic-code-evaluation constructors, Web
// Storage and cookie accessors. None may appear anywhere in the source.
const FORBIDDEN = [
  'innerHTML',
  'outerHTML',
  'insertAdjacentHTML',
  'document.write',
  'eval(',
  'new Function',
  'localStorage',
  'sessionStorage',
  'document.cookie',
];

const SECTION_MARKERS = [
  '// ==== constants ====',
  '// ==== adapter ====',
  '// ==== config ====',
  '// ==== context ====',
  '// ==== buttons ====',
  '// ==== observers ====',
  '// ==== verify ====',
  '// ==== boot ====',
];

// Selector literals and HighLevel-specific strings that may only live in the adapter.
const ADAPTER_ONLY = [
  /querySelector(?:All)?\(\s*['"`]/,
  /closest\(\s*['"`]/,
  /#sidebar-v2/,
  /\.hl_/,
  /hl_header/,
  /\/v2\/location/,
  /\/v2\/agency/,
  /agency_dashboard/,
  /routeChangeEvent/,
  /href\^=/,
];

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_KEY_RE = /token|secret|api.?key|password|bearer/i;
const LEAK_STRINGS = ['hooks/', 'jane@', '5550100', 'requestId'];

// Values created inside the vm realm have a different Object.prototype; strip
// prototypes before strict deep comparison.
const plain = (value) => JSON.parse(JSON.stringify(value));

function collectKeys(value, out = []) {
  if (Array.isArray(value)) value.forEach((v) => collectKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      collectKeys(v, out);
    }
  }
  return out;
}

function throwawayApi() {
  const shim = createShim({ fixture: loadFixture() });
  return shim.run(src).__test;
}

function assertNoLeak(lines, strings, label) {
  const text = lines.join('\n');
  for (const s of strings) {
    assert.ok(!text.includes(s), `${label}: console output must not contain "${s}"\n--- console ---\n${text}`);
  }
}

// ---------------------------------------------------------------------------
// Static checks
// ---------------------------------------------------------------------------

check('static: source compiles as a classic script', () => {
  new vm.Script(src, { filename: 'ghl-customizer.js' });
});

check('static: source contains no forbidden tokens (HTML setters, eval, storage, cookies)', () => {
  for (const token of FORBIDDEN) {
    assert.ok(!src.includes(token), `source must not contain "${token}"`);
  }
});

check('static: eight section markers appear exactly once, in order', () => {
  let last = -1;
  for (const marker of SECTION_MARKERS) {
    const lines = src.split('\n').filter((l) => l === marker);
    assert.equal(lines.length, 1, `marker "${marker}" must appear exactly once on its own line`);
    const idx = src.indexOf(marker);
    assert.ok(idx > last, `marker "${marker}" is out of order`);
    last = idx;
  }
});

check('static: FND-03 — no selector literals or HighLevel strings outside the adapter section', () => {
  const start = src.indexOf('// ==== adapter ====');
  const end = src.indexOf('// ==== config ====');
  assert.ok(start !== -1 && end > start, 'adapter section not found');
  const outside = src.slice(0, start) + src.slice(end);
  for (const re of ADAPTER_ONLY) {
    const m = re.exec(outside);
    assert.ok(!m, `pattern ${re} found outside adapter: "${m && m[0]}"`);
  }
});

check('static: no ES2020+ optional chaining or nullish coalescing in src', () => {
  const noStrings = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
  assert.ok(!/\?\?/.test(noStrings), 'source must not use ??');
  assert.ok(!/\?\.\s*[A-Za-z_$[(]/.test(noStrings), 'source must not use ?.');
});

check('static: schema documentation, data-config attribute, constant fallback, reserved mounts', () => {
  assert.equal(src.split('Config schema (schemaVersion 1)').length - 1, 1);
  assert.ok(src.includes('data-config'));
  assert.ok(src.split('DEFAULT_CONFIG_URL').length - 1 >= 2);
  assert.equal(src.split('location-switcher-sidbar-v2').length - 1, 1);
  assert.ok(src.includes('sidebarLogo') && src.includes('headerLogo'));
  assert.ok(src.includes('__GHLC_TEST__') && src.includes('__test'));
});

check('config: both JSON files parse, validate, use HTTPS webhooks, and carry no secret-like keys', () => {
  const sample = JSON.parse(sampleText);
  const fixture = JSON.parse(fixtureText);
  const api = throwawayApi();
  for (const [label, cfg] of [['sample', sample], ['fixture', fixture]]) {
    const result = api.validateConfig(cfg);
    assert.deepEqual(plain(result), { ok: true, errors: [] }, `${label} config must validate`);
    for (const b of cfg.buttons) {
      if (b.action.type === 'webhook') assert.ok(api.isSafeHttpsUrl(b.action.url), `${label}: ${b.id} url must be https`);
    }
    for (const key of collectKeys(cfg)) {
      assert.ok(!SECRET_KEY_RE.test(key), `${label}: key "${key}" looks like a secret`);
    }
  }
  const invite = sample.buttons.find((b) => b.id === 'sendInvite');
  assert.ok(invite, 'sample must ship a sendInvite button');
  assert.equal(invite.placement, 'contact');
  assert.equal(invite.action.type, 'webhook');
  assert.ok(invite.action.url.includes('REPLACE_ME'));
  assert.ok(sample.buttons.some((b) => b.placement === 'header' && b.action.type === 'link'), 'sample must ship a header link button');
});

check('unit: parseRoute resolves contact, location, and agency routes', () => {
  const api = throwawayApi();
  const route = (p) => plain(api.parseRoute(p));
  assert.deepEqual(route('/v2/location/locA/contacts/detail/c1'), { locationId: 'locA', contactId: 'c1', isAgency: false });
  assert.deepEqual(route('/v2/location/locA/contacts/detail/c1?tab=notes#x'), { locationId: 'locA', contactId: 'c1', isAgency: false });
  assert.deepEqual(route('/v2/location/locA/dashboard'), { locationId: 'locA', contactId: null, isAgency: false });
  assert.deepEqual(route('/v2/location/locA'), { locationId: 'locA', contactId: null, isAgency: false });
  assert.deepEqual(route('/v2/agency/dashboard'), { locationId: null, contactId: null, isAgency: true });
  assert.deepEqual(route('/agency_dashboard/'), { locationId: null, contactId: null, isAgency: true });
  assert.deepEqual(route('/'), { locationId: null, contactId: null, isAgency: true });
  assert.deepEqual(route('/v2/locations/locA'), { locationId: null, contactId: null, isAgency: true });
});

check('unit: isSafeHttpsUrl accepts plain https only', () => {
  const api = throwawayApi();
  assert.equal(api.isSafeHttpsUrl('https://services.leadconnectorhq.com/hooks/x'), true);
  assert.equal(api.isSafeHttpsUrl('http://services.leadconnectorhq.com/hooks/x'), false);
  assert.equal(api.isSafeHttpsUrl('https://user:pw@example.test/hooks/x'), false);
  assert.equal(api.isSafeHttpsUrl('javascript:alert(1)'), false);
  assert.equal(api.isSafeHttpsUrl('/hooks/x'), false);
  assert.equal(api.isSafeHttpsUrl(''), false);
  assert.equal(api.isSafeHttpsUrl(null), false);
});

check('unit: validateConfig rejects bad schema, duplicate ids, and bad placements', () => {
  const api = throwawayApi();
  const base = loadFixture();
  assert.equal(api.validateConfig(null).ok, false);
  assert.equal(api.validateConfig({ ...base, schemaVersion: 2 }).ok, false);
  assert.equal(api.validateConfig({ ...base, enabled: 'yes' }).ok, false);
  assert.equal(api.validateConfig({ ...base, buttons: {} }).ok, false);
  const dup = { ...base, buttons: [base.buttons[0], base.buttons[0]] };
  assert.equal(api.validateConfig(dup).ok, false);
  const badPlacement = { ...base, buttons: [{ ...base.buttons[0], placement: 'footer' }] };
  assert.equal(api.validateConfig(badPlacement).ok, false);
  const badId = { ...base, buttons: [{ ...base.buttons[0], id: 'has space' }] };
  assert.equal(api.validateConfig(badId).ok, false);
  // Unknown action types are not validation errors (they render unavailable).
  const unknownType = { ...base, buttons: [{ ...base.buttons[0], action: { type: 'script' } }] };
  assert.equal(api.validateConfig(unknownType).ok, true);
});

check('unit: resolveButtons scopes by location and returns nothing at agency level', () => {
  const api = throwawayApi();
  const cfg = loadFixture();
  assert.deepEqual(plain(api.resolveButtons(cfg, null)), []);
  const idsA = api.resolveButtons(cfg, 'locA').map((b) => b.id);
  assert.ok(idsA.includes('sendInvite') && idsA.includes('locOnlyLink'));
  const idsB = api.resolveButtons(cfg, 'locB').map((b) => b.id);
  assert.ok(idsB.includes('sendInvite') && !idsB.includes('locOnlyLink'));
});

// ---------------------------------------------------------------------------
// Scenarios (shim-driven, end to end)
// ---------------------------------------------------------------------------

const CONTACT_PATH = '/v2/location/locA/contacts/detail/c1';
const JANE = { email: 'jane@example.test', phone: '+15555550100' };

async function bootContactPage(extra = {}) {
  const shim = createShim({ pathname: CONTACT_PATH, search: '?ghlc-debug=1', fixture: loadFixture(), ...extra });
  const shell = shim.buildShell({ sidebarMode: 'location', contact: JANE });
  const GHLC = shim.run(src);
  const ready = await GHLC.__test.boot();
  await shim.flush();
  return { shim, shell, GHLC, ready };
}

scenario('tracer: contact page renders Send Invite; click POSTs once and shows queued', async () => {
  const { shim, shell, GHLC, ready } = await bootContactPage();
  assert.equal(ready, true, 'boot must resolve true');
  assert.equal(await GHLC.ready, true, 'GHLC.ready must be the boot promise');

  const buttons = shim.document.querySelectorAll('[data-ghlc-button-id="sendInvite"]');
  assert.equal(buttons.length, 1, 'exactly one Send Invite button');
  const button = buttons[0];
  assert.equal(button.tagName, 'BUTTON');
  assert.equal(button.getAttribute('type'), 'button');
  assert.equal(button.getAttribute('data-state'), 'ready');
  assert.equal(button.getAttribute('data-ghlc-ctx'), 'locA|c1');
  assert.equal(button.querySelector('.ghlc-btn__label').textContent, 'Send Invite');
  assert.ok(button.querySelector('.ghlc-btn__icon svg'), 'send icon rendered');
  const group = button.closest('.ghlc-group[data-ghlc-placement="contact"]');
  assert.ok(group, 'button sits inside the contact group');
  assert.ok(shell.contactRegion.contains(button), 'group is mounted inside the contact region');

  const badHandler = shim.document.querySelector('[data-ghlc-button-id="badHandlerBtn"]');
  assert.ok(badHandler, 'badHandlerBtn is rendered');
  assert.equal(badHandler.getAttribute('data-state'), 'unavailable');
  assert.ok(badHandler.disabled);
  assert.equal(badHandler.getAttribute('aria-disabled'), 'true');
  assert.equal(shim.document.querySelectorAll('[data-ghlc-placement="header"]').length, 0, 'no header buttons in Plan 01');
  assert.ok(!shim.document.textContent.includes('alert(1)'), 'config code text never reaches the DOM');

  button.click();
  assert.equal(button.getAttribute('data-state'), 'submitting');
  assert.ok(button.disabled, 'disabled while submitting');
  assert.equal(button.getAttribute('aria-busy'), 'true');
  assert.equal(button.querySelector('.ghlc-btn__label').textContent, 'Sending…');
  button.click(); // must be ignored while submitting

  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'queued');
  assert.equal(button.querySelector('.ghlc-btn__label').textContent, 'Workflow triggered');
  assert.ok(button.disabled, 'stays disabled after queued');
  assert.equal(button.getAttribute('aria-busy'), null);

  assert.equal(shim.fetchLog.length, 1, 'exactly one webhook POST');
  const call = shim.fetchLog[0];
  assert.equal(call.url, 'https://services.leadconnectorhq.com/hooks/TEST-HOOK');
  assert.equal(call.method, 'POST');
  assert.equal(call.mode, 'cors');
  assert.equal(call.credentials, 'omit');
  assert.equal(call.headers['content-type'], 'application/json');
  const body = call.bodyJson;
  assert.ok(body, 'body is JSON');
  assert.equal(body.contactId, 'c1');
  assert.equal(body.locationId, 'locA');
  assert.equal(body.buttonId, 'sendInvite');
  assert.match(body.requestId, UUID_V4_RE);
  assert.ok(Number.isFinite(Date.parse(body.sentAt)), 'sentAt parses as a date');
  assert.equal(body.email, JANE.email);
  assert.equal(body.phone, JANE.phone);
  assert.equal(body.source, 'ghlc-harness');

  const state = GHLC.__test.getState();
  assert.equal(state.generation, 1);
  assert.equal(state.locationId, 'locA');
  assert.equal(state.contactId, 'c1');
  assert.equal(state.configLoaded, true);
  assert.ok(state.buttons.some((b) => b.id === 'sendInvite' && b.state === 'queued'));

  assertNoLeak(shim.console.lines, LEAK_STRINGS, 'DLV-04');
  assert.ok(shim.console.lines.some((l) => l.includes('[ghlc]')), 'debug mode produced diagnostics');
  assert.equal(shim.errors.length, 0, 'no uncaught errors in listeners');
});

scenario('tracer: 500 response shows failed without leaking the URL', async () => {
  const { shim } = await bootContactPage();
  shim.setFetchMode('error');
  const button = shim.document.querySelector('[data-ghlc-button-id="sendInvite"]');
  assert.ok(button);
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'failed');
  assert.ok(!button.disabled, 'failed buttons are enabled for retry');
  assert.equal(button.querySelector('.ghlc-btn__label').textContent, 'Failed — retry');
  const msg = button.querySelector('.ghlc-btn__msg').textContent;
  assert.ok(msg.length > 0, 'failure message present');
  assert.ok(!msg.includes('hooks/') && !msg.includes('TEST-HOOK'), 'message excludes the URL');
  assert.ok(!msg.includes('jane@') && !msg.includes('5550100'), 'message excludes the payload');
  assert.equal(button.getAttribute('title'), msg);
  assert.equal(shim.fetchLog.length, 1);
  assertNoLeak(shim.console.lines, LEAK_STRINGS, 'DLV-04');

  // failed -> retry succeeds
  shim.setFetchMode('ok');
  button.click();
  assert.equal(button.getAttribute('data-state'), 'submitting');
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'queued');
  assert.equal(shim.fetchLog.length, 2);
  assert.notEqual(shim.fetchLog[0].bodyJson.requestId, shim.fetchLog[1].bodyJson.requestId, 'fresh requestId per click');
  assert.equal(shim.errors.length, 0);
});

scenario('tracer: network failure shows failed with a connection message', async () => {
  const { shim } = await bootContactPage();
  shim.setFetchMode('offline');
  const button = shim.document.querySelector('[data-ghlc-button-id="sendInvite"]');
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'failed');
  const msg = button.querySelector('.ghlc-btn__msg').textContent;
  assert.ok(/connection/i.test(msg));
  assert.ok(!msg.includes('hooks/'));
  assertNoLeak(shim.console.lines, LEAK_STRINGS, 'DLV-04');
});

scenario('D-02: contact without email or phone renders unavailable on click', async () => {
  const shim = createShim({ pathname: CONTACT_PATH, search: '?ghlc-debug=1', fixture: loadFixture() });
  shim.buildShell({ sidebarMode: 'location', contact: { name: 'No Details' } });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  const button = shim.document.querySelector('[data-ghlc-button-id="sendInvite"]');
  assert.equal(button.getAttribute('data-state'), 'ready');
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'unavailable');
  assert.equal(button.querySelector('.ghlc-btn__msg').textContent, 'contact email/phone not found');
  assert.equal(shim.fetchLog.length, 0, 'no POST without a contact identifier');
  assertNoLeak(shim.console.lines, LEAK_STRINGS, 'DLV-04');
});

scenario('BTN-04: location dashboard (no contact) renders no contact buttons', async () => {
  const shim = createShim({ pathname: '/v2/location/locA/dashboard', fixture: loadFixture() });
  shim.buildShell({ sidebarMode: 'location', contact: null });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  assert.equal(shim.document.querySelectorAll('[data-ghlc-button-id]').length, 0);
  assert.equal(shim.document.querySelectorAll('.ghlc-group').length, 0);
  const state = GHLC.__test.getState();
  assert.equal(state.locationId, 'locA');
  assert.equal(state.contactId, null);
});

scenario('mount missing: contact route without a toolbar leaves the DOM untouched', async () => {
  const shim = createShim({ pathname: CONTACT_PATH, fixture: loadFixture() });
  shim.buildShell({ sidebarMode: 'location', contact: null });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  assert.equal(shim.document.querySelectorAll('[data-ghlc-button-id]').length, 0);
  assert.equal(shim.document.querySelectorAll('.ghlc-group').length, 0);
});

scenario('FND-05: enabled:false, invalid schema, fetch failure, and parse failure all no-op', async () => {
  const cases = [
    { label: 'enabled false', response: { status: 200, body: { ...loadFixture(), enabled: false } }, warn: false },
    { label: 'schemaVersion 2', response: { status: 200, body: { ...loadFixture(), schemaVersion: 2 } }, warn: 'config-invalid' },
    { label: 'HTTP 404', response: { status: 404, body: '' }, warn: 'config-fetch-failed' },
    { label: 'bad JSON', response: { status: 200, body: '{not json' }, warn: 'config-parse-failed' },
  ];
  for (const c of cases) {
    const shim = createShim({ pathname: CONTACT_PATH, fixture: loadFixture() });
    shim.buildShell({ sidebarMode: 'location', contact: JANE });
    shim.setConfigResponse(c.response);
    const GHLC = shim.run(src);
    assert.equal(await GHLC.__test.boot(), false, `${c.label}: boot resolves false`);
    await shim.flush();
    assert.equal(shim.document.querySelectorAll('[data-ghlc-button-id]').length, 0, `${c.label}: no buttons`);
    assert.equal(GHLC.__test.getState().configLoaded, false, `${c.label}: config not loaded`);
    const text = shim.console.lines.join('\n');
    if (c.warn) assert.ok(text.includes(c.warn), `${c.label}: warns ${c.warn}`);
    assert.ok(!text.includes('config.test'), `${c.label}: config URL never logged`);
  }
});

scenario('FND-05: non-https, cross-origin config URL is rejected before fetch', async () => {
  const shim = createShim({ pathname: CONTACT_PATH, configUrl: 'http://evil.test/config.json', fixture: loadFixture() });
  shim.buildShell({ sidebarMode: 'location', contact: JANE });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), false);
  assert.ok(shim.console.lines.join('\n').includes('config-url-rejected'));
});

scenario('production mode: no __test surface, window.GHLC exposes version/ready/verify', async () => {
  const shim = createShim({ pathname: CONTACT_PATH, fixture: loadFixture() });
  shim.buildShell({ sidebarMode: 'location', contact: JANE });
  // Run without the test flag: the IIFE must boot itself.
  const script = shim.document.createElement('script');
  script.setAttribute('data-config', 'https://config.test/config.json');
  shim.document.currentScript = script;
  shim.window.__GHLC_TEST__ = false;
  new vm.Script(src, { filename: 'ghl-customizer.js' }).runInContext(shim.context);
  shim.document.currentScript = null;
  const GHLC = shim.window.GHLC;
  assert.equal(GHLC.version, '0.1.0');
  assert.equal(GHLC.__test, undefined);
  assert.equal(typeof GHLC.verify, 'function');
  assert.equal(await GHLC.ready, true);
  await shim.flush();
  assert.equal(shim.document.querySelectorAll('[data-ghlc-button-id="sendInvite"]').length, 1);
  const report = GHLC.verify();
  assert.equal(report.version, '0.1.0');
  assert.deepEqual(plain(report.route), { locationId: 'locA', contactId: 'c1', isAgency: false });
  assert.equal(report.generation, 1);
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

let passed = 0;
for (const item of items) {
  try {
    if (item.async) await item.fn();
    else item.fn();
    passed++;
    console.log(`ok - ${item.name}`);
  } catch (err) {
    console.log(`not ok - ${item.name}`);
    const message = err && err.stack ? err.stack : String(err);
    console.log(message.split('\n').map((l) => `    ${l}`).join('\n'));
  }
}

const total = items.length;
if (passed === total) {
  console.log(`PASS ${passed}/${total}`);
  process.exit(0);
} else {
  console.log(`FAIL ${total - passed}/${total}`);
  process.exit(1);
}

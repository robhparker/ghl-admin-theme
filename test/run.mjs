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

check('static: DLV-04 — console is reached only through log/warn (constants) or verify()', () => {
  const cut = (text, from, to) => {
    const a = text.indexOf(from);
    const b = text.indexOf(to);
    assert.ok(a !== -1 && b > a, `sections ${from} .. ${to} not found`);
    return text.slice(0, a) + text.slice(b);
  };
  let rest = cut(src, '// ==== constants ====', '// ==== adapter ====');
  rest = cut(rest, '// ==== verify ====', '// ==== boot ====');
  assert.ok(!rest.includes('console.'), 'console.* must not appear outside the constants and verify sections');
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

scenario('D-02: fields removed after render make the next click unavailable, not a POST', async () => {
  const { shim, shell } = await bootContactPage();
  const button = shim.document.querySelector('[data-ghlc-button-id="sendInvite"]');
  assert.equal(button.getAttribute('data-state'), 'ready');
  // HighLevel re-renders the record without the anchors; the click must re-read.
  for (const a of shell.contactRegion.querySelectorAll('a')) a.remove();
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'unavailable');
  assert.equal(button.getAttribute('data-ghlc-reason'), 'no-contact-fields');
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

scenario('styles: boot injects one stylesheet link derived from the script src, never twice', async () => {
  const { shim, GHLC } = await bootContactPage();
  const links = shim.document.head.querySelectorAll('link[data-ghlc-styles]');
  assert.equal(links.length, 1, 'exactly one stylesheet link');
  assert.equal(links[0].getAttribute('rel'), 'stylesheet');
  assert.equal(links[0].getAttribute('href'), 'https://cdn.test/ghl-customizer.css');
  await GHLC.__test.boot();
  await shim.flush();
  assert.equal(shim.document.head.querySelectorAll('link[data-ghlc-styles]').length, 1, 'second boot adds no link');
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
// Navigation, generation, and stale-context scenarios (Plan 02, Task 1)
// ---------------------------------------------------------------------------

const C2 = { email: 'c2@example.test' };
const invites = (shim) => shim.document.querySelectorAll('[data-ghlc-button-id="sendInvite"]');
const invite = (shim) => {
  const list = invites(shim);
  assert.equal(list.length, 1, 'exactly one Send Invite button in the document');
  return list[0];
};

scenario('nav: pushState to another contact rebinds the button and bumps generation', async () => {
  const { shim, GHLC } = await bootContactPage();
  const old = invite(shim);
  assert.equal(old.getAttribute('data-ghlc-ctx'), 'locA|c1');
  shim.navigate('/v2/location/locA/contacts/detail/c2', { via: 'pushState' });
  shim.setContact(C2);
  await shim.flush();
  const fresh = invite(shim);
  assert.equal(fresh.getAttribute('data-ghlc-ctx'), 'locA|c2');
  assert.equal(fresh.getAttribute('data-ghlc-generation'), '2');
  assert.equal(old.isConnected, false, 'previous element is gone');
  assert.notEqual(old, fresh, 'element is never reused across contexts');
  assert.equal(GHLC.__test.getState().generation, 2);
  assert.equal(shim.errors.length, 0);
});

scenario('nav: browser back and forward rebind through popstate', async () => {
  const { shim, GHLC } = await bootContactPage();
  shim.navigate('/v2/location/locA/contacts/detail/c2', { via: 'pushState' });
  shim.setContact(C2);
  await shim.flush();
  assert.equal(invite(shim).getAttribute('data-ghlc-ctx'), 'locA|c2');

  shim.back();
  shim.setContact(JANE);
  await shim.flush();
  assert.equal(shim.window.location.pathname, CONTACT_PATH);
  assert.equal(invite(shim).getAttribute('data-ghlc-ctx'), 'locA|c1');
  assert.equal(GHLC.__test.getState().generation, 3);

  shim.forward();
  shim.setContact(C2);
  await shim.flush();
  assert.equal(invite(shim).getAttribute('data-ghlc-ctx'), 'locA|c2');
  assert.equal(GHLC.__test.getState().generation, 4);
  assert.equal(shim.errors.length, 0);
});

scenario('nav: routeChangeEvent alone is honored', async () => {
  const { shim, GHLC } = await bootContactPage();
  shim.navigate('/v2/location/locA/contacts/detail/c3', { via: 'routeChangeEvent' });
  shim.setContact({ phone: '+15555550103' });
  await shim.flush();
  assert.equal(invite(shim).getAttribute('data-ghlc-ctx'), 'locA|c3');
  assert.equal(GHLC.__test.getState().contactId, 'c3');
});

scenario('nav: replaceState is hooked', async () => {
  const { shim, GHLC } = await bootContactPage();
  shim.navigate('/v2/location/locA/contacts/detail/c4', { via: 'replaceState' });
  shim.setContact({ email: 'c4@example.test' });
  await shim.flush();
  assert.equal(invite(shim).getAttribute('data-ghlc-ctx'), 'locA|c4');
  assert.equal(GHLC.__test.getState().generation, 2);
});

scenario('nav: patched pushState still updates location and history', async () => {
  const { shim } = await bootContactPage();
  const len = shim.window.history.length;
  const before = shim.window.history.pushState;
  shim.window.history.pushState({ marker: 1 }, '', '/v2/location/locA/dashboard');
  assert.equal(shim.window.location.pathname, '/v2/location/locA/dashboard');
  assert.equal(shim.window.history.length, len + 1);
  assert.deepEqual(plain(shim.window.history.state), { marker: 1 });
  assert.equal(shim.window.history.pushState, before, 'patch is installed once and stays');
  assert.equal(shim.errors.length, 0);
});

scenario('nav: leaving the contact removes the button and clears pending timers', async () => {
  const { shim, GHLC } = await bootContactPage();
  invite(shim).click();
  await shim.flush();
  assert.equal(invite(shim).getAttribute('data-state'), 'queued');
  shim.navigate('/v2/location/locA/dashboard', { via: 'pushState' });
  shim.setContact(null);
  await shim.flush();
  assert.equal(shim.document.querySelectorAll('[data-ghlc-button-id]').length, 0);
  assert.equal(shim.document.querySelectorAll('.ghlc-group').length, 0);
  assert.equal(GHLC.__test.getState().buttons.length, 0);
  await shim.advanceTimers(10000);
  assert.equal(shim.document.querySelectorAll('[data-ghlc-button-id]').length, 0, 'no timer resurrects a button');
  assert.equal(shim.fetchLog.length, 1);
  assert.equal(shim.errors.length, 0);
});

scenario('nav: agency route yields a null location and zero buttons', async () => {
  const { shim, GHLC } = await bootContactPage();
  shim.navigate('/v2/agency/dashboard', { via: 'pushState' });
  shim.setSidebarMode('agency');
  shim.setContact(null);
  await shim.flush();
  const s = GHLC.__test.getState();
  assert.equal(s.locationId, null);
  assert.equal(s.contactId, null);
  assert.equal(s.isAgency, true);
  assert.equal(s.buttons.length, 0);
  assert.equal(shim.document.querySelectorAll('.ghlc-group').length, 0);
  const api = GHLC.__test;
  assert.equal(api.parseRoute('/agency_dashboard/overview').isAgency, true);
  assert.deepEqual(plain(api.parseRoute('/v2/location/locB/settings')), { locationId: 'locB', contactId: null, isAgency: false });
});

scenario('stale: click after an unobserved URL change refuses to fire', async () => {
  const { shim } = await bootContactPage();
  const button = invite(shim);
  shim.setPath('/v2/location/locA/contacts/detail/c9');
  button.click();
  assert.equal(button.getAttribute('data-state'), 'unavailable');
  assert.ok(button.querySelector('.ghlc-btn__msg').textContent.includes('Context changed'));
  assert.ok(button.disabled);
  assert.equal(shim.fetchLog.length, 0, 'nothing is sent for a stale click');
  assert.ok(shim.console.lines.some((l) => l.includes('stale-click')));
  await shim.flush();
  assert.equal(button.isConnected, false, 'stale element is replaced once the DOM catches up');
  const fresh = invite(shim);
  assert.equal(fresh.getAttribute('data-ghlc-ctx'), 'locA|c9');
  assert.equal(fresh.getAttribute('data-state'), 'ready');
  assertNoLeak(shim.console.lines, LEAK_STRINGS, 'DLV-04');
});

scenario('stale: in-flight result from an older generation is discarded', async () => {
  const { shim } = await bootContactPage();
  shim.setFetchMode('hold');
  const old = invite(shim);
  old.click();
  assert.equal(old.getAttribute('data-state'), 'submitting');
  shim.navigate('/v2/location/locA/contacts/detail/c2', { via: 'pushState' });
  shim.setContact(C2);
  await shim.flush();
  const fresh = invite(shim);
  assert.notEqual(fresh, old);
  assert.equal(fresh.getAttribute('data-state'), 'ready');
  shim.releaseFetch();
  await shim.flush();
  assert.equal(fresh.getAttribute('data-state'), 'ready', 'late result never touches the new element');
  assert.equal(old.isConnected, false);
  assert.equal(old.getAttribute('data-state'), 'submitting', 'old element is never updated');
  assert.equal(shim.fetchLog.length, 1);
  assert.ok(shim.console.lines.some((l) => l.includes('webhook-discarded')));
  assertNoLeak(shim.console.lines, LEAK_STRINGS, 'DLV-04');
  assert.equal(shim.errors.length, 0);
});

scenario('ctx: unchanged URL does not bump generation', async () => {
  const { shim, GHLC } = await bootContactPage();
  const button = invite(shim);
  shim.navigate(CONTACT_PATH, { via: 'routeChangeEvent' });
  shim.navigate(CONTACT_PATH, { via: 'routeChangeEvent' });
  shim.window.dispatchEvent(new shim.Event('popstate'));
  await shim.flush();
  assert.equal(GHLC.__test.getState().generation, 1);
  assert.equal(invite(shim), button, 'element survives a no-op signal');
});

scenario('ctx: hooks are installed exactly once', async () => {
  const { shim, GHLC } = await bootContactPage();
  assert.equal(shim.listenerCount(shim.window, 'popstate'), 1);
  assert.equal(shim.listenerCount(shim.window, 'routeChangeEvent'), 1);
  assert.equal(shim.listenerCount(shim.window, 'ghlc:navigate'), 1);
  assert.equal(GHLC.__test.getState().hooksInstalled, true);
  await GHLC.__test.boot();
  await shim.flush();
  assert.equal(shim.listenerCount(shim.window, 'popstate'), 1, 'second boot adds no listener');
  assert.equal(shim.listenerCount(shim.window, 'ghlc:navigate'), 1);
});

// ---------------------------------------------------------------------------
// Webhook hardening and log hygiene scenarios (Plan 02, Task 2)
// Fixture: sendInvite.cooldownMs is 3000.
// ---------------------------------------------------------------------------

const label = (el) => el.querySelector('.ghlc-btn__label').textContent;
const msg = (el) => el.querySelector('.ghlc-btn__msg').textContent;

async function bootWithContact(contact, extra = {}) {
  const shim = createShim({ pathname: CONTACT_PATH, search: '?ghlc-debug=1', fixture: loadFixture(), ...extra });
  const shell = shim.buildShell({ sidebarMode: 'location', contact });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  return { shim, shell, GHLC };
}

scenario('webhook: queued stays disabled for cooldownMs then returns to ready', async () => {
  const { shim } = await bootContactPage();
  const button = invite(shim);
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'queued');
  assert.ok(button.disabled);
  assert.equal(label(button), 'Workflow triggered');
  await shim.advanceTimers(2999);
  assert.equal(button.getAttribute('data-state'), 'queued');
  assert.ok(button.disabled);
  await shim.advanceTimers(1);
  assert.equal(button.getAttribute('data-state'), 'ready');
  assert.ok(!button.disabled);
  assert.equal(label(button), 'Send Invite');
  assert.equal(msg(button), '');
  assert.ok(shim.console.lines.some((l) => l.includes('webhook-queued')));
  assert.equal(shim.errors.length, 0);
});

scenario('webhook: triple click sends exactly one request', async () => {
  const { shim } = await bootContactPage();
  const button = invite(shim);
  button.click();
  button.click();
  button.click();
  await shim.flush();
  assert.equal(shim.fetchLog.length, 1);
  assert.equal(button.getAttribute('data-state'), 'queued');
});

scenario('webhook: click during cooldown sends nothing', async () => {
  const { shim } = await bootContactPage();
  const button = invite(shim);
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'queued');
  button.click();
  await shim.flush();
  await shim.advanceTimers(100);
  button.click();
  await shim.flush();
  assert.equal(shim.fetchLog.length, 1);
  assert.equal(button.getAttribute('data-state'), 'queued');
});

scenario('webhook: non-2xx -> failed with an actionable message; retry sends a new requestId', async () => {
  const { shim } = await bootContactPage();
  shim.setFetchMode('error');
  const button = invite(shim);
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'failed');
  assert.ok(!button.disabled);
  assert.equal(label(button), 'Failed — retry');
  const text = msg(button);
  assert.ok(text.includes('HTTP 500'), `message names the status: ${text}`);
  assert.ok(!text.includes('hooks/') && !text.includes('TEST-HOOK') && !text.includes('c1'));
  assert.ok(shim.console.lines.some((l) => l.includes('webhook-failed')));
  shim.setFetchMode('ok');
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'queued');
  assert.equal(shim.fetchLog.length, 2);
  assert.notEqual(shim.fetchLog[0].bodyJson.requestId, shim.fetchLog[1].bodyJson.requestId);
  assertNoLeak(shim.console.lines, LEAK_STRINGS, 'DLV-04');
});

scenario('webhook: CORS TypeError falls back to no-cors and reports Sent (unconfirmed)', async () => {
  const { shim } = await bootContactPage();
  shim.setFetchMode('cors');
  const button = invite(shim);
  button.click();
  await shim.flush();
  assert.equal(shim.fetchLog.length, 2);
  assert.equal(shim.fetchLog[0].mode, 'cors');
  assert.equal(shim.fetchLog[0].headers['content-type'], 'application/json');
  assert.equal(shim.fetchLog[1].mode, 'no-cors');
  assert.equal(shim.fetchLog[1].method, 'POST');
  assert.equal(shim.fetchLog[1].credentials, 'omit');
  assert.ok(!('content-type' in shim.fetchLog[1].headers), 'no-cors retry carries no content type');
  assert.equal(shim.fetchLog[0].bodyJson.requestId, shim.fetchLog[1].bodyJson.requestId, 'same request, same id');
  assert.equal(button.getAttribute('data-state'), 'queued');
  assert.equal(label(button), 'Sent (unconfirmed)');
  assert.ok(msg(button).includes('did not confirm'));
  assert.ok(button.disabled);
  assert.ok(shim.console.lines.some((l) => l.includes('webhook-unconfirmed')));
  await shim.advanceTimers(3000);
  assert.equal(button.getAttribute('data-state'), 'ready');
  assert.equal(label(button), 'Send Invite');
  assertNoLeak(shim.console.lines, LEAK_STRINGS, 'DLV-04');
});

scenario('webhook: offline -> failed after both attempts', async () => {
  const { shim } = await bootContactPage();
  shim.setFetchMode('offline');
  const button = invite(shim);
  button.click();
  await shim.flush();
  assert.equal(shim.fetchLog.length, 2);
  assert.equal(shim.fetchLog[1].mode, 'no-cors');
  assert.equal(button.getAttribute('data-state'), 'failed');
  assert.ok(/connection/i.test(msg(button)));
  assert.ok(!button.disabled);
  assert.ok(shim.console.lines.some((l) => l.includes('webhook-network')));
  assertNoLeak(shim.console.lines, LEAK_STRINGS, 'DLV-04');
});

scenario('webhook: record without email or phone renders unavailable and sends nothing', async () => {
  const { shim } = await bootWithContact({});
  const button = invite(shim);
  assert.equal(button.getAttribute('data-state'), 'unavailable');
  assert.equal(button.getAttribute('data-ghlc-reason'), 'no-contact-fields');
  assert.equal(msg(button), 'contact email/phone not found');
  assert.ok(button.disabled);
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  button.click();
  await shim.flush();
  assert.equal(shim.fetchLog.length, 0);
});

scenario('webhook: fields appearing later flip unavailable to ready on re-render', async () => {
  const { shim, shell, GHLC } = await bootWithContact({});
  const button = invite(shim);
  assert.equal(button.getAttribute('data-state'), 'unavailable');
  const before = GHLC.__test.getState().generation;
  shell.contactRegion.appendChild(shim.el('a', { href: 'mailto:late@example.test' }, ['email']));
  GHLC.__test.renderAll();
  await shim.flush();
  assert.equal(invite(shim), button, 'same element survives the re-render');
  assert.equal(button.getAttribute('data-state'), 'ready');
  assert.equal(button.getAttribute('data-ghlc-reason'), null);
  assert.equal(GHLC.__test.getState().generation, before, 'no generation bump on re-render');
  button.click();
  await shim.flush();
  assert.equal(shim.fetchLog.length, 1);
  assert.equal(shim.fetchLog[0].bodyJson.email, 'late@example.test');
  assert.equal(button.getAttribute('data-state'), 'queued');
  // A second re-render must not attach a second listener (one click, one POST).
  await shim.advanceTimers(3000);
  GHLC.__test.renderAll();
  await shim.flush();
  button.click();
  await shim.flush();
  assert.equal(shim.fetchLog.length, 2, 'exactly one listener per element');
});

scenario('webhook: email-only record sends email and omits phone', async () => {
  const { shim } = await bootWithContact({ email: 'only@example.test' });
  const button = invite(shim);
  button.click();
  await shim.flush();
  const body = shim.fetchLog[0].bodyJson;
  assert.equal(body.email, 'only@example.test');
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'phone'), false);
});

scenario('webhook: extraFields cannot override identity keys', async () => {
  const { shim } = await bootContactPage();
  invite(shim).click();
  await shim.flush();
  const body = shim.fetchLog[0].bodyJson;
  assert.equal(body.contactId, 'c1');
  assert.equal(body.locationId, 'locA');
  assert.equal(body.buttonId, 'sendInvite');
  assert.equal(body.source, 'ghlc-harness');
  // Core keys are assigned last, after extraFields, so they always win.
  assert.deepEqual(Object.keys(body).slice(-7), ['contactId', 'locationId', 'buttonId', 'requestId', 'sentAt', 'email', 'phone']);
});

scenario('webhook: non-https URL renders unavailable', async () => {
  const fixture = loadFixture();
  fixture.buttons.find((b) => b.id === 'sendInvite').action.url = 'http://services.leadconnectorhq.com/hooks/TEST-HOOK';
  const shim = createShim({ pathname: CONTACT_PATH, fixture: loadFixture() });
  shim.buildShell({ sidebarMode: 'location', contact: JANE });
  shim.setConfigResponse({ status: 200, body: fixture });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  const button = invite(shim);
  assert.equal(button.getAttribute('data-state'), 'unavailable');
  assert.ok(msg(button).includes('HTTPS'));
  assert.ok(!msg(button).includes('hooks/'));
  button.click();
  await shim.flush();
  assert.equal(shim.fetchLog.length, 0);
});

scenario('logs: debug mode never prints URL, payload, email, or phone', async () => {
  const { shim } = await bootContactPage();
  const button = invite(shim);
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'queued');
  await shim.advanceTimers(3000);
  shim.setFetchMode('error');
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'failed');
  shim.setFetchMode('cors');
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'queued');
  await shim.advanceTimers(3000);
  shim.setFetchMode('offline');
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'failed');
  assert.equal(shim.fetchLog.length, 6);
  const text = shim.console.lines.join('\n');
  assert.ok(text.includes('[ghlc]'), 'logging happened');
  for (const s of ['hooks/', 'TEST-HOOK', '@example', '5550100', '"contactId"', 'requestId', 'sentAt', 'leadconnectorhq']) {
    assert.ok(!text.includes(s), `console output must not contain "${s}"\n--- console ---\n${text}`);
  }
  assert.equal(shim.errors.length, 0);
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

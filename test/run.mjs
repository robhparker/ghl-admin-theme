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
  '// ==== branding ====',
  '// ==== theme ====',
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

check('static: ten section markers appear exactly once, in order', () => {
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
  assert.ok(src.includes('logoMount'), 'the logo mount is config-selectable');
  assert.ok(src.includes('img.agency-logo'), 'logo selectors are narrowed to the verified class');
  assert.ok(src.includes('__GHLC_TEST__') && src.includes('__test'));
  // Phase 3: the active-nav candidates live in the adapter and the schema documents the hex grammar.
  assert.ok(src.includes('sidebarNavActive'), 'the active nav candidates are an adapter selector list');
  assert.ok(src.includes("'#rrggbb'"), 'the schema comment documents the theme color grammar');
});

check('static: verify section contains no selector literals (probing goes through adapter.probe)', () => {
  const start = src.indexOf('// ==== verify ====');
  const end = src.indexOf('// ==== boot ====');
  assert.ok(start !== -1 && end > start, 'verify section not found');
  const section = src.slice(start, end);
  for (const re of ADAPTER_ONLY) {
    const m = re.exec(section);
    assert.ok(!m, `pattern ${re} found in the verify section: "${m && m[0]}"`);
  }
  assert.ok(!/querySelector\(\s*['"`]/.test(section), 'verify must not query selector literals');
  assert.ok(section.includes('adapter.probe()'), 'verify reports mounts through adapter.probe()');
  assert.ok(section.includes('contactFields'), 'verify reports contact fields as booleans');
});

check('notice: NOTICE.md records the reference project, its revision, its missing license, and that nothing was copied', () => {
  const noticePath = path.join(root, 'NOTICE.md');
  assert.ok(fs.existsSync(noticePath), 'NOTICE.md exists at the repo root');
  const notice = fs.readFileSync(noticePath, 'utf8');
  for (const s of ['https://github.com/dachi-khelashvili/ghl-customizer', 'ff7c8e49f5e2f2db96cae3db16142642ccc5a6e7', 'no LICENSE file', 'Nothing was copied']) {
    assert.ok(notice.includes(s), `NOTICE.md must contain "${s}"`);
  }
});

check('harness: test/harness.html carries the required HighLevel shell, router hook, config, and stub', () => {
  const harness = fs.readFileSync(path.join(root, 'test', 'harness.html'), 'utf8');
  for (const s of ['id="sidebar-v2"', 'hl_header--controls', 'id="location-switcher-sidbar-v2"', "id: 'record-details-lhs'", "id: 'delete-contact-trigger'", "id: 'contact.email'", 'data-config="./fixtures/config.json"', 'routeChangeEvent', 'no-cors']) {
    assert.ok(harness.includes(s), `harness must contain ${s}`);
  }
  // Phase 2: the sidebar logo, its mutation controls, and the extra routes.
  for (const s of ['class="agency-logo"', 'hx-logo-link', 'hx-rerender-logo', 'hx-reset-logo', 'hx-toggle-sidebar', 'hx-replace-sidebar', 'locC/dashboard', 'locZ/dashboard']) {
    assert.ok(harness.includes(s), `harness must contain ${s}`);
  }
  for (const id of ['hx-rerender-logo', 'hx-reset-logo', 'hx-toggle-sidebar', 'hx-replace-sidebar']) {
    assert.ok(harness.includes(`getElementById('${id}')`), `harness control #${id} must be wired`);
  }
  assert.ok(harness.includes('<base href="/test/">'), 'relative fixture logo URLs must resolve against /test/ after the router pushStates');
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
  assert.ok(/^https:\/\/services\.leadconnectorhq\.com\/hooks\/[A-Za-z0-9]+\/webhook-trigger\/[0-9a-f-]{36}$/.test(invite.action.url) || invite.action.url.includes('REPLACE_ME'), 'sample config points at a HighLevel Inbound Webhook trigger URL (or the placeholder)');
  assert.ok(sample.buttons.some((b) => b.placement === 'header' && b.action.type === 'link'), 'sample must ship a header link button');

  // Phase 2: the sample declares the sidebar mount and no logos (native fallback, A-02).
  assert.equal(sample.agency.logoMount, 'sidebar');
  assert.equal(sample.agency.logoUrl, '');
  assert.equal(Object.keys(sample.locations).length, 0, 'sample ships no location logos (Phase 3 DLV-02 adds the demo overrides)');
  // Every logoUrl in both files is https without credentials or a ./ relative path.
  const logoUrls = (cfg) => [cfg.agency.logoUrl, ...Object.values(cfg.locations).map((l) => l.logoUrl)].filter((u) => u !== undefined && u !== '');
  for (const [label, cfg] of [['sample', sample], ['fixture', fixture]]) {
    for (const u of logoUrls(cfg)) {
      assert.ok(typeof u === 'string' && (api.isSafeHttpsUrl(u) || u.startsWith('./')), `${label}: logoUrl "${u}" must be https without credentials or start with ./`);
    }
  }
  assert.ok(logoUrls(fixture).length >= 3, 'fixture carries the location logos');
  // The fixture SVGs exist, are plain SVG, and carry no script or external reference.
  const logosDir = path.join(root, 'test', 'fixtures', 'logos');
  for (const name of ['native.svg', 'agency.svg', 'loc-a.svg', 'loc-b.svg']) {
    const file = path.join(logosDir, name);
    assert.ok(fs.existsSync(file), `${name} exists`);
    const svg = fs.readFileSync(file, 'utf8');
    assert.ok(/^(?:<\?xml[^>]*\?>\s*)?<svg\b/.test(svg.trimStart()), `${name} starts with <svg (after an optional XML prolog)`);
    assert.ok(!/<script/i.test(svg), `${name} carries no <script`);
    assert.ok(!/<foreignObject/i.test(svg) && !/\bhref\s*=\s*["']https?:/i.test(svg), `${name} has no external references`);
    assert.ok(svg.includes('viewBox="0 0 160 48"'), `${name} uses the shared viewBox`);
  }
  assert.ok(!fs.existsSync(path.join(logosDir, 'missing.svg')), 'missing.svg must not exist: Location C is the harness demonstration of BRD-04');
  // Relative fixture URLs resolve against test/ (the harness base): present for A and B, absent for C.
  for (const [id, entry] of Object.entries(fixture.locations)) {
    if (typeof entry.logoUrl === 'string' && entry.logoUrl.startsWith('./')) {
      assert.equal(fs.existsSync(path.join(root, 'test', entry.logoUrl)), id !== 'locC', `${id}: ${entry.logoUrl} must ${id === 'locC' ? 'be absent' : 'exist'}`);
    }
  }
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
  // locB's override disables sendInvite (BTN-02) and locOnlyLink is scoped to locA.
  const idsB = api.resolveButtons(cfg, 'locB').map((b) => b.id);
  assert.ok(!idsB.includes('sendInvite') && !idsB.includes('locOnlyLink') && idsB.includes('supportLink'));
  const withoutOverride = { ...cfg, locations: {} };
  assert.ok(api.resolveButtons(withoutOverride, 'locB').map((b) => b.id).includes('sendInvite'));
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
  assert.equal(shim.document.querySelectorAll('.ghlc-group[data-ghlc-placement="header"]').length, 1, 'one header group (Plan 03)');
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
  assert.equal(shim.document.querySelectorAll('[data-ghlc-button-id][data-ghlc-placement="contact"]').length, 0);
  assert.equal(shim.document.querySelectorAll('.ghlc-group[data-ghlc-placement="contact"]').length, 0);
  // Header buttons need only a location (Plan 03).
  assert.equal(shim.document.querySelectorAll('.ghlc-group[data-ghlc-placement="header"]').length, 1);
  const state = GHLC.__test.getState();
  assert.equal(state.locationId, 'locA');
  assert.equal(state.contactId, null);
});

scenario('mount missing: contact route without a toolbar leaves the DOM untouched', async () => {
  const shim = createShim({ pathname: CONTACT_PATH, fixture: loadFixture() });
  const shell = shim.buildShell({ sidebarMode: 'location', contact: null });
  const mainBefore = shell.main.childNodes.slice();
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  assert.equal(shim.document.querySelectorAll('[data-ghlc-button-id][data-ghlc-placement="contact"]').length, 0);
  assert.equal(shim.document.querySelectorAll('.ghlc-group[data-ghlc-placement="contact"]').length, 0);
  assert.deepEqual(shell.main.childNodes, mainBefore, 'main content untouched');
});

scenario('FND-05: enabled:false, invalid schema, fetch failure, and parse failure all no-op', async () => {
  const cases = [
    { label: 'enabled false', response: { status: 200, body: { ...loadFixture(), enabled: false } }, warn: false },
    { label: 'schemaVersion 2', response: { status: 200, body: { ...loadFixture(), schemaVersion: 2 } }, warn: 'config-schema-unsupported' },
    { label: 'missing buttons', response: { status: 200, body: { ...loadFixture(), buttons: null } }, warn: 'config-invalid' },
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
  const contactButtons = () => shim.document.querySelectorAll('[data-ghlc-button-id][data-ghlc-placement="contact"]');
  assert.equal(contactButtons().length, 0);
  assert.equal(shim.document.querySelectorAll('.ghlc-group[data-ghlc-placement="contact"]').length, 0);
  assert.equal(GHLC.__test.getState().buttons.filter((b) => b.placement === 'contact').length, 0);
  await shim.advanceTimers(10000);
  assert.equal(contactButtons().length, 0, 'no timer resurrects a button');
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
// Header link buttons, overrides, action allowlist, handlers, icons, a11y
// (Plan 03, Task 1)
// ---------------------------------------------------------------------------

const byId = (shim, id) => shim.document.querySelector(`[data-ghlc-button-id="${id}"]`);
const headerGroup = (shim) => shim.document.querySelector('.hl_header--controls .ghlc-group[data-ghlc-placement="header"]');
const contactGroup = (shim) => shim.document.querySelector('.ghlc-group[data-ghlc-placement="contact"]');
const allElements = (node, out = []) => {
  for (const child of node.childNodes) {
    if (child.nodeType === 1) { out.push(child); allElements(child, out); }
  }
  return out;
};
const assertNoCodeText = (shim) => {
  assert.ok(!shim.document.body.textContent.includes('alert(1)'), 'config code text never reaches the DOM');
  for (const el of allElements(shim.document)) {
    for (const { name, value } of el.attributes) {
      assert.ok(!String(value).includes('alert(1)'), `attribute ${name} carries config code text`);
    }
  }
};

async function bootWithConfig(body, extra = {}) {
  const shim = createShim({ pathname: CONTACT_PATH, search: '?ghlc-debug=1', fixture: loadFixture(), ...extra });
  const shell = shim.buildShell({ sidebarMode: 'location', contact: JANE });
  shim.setConfigResponse({ status: 200, body });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  return { shim, shell, GHLC };
}

scenario('header: link buttons render once in the header mount for an in-scope location', async () => {
  const { shim } = await bootContactPage();
  const groups = shim.document.querySelectorAll('.ghlc-group[data-ghlc-placement="header"]');
  assert.equal(groups.length, 1, 'exactly one header group');
  const group = headerGroup(shim);
  assert.ok(group, 'header group sits inside .hl_header--controls');
  const buttons = group.querySelectorAll('[data-ghlc-button-id]');
  assert.deepEqual(buttons.map((b) => b.getAttribute('data-ghlc-button-id')), ['supportLink', 'locOnlyLink', 'badTypeBtn']);

  const support = byId(shim, 'supportLink');
  assert.equal(support.tagName, 'A');
  assert.equal(support.getAttribute('href'), 'https://example.test/support');
  assert.equal(support.getAttribute('target'), '_blank');
  assert.ok(support.getAttribute('rel').includes('noopener') && support.getAttribute('rel').includes('noreferrer'));
  assert.equal(support.getAttribute('data-state'), 'ready');
  assert.equal(support.className, 'ghlc-btn ghlc-btn--link');
  assert.equal(label(support), 'Support');

  const locOnly = byId(shim, 'locOnlyLink');
  assert.equal(locOnly.tagName, 'A');
  assert.equal(locOnly.getAttribute('href'), '/v2/location/locA/settings');
  assert.equal(locOnly.getAttribute('target'), '_self');
  assert.equal(locOnly.getAttribute('rel'), null);

  const bad = byId(shim, 'badTypeBtn');
  assert.equal(bad.tagName, 'BUTTON');
  assert.equal(bad.getAttribute('data-state'), 'unavailable');
  assert.ok(bad.disabled);
  assert.equal(msg(bad), 'Action not available');
  assertNoCodeText(shim);
  assert.equal(shim.errors.length, 0);
});

scenario('header: location overrides on locB relabel, disable, and scope out', async () => {
  const shim = createShim({ pathname: '/v2/location/locB/contacts/detail/c7', fixture: loadFixture() });
  shim.buildShell({ sidebarMode: 'location', contact: JANE });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  const support = byId(shim, 'supportLink');
  assert.ok(support && headerGroup(shim).contains(support));
  assert.equal(label(support), 'B Support');
  assert.equal(support.getAttribute('href'), 'https://example.test/support', 'action is not overridden');
  assert.equal(byId(shim, 'locOnlyLink'), null, 'locA-only link is absent on locB');
  assert.equal(byId(shim, 'sendInvite'), null, 'sendInvite is disabled by override');
  const copy = byId(shim, 'copyIdBtn');
  assert.ok(copy && contactGroup(shim).contains(copy));
  assert.equal(copy.tagName, 'BUTTON');
  assert.equal(copy.getAttribute('data-state'), 'ready');
  assert.ok(copy.querySelector('.ghlc-btn__icon svg'), 'mail icon rendered');
  const badHandler = byId(shim, 'badHandlerBtn');
  assert.equal(badHandler.getAttribute('data-state'), 'unavailable');
  assert.equal(GHLC.__test.getState().contactId, 'c7');
});

scenario('header: agency page renders no buttons at all', async () => {
  const shim = createShim({ pathname: '/v2/agency/dashboard', search: '?ghlc-debug=1', fixture: loadFixture() });
  shim.buildShell({ sidebarMode: 'agency', contact: null });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  assert.equal(shim.document.querySelectorAll('[data-ghlc-button-id]').length, 0);
  assert.equal(shim.document.querySelectorAll('.ghlc-group').length, 0);
  assert.equal(GHLC.__test.getState().isAgency, true);
});

scenario('actions: unknown type and unknown handler never execute anything', async () => {
  const { shim, GHLC } = await bootContactPage();
  const bad = byId(shim, 'badTypeBtn');
  const badHandler = byId(shim, 'badHandlerBtn');
  assert.ok(bad.disabled && badHandler.disabled);
  bad.click();
  badHandler.click();
  await shim.flush();
  assert.equal(shim.fetchLog.length, 0);
  const api = GHLC.__test;
  for (const button of loadFixture().buttons) {
    const action = api.resolveAction(button);
    if (button.id === 'badTypeBtn' || button.id === 'badHandlerBtn') {
      assert.equal(action.kind, 'unavailable', `${button.id} must be unavailable`);
      assert.equal(action.message, 'Action not available');
    } else {
      assert.notEqual(action.kind, 'unavailable', `${button.id} must resolve`);
    }
  }
  assert.equal(api.resolveAction({ id: 'x', placement: 'header', action: { type: 'webhook', url: 'https://services.leadconnectorhq.com/hooks/x' } }).message, 'Requires an open contact');
  assert.equal(api.resolveAction({ id: 'x', placement: 'contact', action: null }).kind, 'unavailable');
  assert.equal(api.resolveAction({ id: 'x', placement: 'contact', action: { type: 'handler', handler: 42 } }).kind, 'unavailable');
  assert.equal(shim.errors.length, 0, 'window.alert never threw');
});

scenario('actions: handler registry runs copyContactId and reports', async () => {
  const shim = createShim({ pathname: CONTACT_PATH, search: '?ghlc-debug=1', fixture: loadFixture() });
  shim.buildShell({ sidebarMode: 'location', contact: JANE });
  const written = [];
  shim.window.navigator.clipboard = { writeText: async (t) => { written.push(t); } };
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  const copy = byId(shim, 'copyIdBtn');
  assert.equal(copy.getAttribute('data-state'), 'ready');
  copy.click();
  assert.equal(copy.getAttribute('data-state'), 'submitting');
  await shim.flush();
  assert.deepEqual(written, ['c1']);
  assert.equal(copy.getAttribute('data-state'), 'ready');
  assert.equal(msg(copy), 'Contact ID copied');
  assert.equal(label(copy), 'Copy Contact ID');
  assert.ok(!copy.disabled);
  assert.ok(shim.console.lines.some((l) => l.includes('handler') && l.includes('copyIdBtn')));
  assert.equal(shim.fetchLog.length, 0);
  assert.equal(shim.errors.length, 0);
});

scenario('actions: handler failure reports failed and re-enables', async () => {
  const { shim } = await bootContactPage();
  assert.equal(shim.window.navigator.clipboard, undefined);
  const copy = byId(shim, 'copyIdBtn');
  copy.click();
  await shim.flush();
  assert.equal(copy.getAttribute('data-state'), 'failed');
  assert.equal(msg(copy), 'Clipboard unavailable');
  assert.ok(!copy.disabled, 'failed handler buttons stay clickable');
  // A handler that throws reports a generic failure.
  copy.click();
  await shim.flush();
  assert.equal(copy.getAttribute('data-state'), 'failed');
});

scenario('actions: prototype-named handlers and override keys are ignored', async () => {
  const fixture = loadFixture();
  fixture.buttons.find((b) => b.id === 'badHandlerBtn').action.handler = 'constructor';
  fixture.buttons.find((b) => b.id === 'copyIdBtn').action.handler = '__proto__';
  // Build via JSON text so "__proto__" is an own key on the parsed object (an
  // object literal would set the prototype instead).
  const text = JSON.stringify(fixture).replace('"locA":{"name":"Location A","buttons":{}}',
    '"locA":{"name":"Location A","buttons":{"__proto__":{"label":"Polluted"},"constructor":false}}');
  assert.ok(text.includes('"__proto__"'), 'fixture variant carries an own __proto__ override key');
  const { shim, GHLC } = await bootWithConfig(text);
  assert.equal(byId(shim, 'badHandlerBtn').getAttribute('data-state'), 'unavailable');
  assert.equal(byId(shim, 'copyIdBtn').getAttribute('data-state'), 'unavailable');
  assert.equal(GHLC.__test.resolveAction({ id: 'x', placement: 'contact', action: { type: 'handler', handler: 'toString' } }).kind, 'unavailable');
  assert.equal(GHLC.__test.resolveAction({ id: 'x', placement: 'contact', action: { type: 'handler', handler: 'hasOwnProperty' } }).kind, 'unavailable');
  const parsed = JSON.parse(text);
  const ids = plain(GHLC.__test.resolveButtons(parsed, 'locA').map((b) => b.id));
  assert.deepEqual(ids, ['sendInvite', 'supportLink', 'locOnlyLink', 'badTypeBtn', 'badHandlerBtn', 'copyIdBtn']);
  assert.equal(label(byId(shim, 'sendInvite')), 'Send Invite', 'no label was polluted');
  assert.equal(Object.prototype.label, undefined, 'the host prototype is untouched');
  assert.equal(shim.errors.length, 0);
});

scenario('actions: unsafe link hrefs are unavailable, safe ones render anchors', async () => {
  const fixture = loadFixture();
  const link = (id, href, target) => ({ id, label: id, placement: 'header', scope: 'all', action: { type: 'link', href, ...(target ? { target } : {}) } });
  const unsafe = {
    js: 'javascript:alert(1)',
    protoRel: '//evil.test/x',
    backslash: '/\\evil.test/x',
    http: 'http://plain.test/',
    data: 'data:text/html,x',
    ftp: 'ftp://f.test/',
    creds: 'https://user:pw@ok.test/',
    empty: '',
  };
  const safe = {
    https: 'https://ok.test/',
    path: '/v2/location/locA/x',
    mailto: 'mailto:a@example.test',
    tel: 'tel:+15555550100',
  };
  fixture.buttons = [
    ...Object.entries(unsafe).map(([id, href]) => link(id, href)),
    ...Object.entries(safe).map(([id, href]) => link(id, href)),
    link('topTarget', 'https://ok.test/top', 'top'),
    link('blankTarget', 'https://ok.test/blank', '_blank'),
  ];
  const { shim, GHLC } = await bootWithConfig(fixture);
  for (const [id, href] of Object.entries(unsafe)) {
    const el = byId(shim, id);
    assert.equal(el.tagName, 'BUTTON', `${id} is a disabled button`);
    assert.equal(el.getAttribute('data-state'), 'unavailable', `${id} is unavailable`);
    assert.equal(msg(el), 'Link not allowed');
    assert.equal(el.getAttribute('href'), null);
    assert.equal(GHLC.__test.isSafeLinkHref(href), false);
  }
  for (const [id, href] of Object.entries(safe)) {
    const el = byId(shim, id);
    assert.equal(el.tagName, 'A', `${id} is an anchor`);
    assert.equal(el.getAttribute('data-state'), 'ready');
    assert.equal(el.getAttribute('href'), href);
    assert.equal(GHLC.__test.isSafeLinkHref(href), true);
  }
  assert.equal(byId(shim, 'topTarget').getAttribute('target'), '_self', 'unknown target falls back to _self');
  assert.equal(byId(shim, 'topTarget').getAttribute('rel'), null);
  assert.equal(byId(shim, 'blankTarget').getAttribute('rel'), 'noopener noreferrer');
  assertNoCodeText(shim);
  assert.equal(shim.errors.length, 0);
});

scenario('a11y: every rendered control is a native button or anchor', async () => {
  const { shim } = await bootContactPage();
  const controls = shim.document.querySelectorAll('[data-ghlc-button-id]');
  assert.ok(controls.length >= 5, 'header and contact controls rendered');
  for (const el of controls) {
    assert.ok(['BUTTON', 'A'].includes(el.tagName), `${el.getAttribute('data-ghlc-button-id')} is native`);
    if (el.tagName === 'A') assert.ok(el.getAttribute('href'), 'anchors carry an href');
    if (el.tagName === 'BUTTON') assert.equal(el.getAttribute('type'), 'button');
    assert.equal(el.getAttribute('role'), null, 'no role on a native control');
    assert.equal(el.getAttribute('tabindex'), null, 'no tabindex on a native control');
    for (const child of allElements(el)) {
      assert.equal(child.getAttribute('tabindex'), null, 'no tabindex inside a control');
      if (child.classList.contains('ghlc-btn__msg')) assert.equal(child.getAttribute('role'), 'status');
      else assert.equal(child.getAttribute('role'), null);
    }
  }
  for (const m of shim.document.querySelectorAll('.ghlc-btn__msg')) assert.equal(m.getAttribute('role'), 'status');
  for (const g of shim.document.querySelectorAll('.ghlc-group')) assert.equal(g.getAttribute('role'), null);
});

scenario('icons: known icon renders an svg, unknown renders none', async () => {
  const { shim, GHLC } = await bootContactPage();
  const svg = byId(shim, 'sendInvite').querySelector('.ghlc-btn__icon svg');
  assert.ok(svg, 'send icon rendered');
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.equal(svg.getAttribute('focusable'), 'false');
  assert.equal(svg.getAttribute('viewBox'), '0 0 24 24');
  assert.ok(svg.querySelectorAll('path').length >= 1);
  for (const p of svg.querySelectorAll('path')) {
    assert.equal(p.getAttribute('fill'), 'none');
    assert.equal(p.getAttribute('stroke'), 'currentColor');
  }
  assert.equal(byId(shim, 'badTypeBtn').querySelector('.ghlc-btn__icon').childNodes.length, 0, 'no icon key -> empty span');
  assert.ok(Object.isFrozen(GHLC.__test.handlers), 'handlers registry is frozen');

  const fixture = loadFixture();
  fixture.buttons.find((b) => b.id === 'sendInvite').icon = 'bogus';
  fixture.buttons.find((b) => b.id === 'supportLink').icon = 'constructor';
  const second = await bootWithConfig(fixture);
  assert.equal(byId(second.shim, 'sendInvite').querySelector('.ghlc-btn__icon').childNodes.length, 0, 'unknown icon -> empty span');
  assert.equal(byId(second.shim, 'supportLink').querySelector('.ghlc-btn__icon').childNodes.length, 0, 'prototype-named icon -> empty span');
  assert.equal(byId(second.shim, 'sendInvite').getAttribute('data-state'), 'ready', 'unknown icon does not affect the action');
});

// ---------------------------------------------------------------------------
// Scoped observers, bounded mount wait, verify mode, disabled paths, boot
// (Plan 03, Task 2)
// ---------------------------------------------------------------------------

const logCount = (shim, ...needles) => shim.console.lines.filter((l) => needles.every((n) => l.includes(n))).length;
const headerButtons = (shim) => shim.document.querySelectorAll('[data-ghlc-button-id][data-ghlc-placement="header"]');
const freshHeader = (shim) => shim.el('header', { class: 'hl_header' }, [shim.el('span', {}, ['Re-rendered']), shim.el('div', { class: 'hl_header--controls' })]);
// Registrations belonging to the branding observer (Phase 2): the one
// instance registered on the logo img with attributes. Placement observer
// sets never observe attributes, so this identifies the instance exactly.
const brandingRegs = (shim) => {
  const imgReg = shim.observers().find((o) => o.options.attributes && o.target.tagName === 'IMG');
  return imgReg ? shim.observers().filter((o) => o.observer === imgReg.observer) : [];
};
// Registrations belonging to the theme observer (Phase 3): the one instance
// whose root registration filters attributes to class and aria-current. No
// other observer in the script filters on aria-current.
const themeRegs = (shim) => {
  const rootReg = shim.observers().find((o) => Array.isArray(o.options.attributeFilter) && o.options.attributeFilter.includes('aria-current'));
  return rootReg ? shim.observers().filter((o) => o.observer === rootReg.observer) : [];
};
const themeMo = (shim) => { const regs = themeRegs(shim); return regs.length ? regs[0].observer : null; };

scenario('observers: wholesale header replacement restores header buttons once and swaps the observer set', async () => {
  const { shim, shell: page, GHLC } = await bootContactPage();
  // The shipped fixture brands and themes locA, so the single branding observer
  // (Phase 2) holds three registrations and the single theme observer (Phase 3)
  // two; the placement sets are everything else.
  const brandingMo = shim.observers().find((o) => o.target === page.logo).observer;
  const placementRegs = () => shim.observers().filter((o) => o.observer !== brandingMo && o.observer !== themeMo(shim));
  const before = placementRegs().length;
  assert.equal(before, 4, 'root + anchor observer for each of header and contact');
  assert.equal(shim.observers().filter((o) => o.observer === brandingMo).length, 3, 'three branding registrations on one instance');
  assert.equal(themeRegs(shim).length, 2, 'two theme registrations on one instance');
  assert.equal(shim.observers().length, 9, 'placements + branding + theme, nothing else');
  assert.equal(logCount(shim, 'observer-attached', 'header'), 1);
  let oldHeader = shim.document.querySelector('.hl_header');
  assert.ok(placementRegs().some((o) => o.target === oldHeader && o.options.subtree === true), 'root observer on the header');
  assert.ok(placementRegs().some((o) => o.target === shim.document.body && o.options.subtree === false), 'shallow anchor observer on the header parent');
  // Also proves the branding root is the sidebar, not body.
  assert.ok(!shim.observers().some((o) => o.target === shim.document.body && o.options.subtree === true), 'never a page-wide subtree observer');

  for (let round = 1; round <= 2; round++) {
    const newHeader = freshHeader(shim);
    oldHeader.parentNode.replaceChild(newHeader, oldHeader);
    await shim.flush();
    const controls = newHeader.querySelector('.hl_header--controls');
    assert.equal(controls.querySelectorAll('.ghlc-group').length, 1, `round ${round}: one group in the new header`);
    assert.equal(controls.querySelectorAll('[data-ghlc-button-id]').length, 3, `round ${round}: three header buttons`);
    assert.equal(headerButtons(shim).length, 3, `round ${round}: three header buttons in the document`);
    const stale = oldHeader.querySelector('.ghlc-group');
    assert.ok(stale === null || !stale.isConnected, 'old group is gone or disconnected');
    assert.equal(placementRegs().length, before, `round ${round}: observer set swapped, not accumulated`);
    assert.equal(shim.observers().filter((o) => o.observer === brandingMo).length, 3, `round ${round}: branding registrations untouched`);
    assert.ok(placementRegs().some((o) => o.target === newHeader), 'root observer follows the new header');
    assert.ok(shim.observers().every((o) => o.target !== oldHeader && o.target.isConnected), 'no observer targets the old header');
    assert.equal(GHLC.verify().observers.header, true);
    assert.equal(logCount(shim, 'rerender', 'header'), round, `round ${round}: exactly one rerender per replacement`);
    assert.equal(logCount(shim, 'observer-attached', 'header'), round + 1);
    oldHeader = newHeader;
  }
  assert.equal(logCount(shim, 'rerender', 'contact'), 0, 'contact placement never re-rendered');
  // The header is a sibling of the sidebar, so each body-level swap wakes the
  // shallow branding anchor once: one coalesced no-op rebrand per round.
  assert.equal(logCount(shim, 'rebrand'), 2, 'one no-op rebrand per header swap');
  logoIs(page.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  assert.equal(shim.errors.length, 0);

  // Variant: the header sits inside an extra wrapper, so the anchor must be
  // that wrapper (derived from the region root's parent), not a fixed ancestor.
  const wrapped = createShim({ pathname: CONTACT_PATH, search: '?ghlc-debug=1', fixture: loadFixture() });
  const shell = wrapped.buildShell({ sidebarMode: 'location', contact: JANE });
  const wrap = wrapped.el('div', { class: 'hx-wrap' });
  shell.header.replaceWith(wrap);
  wrap.appendChild(shell.header);
  const W = wrapped.run(src);
  assert.equal(await W.__test.boot(), true);
  await wrapped.flush();
  const wrappedBrandingMo = wrapped.observers().find((o) => o.target === shell.logo).observer;
  const wrappedPlacementRegs = () => wrapped.observers().filter((o) => o.observer !== wrappedBrandingMo && o.observer !== themeMo(wrapped));
  assert.ok(wrappedPlacementRegs().some((o) => o.target === wrap && o.options.subtree === false), 'anchor is the wrapper');
  // The branding and theme anchors legitimately target body (the sidebar's
  // parent); no placement registration may, and nothing may observe body with subtree.
  assert.ok(!wrappedPlacementRegs().some((o) => o.target === wrapped.document.body), 'no placement registration targets body');
  assert.ok(!wrapped.observers().some((o) => o.target === wrapped.document.body && o.options.subtree === true), 'never a page-wide subtree observer');
  const replacement = freshHeader(wrapped);
  wrap.replaceChild(replacement, shell.header);
  await wrapped.flush();
  assert.equal(replacement.querySelectorAll('[data-ghlc-button-id]').length, 3, 'buttons restored inside the wrapper');
  assert.equal(headerButtons(wrapped).length, 3);
  assert.equal(wrappedPlacementRegs().length, 4);
  assert.equal(wrapped.observers().filter((o) => o.observer === wrappedBrandingMo).length, 3);
  assert.ok(wrappedPlacementRegs().some((o) => o.target === replacement));
  assert.equal(logCount(wrapped, 'rebrand'), 0, 'a swap inside the wrapper is invisible to the sidebar anchor');
  assert.equal(logCount(wrapped, 'rerender', 'header'), 1);
  assert.equal(wrapped.errors.length, 0);
});

scenario('observers: framework wiping our group from the mount re-adds it once', async () => {
  const { shim } = await bootContactPage();
  const header = shim.document.querySelector('.hl_header');
  const group = headerGroup(shim);
  const before = shim.observers().length;
  group.parentNode.removeChild(group);
  await shim.flush();
  const fresh = headerGroup(shim);
  assert.ok(fresh && fresh !== group, 'a new group element was created');
  assert.equal(shim.document.querySelectorAll('.ghlc-group[data-ghlc-placement="header"]').length, 1);
  assert.equal(fresh.querySelectorAll('[data-ghlc-button-id]').length, 3);
  assert.equal(shim.observers().length, before);
  assert.ok(shim.observers().some((o) => o.target === header && o.options.subtree === true), 'header set still targets the same root');
  assert.equal(logCount(shim, 'observer-attached', 'header'), 1, 'watchMount was a no-op: the mount survived');
  assert.equal(logCount(shim, 'rerender', 'header'), 1);
  await shim.advanceTimers(50);
  assert.equal(logCount(shim, 'rerender', 'header'), 1, 'the re-add itself did not trigger another render');

  // The mount's children wiped (group removed together with native nodes).
  const controls = header.querySelector('.hl_header--controls');
  controls.appendChild(shim.el('span', { class: 'hx-native' }, ['native']));
  await shim.flush();
  assert.equal(logCount(shim, 'rerender', 'header'), 2, 'a native node appearing wakes the observer');
  assert.equal(headerButtons(shim).length, 3, 'idempotent: still exactly three buttons');
  while (controls.firstChild) controls.removeChild(controls.firstChild);
  await shim.flush();
  assert.equal(headerButtons(shim).length, 3, 'buttons restored after the mount was wiped');
  assert.equal(shim.document.querySelectorAll('.ghlc-group[data-ghlc-placement="header"]').length, 1);
  assert.equal(shim.errors.length, 0);
});

scenario('observers: contact toolbar re-render keeps one button bound to the current contact', async () => {
  const { shim, shell, GHLC } = await bootContactPage();
  const oldRegion = shell.contactRegion;
  assert.ok(shim.observers().some((o) => o.target === oldRegion));
  const newRegion = shim.setContact(JANE);
  await shim.flush();
  const button = invite(shim);
  assert.ok(newRegion.contains(button), 'button lives in the new region');
  assert.equal(button.getAttribute('data-ghlc-ctx'), 'locA|c1');
  assert.equal(button.getAttribute('data-state'), 'ready');
  assert.equal(GHLC.verify().observers.contact, true);
  assert.ok(shim.observers().some((o) => o.target === newRegion), 'root observer follows the new region');
  assert.ok(!shim.observers().some((o) => o.target === oldRegion), 'nothing targets the old region');
  assert.equal(shim.observers().length, 9, 'two placement sets plus three branding and two theme registrations');
  assert.equal(brandingRegs(shim).length, 3, 'the branding registrations belong to one instance');
  assert.equal(themeRegs(shim).length, 2, 'the theme registrations belong to one instance');
  assert.equal(GHLC.__test.getState().generation, 1, 'no generation bump on a same-context re-render');
  assert.equal(logCount(shim, 'rerender', 'contact'), 1);
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'queued', 'restored button is fully bound');
  assert.equal(shim.fetchLog.length, 1);
  assert.equal(shim.errors.length, 0);
});

scenario('review WR-02: cooldown survives a same-context region re-render', async () => {
  const { shim } = await bootContactPage();
  const first = invite(shim);
  first.click();
  await shim.flush();
  assert.equal(first.getAttribute('data-state'), 'queued');
  await shim.advanceTimers(1000);
  shim.setContact(JANE);
  await shim.flush();
  const restored = invite(shim);
  assert.notEqual(restored, first, 'button was recreated by the re-render');
  assert.equal(restored.getAttribute('data-state'), 'queued', 'recreated inside the cooldown window stays queued');
  assert.ok(restored.disabled);
  restored.click();
  await shim.flush();
  assert.equal(shim.fetchLog.length, 1, 'no second POST inside the cooldown');
  await shim.advanceTimers(2001);
  assert.equal(restored.getAttribute('data-state'), 'ready', 'cooldown expires at the original deadline');
  assert.equal(shim.errors.length, 0);
});

scenario('review WR-03: ambiguous email/phone in the contact region is refused, counts reported', async () => {
  const { shim, shell, GHLC } = await bootContactPage();
  const extra = shim.document.createElement('a');
  extra.setAttribute('href', 'mailto:someone-else@example.test');
  shell.contactRegion.appendChild(extra);
  const r = GHLC.verify();
  assert.equal(r.contactFields.email, false, 'two mailto anchors -> no email');
  assert.equal(r.contactFields.emailCandidates, 2);
  assert.equal(r.contactFields.phone, true);
  const button = invite(shim);
  button.click();
  await shim.flush();
  const body = shim.fetchLog.length ? JSON.parse(shim.fetchLog[0].body) : null;
  assert.ok(!body || body.email === undefined || body.email === null, 'ambiguous email is never sent');
  assert.equal(shim.errors.length, 0);
});

scenario('review IN-06: cooldownMs is clamped to five minutes', async () => {
  const fixture = loadFixture();
  const btn = fixture.buttons.find((b) => b.id === 'sendInvite');
  btn.action.cooldownMs = 1e10;
  const { GHLC } = await bootWithConfig(fixture);
  const action = GHLC.__test.resolveAction(btn);
  assert.equal(action.cooldownMs, 300000);
});

scenario('live DOM: HighLevel record-details structure mounts on the name row and reads the stateful fields', async () => {
  const { shim, shell, GHLC } = await bootContactPage();
  const doc = shim.document;
  const host = shell.main || shell.contactRegion.parentNode;
  shell.contactRegion.parentNode.removeChild(shell.contactRegion);
  const lhs = doc.createElement('div'); lhs.setAttribute('id', 'record-details-lhs');
  const nameRow = doc.createElement('div'); nameRow.setAttribute('class', 'flex items-center justify-between gap-2');
  const name = doc.createElement('span'); name.textContent = '(Example) Jordan Smith';
  const del = doc.createElement('i'); del.setAttribute('id', 'delete-contact-trigger');
  nameRow.appendChild(name); nameRow.appendChild(del);
  const emailField = doc.createElement('div'); emailField.setAttribute('id', 'contact.email');
  const emailInput = doc.createElement('input'); emailInput.setAttribute('type', 'text'); emailInput.value = 'jordan.smith@example.com';
  emailField.appendChild(emailInput);
  const phoneField = doc.createElement('div'); phoneField.setAttribute('id', 'contact.phone');
  const phoneInput = doc.createElement('input'); phoneInput.setAttribute('type', 'tel'); phoneInput.value = '';
  phoneField.appendChild(phoneInput);
  lhs.appendChild(nameRow); lhs.appendChild(emailField); lhs.appendChild(phoneField);
  host.appendChild(lhs);
  GHLC.__test.renderAll();
  await shim.flush();
  const button = invite(shim);
  assert.ok(button, 'Send Invite rendered');
  assert.equal(button.parentNode.parentNode, nameRow, 'group mounted on the name row (parent of #delete-contact-trigger)');
  const r = GHLC.verify();
  assert.equal(r.mounts.contactMountVia, 'toolbar-anchor');
  assert.equal(r.mounts.contactEmailField, true);
  assert.deepEqual(plain(r.contactFields), { email: true, phone: false, emailCandidates: 0, phoneCandidates: 1 });
  button.click();
  await shim.flush();
  assert.equal(shim.fetchLog.length, 1);
  const body = JSON.parse(shim.fetchLog[0].body);
  assert.equal(body.email, 'jordan.smith@example.com');
  assert.ok(body.phone == null, 'phone omitted when the field is empty');
  assert.equal(shim.errors.length, 0);
});

scenario('live DOM: email field that fills in after render recovers the button by polling (no mutation)', async () => {
  const { shim, shell, GHLC } = await bootContactPage();
  const doc = shim.document;
  const host = shell.main || shell.contactRegion.parentNode;
  shell.contactRegion.parentNode.removeChild(shell.contactRegion);
  const lhs = doc.createElement('div'); lhs.setAttribute('id', 'record-details-lhs');
  const nameRow = doc.createElement('div'); const del = doc.createElement('i'); del.setAttribute('id', 'delete-contact-trigger'); nameRow.appendChild(del);
  const emailField = doc.createElement('div'); emailField.setAttribute('id', 'contact.email');
  const emailInput = doc.createElement('input'); emailInput.setAttribute('type', 'text'); emailInput.value = '';
  emailField.appendChild(emailInput);
  lhs.appendChild(nameRow); lhs.appendChild(emailField); host.appendChild(lhs);
  GHLC.__test.renderAll();
  await shim.flush();
  const button = invite(shim);
  assert.equal(button.getAttribute('data-state'), 'unavailable', 'no value yet');
  assert.equal(GHLC.verify().waiting.contactFields, true, 'poll started');
  emailInput.value = 'late@example.test'; // property change only: no MutationRecord
  await shim.advanceTimers(600);
  assert.equal(button.getAttribute('data-state'), 'ready', 'poll recovered the button');
  assert.equal(GHLC.verify().waiting.contactFields, false);
  assert.ok(shim.console.lines.some((l) => l.includes('contact-fields-recovered')));
  button.click();
  await shim.flush();
  assert.equal(JSON.parse(shim.fetchLog[0].body).email, 'late@example.test');
  assert.equal(shim.errors.length, 0);
});

scenario('observers: own writes do not cause render loops', async () => {
  const { shim } = await bootContactPage();
  await shim.advanceTimers(50);
  assert.equal(logCount(shim, 'rerender'), 0, 'boot writes never schedule a render');
  const button = invite(shim);
  button.click();
  await shim.flush();
  assert.equal(button.getAttribute('data-state'), 'queued');
  await shim.advanceTimers(3050);
  assert.equal(button.getAttribute('data-state'), 'ready');
  assert.equal(logCount(shim, 'rerender'), 0, 'setState label/message swaps are self-inflicted');
  assert.equal(logCount(shim, 'rebrand'), 0, 'branding writes never schedule a rebrand');
  assert.equal(logCount(shim, 'retheme'), 0, 'theme writes never schedule a retheme');
  assert.equal(shim.observers().length, 9);
  assert.equal(brandingRegs(shim).length, 3);
  assert.equal(themeRegs(shim).length, 2);
  assert.equal(shim.errors.length, 0);
});

async function bootDashboard() {
  const shim = createShim({ pathname: '/v2/location/locA/dashboard', search: '?ghlc-debug=1', fixture: loadFixture() });
  shim.buildShell({ sidebarMode: 'location', contact: null });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  return { shim, GHLC };
}

scenario('observers: mount appearing after navigation is picked up by the bounded wait', async () => {
  const { shim, GHLC } = await bootDashboard();
  assert.equal(GHLC.verify().waiting.contact, false);
  shim.navigate('/v2/location/locA/contacts/detail/c2', { via: 'pushState' });
  await shim.flush();
  assert.equal(invites(shim).length, 0);
  assert.equal(GHLC.verify().waiting.contact, true);
  assert.equal(GHLC.verify().observers.contact, false);
  await shim.advanceTimers(600);
  assert.equal(invites(shim).length, 0);
  assert.equal(GHLC.verify().waiting.contact, true, 'still waiting');
  shim.setContact(C2);
  await shim.advanceTimers(300);
  const button = invite(shim);
  assert.equal(button.getAttribute('data-ghlc-ctx'), 'locA|c2');
  assert.equal(button.getAttribute('data-state'), 'ready');
  assert.equal(GHLC.verify().waiting.contact, false);
  assert.equal(GHLC.verify().observers.contact, true);
  assert.equal(shim.observers().length, 9);
  assert.equal(brandingRegs(shim).length, 3);
  assert.equal(themeRegs(shim).length, 2);
  assert.equal(shim.errors.length, 0);
});

scenario('observers: bounded wait gives up after MOUNT_WAIT_MAX_MS', async () => {
  const { shim, GHLC } = await bootDashboard();
  shim.navigate('/v2/location/locA/contacts/detail/c3', { via: 'pushState' });
  await shim.flush();
  assert.equal(GHLC.verify().waiting.contact, true);
  await shim.advanceTimers(14900);
  assert.equal(GHLC.verify().waiting.contact, true, 'still within the bound');
  assert.equal(logCount(shim, 'mount-missing'), 0);
  await shim.advanceTimers(600);
  assert.equal(GHLC.verify().waiting.contact, false);
  assert.equal(invites(shim).length, 0);
  assert.equal(logCount(shim, 'mount-missing', 'contact'), 1);
  // Nothing keeps polling after giving up.
  await shim.advanceTimers(5000);
  assert.equal(logCount(shim, 'mount-missing'), 1);
  shim.setContact({ email: 'c3@example.test' });
  await shim.advanceTimers(1000);
  assert.equal(invites(shim).length, 0, 'a late mount after the bound is not picked up until the next navigation');
  assert.equal(shim.errors.length, 0);
});

scenario('observers: context change cancels the wait and leaving to agency disconnects everything', async () => {
  const { shim, GHLC } = await bootDashboard();
  shim.navigate('/v2/location/locA/contacts/detail/c4', { via: 'pushState' });
  await shim.flush();
  assert.equal(GHLC.verify().waiting.contact, true);
  assert.equal(shim.observers().length, 7, 'header set plus the branding and theme registrations while waiting for the contact mount');
  assert.equal(brandingRegs(shim).length, 3, 'branding registrations belong to one instance');
  assert.equal(themeRegs(shim).length, 2, 'theme registrations belong to one instance');
  shim.navigate('/v2/agency/dashboard', { via: 'pushState' });
  shim.setSidebarMode('agency');
  shim.setContact(null);
  await shim.flush();
  const r = GHLC.verify();
  assert.deepEqual(plain(r.waiting), { header: false, contact: false, contactFields: false, branding: false, theme: false });
  assert.deepEqual(plain(r.observers), { header: false, contact: false, branding: false, theme: false });
  assert.equal(shim.observers().length, 0, 'agency pages end with zero observers');
  assert.equal(shim.document.querySelectorAll('[data-ghlc-button-id]').length, 0);
  assert.equal(shim.document.querySelectorAll('.ghlc-group').length, 0);
  await shim.advanceTimers(16000);
  assert.equal(logCount(shim, 'mount-missing'), 0, 'the cancelled wait never reports');
  assert.equal(shim.errors.length, 0);
});

scenario('observers: fields appearing later flip unavailable to ready via the observer', async () => {
  const { shim, shell } = await bootWithContact({});
  const button = invite(shim);
  assert.equal(button.getAttribute('data-state'), 'unavailable');
  assert.equal(button.getAttribute('data-ghlc-reason'), 'no-contact-fields');
  shell.contactRegion.appendChild(shim.el('a', { href: 'mailto:late@example.test' }, ['email']));
  await shim.flush();
  assert.equal(invite(shim), button, 'same element recovered in place');
  assert.equal(button.getAttribute('data-state'), 'ready');
  assert.equal(button.getAttribute('data-ghlc-reason'), null);
  assert.equal(logCount(shim, 'rerender', 'contact'), 1);
  button.click();
  await shim.flush();
  assert.equal(shim.fetchLog.length, 1);
  assert.equal(shim.fetchLog[0].bodyJson.email, 'late@example.test');
  assertNoLeak(shim.console.lines, LEAK_STRINGS, 'DLV-04');
});

function disabledShim(response) {
  const shim = createShim({ pathname: CONTACT_PATH, search: '?ghlc-debug=1', fixture: loadFixture() });
  shim.buildShell({ sidebarMode: 'location', contact: JANE });
  shim.setConfigResponse(response);
  return shim;
}

function assertNoFootprint(shim, GHLC, label) {
  assert.equal(shim.document.querySelectorAll('[data-ghlc-button-id]').length, 0, `${label}: no buttons`);
  assert.equal(shim.document.querySelectorAll('.ghlc-group').length, 0, `${label}: no groups`);
  assert.equal(shim.observers().length, 0, `${label}: no observers`);
  assert.equal(GHLC.verify().observers.branding, false, `${label}: no branding observer`);
  assert.equal(shim.listenerCount(shim.window, 'popstate'), 0, `${label}: no popstate listener`);
  assert.equal(shim.listenerCount(shim.window, 'routeChangeEvent'), 0, `${label}: no route listener`);
  assert.equal(shim.listenerCount(shim.window, 'ghlc:navigate'), 0, `${label}: no navigate listener`);
  assert.equal(shim.document.head.querySelectorAll('link[data-ghlc-styles]').length, 0, `${label}: no stylesheet`);
  assert.equal(GHLC.__test.getState().hooksInstalled, false, `${label}: hooks not installed`);
  assert.equal(GHLC.__test.getState().configLoaded, false, `${label}: config not adopted`);
}

scenario('disable: enabled false is a complete no-op', async () => {
  const shim = disabledShim({ status: 200, body: { ...loadFixture(), enabled: false } });
  const origPush = shim.window.history.pushState;
  const origReplace = shim.window.history.replaceState;
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), false);
  await shim.flush();
  assertNoFootprint(shim, GHLC, 'enabled false');
  assert.equal(shim.window.history.pushState, origPush, 'pushState untouched');
  assert.equal(shim.window.history.replaceState, origReplace, 'replaceState untouched');
  const r = GHLC.verify();
  assert.equal(r.config.enabled, false);
  assert.equal(r.config.loaded, false);
  assert.equal(r.config.schemaVersion, 1);
  assert.deepEqual(plain(r.config.buttonIds), []);
  assert.deepEqual(plain(r.observers), { header: false, contact: false, branding: false, theme: false });
  assert.deepEqual(plain(r.branding), { mount: 'sidebar', found: true, applied: null, resolving: false, failed: 0, loaded: 0 }, 'disabled: the mount is probed, nothing was applied');
  assert.ok(r.mounts.headerMount && r.mounts.contactMount, 'verify still probes mounts while disabled');
  await shim.advanceTimers(16000);
  assertNoFootprint(shim, GHLC, 'enabled false after 16 s');
  assert.equal(shim.errors.length, 0);
});

scenario('disable: unsupported schemaVersion is a no-op with one warning', async () => {
  const shim = disabledShim({ status: 200, body: { ...loadFixture(), schemaVersion: 2 } });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), false);
  await shim.flush();
  assertNoFootprint(shim, GHLC, 'schemaVersion 2');
  assert.equal(logCount(shim, 'config-schema-unsupported'), 1);
  assert.equal(logCount(shim, 'config-invalid'), 0, 'schema mismatch is its own event');
  const r = GHLC.verify();
  assert.equal(r.config.schemaVersion, 2);
  assert.equal(r.config.loaded, false);
  assert.equal(r.config.enabled, true, 'reports what the config said even though it was not adopted');
});

scenario('disable: config fetch failure is a no-op', async () => {
  const shim = disabledShim({ status: 404, body: null });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), false);
  await shim.flush();
  assertNoFootprint(shim, GHLC, 'HTTP 404');
  assert.ok(logCount(shim, 'config-fetch-failed') >= 1);
  const r = GHLC.verify();
  assert.equal(r.config.loaded, false);
  assert.equal(r.config.enabled, null);
  assert.equal(r.config.schemaVersion, null);
  assert.ok(!JSON.stringify(r).includes('config.test'), 'config URL never appears in the report');
});

scenario('disable: malformed JSON is a no-op', async () => {
  const shim = disabledShim({ status: 200, body: '{not json' });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), false);
  await shim.flush();
  assertNoFootprint(shim, GHLC, 'bad JSON');
  assert.ok(logCount(shim, 'config-parse-failed') >= 1);
  assert.doesNotThrow(() => GHLC.verify());
});

scenario('verify: report shape and hygiene', async () => {
  const { shim, GHLC } = await bootContactPage();
  assert.ok(logCount(shim, '[ghlc] verify') >= 1, 'debug mode auto-ran verify at boot');
  const r = GHLC.verify();
  assert.equal(r.version, '0.1.0');
  assert.equal(r.url, undefined, 'raw pathname is not reported (IN-03)');
  assert.deepEqual(plain(r.route), { locationId: 'locA', contactId: 'c1', isAgency: false });
  assert.equal(r.generation, 1);
  assert.equal(r.hooksInstalled, true);
  assert.deepEqual(plain(r.config), { loaded: true, enabled: true, schemaVersion: 1, buttonIds: ['sendInvite', 'supportLink', 'locOnlyLink', 'badTypeBtn', 'badHandlerBtn', 'copyIdBtn'] });
  assert.deepEqual(plain(r.mounts), {
    sidebar: true,
    header: true,
    headerMount: true,
    contactMount: true,
    contactRegion: true,
    sidebarLogo: true,
    headerLogo: false,
    locationSwitcher: true,
    backToAgency: true,
    contactMountVia: 'selector',
    contactEmailField: false,
    contactPhoneField: false,
    sidebarNavActive: false,
  });
  assert.deepEqual(plain(r.contactFields), { email: true, phone: true, emailCandidates: 1, phoneCandidates: 1 });
  assert.deepEqual(plain(r.observers), { header: true, contact: true, branding: true, theme: true });
  assert.deepEqual(plain(r.waiting), { header: false, contact: false, contactFields: false, branding: false, theme: false });
  assert.deepEqual(plain(r.branding), { mount: 'sidebar', found: true, applied: 'location', resolving: false, failed: 0, loaded: 1 });
  assert.deepEqual(plain(r.theme), { root: true, applied: ['primary', 'sidebarBg', 'sidebarText', 'navActive'], navActive: 0, ignored: 0, fallback: false });
  assert.ok(Array.isArray(r.buttons) && r.buttons.length === 6);
  assert.ok(r.buttons.some((b) => b.id === 'sendInvite' && b.placement === 'contact' && b.state === 'ready'));
  assert.ok(r.buttons.every((b) => Object.keys(b).length === 3), 'buttons carry id, placement, state only');
  const text = JSON.stringify(r);
  for (const s of ['jane@', '5550100', 'hooks/', 'TEST-HOOK', 'leadconnectorhq', 'config.test', 'alert(']) {
    assert.ok(!text.includes(s), `verify report must not contain "${s}"`);
  }
  assertNoLeak(shim.console.lines, LEAK_STRINGS, 'DLV-04');
  assert.equal(GHLC.__test.verify, GHLC.verify);
});

scenario('verify: missing mounts are reported false and native DOM stays untouched', async () => {
  const shim = createShim({ pathname: '/v2/location/locA/dashboard', search: '?ghlc-debug=1', fixture: loadFixture() });
  const doc = shim.document;
  while (doc.body.firstChild) doc.body.removeChild(doc.body.firstChild);
  doc.body.appendChild(shim.el('aside', { id: 'sidebar-v2', class: 'sidebar-v2-location' }, [shim.el('select', { id: 'location-switcher-sidbar-v2' })]));
  doc.body.appendChild(shim.el('main', {}, [shim.el('div', { class: 'hx-dashboard' }, ['Dashboard'])]));
  const before = doc.body.children.length;
  const snapshot = doc.body.childNodes.slice();
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  const r = GHLC.verify();
  assert.equal(r.mounts.headerMount, false);
  assert.equal(r.mounts.header, false);
  assert.equal(r.mounts.contactMount, false);
  assert.equal(r.mounts.contactRegion, false);
  assert.equal(r.mounts.sidebar, true);
  assert.equal(r.mounts.locationSwitcher, true);
  assert.equal(r.mounts.backToAgency, false);
  assert.deepEqual(plain(r.contactFields), { email: false, phone: false, emailCandidates: 0, phoneCandidates: 0 });
  // The hand-built sidebar is the theme root, so locA's sidebar tokens apply and the theme observer is up.
  assert.deepEqual(plain(r.observers), { header: false, contact: false, branding: false, theme: true });
  assert.deepEqual(plain(r.branding), { mount: 'sidebar', found: false, applied: null, resolving: false, failed: 0, loaded: 0 });
  assert.equal(r.waiting.branding, true, 'locA has a logo to show, so a bounded wait runs for the missing mount');
  assert.equal(r.waiting.header, true, 'the route expects a header, so a bounded wait runs');
  assert.equal(r.waiting.contact, false, 'no contact in the URL, no contact wait');
  assert.equal(doc.querySelectorAll('.ghlc-group').length, 0);
  assert.equal(doc.body.children.length, before);
  assert.deepEqual(doc.body.childNodes, snapshot, 'body children are the same nodes');
  await shim.advanceTimers(16000);
  assert.equal(GHLC.verify().waiting.header, false, 'wait gave up');
  assert.deepEqual(doc.body.childNodes, snapshot, 'still untouched after the wait');
  assert.equal(shim.observers().length, 2, 'only the theme observer remains: the sidebar is present and themed');
  assert.equal(themeRegs(shim).length, 2);
  assert.equal(shim.errors.length, 0);
});

scenario('boot: window.GHLC is the only global the script adds', async () => {
  const shim = createShim({ pathname: CONTACT_PATH, fixture: loadFixture() });
  shim.buildShell({ sidebarMode: 'location', contact: JANE });
  const before = new Set(Object.keys(shim.window));
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  const added = Object.keys(shim.window).filter((k) => !before.has(k) && k !== '__GHLC_TEST__');
  assert.deepEqual(added, ['GHLC']);
  assert.deepEqual(Object.keys(GHLC).sort(), ['__test', 'ready', 'verify', 'version']);
});

// ---------------------------------------------------------------------------
// Location logo switching (Phase 2, Plan 01)
// Shell: img.agency-logo inside a.hx-logo-link in the sidebar (shell.logo).
// Image loads are settled by the shim stub; no bytes are fetched.
// ---------------------------------------------------------------------------

const LOC_A_LOGO = './fixtures/logos/loc-a.svg';
const LOC_B_LOGO = './fixtures/logos/loc-b.svg';
const NATIVE_SRC = 'https://native.test/agency.png';
const BRANDING_LEAKS = ['loc-a.svg', 'loc-b.svg', 'logos/', 'native.test', 'Location A', 'Location B'];

// Boots at a location dashboard (debug on) with the fixture, or a config body
// when given. `shell` options pass through to buildShell; `before(shim)` runs
// before the script (to hold image loads that boot itself will request).
async function bootBranding({ path = '/v2/location/locA/dashboard', config = null, shell: shellOpts = {}, before = null } = {}) {
  const shim = createShim({ pathname: path, search: '?ghlc-debug=1', fixture: loadFixture() });
  const shell = shim.buildShell({ sidebarMode: 'location', contact: null, ...shellOpts });
  if (config) shim.setConfigResponse({ status: 200, body: config });
  if (before) before(shim);
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true, 'boot resolves true');
  await shim.flush();
  return { shim, shell, GHLC };
}

const logoIs = (img, { src, alt, tier }) => {
  assert.equal(img.getAttribute('src'), src);
  assert.equal(img.getAttribute('alt'), alt);
  if (tier) {
    assert.equal(img.getAttribute('data-ghlc-logo'), tier);
    assert.ok(img.classList.contains('ghlc-logo'), 'ghlc-logo class while branded');
    assert.equal(img.getAttribute('referrerpolicy'), 'no-referrer');
  } else {
    assert.equal(img.getAttribute('data-ghlc-logo'), null, 'no tier marker on the native logo');
    assert.ok(!img.classList.contains('ghlc-logo'), 'no ghlc-logo class on the native logo');
    assert.equal(img.getAttribute('referrerpolicy'), null, 'no referrer policy on the native logo');
  }
};
const mountWrites = (shim, shell) => shim.imageLog.filter((e) => e.el === shell.logo);
const preloads = (shim, shell) => shim.imageLog.filter((e) => e.el !== shell.logo);

check('unit: resolveBranding builds the location -> agency chain and ignores unsafe URLs', () => {
  const api = throwawayApi();
  const cfg = loadFixture();
  const chain = (c, id) => plain(api.resolveBranding(c, id));
  assert.deepEqual(chain(cfg, 'locA'), [{ tier: 'location', src: LOC_A_LOGO, alt: 'Location A logo' }]);
  assert.deepEqual(chain(cfg, 'locB'), [{ tier: 'location', src: LOC_B_LOGO, alt: 'Location B' }]);
  assert.deepEqual(chain(cfg, 'locZ'), [], 'unconfigured location has no candidate (agency.logoUrl is empty)');
  assert.deepEqual(chain(cfg, null), [], 'agency route with no agency logo');
  assert.deepEqual(chain(cfg, 'constructor'), [], 'prototype-named location IDs never resolve');

  const withAgency = loadFixture();
  withAgency.agency.logoUrl = 'https://cdn.test/agency.png';
  withAgency.agency.logoAlt = 'Agency';
  assert.deepEqual(chain(withAgency, 'locA'), [
    { tier: 'location', src: LOC_A_LOGO, alt: 'Location A logo' },
    { tier: 'agency', src: 'https://cdn.test/agency.png', alt: 'Agency' },
  ]);
  assert.deepEqual(chain(withAgency, null), [{ tier: 'agency', src: 'https://cdn.test/agency.png', alt: 'Agency' }]);
  assert.deepEqual(chain(withAgency, 'locZ'), [{ tier: 'agency', src: 'https://cdn.test/agency.png', alt: 'Agency' }]);

  // Alt chain when the location has no logoAlt and no name (A-07).
  const bare = loadFixture();
  bare.agency.logoAlt = 'Agency';
  bare.locations.locQ = { logoUrl: 'https://cdn.test/q.png' };
  assert.deepEqual(chain(bare, 'locQ'), [{ tier: 'location', src: 'https://cdn.test/q.png', alt: 'Agency' }]);
  delete bare.agency.logoAlt;
  assert.deepEqual(chain(bare, 'locQ'), [{ tier: 'location', src: 'https://cdn.test/q.png', alt: null }], 'null alt means keep the native alt');

  for (const bad of ['javascript:alert(1)', 'http://plain.test/x.png', 'data:image/png;base64,AAAA', 'https://u:p@h.test/x.png', 42, '', null, {}]) {
    const c = loadFixture();
    c.locations.locA.logoUrl = bad;
    c.agency.logoUrl = bad;
    assert.deepEqual(chain(c, 'locA'), [], `unsafe logoUrl ${JSON.stringify(bad)} never produces a candidate`);
  }
});

check('unit: isSafeImageUrl accepts https and same-origin, rejects the rest', () => {
  const api = throwawayApi();
  assert.equal(api.isSafeImageUrl('https://cdn.test/logo.png'), true);
  assert.equal(api.isSafeImageUrl(LOC_A_LOGO), true, 'relative path resolves against the page (same-origin)');
  assert.equal(api.isSafeImageUrl('/v2/location/locA/logo.png'), true);
  // The rule as written (A-06), not a host allowlist: a protocol-relative URL
  // resolves against the shim's https origin to a credential-free https URL.
  assert.equal(api.isSafeImageUrl('//evil.test/x.png'), true);
  for (const bad of ['javascript:alert(1)', 'http://plain.test/x.png', 'data:image/png;base64,AAAA', 'blob:https://app.test/x', 'https://u:p@h.test/x.png', 'ftp://f.test/x.png', 42, '', null, undefined, {}, []]) {
    assert.equal(api.isSafeImageUrl(bad), false, `rejects ${JSON.stringify(bad)}`);
  }
});

check('review WR-02: URL safety checks resolve against document.baseURI, the base the browser loads from', () => {
  // A <base> pointing off-origin: a relative logoUrl validated against
  // location.href would read as same-origin while loading cross-origin http.
  const shim = createShim({ fixture: loadFixture() });
  shim.document.baseURI = 'http://plain.test/base/';
  const api = shim.run(src).__test;
  assert.equal(api.isSafeImageUrl('logo.png'), false, 'relative logo resolves through the base, not location.href');
  assert.equal(api.isSafeImageUrl('/logo.png'), false, 'root-relative logo resolves through the base too');
  assert.equal(api.isSafeImageUrl('https://cdn.test/logo.png'), true, 'absolute https is unaffected');
  assert.equal(api.isSafeLinkHref('/contacts'), false, 'root-relative link resolves through the base');
  assert.equal(api.isSafeLinkHref('https://cdn.test/x'), true);

  // A same-origin <base> (the harness) keeps relative files allowed.
  const same = createShim({ fixture: loadFixture() });
  same.document.baseURI = same.window.location.origin + '/test/';
  const sameApi = same.run(src).__test;
  assert.equal(sameApi.isSafeImageUrl('fixtures/logos/loc-a.svg'), true);
  assert.equal(sameApi.isSafeLinkHref('/contacts'), true);

  // No <base>: behaves exactly as before, against the page URL.
  const bare = throwawayApi();
  assert.equal(bare.isSafeImageUrl(LOC_A_LOGO), true);
  assert.equal(bare.isSafeImageUrl('/v2/location/locA/logo.png'), true);
});

scenario('branding tracer: configured location swaps the sidebar logo in place after preload; agency route restores native', async () => {
  const { shim, shell, GHLC } = await bootBranding();
  assert.ok(shell.logo, 'shell carries the sidebar logo');
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });

  // Exactly one detached preload for loc-a, and it was requested before the mount write.
  const pre = preloads(shim, shell).filter((e) => e.src === LOC_A_LOGO);
  assert.equal(pre.length, 1, 'exactly one preload for the location logo');
  assert.equal(pre[0].el.tagName, 'IMG');
  assert.equal(pre[0].el.getAttribute('referrerpolicy'), 'no-referrer', 'preload carries the referrer policy');
  assert.equal(pre[0].el.isConnected, false, 'preload element never enters the document');
  const mountWrite = shim.imageLog.findIndex((e) => e.el === shell.logo && e.src === LOC_A_LOGO);
  assert.ok(mountWrite !== -1, 'the mount was written');
  assert.ok(shim.imageLog.indexOf(pre[0]) < mountWrite, 'preload precedes the mount write');
  assert.equal(mountWrites(shim, shell).filter((e) => e.src === LOC_A_LOGO).length, 1, 'the mount was written once');

  // Same element, same anchor, no behavior attached (A-03, BRD-02).
  assert.equal(shim.document.querySelector('#sidebar-v2 img.agency-logo'), shell.logo, 'mount is the same node');
  assert.equal(shim.document.querySelectorAll('img.agency-logo').length, 1, 'no duplicate logo');
  assert.equal(shell.logo.parentNode.tagName, 'A');
  assert.ok(shell.logo.parentNode.classList.contains('hx-logo-link'));
  assert.equal(shell.logo.parentNode.getAttribute('href'), '/v2/agency/dashboard', 'anchor href untouched');
  assert.equal(shim.listenerCount(shell.logo, 'click'), 0, 'no click listener on the logo');
  assert.equal(shim.listenerCount(shell.logo.parentNode, 'click'), 0, 'no click listener on the anchor');
  assert.equal(shell.logo.hasAttribute('srcset'), false);
  assert.equal(GHLC.__test.getState().generation, 1);
  assert.equal(logCount(shim, 'logo-resolving'), 1);
  // Match the tier field, not the bare word: every branding line carries locationId.
  assert.equal(logCount(shim, 'logo-applied', "tier: 'location'"), 1);
  assert.equal(logCount(shim, 'logo-applied', "tier: 'native'"), 1, 'native was recorded as the interim tier before the preload');

  shim.navigate('/v2/agency/dashboard', { via: 'pushState' });
  shim.setSidebarMode('agency');
  await shim.flush();
  logoIs(shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  assert.equal(shim.document.querySelector('#sidebar-v2 img.agency-logo'), shell.logo, 'still the same node after restore');
  assert.equal(GHLC.__test.getState().generation, 2);
  assert.equal(preloads(shim, shell).length, 1, 'no preload for the agency route');

  assertNoLeak(shim.console.lines, ['loc-a.svg', 'logos/', 'native.test', 'Location A'], 'branding');
  assert.ok(logCount(shim, '[ghlc]') > 0, 'diagnostics were produced');
  assert.equal(shim.errors.length, 0);
});

// ---------------------------------------------------------------------------
// Switching and fallback semantics (Phase 2, Plan 01, Task 2)
// ---------------------------------------------------------------------------

const AGENCY_LOGO = 'https://cdn.test/agency.png';
const withAgencyLogo = () => {
  const cfg = loadFixture();
  cfg.agency.logoUrl = AGENCY_LOGO;
  cfg.agency.logoAlt = 'Agency';
  return cfg;
};
const go = async (shim, path) => {
  shim.navigate(path, { via: 'pushState' });
  await shim.flush();
};

scenario('branding: switching A -> B shows the agency logo while B resolves, then B; A is never on the mount', async () => {
  const { shim, shell } = await bootBranding({ config: withAgencyLogo() });
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  const mark = shim.imageLog.length;
  shim.setImageOutcome(LOC_B_LOGO, 'hold');
  await go(shim, '/v2/location/locB/dashboard');
  // loc-b is held, so the interim is the resting state after the navigation flush.
  logoIs(shell.logo, { src: AGENCY_LOGO, alt: 'Agency', tier: 'agency' });
  const since = shim.imageLog.slice(mark);
  const interimIdx = since.findIndex((e) => e.el === shell.logo && e.src === AGENCY_LOGO);
  const preloadIdx = since.findIndex((e) => e.el !== shell.logo && e.src === LOC_B_LOGO);
  assert.ok(interimIdx !== -1 && preloadIdx !== -1, 'interim write and B preload both happened');
  assert.ok(interimIdx < preloadIdx, 'the interim is written before the preload starts');
  assert.equal(shim.heldImages.length, 1, 'B preload is held');
  assert.equal(shim.releaseImage(LOC_B_LOGO, 'load'), 1);
  await shim.flush();
  logoIs(shell.logo, { src: LOC_B_LOGO, alt: 'Location B', tier: 'location' });
  assert.ok(!shim.imageLog.slice(mark).some((e) => e.el === shell.logo && e.src === LOC_A_LOGO), "A's src never returns to the mount after the switch");
  assert.equal(shim.errors.length, 0);
});

scenario('branding: with no agency logo the interim is the native logo', async () => {
  const { shim, shell } = await bootBranding();
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  shim.setImageOutcome(LOC_B_LOGO, 'hold');
  await go(shim, '/v2/location/locB/dashboard');
  logoIs(shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  shim.releaseImage(LOC_B_LOGO, 'load');
  await shim.flush();
  logoIs(shell.logo, { src: LOC_B_LOGO, alt: 'Location B', tier: 'location' });
  assert.equal(shim.errors.length, 0);
});

scenario('branding: rapid A -> B -> A keeps A when B resolves late', async () => {
  const { shim, shell, GHLC } = await bootBranding({
    before: (s) => {
      s.setImageOutcome(LOC_A_LOGO, 'hold');
      s.setImageOutcome(LOC_B_LOGO, 'hold');
    },
  });
  logoIs(shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  assert.equal(shim.heldImages.length, 1, 'A preload pending');
  await go(shim, '/v2/location/locB/dashboard');
  assert.equal(shim.heldImages.filter((h) => h.src === LOC_B_LOGO).length, 1, 'B preload pending');
  assert.equal(shim.heldImages[0].el.getAttribute('src'), null, "A's first preload was cancelled (src dropped)");
  await go(shim, '/v2/location/locA/dashboard');
  assert.equal(GHLC.__test.getState().generation, 3);
  assert.equal(shim.releaseImage(LOC_B_LOGO, 'load'), 1, 'B resolves after the last switch');
  await shim.flush();
  assert.notEqual(shell.logo.getAttribute('src'), LOC_B_LOGO, 'the mount never shows B');
  logoIs(shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  assert.ok(logCount(shim, 'logo-discarded') >= 1, 'the late result was discarded');
  assert.equal(shim.releaseImage(LOC_A_LOGO, 'load'), 2, 'the cancelled and the current A preload both settle');
  await shim.flush();
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  assert.equal(mountWrites(shim, shell).filter((e) => e.src === LOC_A_LOGO).length, 1, 'A written to the mount exactly once');
  assert.equal(GHLC.__test.getState().generation, 3);
  // loc-a is still set to hold, so the only parked request left is the mount's own write.
  assert.equal(shim.heldImages.length, 1);
  assert.equal(shim.heldImages[0].el, shell.logo);
  assert.equal(shim.errors.length, 0);
});

scenario('branding: broken location logo falls back to the agency logo, broken agency logo falls back to native, previous client logo is never used', async () => {
  const { shim, shell } = await bootBranding({
    config: withAgencyLogo(),
    before: (s) => s.setImageOutcome('./fixtures/logos/missing.svg', 'error'),
  });
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  await go(shim, '/v2/location/locC/dashboard');
  logoIs(shell.logo, { src: AGENCY_LOGO, alt: 'Agency', tier: 'agency' });
  assert.equal(logCount(shim, 'logo-failed'), 1, 'the preload error');
  assert.equal(logCount(shim, 'logo-failed', "tier: 'location'"), 1);
  assert.ok(!mountWrites(shim, shell).some((e) => e.src === './fixtures/logos/missing.svg'), 'a broken URL never reaches the mount');

  // Force a fresh agency write: back to A (loaded, instant), then to an
  // unconfigured location with the agency logo now broken.
  await go(shim, '/v2/location/locA/dashboard');
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  const mark = shim.imageLog.length;
  shim.setImageOutcome(AGENCY_LOGO, 'error');
  await go(shim, '/v2/location/locZ/dashboard');
  logoIs(shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  assert.equal(logCount(shim, 'logo-failed'), 2, 'preload error plus mount error');
  assert.equal(logCount(shim, 'logo-failed', "tier: 'agency'"), 1);
  assert.ok(!shim.imageLog.slice(mark).some((e) => e.el === shell.logo && e.src === LOC_A_LOGO), 'the previously applied client logo is never a fallback');
  // The failed agency URL stays excluded for the session: the agency route goes straight to native.
  await go(shim, '/v2/agency/dashboard');
  logoIs(shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  assert.equal(shim.imageLog.slice(mark).filter((e) => e.src === AGENCY_LOGO).length, 1, 'the broken agency URL was requested once and never retried');
  assert.equal(shim.errors.length, 0);
});

scenario('branding: unconfigured location and agency route resolve to agency then native', async () => {
  const withAgency = await bootBranding({ path: '/v2/location/locZ/dashboard', config: withAgencyLogo() });
  logoIs(withAgency.shell.logo, { src: AGENCY_LOGO, alt: 'Agency', tier: 'agency' });
  await go(withAgency.shim, '/v2/agency/dashboard');
  logoIs(withAgency.shell.logo, { src: AGENCY_LOGO, alt: 'Agency', tier: 'agency' });
  assert.equal(preloads(withAgency.shim, withAgency.shell).length, 0, 'the agency tier is applied directly, never preloaded');
  assert.equal(withAgency.shim.errors.length, 0);

  const shipped = await bootBranding({ path: '/v2/location/locZ/dashboard' });
  logoIs(shipped.shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  await go(shipped.shim, '/v2/agency/dashboard');
  logoIs(shipped.shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  assert.equal(mountWrites(shipped.shim, shipped.shell).length, 1, 'only the shell build wrote the native src; the script never touched it');
  assert.equal(shipped.shim.errors.length, 0);
});

scenario('branding: same-context re-render is a no-op write and a loaded logo re-applies instantly', async () => {
  const { shim, shell, GHLC } = await bootBranding();
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  const writes = mountWrites(shim, shell).length;
  const applied = logCount(shim, 'logo-applied');
  GHLC.__test.renderAll();
  await shim.flush();
  assert.equal(mountWrites(shim, shell).length, writes, 're-render writes nothing');
  assert.equal(logCount(shim, 'logo-applied'), applied, 're-render logs nothing');
  assert.equal(GHLC.__test.getState().generation, 1);

  await go(shim, '/v2/location/locB/dashboard');
  logoIs(shell.logo, { src: LOC_B_LOGO, alt: 'Location B', tier: 'location' });
  assert.equal(logCount(shim, 'logo-resolving'), 2, 'A and B each preloaded once');
  await go(shim, '/v2/location/locA/dashboard');
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  assert.equal(preloads(shim, shell).filter((e) => e.src === LOC_A_LOGO).length, 1, 'no second preload for a loaded URL');
  assert.equal(logCount(shim, 'logo-resolving'), 2, 'the revisit did not resolve again');
  assert.equal(shim.heldImages.length, 0);
  assert.equal(shim.errors.length, 0);
});

scenario('branding: srcset is removed while branded and restored on native', async () => {
  const native = { src: 'https://native.test/a.png', alt: 'N', srcset: 'https://native.test/a@2x.png 2x' };
  const { shim, shell } = await bootBranding({ shell: { logo: native } });
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  assert.equal(shell.logo.hasAttribute('srcset'), false, 'srcset removed while branded');
  await go(shim, '/v2/agency/dashboard');
  logoIs(shell.logo, { src: native.src, alt: 'N', tier: null });
  assert.equal(shell.logo.getAttribute('srcset'), native.srcset, 'srcset restored verbatim');
  assert.equal(shim.errors.length, 0);
});

scenario('branding: alt chain — logoAlt, then location name, then agency logoAlt, then native alt', async () => {
  const a = await bootBranding();
  assert.equal(a.shell.logo.getAttribute('alt'), 'Location A logo', 'logoAlt wins');
  const b = await bootBranding({ path: '/v2/location/locB/dashboard' });
  assert.equal(b.shell.logo.getAttribute('alt'), 'Location B', 'location name when logoAlt is absent');

  const bare = loadFixture();
  bare.agency.logoAlt = 'Agency';
  bare.locations.locQ = { logoUrl: 'https://cdn.test/q.png' };
  const q = await bootBranding({ path: '/v2/location/locQ/dashboard', config: bare });
  logoIs(q.shell.logo, { src: 'https://cdn.test/q.png', alt: 'Agency', tier: 'location' });

  const noAgencyAlt = loadFixture();
  delete noAgencyAlt.agency.logoAlt;
  noAgencyAlt.locations.locQ = { logoUrl: 'https://cdn.test/q.png' };
  const n = await bootBranding({ path: '/v2/location/locQ/dashboard', config: noAgencyAlt });
  logoIs(n.shell.logo, { src: 'https://cdn.test/q.png', alt: 'Native Agency', tier: 'location' });

  // Agency tier without an agency logoAlt keeps the native alt too.
  const agencyNoAlt = loadFixture();
  agencyNoAlt.agency.logoUrl = AGENCY_LOGO;
  delete agencyNoAlt.agency.logoAlt;
  const z = await bootBranding({ path: '/v2/location/locZ/dashboard', config: agencyNoAlt });
  logoIs(z.shell.logo, { src: AGENCY_LOGO, alt: 'Native Agency', tier: 'agency' });
  for (const s of [a, b, q, n, z]) assert.equal(s.shim.errors.length, 0);
});

scenario('branding: mount missing leaves the DOM untouched and waits bounded', async () => {
  const { shim, shell, GHLC } = await bootBranding({ shell: { logo: false } });
  assert.equal(shell.logo, null);
  const snapshot = shell.sidebar.childNodes.slice();
  assert.equal(logCount(shim, 'logo-mount-missing'), 1);
  assert.equal(GHLC.verify().waiting.branding, true, 'a bounded wait runs while the route has a logo to show');
  assert.equal(shim.document.querySelectorAll('img').length, 0, 'nothing was added to the document');
  await shim.advanceTimers(600);
  assert.equal(logCount(shim, 'logo-mount-missing'), 1, 'reported once per generation while waiting');
  assert.deepEqual(shell.sidebar.childNodes, snapshot, 'sidebar untouched while waiting');
  const img = shim.el('img', { class: 'agency-logo', src: NATIVE_SRC, alt: 'Native Agency' });
  shell.sidebar.appendChild(shim.el('a', { class: 'hx-logo-link', href: '/v2/agency/dashboard' }, [img]));
  await shim.advanceTimers(300);
  logoIs(img, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  assert.equal(GHLC.verify().waiting.branding, false);
  assert.equal(logCount(shim, 'mount-missing', 'branding'), 0, 'the wait was satisfied, not exhausted');
  assert.equal(shim.errors.length, 0);

  // Second half: no mount ever appears; the wait gives up within the bound.
  const bare = await bootBranding({ shell: { logo: false } });
  const before = bare.shell.sidebar.childNodes.slice();
  assert.equal(bare.GHLC.verify().waiting.branding, true);
  await bare.shim.advanceTimers(16000);
  assert.equal(bare.GHLC.verify().waiting.branding, false, 'wait gave up');
  assert.equal(logCount(bare.shim, 'mount-missing', 'branding'), 1);
  assert.equal(logCount(bare.shim, 'logo-mount-missing'), 1);
  assert.deepEqual(bare.shell.sidebar.childNodes, before, 'still untouched after the wait');
  await bare.shim.advanceTimers(5000);
  assert.equal(logCount(bare.shim, 'mount-missing', 'branding'), 1, 'nothing keeps polling after giving up');
  assert.equal(bare.shim.errors.length, 0);

  // Agency route with no agency logo: nothing to show, so no wait at all.
  const idle = await bootBranding({ path: '/v2/agency/dashboard', shell: { logo: false, sidebarMode: 'agency' } });
  assert.equal(idle.GHLC.verify().waiting.branding, false);
  await idle.shim.advanceTimers(16000);
  assert.equal(logCount(idle.shim, 'mount-missing', 'branding'), 0);
  assert.equal(idle.shim.errors.length, 0);
});

scenario('logs: branding diagnostics never contain logo URLs, alt text, or location names', async () => {
  const { shim, shell } = await bootBranding({
    config: withAgencyLogo(),
    before: (s) => s.setImageOutcome('./fixtures/logos/missing.svg', 'error'),
  });
  shim.setImageOutcome(LOC_B_LOGO, 'hold');
  await go(shim, '/v2/location/locB/dashboard');
  shim.releaseImage(LOC_B_LOGO, 'load');
  await shim.flush();
  await go(shim, '/v2/location/locC/dashboard');
  await go(shim, '/v2/location/locA/dashboard');
  shim.setImageOutcome(AGENCY_LOGO, 'error');
  await go(shim, '/v2/location/locZ/dashboard');
  logoIs(shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  assert.ok(logCount(shim, 'logo-applied', "tier: 'location'") >= 1, 'branding diagnostics were produced');
  assert.ok(logCount(shim, 'logo-failed') >= 2 && logCount(shim, 'logo-resolving') >= 2);
  assertNoLeak(shim.console.lines, ['cdn.test', 'logos/', '.svg', '.png', 'Location A', 'Location B', 'Agency logo', 'native.test', 'Native Agency', 'Test Agency'], 'branding DLV-04');
  assert.equal(shim.errors.length, 0);
});

// ---------------------------------------------------------------------------
// Single branding observer and verify() branding report (Phase 2, Plan 02)
// ---------------------------------------------------------------------------

const freshNativeImg = (shim) => shim.el('img', { class: 'agency-logo', src: NATIVE_SRC, alt: 'Native Agency' });
const assertOneBrandingInstance = (regs) => {
  assert.equal(regs.length, 3, 'root + anchor + img registrations');
  assert.equal(new Set(regs.map((r) => r.observer)).size, 1, 'single branding observer');
  assert.ok(regs.every((r) => r.target.isConnected), 'every branding registration targets a connected node');
};

scenario('observers: replacing the sidebar logo img re-brands once through a single branding observer instance', async () => {
  const { shim, shell, GHLC } = await bootBranding();
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  let regs = brandingRegs(shim);
  assertOneBrandingInstance(regs);
  const rootReg = regs.find((r) => r.target === shell.sidebar);
  assert.ok(rootReg && rootReg.options.childList === true && rootReg.options.subtree === true, 'root: the sidebar, childList + subtree');
  const anchorReg = regs.find((r) => r.target === shell.sidebar.parentNode);
  assert.ok(anchorReg && anchorReg.options.childList === true && anchorReg.options.subtree === false, 'anchor: the sidebar parent, shallow');
  const imgReg = regs.find((r) => r.target === shell.logo);
  assert.ok(imgReg && imgReg.options.attributes === true && imgReg.options.childList === false, 'img: attributes only');
  assert.deepEqual(plain(imgReg.options.attributeFilter), ['src', 'alt', 'srcset', 'class'], 'every attribute the script writes is defended');
  assert.equal(logCount(shim, 'branding-observer-attached'), 1);
  assert.equal(logCount(shim, 'rebrand'), 0, 'boot writes never schedule a rebrand');

  const oldImg = shell.logo;
  const link = oldImg.parentNode;
  const freshImg = freshNativeImg(shim);
  link.replaceChild(freshImg, oldImg);
  await shim.flush();
  logoIs(freshImg, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  assert.equal(oldImg.isConnected, false);
  assert.equal(freshImg.parentNode, link, 'the replacement img stays where HighLevel put it');
  assert.equal(shim.document.querySelectorAll('img.agency-logo').length, 1, 'exactly one logo in the document');
  assert.equal(logCount(shim, 'rebrand'), 1);
  assert.equal(logCount(shim, 'logo-applied', "tier: 'location'"), 2);
  assert.equal(logCount(shim, 'logo-resolving'), 1, 'a loaded URL is re-applied without a second preload');
  regs = brandingRegs(shim);
  assertOneBrandingInstance(regs);
  assert.ok(regs.some((r) => r.target === freshImg && r.options.attributes), 'img registration follows the new img');
  assert.ok(regs.some((r) => r.target === shell.sidebar && r.options.subtree), 'root registration unchanged');
  assert.ok(!shim.observers().some((r) => r.target === oldImg), 'nothing targets the old img');
  assert.equal(logCount(shim, 'branding-observer-attached'), 2);
  assert.equal(logCount(shim, 'branding-observer-detached'), 1);
  assert.equal(GHLC.verify().observers.branding, true);
  assert.equal(shim.listenerCount(oldImg, 'error'), 0, 'error listener unbound from the old img');
  assert.equal(shim.listenerCount(freshImg, 'error'), 1, 'error listener bound once on the new img');
  assert.equal(shim.listenerCount(freshImg, 'click'), 0);
  await shim.advanceTimers(50);
  assert.equal(logCount(shim, 'rebrand'), 1, 'the rebrand settled in one pass');
  assert.equal(shim.errors.length, 0);
});

scenario('observers: HighLevel rewriting the logo src on the same element is re-branded and the new native value is remembered', async () => {
  const { shim, shell, GHLC } = await bootBranding();
  const NEW_NATIVE_SRC = 'https://native.test/new-agency.png';
  shell.logo.setAttribute('src', NEW_NATIVE_SRC);
  await shim.flush();
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  assert.equal(logCount(shim, 'logo-native-updated'), 1);
  assert.equal(logCount(shim, 'rebrand'), 1);
  assert.equal(mountWrites(shim, shell).filter((e) => e.src === LOC_A_LOGO).length, 2, 'A written back exactly once');
  assert.equal(logCount(shim, 'logo-resolving'), 1, 'no second preload for a loaded URL');
  assert.equal(logCount(shim, 'branding-observer-attached'), 1, 'same img: registrations kept');
  assert.equal(brandingRegs(shim).length, 3);

  // The same rule for alt: re-branded, and the write costs no image request.
  shell.logo.setAttribute('alt', 'HighLevel wrote this');
  await shim.flush();
  assert.equal(shell.logo.getAttribute('alt'), 'Location A logo');
  assert.equal(logCount(shim, 'logo-native-updated'), 2);
  assert.equal(logCount(shim, 'rebrand'), 2);
  assert.equal(mountWrites(shim, shell).filter((e) => e.src === LOC_A_LOGO).length, 2, 'an alt-only rebrand never rewrites src');

  await go(shim, '/v2/agency/dashboard');
  logoIs(shell.logo, { src: NEW_NATIVE_SRC, alt: 'HighLevel wrote this', tier: null });
  const r = GHLC.verify();
  assert.equal(r.observers.branding, false);
  assert.equal(r.branding.applied, 'native');
  assert.equal(brandingRegs(shim).length, 0);
  assert.equal(shim.observers().length, 0, 'agency route: no observers of any kind');
  assert.equal(logCount(shim, 'branding-observer-detached'), 1);
  assertNoLeak(shim.console.lines, [...BRANDING_LEAKS, 'new-agency', 'HighLevel wrote'], 'branding DLV-04');
  assert.equal(shim.errors.length, 0);
});

scenario('observers: own src and alt writes never schedule a rebrand', async () => {
  const { shim, shell } = await bootBranding();
  await go(shim, '/v2/location/locB/dashboard');
  await go(shim, '/v2/location/locA/dashboard');
  await go(shim, '/v2/location/locB/dashboard');
  logoIs(shell.logo, { src: LOC_B_LOGO, alt: 'Location B', tier: 'location' });
  await go(shim, '/v2/location/locA/dashboard');
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  await shim.advanceTimers(50);
  assert.equal(logCount(shim, 'rebrand'), 0);
  assert.equal(logCount(shim, 'logo-native-updated'), 0);
  // Every mount write is a tier change (the first is the shell building the
  // native img; the native interim shows once, on the first unproven B).
  assert.deepEqual(mountWrites(shim, shell).map((e) => e.src), [NATIVE_SRC, LOC_A_LOGO, NATIVE_SRC, LOC_B_LOGO, LOC_A_LOGO, LOC_B_LOGO, LOC_A_LOGO]);
  assert.equal(logCount(shim, 'logo-resolving'), 2, 'A and B each preloaded once');
  assert.equal(logCount(shim, 'branding-observer-attached'), 1, 'the same img stays watched across switches');
  assert.equal(brandingRegs(shim).length, 3);
  assert.equal(shim.errors.length, 0);
});

scenario('observers: wholesale sidebar replacement re-brands and swaps registrations', async () => {
  const { shim, shell, GHLC } = await bootBranding();
  const oldAside = shell.sidebar;
  const oldImg = shell.logo;
  const freshImg = freshNativeImg(shim);
  const freshAside = shim.el('aside', { id: 'sidebar-v2', class: 'sidebar-v2-location' }, [
    shim.el('a', { class: 'hx-logo-link', href: '/v2/agency/dashboard' }, [freshImg]),
    shim.el('select', { id: 'location-switcher-sidbar-v2' }),
  ]);
  shim.document.body.replaceChild(freshAside, oldAside);
  await shim.flush();
  assert.equal(shim.document.querySelector('#sidebar-v2'), freshAside);
  logoIs(freshImg, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  assert.equal(oldAside.isConnected, false);
  assert.equal(shim.document.querySelectorAll('img.agency-logo').length, 1);
  const regs = brandingRegs(shim);
  assertOneBrandingInstance(regs);
  assert.ok(regs.some((r) => r.target === freshAside && r.options.subtree === true), 'root follows the new sidebar');
  assert.ok(regs.some((r) => r.target === shim.document.body && r.options.subtree === false), 'anchor is still the sidebar parent');
  assert.ok(regs.some((r) => r.target === freshImg && r.options.attributes), 'img registration follows the new img');
  assert.ok(!shim.observers().some((r) => r.target === oldAside || r.target === oldImg), 'nothing targets the old sidebar or img');
  assert.equal(logCount(shim, 'rebrand'), 1);
  assert.equal(logCount(shim, 'branding-observer-attached'), 2);
  assert.equal(logCount(shim, 'branding-observer-detached'), 1);
  assert.equal(GHLC.verify().observers.branding, true);
  assert.equal(shim.listenerCount(oldImg, 'error'), 0);
  assert.equal(shim.listenerCount(freshImg, 'error'), 1);
  assert.equal(shim.errors.length, 0);
});

scenario('observers: unrelated sidebar mutations cost one coalesced no-op rebrand', async () => {
  const { shim, shell } = await bootBranding();
  const writes = mountWrites(shim, shell).length;
  const applied = logCount(shim, 'logo-applied');
  for (let i = 0; i < 5; i++) shell.sidebar.appendChild(shim.el('div', { class: 'hx-nav-item' }));
  await shim.flush();
  assert.equal(logCount(shim, 'rebrand'), 1, 'five mutations, one rebrand');
  assert.equal(mountWrites(shim, shell).length, writes, 'the no-op rebrand wrote nothing');
  assert.equal(logCount(shim, 'logo-applied'), applied, 'and logged no apply');
  assert.equal(logCount(shim, 'branding-observer-attached'), 1, 'watch was a no-op: same img, same root');
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  await shim.advanceTimers(50);
  assert.equal(logCount(shim, 'rebrand'), 1, 'nothing re-triggered');
  assert.equal(shim.errors.length, 0);
});

scenario('observers: native branding keeps no observer; an agency logo keeps one on agency routes', async () => {
  const { shim, GHLC } = await bootBranding({ path: '/v2/location/locZ/dashboard' });
  assert.equal(GHLC.verify().observers.branding, false);
  assert.equal(GHLC.verify().branding.applied, 'native');
  assert.equal(brandingRegs(shim).length, 0);
  assert.equal(logCount(shim, 'branding-observer-attached'), 0);
  await go(shim, '/v2/location/locA/dashboard');
  assert.equal(GHLC.verify().observers.branding, true);
  assert.equal(brandingRegs(shim).length, 3);
  await go(shim, '/v2/agency/dashboard');
  assert.equal(GHLC.verify().observers.branding, false);
  assert.equal(brandingRegs(shim).length, 0);
  assert.equal(shim.observers().length, 0);
  assert.equal(shim.errors.length, 0);

  // A configured agency logo is a non-native tier on agency routes too.
  const agency = await bootBranding({ path: '/v2/agency/dashboard', config: withAgencyLogo(), shell: { sidebarMode: 'agency' } });
  const ar = agency.GHLC.verify();
  assert.equal(ar.observers.branding, true);
  assert.equal(ar.branding.applied, 'agency');
  assert.equal(brandingRegs(agency.shim).length, 3);
  assert.equal(agency.shim.observers().length, 3, 'the branding observer is the only one on an agency page');
  assert.equal(agency.shim.errors.length, 0);

  // Resolving counts as branded: the observer is up while the preload is out.
  const held = await bootBranding({ before: (s) => s.setImageOutcome(LOC_A_LOGO, 'hold') });
  logoIs(held.shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  let hr = held.GHLC.verify();
  assert.deepEqual(plain(hr.branding), { mount: 'sidebar', found: true, applied: 'native', resolving: true, failed: 0, loaded: 0 });
  assert.equal(hr.observers.branding, true);
  assert.equal(brandingRegs(held.shim).length, 3);
  held.shim.releaseImage(LOC_A_LOGO, 'load');
  await held.shim.flush();
  hr = held.GHLC.verify();
  assert.deepEqual(plain(hr.branding), { mount: 'sidebar', found: true, applied: 'location', resolving: false, failed: 0, loaded: 1 });
  assert.equal(hr.observers.branding, true);
  assert.equal(held.shim.errors.length, 0);

  // A failed preload with nothing else to show ends at native with no observer.
  const broken = await bootBranding({ path: '/v2/location/locC/dashboard', before: (s) => s.setImageOutcome('./fixtures/logos/missing.svg', 'error') });
  logoIs(broken.shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  const br = broken.GHLC.verify();
  assert.deepEqual(plain(br.branding), { mount: 'sidebar', found: true, applied: 'native', resolving: false, failed: 1, loaded: 0 });
  assert.equal(br.observers.branding, false);
  assert.equal(brandingRegs(broken.shim).length, 0);
  assert.equal(logCount(broken.shim, 'branding-observer-attached'), 1, 'watched while resolving');
  assert.equal(logCount(broken.shim, 'branding-observer-detached'), 1, 'released once native was final');
  assert.equal(broken.shim.errors.length, 0);
});

scenario('review CR-01: a branded img that stops matching the mount selector is restored, and once re-found is captured as native, never as the previous client logo', async () => {
  const { shim, shell, GHLC } = await bootBranding();
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  assert.equal(shim.listenerCount(shell.logo, 'error'), 1);

  // HighLevel rewrites the img class through a framework binding: the same
  // element stays in the sidebar wearing our tier but no longer matches the
  // mount selector. It must not be left branded out of sight.
  shell.logo.setAttribute('class', 'logo-v3');
  GHLC.__test.renderAll();
  await shim.flush();
  logoIs(shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  assert.equal(shell.logo.getAttribute('class'), 'logo-v3', 'the HighLevel class is left alone');
  assert.equal(shim.listenerCount(shell.logo, 'error'), 0, 'error listener unbound with the capture');
  assert.equal(brandingRegs(shim).length, 0, 'no observer without a mount');
  assert.equal(logCount(shim, 'logo-mount-missing'), 1);

  // The binding settles: the same element matches again and is captured
  // fresh. What it carries now is HighLevel's logo, so the capture is right.
  shell.logo.setAttribute('class', 'agency-logo');
  GHLC.__test.renderAll();
  await shim.flush();
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  assert.equal(logCount(shim, 'logo-resolving'), 1, 'a loaded URL is re-applied without a second preload');
  assert.equal(shim.listenerCount(shell.logo, 'error'), 1, 'error listener bound once on the re-found img');
  assertOneBrandingInstance(brandingRegs(shim));

  // Every native restore from here shows HighLevel's logo, never Location A's.
  await go(shim, '/v2/agency/dashboard');
  logoIs(shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  assert.equal(GHLC.verify().branding.applied, 'native');
  await go(shim, '/v2/location/locZ/dashboard');
  logoIs(shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  assert.equal(brandingRegs(shim).length, 0, 'native resting state keeps no branding observer');
  assertNoLeak(shim.console.lines, BRANDING_LEAKS, 'branding DLV-04');
  assert.equal(shim.errors.length, 0);
});

scenario('review WR-01: srcset and class written back on the same element are re-stripped and re-added; the srcset is remembered as native', async () => {
  const { shim, shell, GHLC } = await bootBranding();
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  const writesOfA = () => mountWrites(shim, shell).filter((e) => e.src === LOC_A_LOGO).length;
  assert.equal(writesOfA(), 1);

  // HighLevel re-adds a srcset on the branded element: the browser would pick
  // its native 2x candidate over our src. It is stripped again, at no image
  // request, and remembered as the native srcset.
  const NATIVE_SRCSET = 'https://native.test/agency@2x.png 2x';
  shell.logo.setAttribute('srcset', NATIVE_SRCSET);
  await shim.flush();
  assert.equal(shell.logo.hasAttribute('srcset'), false, 'srcset re-stripped while branded');
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  assert.equal(logCount(shim, 'rebrand'), 1);
  assert.equal(logCount(shim, 'logo-native-updated'), 1);
  assert.equal(writesOfA(), 1, 'a srcset rebrand never rewrites src');

  // A framework class rewrite drops our class: only the class comes back,
  // HighLevel's own classes are kept, and src is untouched.
  shell.logo.setAttribute('class', 'agency-logo hl-fresh');
  await shim.flush();
  assert.ok(shell.logo.classList.contains('ghlc-logo'), 'ghlc-logo re-added');
  assert.ok(shell.logo.classList.contains('hl-fresh'), 'HighLevel classes kept');
  logoIs(shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  assert.equal(logCount(shim, 'rebrand'), 2);
  assert.equal(writesOfA(), 1, 'a class rebrand never rewrites src');

  // A class write that keeps our token is HighLevel's business, not a rebrand.
  shell.logo.setAttribute('class', 'agency-logo ghlc-logo hl-newer');
  await shim.advanceTimers(50);
  assert.equal(logCount(shim, 'rebrand'), 2, 'own class/srcset writes and a class rewrite that keeps our token never schedule a rebrand');
  assert.equal(logCount(shim, 'branding-observer-attached'), 1, 'same img: registrations kept');
  assertOneBrandingInstance(brandingRegs(shim));

  // Native restore puts back the srcset HighLevel wrote while branded.
  await go(shim, '/v2/agency/dashboard');
  logoIs(shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  assert.equal(shell.logo.getAttribute('srcset'), NATIVE_SRCSET, 'the srcset HighLevel wrote while branded is restored');
  assert.equal(GHLC.verify().branding.applied, 'native');
  assert.equal(brandingRegs(shim).length, 0);
  assertNoLeak(shim.console.lines, [...BRANDING_LEAKS, 'agency@2x'], 'branding DLV-04');
  assert.equal(shim.errors.length, 0);
});

scenario('verify: branding report shape, header mount, and hygiene', async () => {
  const { shim, GHLC } = await bootBranding();
  const r = GHLC.verify();
  assert.deepEqual(plain(r.branding), { mount: 'sidebar', found: true, applied: 'location', resolving: false, failed: 0, loaded: 1 });
  assert.deepEqual(plain(r.observers), { header: true, contact: false, branding: true, theme: true });
  assert.equal(r.waiting.branding, false);
  const text = JSON.stringify(r);
  for (const s of ['loc-a.svg', 'logos/', 'native.test', 'Location A', 'Test Agency']) {
    assert.ok(!text.includes(s), `verify report must not contain "${s}"`);
  }
  // Counters follow the session memory.
  shim.setImageOutcome('./fixtures/logos/missing.svg', 'error');
  await go(shim, '/v2/location/locC/dashboard');
  assert.deepEqual(plain(GHLC.verify().branding), { mount: 'sidebar', found: true, applied: 'native', resolving: false, failed: 1, loaded: 1 });
  assert.ok(!JSON.stringify(GHLC.verify()).includes('missing.svg'));
  assert.equal(shim.errors.length, 0);

  // Header mount: agency.logoMount = 'header' brands the header img and leaves the sidebar img native.
  const headerCfg = loadFixture();
  headerCfg.agency.logoMount = 'header';
  const h = await bootBranding({
    config: headerCfg,
    before: (s) => s.document.querySelector('.hl_header').appendChild(s.el('img', { class: 'agency-logo', src: 'https://native.test/header.png', alt: 'Header logo' })),
  });
  const hr = h.GHLC.verify();
  assert.equal(hr.branding.mount, 'header');
  assert.equal(hr.branding.found, true);
  assert.equal(hr.branding.applied, 'location');
  assert.equal(hr.mounts.headerLogo, true);
  assert.equal(hr.observers.branding, true);
  const headerImg = h.shim.document.querySelector('.hl_header img.agency-logo');
  logoIs(headerImg, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  logoIs(h.shell.logo, { src: NATIVE_SRC, alt: 'Native Agency', tier: null });
  const hRegs = brandingRegs(h.shim);
  assertOneBrandingInstance(hRegs);
  assert.ok(hRegs.some((x) => x.target === h.shell.header && x.options.subtree === true), 'root is the header for the header mount');
  assert.ok(hRegs.some((x) => x.target === headerImg && x.options.attributes), 'img registration is the header img');
  assert.ok(!h.shim.observers().some((x) => x.target === h.shell.logo), 'the sidebar img is not observed');
  assert.equal(h.shim.errors.length, 0);

  // An unknown mount name falls back to the adapter default.
  const bogusCfg = loadFixture();
  bogusCfg.agency.logoMount = 'bogus';
  const b = await bootBranding({ config: bogusCfg });
  assert.equal(b.GHLC.verify().branding.mount, 'sidebar');
  logoIs(b.shell.logo, { src: LOC_A_LOGO, alt: 'Location A logo', tier: 'location' });
  assert.equal(b.shim.errors.length, 0);
});

// ---------------------------------------------------------------------------
// Accent colors (Phase 3, Plan 01)
// Fixture: agency.theme.primary #0f766e; locA a full valid theme; locB an
// invalid primary plus a low-contrast sidebar pair; locC no theme.
// ---------------------------------------------------------------------------

const A_PRIMARY = '#c2410c';
const A_BG = '#1f2937';
const A_TEXT = '#f9fafb';
const A_NAV = '#374151';
const AGENCY_PRIMARY = '#0f766e';
const THEME_LEAKS = ['#c2410c', '#1f2937', '#0f766e', '#f9fafb', '#374151', 'c2410c', '1f2937', '0f766e', 'f9fafb', '374151'];
const groupsOf = (shim) => shim.document.querySelectorAll('.ghlc-group');
const varOf = (el, name) => el.style.getPropertyValue(name);
// Every element in the document whose inline style carries a theme custom property.
const themedElements = (shim) => allElements(shim.document).filter((el) => el.style.cssText.includes('--ghlc-'));

check('unit: parseColor accepts 3- and 6-digit hex only and normalizes to #rrggbb', () => {
  const api = throwawayApi();
  assert.deepEqual(plain(api.parseColor('#fff')), { hex: '#ffffff', r: 255, g: 255, b: 255 });
  assert.deepEqual(plain(api.parseColor('#0F766E')), { hex: '#0f766e', r: 15, g: 118, b: 110 });
  assert.deepEqual(plain(api.parseColor('#C2410C')), { hex: '#c2410c', r: 194, g: 65, b: 12 });
  for (const bad of ['fff', '#ffff', '#fffffff0', ' #fff', '#fff ', 'red', 'rgb(0,0,0)', 'url(x)', '', null, undefined, 42, {}, []]) {
    assert.equal(api.parseColor(bad), null, `rejects ${JSON.stringify(bad)}`);
  }
});

check('unit: resolveTheme merges agency and location tokens through locationEntry and drops invalid values', () => {
  const api = throwawayApi();
  const cfg = loadFixture();
  const theme = (c, id) => plain(api.resolveTheme(c, id));
  assert.deepEqual(theme(cfg, 'locA'), {
    tokens: { primary: A_PRIMARY, primaryText: '#ffffff', sidebarBg: A_BG, sidebarText: A_TEXT, navActive: A_NAV },
    ignored: [],
    fallback: false,
  });
  const agencyOnly = { tokens: { primary: AGENCY_PRIMARY, primaryText: '#ffffff' }, ignored: [], fallback: false };
  assert.deepEqual(theme(cfg, 'locC'), agencyOnly, 'a location without a theme inherits the agency tokens');
  assert.deepEqual(theme(cfg, null), agencyOnly, 'agency-level pages resolve the agency tokens alone');
  assert.deepEqual(theme(cfg, 'locZ'), agencyOnly, 'an unconfigured location inherits the agency tokens');
  assert.deepEqual(theme(cfg, 'constructor'), agencyOnly, 'a prototype-named location ID never resolves');
  const b = theme(cfg, 'locB');
  assert.equal(b.tokens.primary, AGENCY_PRIMARY, 'an invalid location primary falls through to the agency value');
  assert.ok(b.ignored.some((i) => i.scope === 'location' && i.token === 'primary' && i.reason === 'invalid'), 'the invalid value is reported by scope and token');

  const empty = loadFixture();
  empty.agency.theme.primary = '';
  assert.deepEqual(theme(empty, 'locC'), { tokens: {}, ignored: [], fallback: false }, 'an empty string is absent, not a diagnostic');
  const nulled = loadFixture();
  nulled.agency.theme.primary = null;
  assert.deepEqual(theme(nulled, 'locC').ignored, [], 'null is absent, not a diagnostic');
  const notObject = loadFixture();
  notObject.agency.theme = 'blue';
  assert.deepEqual(theme(notObject, 'locC'), { tokens: {}, ignored: [], fallback: false }, 'a non-object theme yields no tokens');
  const arrayTheme = loadFixture();
  arrayTheme.agency.theme = ['#ff0000'];
  assert.deepEqual(theme(arrayTheme, 'locC').tokens, {}, 'an array theme yields no tokens');
  assert.deepEqual(theme({ ...loadFixture(), agency: {} }, 'locC').tokens, {}, 'a missing theme yields no tokens');

  // locationEntry is the one lookup every per-location facet reads through.
  assert.equal(api.locationEntry(cfg, 'locA'), cfg.locations.locA, 'returns the fixture entry itself');
  assert.equal(api.locationEntry(cfg, 'nope'), null);
  assert.equal(api.locationEntry(cfg, null), null);
  assert.equal(api.locationEntry(cfg, 'constructor'), null);
  assert.equal(api.locationEntry(cfg, '__proto__'), null);
  assert.equal(api.locationEntry(null, 'locA'), null);
  assert.equal(api.locationEntry({ ...cfg, locations: [] }, 'locA'), null);
  // The refactored callers still return exactly what the Phase 1/2 units pin.
  assert.deepEqual(plain(api.resolveBranding(cfg, 'locA')), [{ tier: 'location', src: LOC_A_LOGO, alt: 'Location A logo' }]);
  assert.deepEqual(plain(api.resolveBranding(cfg, 'constructor')), []);
  assert.deepEqual(plain(api.resolveButtons(cfg, 'locA').map((b) => b.id)), ['sendInvite', 'supportLink', 'locOnlyLink', 'badTypeBtn', 'badHandlerBtn', 'copyIdBtn']);
  assert.deepEqual(plain(api.resolveButtons(cfg, 'locB').map((b) => b.id)), ['supportLink', 'badTypeBtn', 'badHandlerBtn', 'copyIdBtn']);
  assert.equal(api.resolveButtons(cfg, 'locB').find((b) => b.id === 'supportLink').label, 'B Support');
  assert.deepEqual(plain(api.resolveButtons(cfg, null)), []);
});

scenario("theme tracer: a location's primary and sidebarBg land on the customizer's groups and the sidebar; the agency route removes them", async () => {
  const { shim, shell, GHLC } = await bootBranding({ path: CONTACT_PATH, shell: { contact: JANE } });
  const groups = groupsOf(shim);
  assert.equal(groups.length, 2, 'header and contact groups');
  for (const group of groups) {
    assert.equal(varOf(group, '--ghlc-primary'), A_PRIMARY);
    assert.equal(varOf(group, '--ghlc-primary-text'), '#ffffff');
    assert.equal(varOf(group, '--ghlc-focus'), A_PRIMARY);
  }
  assert.equal(varOf(shell.sidebar, '--ghlc-sidebar-bg'), A_BG);
  assert.ok((shell.sidebar.getAttribute('data-ghlc-theme') || '').split(' ').includes('sidebar-bg'), 'the sidebar carries the sidebar-bg marker');
  let r = GHLC.verify();
  assert.equal(r.theme.root, true);
  assert.ok(r.theme.applied.includes('primary') && r.theme.applied.includes('sidebarBg'));
  assert.equal(r.observers.theme, true);
  assert.equal(shell.sidebar.getAttribute('class'), 'sidebar-v2-location', 'the sidebar class attribute is untouched');
  const themed = themedElements(shim);
  assert.equal(themed.length, 3, 'the sidebar and the two groups, nothing else');
  assert.ok(themed.every((el) => el === shell.sidebar || el.classList.contains('ghlc-group')));
  assert.equal(shim.document.documentElement.style.cssText, '', 'nothing on the html element');
  assert.equal(shim.document.body.style.cssText, '', 'nothing on the body element');
  assert.equal(shim.document.querySelectorAll('style').length, 0, 'no style element was generated');

  await go(shim, '/v2/agency/dashboard');
  assert.equal(groupsOf(shim).length, 0, 'no groups on an agency route');
  assert.equal(shell.sidebar.getAttribute('data-ghlc-theme'), null, 'the marker is gone');
  assert.equal(varOf(shell.sidebar, '--ghlc-sidebar-bg'), '');
  assert.equal(themedElements(shim).length, 0, 'no element carries a theme property');
  r = GHLC.verify();
  assert.deepEqual(plain(r.theme.applied), ['primary'], 'the agency primary resolves; the sidebar tokens are gone');
  assert.equal(r.observers.theme, false, 'no sidebar token, no theme observer');
  assert.equal(GHLC.__test.getState().generation, 2);
  assert.ok(logCount(shim, 'theme-applied') >= 1, 'theme diagnostics were produced');
  assertNoLeak(shim.console.lines, THEME_LEAKS, 'theme');
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

#!/usr/bin/env node
'use strict';
// email-check.cjs: content, style, and build checks for the member consent email (Plan 05-03, HUB-03, D-13).
//
// Usage: node email-check.cjs [--mjml PATH] [--html PATH]
//   Defaults to the canonical (uncommitted) files in the xcelsior repo.
//
// Prints one "ok - ..." or "not ok - ...: reason" line per check, then "PASS n/n" or "FAIL k/n".
// Exits 0 only on PASS. Node built-ins only. The fresh-compile check runs the cached mjml via
// `npx --yes mjml` from /tmp (the same tool Email-Templates/build.sh uses); it installs nothing new.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = '/Users/rhparker/Repos/clients/xcelsior/Email-Templates/Consent-Hub-Invite';
const args = process.argv.slice(2);
function opt(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : dflt;
}
const MJML = opt('--mjml', path.join(DIR, 'consent-forms-member.mjml'));
const HTML = opt('--html', path.join(DIR, 'consent-forms-member.html'));

const LINK = 'https://join.xcelsiorhealth.com/consent-hub?t={{contact.consent_hub_token}}';
const ALLOWED_MERGE = ['{{contact.consent_hub_token}}', '{{contact.first_name}}'];
const LEGAL = 'The button in this email opens a personal, secure link to your forms. If you have any questions, or if you were not expecting this email, please call our office and we will be glad to help.';
// Platform family names (HighLevel / GoHighLevel / Go High Level), the ClinX brand, the GHL
// abbreviation, and the LeadConnector domain name.
const VENDOR = /(?:go\s*)?high\s*level|\bclin-?x\b|\bghl\b|lead\s*connector/i;
const DASH_CHARS = /[–—]/;
const DASH_ENTITIES = /&(?:mdash|ndash);|&#821[12];|&#x201[34];/i;

let mjml = '';
let html = '';
const results = [];
function check(name, fn) {
  let reason = null;
  try { reason = fn(); } catch (e) { reason = 'error: ' + e.message; }
  results.push({ name, reason });
}

try { mjml = fs.readFileSync(MJML, 'utf8'); } catch (e) { mjml = null; }
try { html = fs.readFileSync(HTML, 'utf8'); } catch (e) { html = null; }

const start = mjml ? mjml.indexOf('<mjml>') : -1;
const header = mjml && start >= 0 ? mjml.slice(0, start) : '';
const body = mjml && start >= 0 ? mjml.slice(start) : '';

function need() {
  if (mjml === null) return 'cannot read MJML at ' + MJML;
  if (html === null) return 'cannot read HTML at ' + HTML;
  if (start < 0) return 'MJML has no <mjml> root';
  return null;
}

check("link: hub link with the member's own token", () => {
  const n = need(); if (n) return n;
  if (!html.includes(LINK)) return 'HTML lacks ' + LINK;
  const re = /consent-hub\?t=/g;
  let m; let count = 0;
  while ((m = re.exec(html))) {
    count++;
    const after = html.slice(m.index + 'consent-hub?t='.length, m.index + 'consent-hub?t='.length + '{{contact.consent_hub_token}}'.length);
    if (after !== '{{contact.consent_hub_token}}') return 'consent-hub?t= followed by "' + after + '"';
  }
  return count >= 1 ? null : 'no consent-hub?t= occurrence';
});

check('merge: only first_name and consent_hub_token merge fields', () => {
  const n = need(); if (n) return n;
  for (const [label, text] of [['MJML body', body], ['HTML', html]]) {
    const found = [...new Set(text.match(/\{\{[^}]*\}\}/g) || [])].sort();
    if (JSON.stringify(found) !== JSON.stringify(ALLOWED_MERGE)) return label + ' merge set is ' + JSON.stringify(found);
  }
  return null;
});

check('copy: greeting, personal, about ten minutes', () => {
  const n = need(); if (n) return n;
  if (!html.includes('Hi <strong>{{contact.first_name}}</strong>') && !html.includes('Hi {{contact.first_name}}')) return 'greeting missing';
  if (!/for you personally/i.test(html)) return '"for you personally" missing';
  if (!/ten minutes/i.test(html)) return '"ten minutes" missing';
  return null;
});

check('dashes: no em or en dash in the email', () => {
  const n = need(); if (n) return n;
  for (const [label, text] of [['MJML', mjml], ['HTML', html]]) {
    const c = text.match(DASH_CHARS);
    if (c) return label + ' contains U+' + c[0].charCodeAt(0).toString(16).toUpperCase() + ' at offset ' + c.index;
    const e = text.match(DASH_ENTITIES);
    if (e) return label + ' contains entity ' + e[0];
  }
  return null;
});

check('vendor: no platform or vendor name in patient-facing content', () => {
  const n = need(); if (n) return n;
  for (const [label, text] of [['MJML from <mjml>', body], ['HTML', html]]) {
    const m = text.match(VENDOR);
    if (m) return label + ' contains "' + m[0] + '"';
  }
  return null;
});

check('style: Consent Hub Invite design tokens present', () => {
  const n = need(); if (n) return n;
  const tokens = ['#142131', '#3D7050', '#FAF9F1', '#A68563', '#F5F1E5', 'Taviraj', 'Montserrat', 'width="680px"',
    '6a6cbc9ba4c8a1a2c34463df.png', '6a1ee6ea1b531ff70a83f3e7.png', '2506 S. Macdill Avenue', '813-605-1977', LEGAL];
  const missing = tokens.filter((t) => !mjml.includes(t));
  return missing.length ? 'missing ' + JSON.stringify(missing) : null;
});

check('header: paste target, subject, click tracking off', () => {
  const n = need(); if (n) return n;
  const req = ['Member Consent Forms', 'Your Xcelsior consent forms', '[Ready] Admin Menu: Consent Actions (webhook)', 'consent-forms-member.html'];
  const missing = req.filter((t) => !header.includes(t));
  if (missing.length) return 'header lacks ' + JSON.stringify(missing);
  const line = header.split('\n').find((l) => /click tracking stays OFF in the email action/i.test(l) && /stays OFF\b/.test(l));
  return line ? null : 'no header line stating click tracking OFF';
});

check('header: recipient claim is hedged and names the residual cases (code review WR-02, IN-01)', () => {
  const n = need(); if (n) return n;
  if (/only ever reaches/i.test(header)) return 'header still claims the email "only ever reaches" the member';
  const flat = header.replace(/\s+/g, ' ');
  const req = ['reduce the chance', 'Residual cases', 'belongs to another member', 'only this member\'s card'];
  const missing = req.filter((t) => !flat.includes(t));
  return missing.length ? 'header lacks ' + JSON.stringify(missing) : null;
});

check('size: under the Gmail clip threshold', () => {
  const n = need(); if (n) return n;
  const size = Buffer.byteLength(html, 'utf8');
  return size < 102400 ? null : 'HTML is ' + size + ' bytes';
});

check('fresh: HTML equals a fresh compile of the MJML', () => {
  const n = need(); if (n) return n;
  const r = spawnSync('npx', ['--yes', 'mjml', MJML, '-s', '--config.minify', 'true', '--config.beautify', 'false'],
    { cwd: '/tmp', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) return 'mjml exited ' + r.status + ': ' + (r.stderr || '').trim().split('\n').pop();
  // `mjml -s` prefixes one "<!-- FILE: <path> -->" banner line that `-o` (build.sh) never writes;
  // strip exactly that banner for this input file and nothing else.
  const banner = '<!-- FILE: ' + MJML + ' -->\n';
  const out = r.stdout.startsWith(banner) ? r.stdout.slice(banner.length) : r.stdout;
  const fresh = out.replace(/\s+$/, '');
  const onDisk = html.replace(/\s+$/, '');
  if (fresh === onDisk) return null;
  let i = 0; while (i < fresh.length && fresh[i] === onDisk[i]) i++;
  return 'differs at offset ' + i + ' (fresh ' + fresh.length + ' chars, file ' + onDisk.length + ')';
});

let failed = 0;
for (const r of results) {
  if (r.reason) { failed++; console.log('not ok - ' + r.name + ': ' + r.reason); }
  else console.log('ok - ' + r.name);
}
console.log(failed ? 'FAIL ' + failed + '/' + results.length : 'PASS ' + results.length + '/' + results.length);
process.exit(failed ? 1 : 0);

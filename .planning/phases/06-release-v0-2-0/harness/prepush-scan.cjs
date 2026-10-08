#!/usr/bin/env node
'use strict';
// prepush-scan.cjs: the Phase 6 publication gate (D-02).
//
// The repository is public and a jsDelivr tag is cached forever, so nothing is pushed or tagged
// until this scan passes. It proves that the tracked tree, and (with --history) every unpushed
// commit, carries no secret and no live-looking patient identifier.
//
// Usage:
//   node prepush-scan.cjs                    tree mode: six gating checks over every tracked file
//   node prepush-scan.cjs --history [RANGE]  tree mode, then every commit in RANGE
//                                            (default origin/main..HEAD); the history patient-id
//                                            check is the seventh, gating check
//
// Read-only: it never runs a git write command, and runs git only through spawnSync with an
// argument array (no shell). It NEVER prints a matched value, only the class and the location
// (path:line in the tree, sha7 plus path or the word "message" in history), so its output can be
// pasted into a log or a SUMMARY without spreading what it found.
//
// Output:
//   ok - <class>: <summary>               a check with no finding
//   not ok - <class>: <path>:<line>       one line per offending line
//   review - hl-id: <path>:<line>         review class, printed but never failing
//   history - <class>: <sha7> <path|message>
//   history: <N> commits, <K> findings
//   ok - history-patient-id: none in <N> commits
//   not ok - history-patient-id: <P> findings in <C> commits
//   PASS 6/6 | FAIL k/6 (tree)   PASS 7/7 | FAIL k/7 (history)
// Exit: 0 on PASS, 1 on FAIL, 2 on a usage error or an unresolvable RANGE.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SEND_INVITE_ID = 'bde416ab-a074-4946-bf99-7266eb1b0f4e';
const CONFIG_PATH = 'config/agency-config.json';
const CONSENT_ITEM_IDS = ['send-individual-consent', 'resend-consent-hub'];
const CONSENT_URL_RE =
  /^https:\/\/services\.leadconnectorhq\.com\/hooks\/Cp2XxBsRoyKS2CUf1Hwi\/webhook-trigger\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

// Public or non-personal 20-character ids (HighLevel location ids and the like) that the
// hl-id review class does not report.
const HL_ID_ALLOW = new Set([
  'Cp2XxBsRoyKS2CUf1Hwi',
  'iDPNGKoFsjvf9wUCrk3V',
  'Q7c2Whf2KdoKSzPbNN7K',
  'Oz0f515BAOp3gkwNlpbO',
  '8y71OTd9m7RjNgRA6EyC',
  'pZOnhyMAxryvLiW675mI',
  '3j2clPHt1Q6u6oIccvJx',
  'vlGvMKVj0e1GLVTH6oZm',
  'T5tWa7nLM8QgMQHu6D8P',
  'GLEnO5x5RTlpwauylrRf',
]);

const SECRET_RES = [
  /pit-[0-9a-f]{8}/,
  /Bearer\s+[A-Za-z0-9._~+\/=-]{16,}/,
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
  /sk-[A-Za-z0-9]{20,}/,
  /ghp_[A-Za-z0-9]{30,}/,
];
const PATIENT_ID_RE = /(?<![A-Za-z0-9_])pat-[A-Za-z0-9]{10,}/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})(?![A-Za-z0-9-])/g;
const EMAIL_OK_DOMAINS = new Set(['example.com', 'example.net', 'example.org', 'x.com']);
const MEMBER_TOKEN_RE = /adhoc_[0-9a-f]{64}/;
const WEBHOOK_RE = /webhook-trigger\/([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})/g;
const HL_ID_RE = /(?<![A-Za-z0-9])[A-Za-z0-9]{20}(?![A-Za-z0-9])/g;

const TREE_CLASSES = ['secret', 'patient-id', 'email', 'member-token', 'webhook-trigger', 'consent-url'];
const LINE_CLASSES = ['secret', 'patient-id', 'email', 'member-token', 'webhook-trigger', 'hl-id'];

function usage(msg) {
  process.stderr.write('usage error: ' + msg + '\n' +
    'usage: node prepush-scan.cjs [--history [RANGE]]   (RANGE defaults to origin/main..HEAD)\n');
  process.exit(2);
}

function git(args, opts) {
  const r = spawnSync('git', ['-c', 'core.quotePath=false'].concat(args), {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    ...(opts || {}),
  });
  return r;
}

// ---- arguments -------------------------------------------------------------------------------
const argv = process.argv.slice(2);
let historyMode = false;
let range = 'origin/main..HEAD';
if (argv.length > 0) {
  if (argv[0] !== '--history') usage('unknown argument ' + JSON.stringify(argv[0]));
  historyMode = true;
  if (argv.length > 2) usage('too many arguments');
  if (argv.length === 2) {
    range = argv[1];
    if (range === '' || range.startsWith('-')) usage('RANGE must be a revision range, not an option');
  }
}

const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: __dirname, encoding: 'utf8' });
if (top.status !== 0) usage('not inside a git work tree');
const ROOT = top.stdout.trim();

// Resolve the range before any output, so an unresolvable range never reads as an empty PASS.
let commits = [];
if (historyMode) {
  const rl = git(['rev-list', '--reverse', range, '--']);
  if (rl.status !== 0) usage('cannot resolve RANGE ' + JSON.stringify(range));
  commits = rl.stdout.split('\n').filter(Boolean);
}

// ---- classifiers (each returns the classes found on one line; never the values) --------------
function hasSecret(line) {
  return SECRET_RES.some((re) => re.test(line));
}
function hasPatientId(line) {
  PATIENT_ID_RE.lastIndex = 0;
  let m;
  while ((m = PATIENT_ID_RE.exec(line)) !== null) {
    if (!m[0].includes('EXAMPLE')) return true;
  }
  return false;
}
function emailDomainOk(domain) {
  const d = domain.toLowerCase();
  if (EMAIL_OK_DOMAINS.has(d)) return true;
  if (d.endsWith('.test')) return true;
  if (/\.(png|svg|jpg|webp)$/.test(d)) return true;
  return false;
}
function hasEmail(line) {
  EMAIL_RE.lastIndex = 0;
  let m;
  while ((m = EMAIL_RE.exec(line)) !== null) {
    if (!emailDomainOk(m[1])) return true;
  }
  return false;
}
function hasMemberToken(line) {
  return MEMBER_TOKEN_RE.test(line);
}
function badWebhookTrigger(line, allowed) {
  WEBHOOK_RE.lastIndex = 0;
  let m;
  while ((m = WEBHOOK_RE.exec(line)) !== null) {
    if (!allowed.has(m[1].toLowerCase())) return true;
  }
  return false;
}
function hasHlId(line) {
  HL_ID_RE.lastIndex = 0;
  let m;
  while ((m = HL_ID_RE.exec(line)) !== null) {
    const t = m[0];
    if (/[0-9]/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t) && !HL_ID_ALLOW.has(t)) return true;
  }
  return false;
}
function lineClasses(line, allowedTriggers) {
  const out = [];
  if (hasSecret(line)) out.push('secret');
  if (hasPatientId(line)) out.push('patient-id');
  if (hasEmail(line)) out.push('email');
  if (hasMemberToken(line)) out.push('member-token');
  if (badWebhookTrigger(line, allowedTriggers)) out.push('webhook-trigger');
  if (hasHlId(line)) out.push('hl-id');
  return out;
}

// ---- tracked tree ----------------------------------------------------------------------------
const ls = git(['ls-files', '-z']);
if (ls.status !== 0) usage('git ls-files failed');
const files = ls.stdout.split('\0').filter(Boolean);
const tree = []; // { path, lines }
for (const rel of files) {
  const abs = path.join(ROOT, rel);
  let st;
  try { st = fs.lstatSync(abs); } catch (e) { continue; } // tracked but deleted in the work tree
  if (!st.isFile()) continue;
  const buf = fs.readFileSync(abs);
  if (buf.subarray(0, 8000).includes(0)) continue; // binary
  tree.push({ path: rel, lines: buf.toString('utf8').split('\n') });
}

// consent-url: read the two consent item urls from the working-tree config
const findings = {}; // class -> [ 'path:line', ... ]
for (const c of TREE_CLASSES.concat(['hl-id'])) findings[c] = [];
let consentSummary = '';
let consentId = null;
(function checkConsentUrl() {
  const cfgEntry = tree.find((f) => f.path === CONFIG_PATH);
  if (!cfgEntry) { findings['consent-url'].push(CONFIG_PATH + ':1'); return; }
  let cfg;
  try { cfg = JSON.parse(cfgEntry.lines.join('\n')); } catch (e) { findings['consent-url'].push(CONFIG_PATH + ':1'); return; }
  const items = [];
  for (const menu of (Array.isArray(cfg.menus) ? cfg.menus : [])) {
    for (const item of (menu && Array.isArray(menu.items) ? menu.items : [])) items.push(item);
  }
  const lineOf = (needle) => {
    const i = cfgEntry.lines.findIndex((l) => l.includes(needle));
    return CONFIG_PATH + ':' + (i < 0 ? 1 : i + 1);
  };
  const urls = [];
  for (const id of CONSENT_ITEM_IDS) {
    const item = items.find((it) => it && it.id === id);
    const url = item && item.action && typeof item.action.url === 'string' ? item.action.url : null;
    if (url === null) { findings['consent-url'].push(lineOf('"' + id + '"')); return; }
    urls.push({ id, url });
  }
  if (urls[0].url === '' && urls[1].url === '') { consentSummary = 'not wired yet'; return; }
  if (urls[0].url !== urls[1].url) {
    for (const u of urls) findings['consent-url'].push(lineOf('"' + u.id + '"'));
    return;
  }
  const m = CONSENT_URL_RE.exec(urls[0].url);
  if (!m || m[1] === SEND_INVITE_ID) {
    findings['consent-url'].push(lineOf('"' + urls[0].id + '"'));
    return;
  }
  consentId = m[1];
  const elsewhere = [];
  let inConfig = false;
  for (const f of tree) {
    f.lines.forEach((l, i) => {
      if (!l.includes(consentId)) return;
      if (f.path === CONFIG_PATH) inConfig = true;
      else elsewhere.push(f.path + ':' + (i + 1));
    });
  }
  if (!inConfig) findings['consent-url'].push(CONFIG_PATH + ':1');
  for (const loc of elsewhere) findings['consent-url'].push(loc);
  if (findings['consent-url'].length === 0) consentSummary = 'both consent items share one trigger, distinct from Send Invite, only in ' + CONFIG_PATH;
})();

const allowedTriggers = new Set([SEND_INVITE_ID]);
if (consentId) allowedTriggers.add(consentId);

for (const f of tree) {
  f.lines.forEach((line, i) => {
    for (const c of lineClasses(line, allowedTriggers)) findings[c].push(f.path + ':' + (i + 1));
  });
}

const okSummary = {
  'secret': 'none in ' + tree.length + ' tracked text files',
  'patient-id': 'none outside the EXAMPLE ids',
  'email': 'only example and test domains',
  'member-token': 'none',
  'webhook-trigger': 'only ' + (consentId ? 'the Send Invite and consent triggers' : 'the Send Invite trigger'),
  'consent-url': consentSummary,
};
let failedChecks = 0;
for (const c of TREE_CLASSES) {
  if (findings[c].length === 0) {
    console.log('ok - ' + c + ': ' + okSummary[c]);
  } else {
    failedChecks += 1;
    for (const loc of findings[c]) console.log('not ok - ' + c + ': ' + loc);
  }
}
for (const loc of findings['hl-id']) console.log('review - hl-id: ' + loc);

if (!historyMode) {
  if (failedChecks === 0) { console.log('PASS 6/6'); process.exit(0); }
  console.log('FAIL ' + failedChecks + '/6');
  process.exit(1);
}

// ---- history ---------------------------------------------------------------------------------
let historyFindings = 0;
let patientFindings = 0;
const patientCommits = new Set();
function report(cls, sha, where) {
  console.log('history - ' + cls + ': ' + sha.slice(0, 7) + ' ' + where);
  historyFindings += 1;
  if (cls === 'patient-id') { patientFindings += 1; patientCommits.add(sha); }
}
function fatal(msg) {
  process.stderr.write('error: ' + msg + '\n');
  process.exit(2);
}

for (const sha of commits) {
  const seen = new Set(); // "class\0where", one line per class, commit, and path
  const add = (cls, where) => {
    const key = cls + '\0' + where;
    if (seen.has(key)) return;
    seen.add(key);
    report(cls, sha, where);
  };

  const msg = git(['log', '-1', '--format=%B', sha]);
  if (msg.status !== 0) fatal('git log failed for ' + sha.slice(0, 7));
  for (const line of msg.stdout.split('\n')) {
    for (const c of lineClasses(line, allowedTriggers)) add(c, 'message');
  }

  const show = git(['show', '--format=', '--unified=0', '--no-color', '--no-ext-diff', '--no-renames',
    '--diff-merges=first-parent', sha]);
  if (show.status !== 0) fatal('git show failed for ' + sha.slice(0, 7));
  let file = null;
  let inHunk = false;
  for (const line of show.stdout.split('\n')) {
    if (line.startsWith('diff --git ')) { file = null; inHunk = false; continue; }
    if (!inHunk) {
      if (line.startsWith('+++ ')) {
        const p = line.slice(4);
        file = p === '/dev/null' ? null : p.replace(/^b\//, '');
      } else if (line.startsWith('@@')) {
        inHunk = true;
      }
      continue;
    }
    if (line.startsWith('@@')) continue;
    if (!line.startsWith('+') || file === null) continue;
    for (const c of lineClasses(line.slice(1), allowedTriggers)) add(c, file);
  }
}

console.log('history: ' + commits.length + ' commits, ' + historyFindings + ' findings');
let historyFailed = 0;
if (patientFindings === 0) {
  console.log('ok - history-patient-id: none in ' + commits.length + ' commits');
} else {
  historyFailed = 1;
  console.log('not ok - history-patient-id: ' + patientFindings + ' findings in ' + patientCommits.size + ' commits');
}
const k = failedChecks + historyFailed;
if (k === 0) { console.log('PASS 7/7'); process.exit(0); }
console.log('FAIL ' + k + '/7');
process.exit(1);

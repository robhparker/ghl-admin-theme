#!/usr/bin/env node
// Phase 05-01 builder: repo wf2 JSON + Build Status v9 source -> edited workflow JSON + unified diff.
//
// Inputs (committed, secret-free):
//   X/hint-api/n8n/2-consent-hub-status.json   (stale repo mirror: Build Status v6 + Lookup Member Docs)
//   harness/build-status-v9.js                 (live v8 + the member-scope block)
// Outputs (canonical, left UNTRACKED in the xcelsior repo - never git add/commit there):
//   X/hint-api/proposals/2026-10-07-individual-consent/wf2-consent-hub-status.member-scope.json
//   X/hint-api/proposals/2026-10-07-individual-consent/wf2-member-scope.diff
//
// Edits applied, and nothing else:
//   1. Live-roster sync (planner finding F-1): delete node 'Lookup Member Docs', wire
//      Refetch Member -> Build Status directly, drop the Lookup Member Docs connection.
//      This is the live v8 graph (14 nodes), so applying the edit cannot roll live back to v6.
//   2. Build Status parameters.jsCode = build-status-v9.js verbatim.
// Every other key, node id, position, and the Config PIT placeholder stay untouched.
// The live export (it holds the real PIT) is NOT read here.
//
// Usage: node build-wf2.cjs [--repo FILE] [--v9 FILE] [--out-dir DIR]
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const X = '/Users/rhparker/Repos/clients/xcelsior';
const args = process.argv.slice(2);
function opt(name, def) { const i = args.indexOf(name); return i !== -1 && args[i + 1] ? args[i + 1] : def; }

const REPO = opt('--repo', path.join(X, 'hint-api/n8n/2-consent-hub-status.json'));
const V9 = opt('--v9', path.join(__dirname, 'build-status-v9.js'));
const OUT_DIR = opt('--out-dir', path.join(X, 'hint-api/proposals/2026-10-07-individual-consent'));
const OUT_JSON = path.join(OUT_DIR, 'wf2-consent-hub-status.member-scope.json');
const OUT_DIFF = path.join(OUT_DIR, 'wf2-member-scope.diff');
const LABEL_A = 'a/hint-api/n8n/2-consent-hub-status.json';
const LABEL_B = 'b/hint-api/proposals/2026-10-07-individual-consent/wf2-consent-hub-status.member-scope.json';

// The repo's n8n mirrors are JSON.stringify(obj, null, 2) with every char from U+007F up
// escaped as lowercase \uXXXX, and no trailing newline. Verified below by round-trip.
function serialize(obj) {
  return JSON.stringify(obj, null, 2).replace(/[\u007f-￿]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
}

const repoText = fs.readFileSync(REPO, 'utf8');
const wf = JSON.parse(repoText);
if (serialize(wf) !== repoText) {
  console.error('FATAL: serializer does not reproduce the repo JSON byte-for-byte; refusing to build a diff');
  process.exit(1);
}
const v9 = fs.readFileSync(V9, 'utf8');
if (v9.indexOf('// v9: MEMBER SCOPE') !== 0) { console.error('FATAL: ' + V9 + ' does not start with the v9 header'); process.exit(1); }

// 1. live-roster sync (F-1)
const before = wf.nodes.length;
wf.nodes = wf.nodes.filter(n => n.name !== 'Lookup Member Docs');
if (wf.nodes.length !== before - 1) { console.error('FATAL: expected exactly one Lookup Member Docs node in the repo JSON'); process.exit(1); }
wf.connections['Refetch Member'] = { main: [[{ node: 'Build Status', type: 'main', index: 0 }]] };
delete wf.connections['Lookup Member Docs'];

// 2. Build Status v9
const bs = wf.nodes.filter(n => n.name === 'Build Status');
if (bs.length !== 1) { console.error('FATAL: expected exactly one Build Status node'); process.exit(1); }
bs[0].parameters.jsCode = v9;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_JSON, serialize(wf));

// Unified diff with repo-relative labels (no absolute home path in the output).
const d = spawnSync('diff', ['-u', '--label', LABEL_A, '--label', LABEL_B, REPO, OUT_JSON], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (d.status !== 1) { console.error('FATAL: diff exited ' + d.status + ' (expected 1: files differ)\n' + (d.stderr || '')); process.exit(1); }
if (d.stdout.indexOf('/Users/') !== -1) { console.error('FATAL: diff carries an absolute /Users/ path'); process.exit(1); }
fs.writeFileSync(OUT_DIFF, d.stdout);

console.log('wrote ' + OUT_JSON + ' (' + wf.nodes.length + ' nodes)');
console.log('wrote ' + OUT_DIFF);

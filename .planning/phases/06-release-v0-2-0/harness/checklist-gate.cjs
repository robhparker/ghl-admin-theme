#!/usr/bin/env node
'use strict';
// Phase 6 checklist gate (D-03, SC2). Read-only: it never writes a file.
//
// Usage: node .planning/phases/06-release-v0-2-0/harness/checklist-gate.cjs [--pre-release] [PATH]
//
// PATH defaults to 06-LIVE-CHECKLIST.md one directory above this script. For each of the 44 row
// ids the gate finds the one line that starts `| <id> |` and reads only its last cell, the Result.
// It prints counts and row ids only, never cell text, so it cannot leak what an operator wrote.
//
// Final line (first that applies): ORDER-VIOLATION, FAILED, OPEN, PRE-RELEASE-COMPLETE,
// LIVE-RUN-COMPLETE. Exit 0 only on LIVE-RUN-COMPLETE, or on PRE-RELEASE-COMPLETE with
// --pre-release. A missing or duplicated row prints `MALFORMED <ids>` and exits 2.
//
// PR-01 (moving staff to v0.2.0) needs `--pre-release` exit 0. Phase 6 verification needs the
// default mode to exit 0 (LIVE-RUN-COMPLETE).

const fs = require('fs');
const path = require('path');

function ids(prefix, n) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push(prefix + '-' + String(i).padStart(2, '0'));
  return out;
}

const PRE_IDS = [].concat(ids('P', 7), ids('M', 10), ids('R', 12), ids('H', 8));
const POST_IDS = [].concat(ids('RB', 4), ids('PR', 3));
const ALL_IDS = PRE_IDS.concat(POST_IDS);

function usage(msg) {
  if (msg) console.log('error: ' + msg);
  console.log('usage: node checklist-gate.cjs [--pre-release] [PATH]');
  process.exit(2);
}

let preRelease = false;
let file = null;
for (const arg of process.argv.slice(2)) {
  if (arg === '--pre-release') preRelease = true;
  else if (arg.startsWith('-')) usage('unknown option');
  else if (file === null) file = arg;
  else usage('more than one PATH');
}
if (file === null) file = path.join(__dirname, '..', '06-LIVE-CHECKLIST.md');

let text;
try {
  text = fs.readFileSync(file, 'utf8');
} catch (e) {
  console.log('error: cannot read the checklist');
  process.exit(2);
}

const lines = text.split(/\r?\n/);

// id -> raw Result cell (string), or null when the row is missing, duplicated, or not closed.
const results = {};
const malformed = [];
for (const id of ALL_IDS) {
  const prefix = '| ' + id + ' |';
  const rows = lines.filter((l) => l.startsWith(prefix));
  if (rows.length !== 1) { malformed.push(id); continue; }
  const row = rows[0].trimEnd();
  if (!row.endsWith('|')) { malformed.push(id); continue; }
  const cells = row.split('|').slice(1, -1);
  if (cells.length < 2) { malformed.push(id); continue; }
  results[id] = cells[cells.length - 1].trim();
}
if (malformed.length) {
  console.log('MALFORMED ' + malformed.join(', '));
  process.exit(2);
}

// open | pass | deferred | fail | invalid
function classify(cell) {
  if (cell === '') return 'open';
  const lower = cell.toLowerCase();
  if (lower === 'pass') return 'pass';
  if (lower === 'fail') return 'fail';
  const m = /^deferred:\s*(\S.*)$/i.exec(cell);
  if (m && m[1].trim() !== '<reason>') return 'deferred';
  return 'invalid';
}

const status = {};
for (const id of ALL_IDS) status[id] = classify(results[id]);

function tally(list) {
  const t = { pass: 0, deferred: 0, fail: 0, open: 0, invalid: 0 };
  for (const id of list) t[status[id]]++;
  return t;
}
function line(label, t) {
  return label + ': ' + t.pass + ' pass, ' + t.deferred + ' deferred, ' + t.fail + ' fail, ' +
    t.open + ' open, ' + t.invalid + ' invalid';
}
const byStatus = (s) => ALL_IDS.filter((id) => status[id] === s);

const pre = tally(PRE_IDS);
const post = tally(POST_IDS);
console.log(line('pre-release', pre));
console.log(line('post-release', post));

const open = byStatus('open');
const failed = byStatus('fail');
const invalid = byStatus('invalid');
if (open.length) console.log('open: ' + open.join(', '));
if (failed.length) console.log('fail: ' + failed.join(', '));
if (invalid.length) console.log('invalid: ' + invalid.join(', '));

// Staff moved (PR) or the rollback rehearsed (RB) before the live proof was done.
const preNotDone = pre.open + pre.fail + pre.invalid > 0;
const early = preNotDone ? POST_IDS.filter((id) => status[id] !== 'open') : [];
console.log(early.length ? 'order: violation ' + early.join(', ') : 'order: ok');

let verdict;
if (early.length) verdict = 'ORDER-VIOLATION';
else if (failed.length || invalid.length) verdict = 'FAILED';
else if (pre.open) verdict = 'OPEN';
else if (post.open) verdict = 'PRE-RELEASE-COMPLETE';
else verdict = 'LIVE-RUN-COMPLETE';
console.log(verdict);

const ok = verdict === 'LIVE-RUN-COMPLETE' || (preRelease && verdict === 'PRE-RELEASE-COMPLETE');
process.exit(ok ? 0 : 1);

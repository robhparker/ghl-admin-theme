#!/usr/bin/env node
'use strict';
// scrub-history.cjs: rewrite the unpushed range origin/main..main so no commit carries a
// live-looking Hint patient id in its content or its message (Plan 06-03, D-02).
//
// Usage:
//   node scrub-history.cjs --preview   rewrite origin/main..HEAD onto the local branch scrub/preview
//                                      and run eight checks; main is never touched
//   node scrub-history.cjs --apply     the preview steps, then a local backup branch
//                                      backup/pre-scrub-<YYYYMMDD> at the old tip, then one
//                                      compare-and-swap update-ref of main
//   (internal) --filter-tree           git filter-branch tree filter (cwd is its temporary checkout)
//   (internal) --filter-msg            git filter-branch message filter (stdin -> stdout)
//
// The id mapping is derived from the Plan 06-02 scrub commit, which replaced every live-looking id
// in place with a synthetic EXAMPLE id. The mapping lives only in this process's memory and in the
// GHLC_IDMAP environment of the filter-branch child. It is never printed and never written to a
// file. Output is counts, check names, and shas only.
//
// Git runs through spawnSync with argument arrays. The only shell strings are the two filter
// commands handed to filter-branch, which quote process.execPath and this file's absolute path.
//
// Final line: PREVIEW-OK <old7> -> <new7> | PREVIEW-FAIL <names> | CLEAN: ... |
//             APPLIED <old7> -> <new7> backup=<branch> | APPLIED nothing: ... | APPLY-FAIL <reason> |
//             GUARD-FAIL <name>
// Exit: 0 on PREVIEW-OK, CLEAN, or APPLIED; 1 otherwise; 3 when a filter mode lacks GHLC_IDMAP.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRUB_SUBJECT =
  'chore(06-02): replace live-looking Hint patient ids with synthetic examples before publishing';
const TARGETS = ['pat-EXAMPLEa1B2c', 'pat-EXAMPLEd4E5f', 'pat-EXAMPLEg7H8i'];
// The patient-id rule from prepush-scan.cjs: case-insensitive pat- plus 10 or more letters and
// digits, nothing word-like immediately before; tokens containing EXAMPLE are synthetic.
const PATIENT_ID_RE = /(?<![A-Za-z0-9_])pat-[A-Za-z0-9]{10,}/gi;
const EXAMPLE_RE = /(?<![A-Za-z0-9_])pat-EXAMPLE[A-Za-z0-9]*/g;
const MAX_BUFFER = 1024 * 1024 * 1024;

// ---- shared helpers --------------------------------------------------------------------------
function liveTokens(s) {
  const out = [];
  PATIENT_ID_RE.lastIndex = 0;
  let m;
  while ((m = PATIENT_ID_RE.exec(s)) !== null) {
    if (!m[0].includes('EXAMPLE')) out.push({ tok: m[0], at: m.index });
  }
  return out;
}
function exampleTokens(s) {
  const out = [];
  EXAMPLE_RE.lastIndex = 0;
  let m;
  while ((m = EXAMPLE_RE.exec(s)) !== null) out.push({ tok: m[0], at: m.index });
  return out;
}
function applyMap(s, map) {
  // Longest key first, so a key that prefixes another can never cut it in half.
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  let out = s;
  for (const k of keys) {
    if (out.includes(k)) out = out.split(k).join(map[k]);
  }
  return out;
}
function containsKey(s, map) {
  return Object.keys(map).some((k) => s.includes(k));
}
function readMapFromEnv() {
  const raw = process.env.GHLC_IDMAP;
  if (!raw) process.exit(3);
  let map;
  try { map = JSON.parse(raw); } catch (e) { process.exit(3); }
  if (!map || typeof map !== 'object' || Object.keys(map).length === 0) process.exit(3);
  return map;
}

// ---- internal filter modes (run by git filter-branch) ----------------------------------------
const mode = process.argv[2];
if (mode === '--filter-tree') {
  const map = readMapFromEnv();
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) { walk(p); continue; }
      if (!ent.isFile()) continue;
      const s = fs.readFileSync(p).toString('latin1'); // byte-preserving; keys and values are ASCII
      if (!containsKey(s, map)) continue;
      fs.writeFileSync(p, Buffer.from(applyMap(s, map), 'latin1'));
    }
  };
  walk(process.cwd());
  process.exit(0);
}
if (mode === '--filter-msg') {
  const map = readMapFromEnv();
  const s = fs.readFileSync(0).toString('latin1');
  fs.writeSync(1, Buffer.from(applyMap(s, map), 'latin1'));
  process.exit(0);
}
if (mode !== '--preview' && mode !== '--apply') {
  process.stderr.write('usage: node scrub-history.cjs --preview | --apply\n');
  process.exit(1);
}
const APPLY = mode === '--apply';

// ---- git plumbing ----------------------------------------------------------------------------
const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: __dirname, encoding: 'utf8' });
if (top.status !== 0) { console.log('GUARD-FAIL work-tree'); process.exit(1); }
const ROOT = top.stdout.trim();
const PREPUSH = path.join(__dirname, 'prepush-scan.cjs');

function git(args, opts) {
  return spawnSync('git', ['-c', 'core.quotePath=false'].concat(args), {
    cwd: ROOT, encoding: 'utf8', maxBuffer: MAX_BUFFER, ...(opts || {}),
  });
}
function gitOut(args) {
  const r = git(args);
  if (r.status !== 0) {
    console.log('error: git ' + args[0] + ' exited ' + r.status);
    process.exit(1);
  }
  return r.stdout.trim();
}
function revParse(rev) {
  const r = git(['rev-parse', '--verify', '--quiet', rev]);
  return r.status === 0 ? r.stdout.trim() : null;
}
function revList(range) {
  const out = gitOut(['rev-list', '--reverse', range, '--']);
  return out ? out.split('\n') : [];
}
// Read many objects through one `git cat-file --batch` process. Returns Map sha -> Buffer.
function catBatch(shas) {
  const uniq = Array.from(new Set(shas));
  const res = new Map();
  if (uniq.length === 0) return res;
  const r = spawnSync('git', ['cat-file', '--batch'], {
    cwd: ROOT, input: uniq.join('\n') + '\n', maxBuffer: MAX_BUFFER,
  });
  if (r.status !== 0) { console.log('error: git cat-file exited ' + r.status); process.exit(1); }
  const buf = r.stdout;
  let pos = 0;
  for (let i = 0; i < uniq.length; i++) {
    const nl = buf.indexOf(0x0a, pos);
    const header = buf.subarray(pos, nl).toString('latin1');
    const parts = header.split(' ');
    if (parts.length !== 3) { console.log('error: cat-file object missing'); process.exit(1); }
    const size = Number(parts[2]);
    res.set(parts[0], buf.subarray(nl + 1, nl + 1 + size));
    pos = nl + 1 + size + 1;
  }
  return res;
}
// Full tree listing of a commit: Map path -> { mode, type, sha }
function lsTree(commit) {
  const out = git(['ls-tree', '-r', '-z', '--full-tree', commit]);
  if (out.status !== 0) { console.log('error: git ls-tree exited ' + out.status); process.exit(1); }
  const m = new Map();
  for (const rec of out.stdout.split('\0')) {
    if (!rec) continue;
    const tab = rec.indexOf('\t');
    const [md, type, sha] = rec.slice(0, tab).split(' ');
    m.set(rec.slice(tab + 1), { mode: md, type, sha });
  }
  return m;
}
function commitParts(raw) {
  const s = raw.toString('latin1');
  const cut = s.indexOf('\n\n');
  const header = cut < 0 ? s : s.slice(0, cut);
  const message = cut < 0 ? '' : s.slice(cut + 2);
  const lines = header.split('\n');
  const get = (k) => lines.filter((l) => l.startsWith(k + ' ')).join('\n');
  return { author: get('author'), committer: get('committer'), message };
}
function runPrepush(range) {
  const args = [PREPUSH, '--history'];
  if (range) args.push(range);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  const lines = (r.stdout || '').split('\n');
  return r.status === 0 && lines.some((l) => l.startsWith('ok - history-patient-id: none in'));
}
const short = (sha) => sha.slice(0, 7);

// Scan the messages and every blob in every tree of a list of commits. Returns the set of
// distinct live-looking ids (kept in memory only) and the number of objects holding one.
function sweep(commitShas) {
  const ids = new Set();
  let objects = 0;
  const raws = catBatch(commitShas);
  for (const c of commitShas) {
    const toks = liveTokens(commitParts(raws.get(c)).message);
    if (toks.length) objects += 1;
    for (const t of toks) ids.add(t.tok);
  }
  const blobs = [];
  for (const c of commitShas) {
    for (const e of lsTree(c).values()) if (e.type === 'blob') blobs.push(e.sha);
  }
  const contents = catBatch(blobs);
  for (const buf of contents.values()) {
    const toks = liveTokens(buf.toString('latin1'));
    if (toks.length) objects += 1;
    for (const t of toks) ids.add(t.tok);
  }
  return { ids, objects };
}

// ---- 1. guards -------------------------------------------------------------------------------
function guard(name, ok) {
  if (!ok) { console.log('GUARD-FAIL ' + name); process.exit(1); }
}
guard('head-is-main', git(['symbolic-ref', '--quiet', '--short', 'HEAD']).stdout.trim() === 'main');
guard('primary-checkout',
  gitOut(['rev-parse', '--path-format=absolute', '--git-dir']) ===
  gitOut(['rev-parse', '--path-format=absolute', '--git-common-dir']));
guard('one-worktree',
  gitOut(['worktree', 'list', '--porcelain']).split('\n').filter((l) => l.startsWith('worktree ')).length === 1);
guard('clean-tree', gitOut(['status', '--porcelain', '--untracked-files=no']) === '');
const ORIGIN = revParse('refs/remotes/origin/main^{commit}');
guard('origin-main', ORIGIN !== null);
const OLD_HEAD = revParse('HEAD^{commit}');
guard('origin-ancestor', git(['merge-base', '--is-ancestor', ORIGIN, OLD_HEAD]).status === 0);
guard('no-merges', gitOut(['rev-list', '--merges', '--count', ORIGIN + '..' + OLD_HEAD]) === '0');

const oldList = revList(ORIGIN + '..' + OLD_HEAD);

// ---- 2. coverage -----------------------------------------------------------------------------
const before = sweep(oldList);
if (before.ids.size === 0) {
  if (APPLY) console.log('APPLIED nothing: history already clean');
  else console.log('CLEAN: no live-looking patient id in ' + oldList.length + ' commits');
  process.exit(0);
}
let BACKUP = null;
if (APPLY) {
  if (gitOut(['for-each-ref', '--format=%(refname)', 'refs/heads/backup/pre-scrub-*']) !== '') {
    console.log('APPLY-FAIL backup exists');
    process.exit(1);
  }
  const d = new Date();
  const ymd = String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  BACKUP = 'backup/pre-scrub-' + ymd;
}

// ---- 3. mapping from the 06-02 scrub diff ----------------------------------------------------
function mappingFail(reason) {
  console.log('mapping: FAIL ' + reason);
  console.log(APPLY ? 'APPLY-FAIL mapping' : 'PREVIEW-FAIL mapping');
  process.exit(1);
}
const scrubCommits = gitOut(['log', '--format=%H%x00%s', ORIGIN + '..' + OLD_HEAD])
  .split('\n').filter(Boolean).map((l) => l.split('\0')).filter((p) => p[1] === SCRUB_SUBJECT);
if (scrubCommits.length !== 1) mappingFail(scrubCommits.length + ' scrub commits in range');
const show = git(['show', '--format=', '--unified=0', '--no-color', '--no-ext-diff', '--no-renames',
  scrubCommits[0][0]], { encoding: 'latin1' });
if (show.status !== 0) mappingFail('git show exited ' + show.status);
const hunks = [];
let hunk = null;
for (const line of show.stdout.split('\n')) {
  if (line.startsWith('diff --git ')) { hunk = null; continue; }
  if (line.startsWith('@@')) { hunk = { rem: [], add: [] }; hunks.push(hunk); continue; }
  if (!hunk) continue;
  if (line.startsWith('-')) hunk.rem.push(line.slice(1));
  else if (line.startsWith('+')) hunk.add.push(line.slice(1));
}
const MAP = {};
const REV = {};
let pairs = 0;
hunks.forEach((h, hi) => {
  if (h.rem.length !== h.add.length) mappingFail('hunk ' + (hi + 1) + ' removes ' + h.rem.length + ' and adds ' + h.add.length + ' lines');
  for (let i = 0; i < h.rem.length; i++) {
    const live = liveTokens(h.rem[i]);
    // EXAMPLE tokens that are new on the added line (any already on the removed line are not
    // replacements and are taken out first, by value).
    const pre = exampleTokens(h.rem[i]).map((t) => t.tok);
    const added = exampleTokens(h.add[i]).filter((t) => {
      const j = pre.indexOf(t.tok);
      if (j >= 0) { pre.splice(j, 1); return false; }
      return true;
    });
    if (live.length !== added.length) mappingFail('hunk ' + (hi + 1) + ' line ' + (i + 1) + ': ' + live.length + ' ids vs ' + added.length + ' examples');
    for (let k = 0; k < live.length; k++) {
      const key = live[k].tok;
      const val = added[k].tok;
      if (live[k].at !== added[k].at) mappingFail('hunk ' + (hi + 1) + ' line ' + (i + 1) + ': offsets differ');
      if (MAP[key] !== undefined && MAP[key] !== val) mappingFail('one id maps to two examples');
      if (REV[val] !== undefined && REV[val] !== key) mappingFail('two ids map to one example');
      MAP[key] = val;
      REV[val] = key;
      pairs += 1;
    }
  }
});
const keys = Object.keys(MAP);
if (keys.length !== 3) mappingFail(keys.length + ' keys');
if (Object.values(MAP).slice().sort().join(',') !== TARGETS.slice().sort().join(',')) mappingFail('values are not the three EXAMPLE targets');
console.log('mapping: 3 pairs');
let unmapped = 0;
for (const id of before.ids) if (!Object.prototype.hasOwnProperty.call(MAP, id)) unmapped += 1;
if (unmapped > 0) {
  console.log('coverage: ' + unmapped + ' unmapped ids');
  console.log(APPLY ? 'APPLY-FAIL coverage' : 'PREVIEW-FAIL coverage');
  process.exit(1);
}
console.log('coverage: ' + before.ids.size + ' distinct ids in ' + oldList.length + ' commits, all mapped');

// ---- 4. build scrub/preview with git filter-branch -------------------------------------------
const q = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
gitOut(['branch', '-f', 'scrub/preview', OLD_HEAD]);
const tmpParent = fs.mkdtempSync(path.join(os.tmpdir(), 'ghlc-scrub-'));
const fbDir = path.join(tmpParent, 'fb');
const fb = spawnSync('git', ['filter-branch', '-f', '-d', fbDir,
  '--tree-filter', q(process.execPath) + ' ' + q(__filename) + ' --filter-tree',
  '--msg-filter', q(process.execPath) + ' ' + q(__filename) + ' --filter-msg',
  '--', ORIGIN + '..scrub/preview'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: MAX_BUFFER,
  env: Object.assign({}, process.env, {
    FILTER_BRANCH_SQUELCH_WARNING: '1',
    GHLC_IDMAP: JSON.stringify(MAP),
  }),
});
try { fs.rmSync(tmpParent, { recursive: true, force: true }); } catch (e) { /* best effort */ }
if (fb.status !== 0) {
  console.log('build: filter-branch exited ' + fb.status);
  console.log(APPLY ? 'APPLY-FAIL build' : 'PREVIEW-FAIL build');
  process.exit(1);
}
const NEW_TIP = revParse('refs/heads/scrub/preview^{commit}');
const newList = revList(ORIGIN + '..' + NEW_TIP);

// ---- 5. eight checks -------------------------------------------------------------------------
const failed = [];
function check(name, detail) {
  if (detail === null) console.log('check - ' + name + ': ok');
  else { console.log('check - ' + name + ': FAIL ' + detail); failed.push(name); }
}
const n = Math.min(oldList.length, newList.length);

// ancestor
(function () {
  if (git(['merge-base', '--is-ancestor', ORIGIN, NEW_TIP]).status !== 0) return check('ancestor', 'origin/main is not an ancestor of scrub/preview');
  if (n === 0) return check('ancestor', 'empty range');
  if (revParse(newList[0] + '^') !== revParse(oldList[0] + '^')) return check('ancestor', 'first rewritten commit has a new parent');
  check('ancestor', null);
})();
// count
(function () {
  if (oldList.length !== newList.length) return check('count', oldList.length + ' old vs ' + newList.length + ' new commits');
  if (gitOut(['rev-list', '--merges', '--count', ORIGIN + '..' + NEW_TIP]) !== '0') return check('count', 'merge commit in rewritten range');
  check('count', null);
})();
// tip-tree
check('tip-tree', revParse(NEW_TIP + '^{tree}') === revParse(OLD_HEAD + '^{tree}') ? null : 'tip trees differ');

const oldRaw = catBatch(oldList);
const newRaw = catBatch(newList);
// metadata
(function () {
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const a = commitParts(oldRaw.get(oldList[i]));
    const b = commitParts(newRaw.get(newList[i]));
    if (a.author !== b.author || a.committer !== b.committer) bad += 1;
  }
  check('metadata', bad === 0 ? null : bad + ' commits with changed author or committer');
})();
// scope
let contentChanged = 0;
let messagesChanged = 0;
(function () {
  const problems = [];
  for (let i = 0; i < n; i++) {
    const o = oldList[i];
    const w = newList[i];
    const a = commitParts(oldRaw.get(o));
    const b = commitParts(newRaw.get(w));
    if (a.message !== b.message) messagesChanged += 1;
    if (applyMap(a.message, MAP) !== b.message) problems.push(short(w) + ' message');
    const d = git(['diff', '--name-only', '--no-renames', '-z', o, w]);
    if (d.status !== 0) { problems.push(short(w) + ' diff'); continue; }
    const paths = d.stdout.split('\0').filter(Boolean);
    if (paths.length === 0) continue;
    contentChanged += 1;
    const ot = lsTree(o);
    const nt = lsTree(w);
    const want = [];
    for (const p of paths) {
      const oe = ot.get(p);
      const ne = nt.get(p);
      if (!oe || !ne || oe.type !== 'blob' || ne.type !== 'blob' || oe.mode !== ne.mode) {
        problems.push(short(w) + ' path added, removed, or retyped');
        continue;
      }
      want.push([oe.sha, ne.sha]);
    }
    const blobs = catBatch(want.flat());
    for (const [os_, ns] of want) {
      const oldText = blobs.get(os_).toString('latin1');
      const newText = blobs.get(ns).toString('latin1');
      if (!containsKey(oldText, MAP)) { problems.push(short(w) + ' blob changed without an id'); continue; }
      if (applyMap(oldText, MAP) !== newText) problems.push(short(w) + ' blob changed beyond the mapping');
    }
  }
  check('scope', problems.length === 0 ? null : problems.length + ' problems (' + problems.slice(0, 5).join('; ') + ')');
})();
// blob-sweep
(function () {
  const after = sweep(newList);
  check('blob-sweep', after.ids.size === 0 ? null : after.objects + ' objects still hold a live-looking id');
})();
// scan
check('scan', runPrepush('origin/main..scrub/preview') ? null : 'prepush-scan --history did not pass on the preview range');
// origin-untouched
(function () {
  if (revParse('refs/remotes/origin/main') !== ORIGIN) return check('origin-untouched', 'origin/main moved');
  if (revParse('refs/heads/main') !== OLD_HEAD) return check('origin-untouched', 'main moved');
  check('origin-untouched', null);
})();

console.log('rewritten: ' + contentChanged + ' commits with content changes, ' + messagesChanged + ' messages changed');
if (failed.length > 0) {
  console.log('PREVIEW-FAIL ' + failed.join(' '));
  process.exit(1);
}
if (!APPLY) {
  console.log('PREVIEW-OK ' + short(OLD_HEAD) + ' -> ' + short(NEW_TIP));
  process.exit(0);
}

// ---- apply: backup branch, then one compare-and-swap of main ---------------------------------
if (git(['branch', BACKUP, OLD_HEAD]).status !== 0) {
  console.log('APPLY-FAIL backup create');
  process.exit(1);
}
const swap = git(['update-ref', '-m', '06-03 history scrub', 'refs/heads/main', NEW_TIP, OLD_HEAD]);
if (swap.status !== 0) {
  git(['update-ref', '-d', 'refs/heads/' + BACKUP, OLD_HEAD]);
  console.log('APPLY-FAIL main moved');
  process.exit(1);
}
const restore = 'git update-ref refs/heads/main ' + OLD_HEAD + ' ' + NEW_TIP;
function postFail(name) {
  console.log('APPLY-FAIL post-' + name);
  console.log('restore: ' + restore);
  process.exit(1);
}
const statusAfter = git(['status', '--porcelain', '--untracked-files=no']);
if (statusAfter.status !== 0 || statusAfter.stdout.trim() !== '') {
  console.log('check - post-clean: FAIL tracked tree differs from the new main');
  postFail('clean');
}
console.log('check - post-clean: ok');
if (!runPrepush(null)) {
  console.log('check - post-scan: FAIL prepush-scan --history did not pass on main');
  postFail('scan');
}
console.log('check - post-scan: ok');
git(['update-ref', '-d', 'refs/heads/scrub/preview', NEW_TIP]);
git(['update-ref', '-d', 'refs/original/refs/heads/scrub/preview']);
for (let i = 0; i < n; i++) console.log('map ' + short(oldList[i]) + ' ' + short(newList[i]));
console.log('APPLIED ' + short(OLD_HEAD) + ' -> ' + short(NEW_TIP) + ' backup=' + BACKUP);
process.exit(0);

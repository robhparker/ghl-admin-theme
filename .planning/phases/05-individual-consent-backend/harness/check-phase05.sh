#!/usr/bin/env bash
# check-phase05.sh: Phase 5 (individual consent backend) end gate.
#
# Proves, for the whole phase:
#   (1) every canonical deliverable in the xcelsior repo is byte-identical to its admin-theme mirror
#   (2) the mirror dir holds exactly the expected files (no strays, none missing)
#   (3) the xcelsior repo has no staged, committed, or tracked-modified file from this phase
#   (4) all three phase harnesses pass
#   (5) no deliverable carries a live-looking PIT (pit- plus 8 hex)
#   (6) the proposal README has its ten H2s in order, the required strings, every file name, a
#       Build Status v9 paste block equal to the JSON Build Status jsCode, a v8->v9 diff block equal
#       to a fresh diff, and (code review CR-03) the negative token live checks, also in COMPLETION-PATH
#
# Read-only: runs no git write command anywhere. Never stops at the first failure.
# Prints "ok - ..." / "not ok - ...: reason" lines, then "PASS n/n" or "FAIL k/n"; exit 0 only on PASS.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
PHASE="$ROOT/.planning/phases/05-individual-consent-backend"
H="$PHASE/harness"
M="$PHASE/deliverables"
X=/Users/rhparker/Repos/clients/xcelsior
PROP_REL=hint-api/proposals/2026-10-07-individual-consent
EMAIL_REL=Email-Templates/Consent-Hub-Invite
PROP="$X/$PROP_REL"
EMAIL="$X/$EMAIL_REL"

# canonical path -> mirror name
CANON=(
  "$PROP/BUILD-SPEC-clinx-consent-webhook.md"
  "$PROP/wf2-consent-hub-status.member-scope.json"
  "$PROP/wf2-member-scope.diff"
  "$PROP/COMPLETION-PATH.md"
  "$PROP/README.md"
  "$EMAIL/consent-forms-member.mjml"
  "$EMAIL/consent-forms-member.html"
)

TOTAL=0
FAILED=0
ok()    { TOTAL=$((TOTAL + 1)); echo "ok - $1"; }
notok() { TOTAL=$((TOTAL + 1)); FAILED=$((FAILED + 1)); echo "not ok - $1: $2"; }

# ---- (1) mirrors ---------------------------------------------------------------------------
for f in "${CANON[@]}"; do
  name="$(basename "$f")"
  if [ ! -f "$f" ]; then notok "mirror: $name" "canonical missing ($f)"
  elif [ ! -f "$M/$name" ]; then notok "mirror: $name" "mirror missing"
  elif cmp -s "$f" "$M/$name"; then ok "mirror: $name byte-identical"
  else notok "mirror: $name" "differs from $M/$name"
  fi
done
HUB_C=0; HUB_M=0
[ -f "$PROP/hub-page.diff" ] && HUB_C=1
[ -f "$M/hub-page.diff" ] && HUB_M=1
if [ "$HUB_C" = 0 ] && [ "$HUB_M" = 0 ]; then ok "mirror: hub-page.diff absent in both (D-11 no change)"
elif [ "$HUB_C" = 1 ] && [ "$HUB_M" = 1 ] && cmp -s "$PROP/hub-page.diff" "$M/hub-page.diff"; then ok "mirror: hub-page.diff byte-identical"
else notok "mirror: hub-page.diff" "present in only one place, or differs (canonical=$HUB_C mirror=$HUB_M)"
fi

# ---- (2) exact mirror set ------------------------------------------------------------------
EXPECTED="$(for f in "${CANON[@]}"; do basename "$f"; done; [ "$HUB_C" = 1 ] && echo hub-page.diff)"
EXPECTED="$(printf '%s\n' "$EXPECTED" | sort)"
ACTUAL="$(cd "$M" && find . -mindepth 1 -maxdepth 1 | sed 's|^\./||' | sort)"
if [ "$EXPECTED" = "$ACTUAL" ]; then ok "mirror set: deliverables/ holds exactly the $(printf '%s\n' "$EXPECTED" | wc -l | tr -d ' ') expected files"
else notok "mirror set" "expected [$(echo $EXPECTED)] got [$(echo $ACTUAL)]"
fi

# ---- (3) xcelsior git safety (read-only queries) -------------------------------------------
TRACKED="$(git -C "$X" diff --name-only -- hint-api Email-Templates 2>&1)"
STAGED="$(git -C "$X" diff --cached --name-only -- hint-api Email-Templates 2>&1)"
if [ -z "$TRACKED" ]; then ok "xcelsior: no tracked modification under hint-api/ or Email-Templates/"
else notok "xcelsior: tracked modification" "$(echo $TRACKED)"; fi
if [ -z "$STAGED" ]; then ok "xcelsior: nothing staged under hint-api/ or Email-Templates/"
else notok "xcelsior: staged" "$(echo $STAGED)"; fi
# Real history only (local branches, tags, remotes). Tool snapshot refs such as
# refs/t3/checkpoints/* (working-tree snapshots a GUI client takes per turn) are not commits
# on any branch and are deliberately excluded.
LOG="$(git -C "$X" log --branches --tags --remotes --oneline -- "$PROP_REL" "$EMAIL_REL/consent-forms-member.mjml" "$EMAIL_REL/consent-forms-member.html" 2>&1)"
if [ -z "$LOG" ]; then ok "xcelsior: no commit touches the proposal folder or the member email files"
else notok "xcelsior: commits found" "$(echo "$LOG" | head -3 | tr '\n' ';')"; fi
STATUS="$(git -C "$X" status --porcelain --untracked-files=all -- "$PROP_REL" "$EMAIL_REL/consent-forms-member.mjml" "$EMAIL_REL/consent-forms-member.html" 2>&1)"
BAD="$(printf '%s\n' "$STATUS" | grep -v '^?? ' | grep -v '^$' || true)"
NSTAT="$(printf '%s\n' "$STATUS" | grep -c '^?? ' || true)"
if [ -z "$BAD" ] && [ "$NSTAT" -ge 7 ]; then ok "xcelsior: all $NSTAT phase paths are untracked (?? only)"
else notok "xcelsior: status" "non-?? lines [$(echo $BAD)] or too few untracked paths ($NSTAT)"; fi

# ---- (4) harnesses -------------------------------------------------------------------------
run_harness() {
  local label="$1"; shift
  local out last
  out="$(cd "$ROOT" && "$@" 2>/dev/null)"
  last="$(printf '%s\n' "$out" | tail -1)"
  case "$last" in
    PASS*) ok "harness: $label ends $last" ;;
    *) notok "harness: $label" "last line '$last'" ;;
  esac
}
run_harness "wf2-member-scope.harness.cjs" node "$H/wf2-member-scope.harness.cjs"
run_harness "spec-check.cjs --stage 3" node "$H/spec-check.cjs" --stage 3
run_harness "email-check.cjs" node "$H/email-check.cjs"

# ---- (5) no live-looking token -------------------------------------------------------------
HITS="$(grep -lE 'pit-[0-9a-fA-F]{8}' "${CANON[@]}" "$M"/* 2>/dev/null || true)"
if [ -z "$HITS" ]; then ok "secrets: no pit- plus 8 hex in any deliverable or mirror"
else notok "secrets" "pit- token pattern in $(echo $HITS)"; fi

# ---- (6) README structure and paste block --------------------------------------------------
# The node program is written to a temp file first: bash 3.2 (macOS) mis-parses a quoted heredoc
# containing backticks inside $(...).
NODE_JS="$(mktemp -t check-phase05)"
trap 'rm -f "$NODE_JS"' EXIT
cat > "$NODE_JS" <<'NODE'
const fs = require('fs');
const [readmePath, jsonPath, v8Path, v9Path, completionPath] = process.argv.slice(2);
const out = [];
let r;
try { r = fs.readFileSync(readmePath, 'utf8'); } catch (e) { console.log('not ok - readme: cannot read: ' + e.message); process.exit(0); }
const H2 = [
  '## Files',
  '## Read first: the repo wf2 mirror is stale (F-1)',
  '## Apply order',
  '## wf2 change, node by node',
  '## Build Status v9 (paste into the live Build Status node)',
  '## Hub page: no change (D-11)',
  '## Token checks (adhoc_)',
  '## Rollback',
  '## Phase 6 live checks',
  '## Open questions and follow-ups for Rob',
];
// H2s outside fenced code blocks only
let inFence = false; const found = [];
for (const line of r.split('\n')) {
  if (/^```/.test(line)) { inFence = !inFence; continue; }
  if (!inFence && /^## /.test(line)) found.push(line);
}
out.push(JSON.stringify(found) === JSON.stringify(H2)
  ? 'ok - readme: the ten H2s in order, no others'
  : 'not ok - readme: H2s: got ' + JSON.stringify(found));

const req = ['n8n changes do not ship until you click Publish', 'dbe383be-ac63-433a-af8e-5564d948aec9', '// v8: PART-1 PREFILL',
  'Lookup Member Docs', 'adhoc_', 'Q-1', 'Q-2', 'Q-3', 'Q-4'];
const miss = req.filter((s) => !r.includes(s));
out.push(miss.length ? 'not ok - readme: required strings: missing ' + JSON.stringify(miss) : 'ok - readme: required strings present (Publish, versionId, v8 header, Lookup Member Docs, adhoc_, Q-1..Q-4)');

const files = ['BUILD-SPEC-clinx-consent-webhook.md', 'wf2-consent-hub-status.member-scope.json', 'wf2-member-scope.diff', 'COMPLETION-PATH.md',
  'README.md', 'consent-forms-member.mjml', 'consent-forms-member.html'];
const fmiss = files.filter((s) => !r.includes(s));
out.push(fmiss.length ? 'not ok - readme: file index: missing ' + JSON.stringify(fmiss) : 'ok - readme: indexes every deliverable file name');

// Rollback order: Draft before adhoc_ clearing before the v8 re-paste
const rb = r.slice(r.indexOf('## Rollback'), r.indexOf('## Phase 6 live checks'));
const iDraft = rb.indexOf('to Draft'), iClear = rb.indexOf('clear member `adhoc_` tokens'), iV8 = rb.indexOf('build-status-v8-PROPOSED.js');
out.push(iDraft >= 0 && iClear > iDraft && iV8 > iClear && rb.includes('n8n changes do not ship until you click Publish')
  ? 'ok - readme: rollback order Draft -> clear adhoc_ -> v8 + Publish'
  : 'not ok - readme: rollback order: Draft@' + iDraft + ' clear@' + iClear + ' v8@' + iV8);

const m = r.match(/\n<!-- build-status-v9:start -->\n```js\n([\s\S]*?)\n```\n<!-- build-status-v9:end -->\n/);
let code = null;
try { code = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).nodes.find((n) => n.name === 'Build Status').parameters.jsCode; } catch (e) { code = null; }
if (!m) out.push('not ok - readme: paste block: markers or js fence not found');
else if (code === null) out.push('not ok - readme: paste block: cannot read Build Status jsCode from the JSON');
else out.push(m[1].replace(/\n+$/, '') === code.replace(/\n+$/, '')
  ? 'ok - readme: v9 paste block equals the JSON Build Status jsCode'
  : 'not ok - readme: paste block differs from the JSON Build Status jsCode');
// The README v8->v9 diff block must equal a fresh `diff -u` of the live v8 file against v9.
const { spawnSync } = require('child_process');
const dm = r.match(/\n```diff\n([\s\S]*?)\n```\n/);
const fresh = spawnSync('diff', ['-u', '--label', 'a/build-status-v8-live.js', '--label', 'b/build-status-v9-member-scope.js', v8Path, v9Path], { encoding: 'utf8' });
if (!dm) out.push('not ok - readme: diff block: not found');
else if (fresh.status !== 1) out.push('not ok - readme: diff block: diff exited ' + fresh.status);
else out.push(dm[1].replace(/\n+$/, '') === fresh.stdout.replace(/\n+$/, '')
  ? 'ok - readme: v8->v9 diff block equals a fresh diff of the v8 file against build-status-v9.js'
  : 'not ok - readme: diff block: differs from a fresh diff -u v8 v9');

// Code review CR-03: the negative live checks are written down for Phase 6 in both documents.
let cp = '';
try { cp = fs.readFileSync(completionPath, 'utf8'); } catch (e) { cp = ''; }
const neg = ['?t=adhoc`', '?t=adhoc_`', 'last character removed', 'one character changed'];
const nmiss = [['README', r], ['COMPLETION-PATH', cp]].flatMap(([label, t]) => neg.filter((x) => !t.includes(x)).map((x) => label + ' ' + x));
out.push(nmiss.length ? 'not ok - readme: negative token live checks: missing ' + JSON.stringify(nmiss)
  : 'ok - readme: negative token live checks (?t=adhoc, ?t=adhoc_, truncated, changed) in README and COMPLETION-PATH');
console.log(out.join('\n'));
NODE
README_OUT="$(node "$NODE_JS" "$PROP/README.md" "$PROP/wf2-consent-hub-status.member-scope.json" "$X/hint-api/proposals/2026-08-11-part1-prefill/build-status-v8-PROPOSED.js" "$H/build-status-v9.js" "$PROP/COMPLETION-PATH.md")"
while IFS= read -r line; do
  [ -z "$line" ] && continue
  case "$line" in
    "ok - "*) ok "${line#ok - }" ;;
    "not ok - "*) rest="${line#not ok - }"; notok "${rest%%: *}" "${rest#*: }" ;;
    *) notok "readme" "unexpected output '$line'" ;;
  esac
done <<< "$README_OUT"

if [ "$FAILED" -eq 0 ]; then echo "PASS $TOTAL/$TOTAL"; exit 0; fi
echo "FAIL $FAILED/$TOTAL"; exit 1

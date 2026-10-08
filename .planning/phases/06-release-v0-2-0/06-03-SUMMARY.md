---
phase: 06-release-v0-2-0
plan: 03
subsystem: release
tags: [release, privacy, history-rewrite, patient-id, filter-branch]

requires:
  - phase: 06-release-v0-2-0
    provides: 06-02 prepush-scan.cjs (the --history gate) and the scrub commit whose diff supplies the id mapping
provides:
  - harness/scrub-history.cjs, the history scrub driver (--preview with eight checks, --apply with backup branch and compare-and-swap)
  - A rewritten origin/main..main with no live-looking patient id in any content or message (prepush-scan --history PASS 7/7)
  - Local branch backup/pre-scrub-20261008 at the pre-rewrite tip (never pushed)
  - The full old-to-new sha map for the 76 unpushed commits
affects: [06-04, 06-05, phase-6-verification]

actuals:
  tokens: 5100
  tasks: 2
  commits: 1
plan_head_before: 3007767072ff08bc26229157b2ee7dfe655aa2fc

tech-stack:
  added: []
  patterns:
    - "History rewrite: preview on a scratch branch with eight independent checks, local backup branch, then one compare-and-swap update-ref; the mapping travels only in memory and in a child environment variable"

key-files:
  created:
    - .planning/phases/06-release-v0-2-0/harness/scrub-history.cjs
  modified: []

key-decisions:
  - "Mapping pairs a live id with the new EXAMPLE token on the same changed line by order, and also requires the same character offset (the 06-02 scrub kept offsets), so a mis-pairing fails loudly"
  - "The rewrite range is anchored on the origin/main sha captured at start; filter-branch is given that sha as the negative end, so origin/main cannot shift the range mid-run"
  - "The commit ledger was re-anchored from ee6c052 to its rewritten equivalent 3007767 (same subject, same tree), so the measured commit count stays on the same instrument"

patterns-established:
  - "Scope proof for a content rewrite: every changed blob must equal its original with the mapping applied, every message must equal its original with the mapping applied, and the tip tree must be identical"

requirements-completed: [REL-02]

coverage:
  - id: D1
    description: "scrub-history.cjs --preview proves the rewrite on scrub/preview: mapping 3 pairs, coverage 3 distinct ids in 76 commits all mapped, eight checks ok (ancestor, count, tip-tree, metadata, scope, blob-sweep, scan, origin-untouched), PREVIEW-OK f419f61 -> ac1f69d, main untouched, no id printed"
    requirement: REL-02
    verification:
      - kind: other
        ref: "Task 1 verify -> T1-VERIFY-OK (node .planning/phases/06-release-v0-2-0/harness/scrub-history.cjs --preview; main still FAIL 1/7, scrub/preview PASS 7/7)"
        status: pass
    human_judgment: false
  - id: D2
    description: "--apply: backup/pre-scrub-20261008 created at f419f61, main moved by compare-and-swap to ac1f69d, post-clean and post-scan ok, scratch refs removed, origin/main and tags untouched, nothing pushed"
    requirement: REL-02
    verification:
      - kind: other
        ref: "Task 2 verify 1 -> HISTORY-REWRITTEN-LOCAL-ONLY"
        status: pass
    human_judgment: false
  - id: D3
    description: "Publication gate passes on main (prepush-scan --history PASS 7/7, ok - history-patient-id: none in 76 commits); driver reports CLEAN; suite PASS 165/165, spec-check stage 3 PASS 46/46, check-phase05 PASS 24/24"
    requirement: REL-02
    verification:
      - kind: unit
        ref: "Task 2 verify 2 -> T2-V2-OK (prepush-scan --history, scrub-history --preview CLEAN, npm test, spec-check.cjs --stage 3, check-phase05.sh)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-08
status: complete
---

# Phase 6 Plan 03: History scrub of the unpushed range Summary

**Every unpushed commit is now free of live-looking Hint patient ids in its content and its message. `scrub-history.cjs` took the mapping from the 06-02 scrub diff and rewrote origin/main..main with `git filter-branch` on a scratch branch. All eight checks passed there before one compare-and-swap moved main from `f419f61` to `ac1f69d`. The tip tree, authors, dates, and commit count are unchanged. `prepush-scan.cjs --history` now ends `PASS 7/7`. The pre-rewrite history is kept on the local branch `backup/pre-scrub-20261008`, which is never pushed. No tag was created and nothing was pushed.**

## Performance

- **Duration:** about 5 min
- **Started:** 2026-10-08T15:58:42Z
- **Completed:** 2026-10-08T16:03:24Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- **Driver** (`harness/scrub-history.cjs`, CommonJS, Node built-ins only). Git runs only through `spawnSync` argument arrays. The only shell strings are the two filter commands, which quote `process.execPath` and the driver path.
  - Guards: HEAD on main, primary checkout, one worktree, clean tracked tree, origin/main an ancestor, no merges.
  - Coverage: one `git cat-file --batch` pass over every message and every blob in the range's trees, deduplicated.
  - Mapping: taken from the scrub commit's `--unified=0` diff. Lines pair by position within a hunk, and tokens pair by order with equal character offsets. The mapping must be one-to-one, with exactly 3 keys whose values are exactly the three EXAMPLE targets.
  - Build: `git filter-branch` with tree and message filters onto `scrub/preview`. Its `-d` directory sits in a fresh temp dir outside the repository.
  - Checks: eight independent checks run before main can move.
- **Rewrite applied:** 76 commits paired. 39 commits changed content, because the ids persisted in later trees until the 06-02 scrub, and 1 message changed. The first 33 commits in the range kept their original shas, because filter-branch produced byte-identical commits for them.
- **Re-run is safe:** after the rewrite, `--preview` prints `CLEAN: no live-looking patient id in 76 commits`, and `--apply` prints `APPLIED nothing: history already clean` (exit 0).

## Refs and Restore

| Item | Value |
|------|-------|
| Backup branch (local only) | `backup/pre-scrub-20261008` |
| Pre-rewrite tip | `f419f61542762a3d3722434965d95f34fbbccb77` |
| New tip (rewritten main) | `ac1f69dba97db013d3523b1d23be1a92d837d601` |
| origin/main (unchanged, local and remote) | `90c32eac84ac23502e785a92a445df41b8747f12` |
| Tags (unchanged) | v0.1.0, v0.1.1, v0.1.2 (v0.1.2 = b395107) |

**Restore command** (works while the backup exists; it is a compare-and-swap. If commits were added on top of ac1f69d, the third argument must be the current main sha, and those commits are dropped):

```
git update-ref refs/heads/main f419f61542762a3d3722434965d95f34fbbccb77 ac1f69dba97db013d3523b1d23be1a92d837d601
```

**WARNING:** `backup/pre-scrub-20261008` and the 22 `refs/t3/checkpoints/*` refs still point at pre-rewrite commits, so they still hold the original ids. They must never be pushed. Never use `git push --all` or `--mirror`. `git push origin main --tags` (Plan 06-05) sends neither: it pushes only main and the tags, and no tag points into the pre-rewrite range. Rob deletes the backup himself once v0.2.0 is verified. This plan did not delete it, expire reflogs, or run gc.

## Check Lines

Preview (Task 1) and apply (Task 2) printed the same lines:

```
mapping: 3 pairs
coverage: 3 distinct ids in 76 commits, all mapped
check - ancestor: ok
check - count: ok
check - tip-tree: ok
check - metadata: ok
check - scope: ok
check - blob-sweep: ok
check - scan: ok
check - origin-untouched: ok
rewritten: 39 commits with content changes, 1 messages changed
check - post-clean: ok
check - post-scan: ok
APPLIED f419f61 -> ac1f69d backup=backup/pre-scrub-20261008
```

History gate on the rewritten main (`prepush-scan.cjs --history`, exit 0):

```
ok - history-patient-id: none in 76 commits
PASS 7/7
```

Baselines on the rewritten main: `npm test` -> `PASS 165/165`; `spec-check.cjs --stage 3` -> `PASS 46/46`; `check-phase05.sh` -> `PASS 24/24`.

## Sha Map (pre-rewrite -> rewritten, oldest first)

Use this table to translate the pre-rewrite shas cited in the Phase 4 and 5 SUMMARY, VERIFICATION, and UAT files and in the 06-01 and 06-02 SUMMARYs. Those files were not edited (A-10). Old shas also still resolve through the backup branch.

```
map 363532b 363532b
map 633647a 633647a
map 3c79483 3c79483
map c56f1a5 c56f1a5
map 6790c14 6790c14
map 239517d 239517d
map b97e9b7 b97e9b7
map f30e83f f30e83f
map 15ca6aa 15ca6aa
map a36372c a36372c
map 8c3d0aa 8c3d0aa
map 807d3a7 807d3a7
map 8768252 8768252
map 8d999d5 8d999d5
map 564f776 564f776
map d7c4e7a d7c4e7a
map 4f6ac70 4f6ac70
map a804f43 a804f43
map 93c7e6b 93c7e6b
map d902571 d902571
map 5836f75 5836f75
map cc98bdb cc98bdb
map cc30703 cc30703
map 3cbdd97 3cbdd97
map 2dbf6c9 2dbf6c9
map 5ca798c 5ca798c
map 3f68875 3f68875
map a6a479f a6a479f
map d064003 d064003
map 5bc61b4 5bc61b4
map 2441639 2441639
map 4b98ba3 4b98ba3
map 0b20cb4 0b20cb4
map 4cd4085 4f5c05c
map 86b53d7 63474e8
map a041fb1 053c258
map 4e90329 dd201a1
map aaf1b45 62ad5ee
map ccda56b f5e68a7
map 23f62a0 9eaaa88
map 5eeeb26 74afee7
map caaa890 7f84973
map 0d8d226 3c29564
map b6d1532 34fbe72
map 905d6b2 a6c6eb6
map 2e84caf 2a346fb
map 32df306 6286ec3
map bd60701 9e3cb43
map 65bbb57 a5a872e
map 21366f8 307c969
map a75476d 4d1761b
map 3f19640 eabaff1
map c55aa80 c40431a
map c2d6f84 72c224c
map 1d5dc04 40bc0c3
map dd11658 6a9dae7
map cc8ecc7 88c72bd
map 65d88d3 f1ff295
map caba675 f939e74
map 63f6259 e044a45
map 2b8202f fef14a1
map 485ad73 152dd0c
map 2ffe9f0 7560c9c
map b530d69 5880cd9
map 3d91d12 ae34c46
map 5cf5c07 0ea93cc
map 07ece86 2023dea
map e91b39c 27ca291
map eaf5105 9d4817f
map 1ba4a52 4c26e4a
map cb3c810 41ad8d8
map 4410c71 57d58f7
map 9c13f8a e20a35a
map bd49af4 0e66a6a
map ee6c052 3007767
map f419f61 ac1f69d
```

Key translations: 06-01 commits e91b39c -> 27ca291 and eaf5105 -> 9d4817f. 06-02 commits 4410c71 -> 57d58f7 and 9c13f8a -> e20a35a (the scrub commit). The commits that carried ids: 86b53d7 -> 63474e8, 1d5dc04 -> 40bc0c3, 4cd4085 -> 4f5c05c.

## Task Commits

1. **Task 1 (tracer): history scrub driver, proven on scrub/preview.** Committed as `f419f61`, rewritten to **`ac1f69d`** (chore), subject `chore(06-03): history scrub driver for the unpushed range (preview and apply)`. The tracer gate re-ran the Task 1 verify (T1-VERIFY-OK) before Task 2.
2. **Task 2: apply the scrub.** This task changes git refs only (backup created, main moved, scrub/preview and refs/original removed) and no tracked file, so there is no commit.

## Files Created/Modified

- `.planning/phases/06-release-v0-2-0/harness/scrub-history.cjs`: the history scrub driver (`--preview`, `--apply`, internal `--filter-tree` and `--filter-msg`)

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

**1. [Rule 1 - Measurement] Commit ledger re-anchored after the rewrite.** The ledger recorded `ee6c052` as plan_head_before. After the rewrite, that commit is no longer an ancestor of main, so `rev-list ee6c052..HEAD` would count all 43 rewritten commits. The ledger now records its rewritten equivalent `3007767` (same subject, same tree), and the measured count is 1. Likewise, the 06-02 SUMMARY's `plan_head_before: cb3c810` now corresponds to `41ad8d8`. A verifier comparing commit counts for 06-01 or 06-02 should translate through the sha map above.

**2. [Rule 2 - Hardening] Offset check added to the mapping.** Besides pairing by order, each live id and its EXAMPLE token must start at the same character offset on the line. If the extra check fails, the mapping is refused. The mapping also drops EXAMPLE tokens that were already on the removed line before pairing. The 06-02 diff passed both checks.

**3. [Process note] Committed on `main`.** Sequential dispatch with `branching_strategy: none`, as for 06-01 and 06-02. Nothing was pushed or tagged.

**Total deviations:** 1 measurement fix, 1 hardening addition, 1 process note. **Impact:** none on the specified behavior; every verify command passed as written.

## Issues Encountered

None.

## Expected Side Effects

- Shas cited in the Phase 4, Phase 5, 06-01, and 06-02 docs (and STATE.md's earlier `state_head`) are pre-rewrite. They resolve through the backup branch and translate through the map above.
- `git status` on the T3 desktop app's checkpoints may show them as diverged from main. They are local refs and are left alone.

## User Setup Required

None.

## Next Phase Readiness

- **06-04** can create the release commit on top of `ac1f69d`. Its sha is born after the rewrite and does not change again.
- 06-05 must still confirm `prepush-scan.cjs --history` exits 0 / `PASS 7/7` before any push. It must push only `main --tags`, and never the backup, `refs/t3/*`, `--all`, or `--mirror`.
- Rob's D-02 record: backup `backup/pre-scrub-20261008`, history gate `PASS 7/7`, restore command above.

## Self-Check: PASSED

- FOUND: .planning/phases/06-release-v0-2-0/harness/scrub-history.cjs (tracked, at ac1f69d)
- FOUND: ac1f69d (driver commit, rewritten), 1 commit since plan_head_before 3007767
- FOUND: backup/pre-scrub-20261008 -> f419f61; not on origin
- prepush-scan --history `PASS 7/7`; scrub-history --preview `CLEAN`; suites at baseline
- No v0.2.0 tag; tags v0.1.0, v0.1.1, v0.1.2 only; origin main 90c32eac84ac23502e785a92a445df41b8747f12

---
*Phase: 06-release-v0-2-0*
*Completed: 2026-10-08*

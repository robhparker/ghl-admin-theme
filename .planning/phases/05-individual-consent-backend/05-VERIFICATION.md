---
phase: 05-individual-consent-backend
verified: 2026-10-08T04:30:00Z
status: human_needed
score: 11/11 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/phases/05-individual-consent-backend/05-01-PLAN.md
  - .planning/phases/05-individual-consent-backend/05-01-SUMMARY.md
  - .planning/phases/05-individual-consent-backend/05-02-PLAN.md
  - .planning/phases/05-individual-consent-backend/05-02-SUMMARY.md
  - .planning/phases/05-individual-consent-backend/05-03-PLAN.md
  - .planning/phases/05-individual-consent-backend/05-03-SUMMARY.md
  - .planning/phases/05-individual-consent-backend/05-REVIEW.md
  - .planning/phases/05-individual-consent-backend/deliverables/BUILD-SPEC-clinx-consent-webhook.md
  - .planning/phases/05-individual-consent-backend/deliverables/COMPLETION-PATH.md
  - .planning/phases/05-individual-consent-backend/deliverables/README.md
  - .planning/phases/05-individual-consent-backend/deliverables/consent-forms-member.html
  - .planning/phases/05-individual-consent-backend/deliverables/consent-forms-member.mjml
  - .planning/phases/05-individual-consent-backend/deliverables/wf2-consent-hub-status.member-scope.json
  - .planning/phases/05-individual-consent-backend/deliverables/wf2-member-scope.diff
  - .planning/phases/05-individual-consent-backend/harness/build-status-v9.js
  - .planning/phases/05-individual-consent-backend/harness/build-wf2.cjs
  - .planning/phases/05-individual-consent-backend/harness/check-phase05.sh
  - .planning/phases/05-individual-consent-backend/harness/email-check.cjs
  - .planning/phases/05-individual-consent-backend/harness/spec-check.cjs
  - .planning/phases/05-individual-consent-backend/harness/wf2-member-scope.harness.cjs
covered_digest: "v1:sha256:724b082f2b84110c049fd828fd80363ac0ad8fbb09d77dd7edf8b6b00d60b07c"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "n8n wf2 apply (README Apply order step 1): confirm the live Build Status header reads `// v8: PART-1 PREFILL`, paste the v9 block, Save, then Publish. Immediately open a real owner's hub link."
    expected: "Node header reads `// v9: MEMBER SCOPE (2026-10-07)` after Publish; the owner hub shows the whole family exactly as before."
    why_human: "Needs the live n8n editor and Publish. The v9 token backstop reads `consent_hub_token` from the contacts-search hit's customFields. Extract Owner already reads hint_membership_id the same way on live, but only a live owner link proves the backstop passes real owners. If the owner hub shows could-not-load, roll wf2 back to v8 at once."
  - test: "BUILD-SPEC §6.3 build-time checks while building in Draft: V-02, V-03, V-04, V-06, V-07 (first half), V-08 (mint test plus source probe), V-11, and the V-12 throwaway Custom Code error probe."
    expected: "Each check matches the spec. Record the results in BUILD-SPEC §10."
    why_human: "These depend on ClinX 365 UI and plan behavior (premium actions, picker merge syntax, Custom Code runtime crypto). Nothing offline can observe them."
  - test: "BUILD-SPEC §6.3 pilot gate: publish with the URL in no admin-theme config. Use two test contacts on Rob's mailboxes A and B. Curl send-individual-consent (mint path, then reuse), two quick presses, then resend on member and owner."
    expected: "V-01, V-05 (a)(b)(c)(d), V-07, V-09, V-10, V-13 all pass. One member email to mailbox B whose `?t=` equals the saved `adhoc_`+64-hex token. 'Verify saved token' = ok. Exactly one email plus one R-12 Note on concurrent presses. Resend reaches mailbox A with the d6cf9af1 leaf template. On any failure the workflow goes back to Draft immediately."
    why_human: "Context switching after Find Contact, Custom Code outputs surviving a context switch, the Wait step, and concurrent enrollment are live ClinX runtime behaviors."
  - test: "Live token search (README Phase 6 live check 1-4): open the test member's emailed link, then the owner's hub, then complete Parts 1-3 as the member."
    expected: "GHL contacts search `eq` finds the member by the `adhoc_` token. The member sees one card with their own name only. The owner hub is unchanged and later shows the member complete."
    why_human: "GHL search `eq` semantics on an `adhoc_`-prefixed text custom field, and the end-to-end completion path (forms, a56137e1, wf3), only run live."
  - test: "Negative token checks (README live checks 6-8): `consent-hub?t=adhoc`, `?t=adhoc_`, a truncated or one-char-changed member token, and a one-char-changed owner token."
    expected: "Every one shows the could-not-load (or expired) message, never a card."
    why_human: "Needs the live hub plus live wf2. The offline harness proves v9's backstop, but not GHL's live search behavior."
  - test: "Refusal paths R-01..R-12 on test contacts (README Phase 6 refusal table)."
    expected: "Each refusal gives the register Note on the clicked record (R-01 none), a reason-only internal notification, the run ends, and no email is sent."
    why_human: "These are ClinX workflow runs."
  - test: "Before testing v9, check the legacy-shaped token holders (README live check 5): 6 of 10 holders in the 2026-08-25 pull have empty member_type and owner_contact_id."
    expected: "Any of those still used for testing get member_type = owner first. Production owners already carry member_type owner (verified in the local snapshot: both production-membership owners are `owner`)."
    why_human: "Live data may have changed since the 2026-08-25 snapshot."
  - test: "Send Invite rename (BUILD-SPEC §7) in ClinX."
    expected: "Name becomes '[Ready] Admin Menu: Send Invite (webhook)'. Trigger bde416ab unchanged. Still Published."
    why_human: "This is a ClinX UI action."
  - test: "Rob reads README 'Apply order' and 'Rollback' top to bottom and answers Q-1 (attestation radio), Q-2 (hub copy), Q-3 (token lengths), and Q-5 (accept the member-to-member shared-email residual risk). (Harvested from 05-03 Task 2 human-check.)"
    expected: "The order matches how Rob works in n8n and ClinX. Each question is answered or explicitly carried into Phase 6."
    why_human: "These are product and risk decisions only Rob can make."
---

# Phase 5: Individual Consent Backend Verification Report

**Phase Goal:** Rob has everything needed to build and deploy the consent side in ClinX 365 and n8n: a step-by-step build spec for one consent Inbound Webhook workflow that resolves the exact contact by ID and either sends or refuses with a clear reason (with the Send Invite rename), a wf2 change so a member's own hub link shows only that member's card, and a member consent email in house style.
**Verified:** 2026-10-08T04:30:00Z
**Status:** human_needed
**Re-verification:** No. This is the initial verification. No earlier VERIFICATION.md exists, but 05-REVIEW.md fixes were in scope.

All deliverables exist, are substantive, and were checked against the canonical uncommitted files in `~/Repos/clients/xcelsior/`, not the SUMMARY claims. I re-ran every checker myself. Every offline-provable property holds. What remains is ClinX/n8n live behavior, which is Phase 6 by design.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 / CONS-01, CONS-06: The spec builds one Inbound Webhook workflow. It uses Find Contact by `{{inboundWebhookRequest.contactId}}` (never email or phone), sends an internal notification on not found (R-01), and branches on `{{inboundWebhookRequest.buttonId}}` with a None branch for an unknown action (R-02). It also covers the Send Invite rename with trigger and steps unchanged, reload-after-save, and V-01. | ✓ VERIFIED | BUILD-SPEC §1 (trigger, payload table, Draft sample curl), §2.1 ("Never match on email or phone", V-01), §2.2 R-01, §3.1-3.2, §6.2 reload sentence, §7.1-7.4 (3dff9d94, bde416ab, "Renaming does not change the webhook URL"). spec-check stage 3 (a,b,b2,c,d,e,f,n,p) PASS. |
| 2 | SC2 / CONS-02, CONS-03, CONS-04: Guards run in D-04 order: R-03 tag, R-04 synthetic/empty, R-05 legacy, R-06 owner-email, R-07 complete. Each refusal gives a Note plus a notification with the reason and staff fix. A pass adds `consent-pending`, sends "Your Xcelsior consent forms" to the member, and adds a Note. | ✓ VERIFIED | §4.1-4.7 read in full. The five D-04 texts are verbatim (spec-check h). Order R-07 → Update Contact Field → Member Consent Forms is checked (k, v2). §0.5 refusal pattern. §9 register has 12 rows, R-01..R-12. CONS-02's "has consent_hub_token" is met per locked decision D-05a: a missing token is minted (§4.6), and no email goes out without a verified `adhoc_` token (R-10/R-11). |
| 3 | SC3 / CONS-05: Resend sends the same invite d6cf9af1 sends, directly from an owner record, or from a member record after Find Contact by `{{contact.owner_contact_id}}`. It refuses when no owner or token resolves. | ✓ VERIFIED | §5.1-5.5: four leaves with live-bound template names and subjects, R-08, R-09, and the IN-02 `adhoc_` exclusion in §5.3. |
| 4 | SC4 / HUB-01: With v9, a member-held token returns only the holder's card (owner null, no other member's name, id, or email). Owner tokens return byte-identical v8 output. | ✓ VERIFIED | Read `harness/build-status-v9.js` in full. The JSON jsCode equals the v9 file (checked with node). The harness ran PASS 32/32: member, member detect x4, leak, and owner byte-identical across 8 scenarios. The v8 negative control fails 21/32, so the checks can tell v8 from v9. |
| 5 | SC4 / HUB-02: Hub v11 renders one card, return-to-hub works, no hub change is needed, secrets are placeholders, and the Publish reminder is present. | ✓ VERIFIED | Spot-checked hub v11 lines 16-18, 26, 34, 37-39, and 83: they match the COMPLETION-PATH D-11 evidence. Harness: "hub: v11 renders ... one family-part-1 card" and "hub: return visit without ?t= recovers the adhoc_ token". Config PIT is `PASTE_GHL_PIT_TOKEN_HERE`, and there is no pit-hex anywhere. "n8n changes do not ship until you click Publish" appears in the spec (§0.1, §6.4) and in the README (apply step 1, rollback step 3). |
| 6 | SC5 / HUB-03: The member email MJML is in Consent Hub Invite style. It has no vendor name and no em or en dash, states click tracking off, and links `https://join.xcelsiorhealth.com/consent-hub?t={{contact.consent_hub_token}}`. | ✓ VERIFIED | Independent greps on the HTML: exactly one `consent-hub?t={{contact.consent_hub_token}}`; only two merge fields; 0 vendor-name hits; 0 U+2013/U+2014 in MJML and HTML; 27,172 bytes. email-check PASS 10/10, including a fresh compile matching the HTML. The MJML header carries the paste target, subject, Track link clicks OFF, and the hedged recipient claim (IN-01). |
| 7 | SC5 / HUB-04: The completion trace shows a member's completion flows through the unchanged path to the owner's hub. | ✓ VERIFIED | COMPLETION-PATH.md has six H2s in order. In the 11-row Trace table, only the wf2 row reads "yes". Harness check "HUB-04: member-view form_params equal the owner-view form_params" passes. |
| 8 | `adhoc_` tokens pass every wf2 and hub touchpoint unchanged (D-05a). | ✓ VERIFIED | Has Token? is a notEmpty test only. The Find Owner by Token jsonBody passes `query.t` raw (dumped from the JSON). The static scan finds no regex, length, or hex check. The only validator is v9's backstop, which accepts `adhoc_`+64 hex. |
| 9 | The edited wf2 JSON is the repo copy synced to the live v8 roster plus v9. The diff reproduces it, and no live secret is in it (F-1). | ✓ VERIFIED | I ran `patch` on a temp copy of `n8n/2-consent-hub-status.json` with the diff, then `cmp` against the deliverable: identical. 14 nodes, no Lookup Member Docs, and Refetch Member → Build Status. Harness checks base, sync, scope, and secrets pass. |
| 10 | The member token mint is cryptographic only, `adhoc_`+64 hex, and throws without crypto. Math.random is never used. | ✓ VERIFIED | spec-check m1-m10 executes the spec's own snippet: the web-crypto and node paths, distinct tokens, a throw with no crypto, a throw on a Math-random shim, and `source` reported. |
| 11 | The README gives the full apply order, the F-1 warning, the v9 paste block, and the rollback order. Canonical files are untracked in xcelsior and byte-identical to the committed mirrors. | ✓ VERIFIED | README read: rollback goes Draft → clear `adhoc_` → v8 + Publish. check-phase05.sh PASS 24/24, and the paste block equals the JSON jsCode. Independent `cmp` of all 7 files shows them identical. `git status` in xcelsior shows `??` only. No tracked or staged change under hint-api/ or Email-Templates/. `git log --branches --tags --remotes` shows 0 commits for the phase paths. |

**Score:** 11/11 truths verified (0 present-but-behavior-unverified).

### 05-REVIEW.md fixes (confirmed in code and spec, not from the fix table)

| Id | Where confirmed | Status |
|----|-----------------|--------|
| CR-01 | §4.2 "Capture member email" and §4.4 "Compare with owner" compare saved emails, trimmed and lowercased, failing closed. `grep -c inboundWebhookRequest.email` on the spec returns 0. §1.3 and §8 are corrected. | ✓ present |
| CR-02 | §4.6 steps 3-7: Save → Wait → Reload member → "Verify saved token" (`adhoc_`+64 hex, minted this run, under 15 min old) → R-10. V-12 probe workflow. | ✓ present |
| CR-03 | build-status-v9.js lines 98-105: the `?t=` length 16-256 rule, the strict `adhoc_` form, exactly one exact-match hit equal to Extract Owner's id, and otherwise an empty body. 9 backstop harness checks pass. All 10 real tokens in the 2026-08-25 snapshot are 32 hex and pass the rule (counts only, no values printed). | ✓ present |
| WR-01 | The §4.2 `SYNTHETIC_EMAIL_RE` is byte-equal to `src/ghl-customizer.js:93`. | ✓ present |
| WR-02 | §8 accepts the residual risk with a staff rule. The MJML header is hedged. README Q-5. | ✓ present (needs Rob's acceptance) |
| WR-03 | `tokenCheck` none/reuse/foreign in "Compare with owner". R-11. It is kept under the D-04 alternative (§4.4). | ✓ present |
| WR-04 | 1-minute "Settle concurrent presses" Wait, reload, `superseded` → R-12. §8 states the residual. V-13. | ✓ present |
| WR-05 | The mint's tripwire on Math-random shims, the V-08 source probe, and the stated limitation in §8. | ✓ present |
| WR-06 | §6.3 pilot gate. Post-publish checks say "back to Draft immediately". The remaining "do not publish" lines are build-time checks only (V-04, V-06, V-08, V-11, V-12). | ✓ present |
| IN-01 | MJML AUDIENCE block is hedged and lists the residual cases. | ✓ present |
| IN-02 | §5.3 reads: Member Type owner, OR (token not empty AND not containing `adhoc_`), with a two-branch fallback. | ✓ present |
| IN-03 | v9 line 108-109 classifies from `holderFresh`, and a missing fresh record counts as a member. Harness check "role comes from the fresh record" passes. | ✓ present |

All 12 fix commits (3f19640 … 485ad73) exist in admin-theme and touch only `.planning/phases/05-individual-consent-backend/`.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `X/hint-api/proposals/2026-10-07-individual-consent/BUILD-SPEC-clinx-consent-webhook.md` | 12-section ClinX build spec | ✓ VERIFIED | 449 lines, 12 H2s in order, R-01..R-12, V-01..V-13, and 5 Custom Code regions |
| `.../wf2-consent-hub-status.member-scope.json` | Full wf2 JSON with v9 | ✓ VERIFIED | Valid JSON, 14 nodes, PIT placeholder |
| `.../wf2-member-scope.diff` | Diff vs `n8n/2-consent-hub-status.json` | ✓ VERIFIED | `patch` reproduces the JSON byte-for-byte. No `/Users/` paths. |
| `.../COMPLETION-PATH.md` | HUB-04 trace plus D-11 decision | ✓ VERIFIED | Six sections, evidence cited by line and node |
| `.../README.md` | Index, apply order, rollback, paste block | ✓ VERIFIED | Ten H2s, Q-1..Q-5 |
| `X/Email-Templates/Consent-Hub-Invite/consent-forms-member.mjml` and `.html` | Member email | ✓ VERIFIED | Fresh compile matches. 27,172 bytes. |
| `harness/build-status-v9.js`, `build-wf2.cjs`, `wf2-member-scope.harness.cjs`, `spec-check.cjs`, `email-check.cjs`, `check-phase05.sh` | Proof tooling | ✓ VERIFIED | All four checkers run green (below) |
| `hub-page.diff` | Only if needed | n/a (correctly absent) | D-11 decision is no change. Absent in both locations. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| harness/build-status-v9.js | JSON Build Status jsCode | build-wf2.cjs | ✓ WIRED | Equal (node strict compare) |
| v9 member-scope block | Find Owner by Token contacts | `$('Find Owner by Token').first().json.contacts` | ✓ WIRED | Line 101 |
| Member-scoped body | Hub v11 card render | `members.forEach` → `FAMILY_PART1_URL + '?' + form_params` | ✓ WIRED | Hub line 83, plus the harness render check |
| Spec §3 If/Else values | admin-theme item ids | buttonId | ✓ WIRED | `send-individual-consent` and `resend-consent-hub` match ITEM-03/04 |
| Spec §4.6 mint → Update Contact Field → Reload → Verify | §4.7 email `{{contact.consent_hub_token}}` | Saved and reloaded value | ✓ WIRED (doc) | Merge syntax is V-07, and email = stored token is V-09, both live |
| README v9 paste block | JSON jsCode | check-phase05 equality | ✓ WIRED | "readme: v9 paste block equals the JSON Build Status jsCode" |
| consent-forms-member.html | Spec §4.7 template "Member Consent Forms" | Rob pastes the HTML | ✓ WIRED (doc) | Names match in the spec §0.2, the MJML header, and README step 3 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Build Status v9 member body | `members[0]` | `$('Refetch Member').all()` fresh record of `own.ownerId` | Yes (offline fixtures; live is Phase 6) | ✓ FLOWING (offline) |
| Member email link | `{{contact.consent_hub_token}}` | Member record after §4.6 save and reload | Live only | Routed to human (V-09) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| wf2 v9 member scope, owner identity, backstop, hub render | `node harness/wf2-member-scope.harness.cjs` | PASS 32/32 | ✓ PASS |
| Negative control (v8 as edited code) | `... --edited-js build-status-v8-PROPOSED.js` | FAIL 21/32, exit ≠ 0 | ✓ PASS (discriminates) |
| Spec content plus Custom Code runtime | `node harness/spec-check.cjs --stage 3` | PASS 46/46 | ✓ PASS |
| Member email | `node harness/email-check.cjs` | PASS 10/10 | ✓ PASS |
| Phase gate | `bash harness/check-phase05.sh` | PASS 24/24 | ✓ PASS |
| Diff reproduces the JSON | `patch` temp copy + `cmp` | identical | ✓ PASS |
| Mirrors byte-identical (7 files) | `cmp` each | identical | ✓ PASS |
| Real token formats vs the v9 backstop | node count over the 2026-08-25 snapshot (no values printed) | 10/10 are 32 hex, 0 fail | ✓ PASS |

### Probe Execution

Step 7c: no `scripts/*/tests/probe-*.sh` declared or present for this phase. The phase's own checkers (above) serve as probes and were run by the verifier.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CONS-01 | 05-02 | Trigger, Find Contact by ID, not-found notification, buttonId branch | ✓ SATISFIED | Spec §1-§3 |
| CONS-02 | 05-02 | Individual-consent guards | ✓ SATISFIED | §4.1-4.5. The token condition is met via the D-05a mint plus R-10/R-11 (deviation from literal wording per a locked decision). |
| CONS-03 | 05-02 | Note plus notification with reason and fix; shared/synthetic → Resend on owner; legacy called out | ✓ SATISFIED | §0.5, inline texts, §9 register |
| CONS-04 | 05-02 | Pass adds consent-pending and sends "Your Xcelsior consent forms" with the member's own token | ✓ SATISFIED | §4.6-4.7 |
| CONS-05 | 05-02 | Resend to owner direct, or via owner_contact_id; refuse with a Note | ✓ SATISFIED | §5 |
| CONS-06 | 05-02 | Rename, reload-after-save, V-01 | ✓ SATISFIED | §7, §6.2, §2.1 |
| HUB-01 | 05-01 | Member-only card; owner unchanged | ✓ SATISFIED | v9 plus harness |
| HUB-02 | 05-01, 05-03 | One-card render, return-to-hub, placeholders, Publish reminder | ✓ SATISFIED | Harness, COMPLETION-PATH D-11, README |
| HUB-03 | 05-03 | Member email MJML | ✓ SATISFIED | email-check plus independent greps |
| HUB-04 | 05-01 | Unchanged completion path | ✓ SATISFIED | COMPLETION-PATH trace plus HUB-04 harness check |

All 10 phase IDs are claimed by a plan, and REQUIREMENTS.md maps no other ID to Phase 5. No orphans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all phase harness and deliverable files) | none | TBD/FIXME/XXX, TODO/HACK | none | No debt markers found |
| harness/build-status-v9.js | 102-105 | Backstop changes the response for malformed or duplicate tokens (empty body instead of v8's `contacts[0]` family) | ℹ️ Info | Intentional (CR-03). Well-formed single-match owner tokens stay byte-identical. |
| harness/build-status-v9.js | 109 | Legacy-shaped holders (empty member_type and owner_contact_id) are now treated as members | ℹ️ Info | 6 of 10 holders in the 2026-08-25 snapshot. I confirmed 5 have `sbx-` membership ids and 1 has a test name. Both production owners have member_type `owner`. README live check 5 covers it. |
| xcelsior repo refs/t3/checkpoints/* | none | T3 client checkpoint snapshots include the untracked phase files | ℹ️ Info | Not branch, tag, or remote commits (0 hits with `--branches --tags --remotes`). Not a phase violation, but these refs hold copies of the files. |

### Human Verification Required

All of these are live items expected to run in Phase 6, or decisions only Rob can make. Full details are in the frontmatter `human_verification` list.

1. **n8n wf2 Publish plus owner smoke check.** Paste v9 over a confirmed v8 header, Publish, and open a real owner link right away. Expected: the family view is unchanged. If it shows could-not-load, the search hit is not carrying `consent_hub_token` as the backstop expects. Roll back to v8 at once.
2. **ClinX build-time checks:** V-02, V-03, V-04, V-06, V-07a, V-08 (mint plus probe), V-11, and the V-12 probe workflow.
3. **§6.3 pilot gate:** V-01, V-05, V-07, V-09, V-10, V-13 on two test contacts, Draft on any failure.
4. **Live token search:** `eq` finds the `adhoc_` token. Member sees one card, owner hub unchanged, member completion shows on the owner hub.
5. **Negative token links:** `?t=adhoc`, `?t=adhoc_`, truncated or changed tokens all show could-not-load.
6. **Refusals R-01..R-12** on test contacts, checking all four outcomes for each.
7. **Legacy-shaped test token holders:** set member_type owner before testing.
8. **Send Invite rename** in ClinX.
9. **Rob reviews the README apply and rollback order** and answers Q-1, Q-2, Q-3, and Q-5. Q-5 is the WR-02 residual-risk acceptance.

### Gaps Summary

No gaps. Every must-have from the roadmap success criteria, the three plans, and the 12 review fixes is in the canonical files. I confirmed each by reading the code and spec and by re-running all four checkers, the negative control, the patch reproduction, and the mirror `cmp`. The xcelsior repo has no staged, committed, or tracked-modified file from this phase. Status is `human_needed` only because the phase delivers build instructions whose ClinX and n8n runtime assumptions (V-01..V-13, pilot gate, n8n Publish, live `eq` search, live send) can only be proven live in Phase 6.

---

_Verified: 2026-10-08T04:30:00Z_
_Verifier: Claude (gsd-verifier)_

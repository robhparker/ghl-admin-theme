---
phase: 05-individual-consent-backend
reviewed: 2026-10-08T03:40:30Z
depth: quick
files_reviewed: 11
files_reviewed_list:
  - .planning/phases/05-individual-consent-backend/deliverables/wf2-consent-hub-status.member-scope.json
  - .planning/phases/05-individual-consent-backend/deliverables/wf2-member-scope.diff
  - .planning/phases/05-individual-consent-backend/deliverables/BUILD-SPEC-clinx-consent-webhook.md
  - .planning/phases/05-individual-consent-backend/deliverables/consent-forms-member.mjml
  - .planning/phases/05-individual-consent-backend/harness/build-status-v9.js
  - .planning/phases/05-individual-consent-backend/harness/build-wf2.cjs
  - .planning/phases/05-individual-consent-backend/harness/wf2-member-scope.harness.cjs
  - .planning/phases/05-individual-consent-backend/harness/spec-check.cjs
  - .planning/phases/05-individual-consent-backend/harness/email-check.cjs
  - .planning/phases/05-individual-consent-backend/harness/check-phase05.sh
  - src/ghl-customizer.js (read-only cross-check of the webhook payload; not a phase file)
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-10-08T03:40:30Z
**Depth:** quick (focused deeper on the areas the orchestrator flagged: wrong-recipient paths, token predictability, guard bypasses)
**Files Reviewed:** 11
**Status:** issues_found

## Summary

I focused on the Build Status v9 Code node, the ClinX build spec (guards R-03..R-09, Custom Code mint, resend branch), and the member email. Quick sanity on the harnesses: `wf2-member-scope.harness.cjs` reports PASS 22/22, `spec-check.cjs --stage 3` PASS 26/26, `email-check.cjs` PASS 9/9, and `check-phase05.sh` PASS 22/22. `check-phase05.sh` uses `set -uo pipefail` and a `mktemp` file with an `rm` trap. No secrets: the wf2 JSON carries only the `PASTE_GHL_PIT_TOKEN_HERE` placeholder, and the diff contains no PIT or bearer value. The compiled email has one hub link (`https://join.xcelsiorhealth.com/consent-hub?t={{contact.consent_hub_token}}`), no U+2013/U+2014 or `&mdash;`/`&ndash;`, and no vendor names. The owner path in v9 really is unchanged from v8.

The main problems are guard design, not syntax:

1. Guard R-06 (the owner-email check) compares against the **client-supplied** payload `email` rather than the member's stored email. That contradicts the spec's own §8 claim that every guard runs server-side "whatever the client sent".
2. The Custom Code failure path has no post-condition. Nothing stops an empty or unresolved token from being written and then mailed.
3. wf2 trusts the GHL search `eq` result (`contacts[0]`) with no exact-match or uniqueness check. That matters more now that every member token shares the common `adhoc_` prefix.

Items 2 and 3 together are the cross-family disclosure chain this review was asked to find.

## Critical Issues

### CR-01: R-06 owner-email guard compares the owner against client-supplied payload email, not the member's stored email (guard bypass)

**File:** `.planning/phases/05-individual-consent-backend/deliverables/BUILD-SPEC-clinx-consent-webhook.md:129` (also §1.3 table row `email`, line ~56; §8 line 272)
**Issue:** Step 4.4.3 tests `owner {{contact.email}} == {{inboundWebhookRequest.email}}`, but 4.7 sends to the member's **stored** `{{contact.email}}`. The payload email is untrusted and can differ from the stored value in several ways:
- `buildPayload` (`src/ghl-customizer.js:1782`) omits `email` entirely when the DOM read returns null, so the comparison becomes `owner@x == ""`, which is false, and the guard passes.
- `readContactEmail` can fall back to the first `a[href^="mailto:"]` in the region (`src/ghl-customizer.js:233`), which may not be the member's primary email.
- Staff can edit the field without saving (the spec acknowledges this at line 138 but accepts it).
- Anyone holding the public webhook URL can post any `email`.
- The compare is also case-sensitive (V-05 accepts this), so `Owner@x.com` and `owner@x.com` pass.

In every one of these cases the member email goes to the owner's inbox even though the guard exists to prevent exactly that. §8 (line 272) states that "every guard (R-01 to R-09) runs server-side in ClinX, whatever the client sent". For R-06 that is false.
**Fix:** Compare stored values only, normalized. Custom Code is already a hard prerequisite (V-06), so capture the member's email before the context switch:
```js
// Custom Code "Capture member email" (BEFORE "Find owner (email compare)")
// inputData: memberEmail = {{contact.email}}
output = { memberEmail: String(inputData.memberEmail || '').trim().toLowerCase() };
```
```js
// Custom Code "Compare owner email" (AFTER "Find owner", context = owner)
// inputData: ownerEmail = {{contact.email}}, memberEmail = <Capture member email>.memberEmail
var o = String(inputData.ownerEmail || '').trim().toLowerCase();
var m = String(inputData.memberEmail || '');
output = { same: (o !== '' && o === m) ? 'yes' : 'no' };
```
Then branch "Same email" on `same == yes`. Drop `{{inboundWebhookRequest.email}}` from every guard, and correct §1.3 and §8.

### CR-02: Custom Code mint failure path is unguarded; an empty or unresolved token can be written and emailed

**File:** `.planning/phases/05-individual-consent-backend/deliverables/BUILD-SPEC-clinx-consent-webhook.md:160-172` (4.6 steps 1-3) and 4.7
**Issue:** The snippet's only failure handling is `throw new Error(...)` (line 161). The spec assumes a throw halts the run, but no V-marker verifies what HighLevel does when a Custom Code action errors at runtime. V-08 covers only the "Test your Code" time. HighLevel workflows commonly log a failed action and continue. If that happens, "Save member hub token" writes whatever the unresolved `token` merge resolves to, either an empty string or the literal merge-tag text, and 4.7 still sends "Member Consent Forms":
- **Empty token:** the member gets a dead `?t=` link, and the next press mints again, so the staff action is non-idempotent.
- **Literal or constant text:** every member whose mint failed holds the **same** token. wf2 `Find Owner by Token` then returns several contacts, and Build Status takes `contacts[0]` (see CR-03). Member A's link opens member B's card, which carries B's name, email, phone, and DOB in `form_params` (`INCLUDE_DOB = true`). B can be in a different family. That is a cross-family PHI disclosure.

Nothing between the mint and the send checks the result.
**Fix:** Add a post-condition guard and a V-marker:
1. Right after "Save member hub token" (and after the V-09 refetch, if used), add If/Else "Token is valid": Consent Hub Token **starts with** `adhoc_` AND **does not contain** `{{` (or, if ClinX lacks starts-with, a Custom Code step that tests `/^adhoc_[0-9a-f]{64}$/` and outputs `ok`). On failure: Note and notification "Token mint failed; nothing sent" (new R-10), then End.
2. Add V-12: force a runtime error (temporarily `throw` unconditionally in a draft copy) and record whether the run stops at Custom Code. If it continues, the R-10 guard is mandatory.
3. Put the same "starts with `adhoc_`" check in front of 4.7 on the None (existing-token) branch (see WR-03).

### CR-03: wf2 v9 trusts `contacts[0]` of a search with no exact-match or uniqueness check; the shared `adhoc_` prefix raises the stakes

**File:** `.planning/phases/05-individual-consent-backend/harness/build-status-v9.js:89-93` (same code in `deliverables/wf2-consent-hub-status.member-scope.json:337`, `jsCode`). Relies on the unchanged `Find Owner by Token` (`pageLimit: 5`, `operator: 'eq'`) and `Extract Owner` (`contacts[0]`).
**Issue:** v9's whole security boundary is "the holder is whoever `contacts[0]` is". Nothing verifies that the holder's stored `consent_hub_token` actually equals `query.t`, or that exactly one contact matched:
- The 05-01 live check only covers the **positive** case ("eq finds a member by an adhoc_ token"). Nobody verifies that `?t=adhoc` or `?t=adhoc_` (both pass `Has Token?`, which only tests notEmpty) does **not** match. Before this phase, tokens were pure hex with no shared term. Now every member token shares the `adhoc_` prefix. If GHL's `eq` on a text custom field is analyzed or tokenized (splitting on `_`) or prefix-tolerant, an unauthenticated `GET ?t=adhoc` returns an arbitrary member's card, including that member's DOB, phone, and email.
- If any two contacts hold the same value (CR-02 failure, WR-03 copied owner token, or manual data entry), `contacts[0]` is arbitrary. If an owner and a member share a token and the owner sorts first, the member's link renders the **whole family**.

**Fix:** Add a cheap code-level backstop at the top of Build Status v9, before both paths, so it does not depend on GHL search semantics:
```js
const q = String((($('Status Webhook').first().json.query) || {}).t || '');
const hits = ($('Find Owner by Token').first().json.contacts || [])
  .filter(h => String(val(h, 'consent_hub_token')) === q);
if (q === '' || hits.length !== 1 || hits[0].id !== own.ownerId) {
  return [{ json: { body: { practice: practice, owner_first_name: '', owner: null, members: [], all_complete: false, all_signed: false } } }];
}
const holder = hits[0];
```
Then update the harness static scan, which currently asserts that only Has Token? and Find Owner read `query.t`. Owner byte-identity still holds for every well-formed single-match request. Add negative Phase 6 live checks: `?t=adhoc`, `?t=adhoc_`, and a truncated real token must all render the could-not-load state.

## Warnings

### WR-01: R-04's server-side synthetic check is weaker than the client's; `owner+<digits>@` dedupe addresses pass

**File:** `.planning/phases/05-individual-consent-backend/deliverables/BUILD-SPEC-clinx-consent-webhook.md:114` (register row line 288)
**Issue:** The third condition only catches `+{{contact.hint_patient_id}}@`. The client regex `SYNTHETIC_EMAIL_RE = /\+(?:\d+|pat-[A-Za-z0-9_-]+)@/` (`src/ghl-customizer.js:90-93`) also exists for "the dedupe address HighLevel/Hint writes for a shared signup email (owner+12@...)". The digits there are not the member's `hint_patient_id`. Such a member has no `synthetic-email` tag (F-3), a non-empty email, and an email different from the owner's, so it passes R-04 and R-06 and the email lands in the owner's inbox. The spec says "the server-side guard is the one that counts", yet it is the weaker of the two checks.
**Fix:** Run the same regex server-side in the Custom Code step from CR-01 (`inputData.memberEmail`) and output `synthetic: 'yes'|'no'`, then refuse R-04 on `yes`. Keep the tag and empty conditions.

### WR-02: Member-to-member shared email is not refused; one member's link can reach a sibling

**File:** `.planning/phases/05-individual-consent-backend/deliverables/BUILD-SPEC-clinx-consent-webhook.md:126-136` (4.4) and `consent-forms-member.mjml:20-23`
**Issue:** R-06 only compares against the owner. If staff type member B's address onto member A (for example two adult children who share an inbox, or a copy-paste slip), A's adhoc link is sent to B. Under v9, B then sees A's card with A's DOB, phone, and email in `form_params`. That is exactly the cross-member view v9 exists to prevent. The MJML header claims the guards keep "shared" addresses out and that the email "only ever reaches an address that belongs to the member". Neither is true for this case.
**Fix:** Either add a Custom Code or HTTP check that no other contact with the same `hint_membership_id` has the same lowercase email (needs an API call, so possibly deferred), or document it explicitly as residual risk in §8 and the MJML header and remove the "only ever reaches" claim.

### WR-03: Existing-token reuse branch (4.6 None) accepts any value, including a copied owner or family token

**File:** `.planning/phases/05-individual-consent-backend/deliverables/BUILD-SPEC-clinx-consent-webhook.md:142`
**Issue:** "None (a token exists) -> reuse it, write nothing" never checks what the token is. If a member already holds a non-`adhoc_` value (a backfill, import, or staff copy of the owner's family token, or a token left over from a contact that was once an owner), the "for you personally" email carries a link that resolves through `contacts[0]` (CR-03). That can be the owner's record, which means the full family hub is sent to the member's inbox.
**Fix:** Split the None branch. If Consent Hub Token starts with `adhoc_`, reuse it. Otherwise refuse (new R-xx: "Member holds a non-member hub token; Rob must clear it"), Note, notify, and End. Never mail a non-`adhoc_` token from the member branch.

### WR-04: Concurrent presses race the mint; the first email's link dies and duplicate sends occur

**File:** `.planning/phases/05-individual-consent-backend/deliverables/BUILD-SPEC-clinx-consent-webhook.md:249` (Allow re-entry ON) with 4.6
**Issue:** The 60 s cooldown is per client tab. Two staff members, two tabs, or a direct POST can start two runs together. Both see an empty token, both mint, and the last write wins. Run 1's email then carries a token that no longer exists (dead link). Depending on V-09 resolution timing, both emails may also carry the same final token. Either way the member gets two emails, which contradicts the project core value of "no duplicate sends", and possibly a broken one.
**Fix:** After "Save member hub token", re-fetch the member (the V-09 fallback Find Contact) and send using the stored value only. State the residual duplicate-send risk in §8. Server-side dedupe is already deferred (`seeds/consent-actions-hardening.md`), so cite it.

### WR-05: V-08 cannot detect a non-cryptographic `getRandomValues` polyfill

**File:** `.planning/phases/05-individual-consent-backend/deliverables/BUILD-SPEC-clinx-consent-webhook.md:151-152, 179`
**Issue:** The acceptance test is "Test your Code returns `adhoc_` plus 64 hex". A sandboxed runtime (isolated-vm or a vm2-style shim) can expose a JS polyfill of `crypto.getRandomValues` backed by `Math.random`, and that passes V-08 unchanged. D-05a explicitly forbids Math.random, and the token is the only credential to the member's hub.
**Fix:** Add a probe to V-08: temporarily output `{ src: String(crypto.getRandomValues), node: typeof require === 'function' && typeof require('crypto').randomBytes }` in a Test run. Accept only `[native code]` or a working Node `randomBytes`. Otherwise prefer the `require('crypto').randomBytes` path first, or use the Python `secrets` alternative.

### WR-06: Context-switch checks (V-01, V-05, V-09) are only observable after Publish, yet the spec says "do not publish" if they fail

**File:** `.planning/phases/05-individual-consent-backend/deliverables/BUILD-SPEC-clinx-consent-webhook.md:83, 134, 181, 254`
**Issue:** §6.3 publishes before any real-contact run (the Draft sample ends at R-01). V-01, V-05, and V-09 are checked "on the run log of the first Phase 6 test". If V-05(b) fails ("Restore member" does not switch back), the R-07 check and the member email run in the **owner** context. The live workflow is already published by the time anyone can see this. The instruction "If it differs: do not publish" cannot be followed as written.
**Fix:** Reword these as "if it differs: set the workflow back to Draft immediately, before the URL goes into admin-theme config". Run the first test with two test contacts whose owner and member emails both go to Rob, so a wrong-context send is harmless.

## Info

### IN-01: MJML header names "ClinX" and overstates the recipient guarantee

**File:** `.planning/phases/05-individual-consent-backend/deliverables/consent-forms-member.mjml:13, 20-23`
**Issue:** The compiled HTML strips the comment (verified: no vendor names in `.html`), so this is not patient-facing. However, the header says "Guards R-03..R-07 ... keep shared, missing, owner-matching, and synthetic addresses out, so this email only ever reaches an address that belongs to the member". CR-01, WR-01, and WR-02 show that is not true.
**Fix:** Soften the claim to "reduce the chance this reaches a non-member address" and list the residual cases.

### IN-02: Resend owner-path classification relies on an unenforced invariant

**File:** `.planning/phases/05-individual-consent-backend/deliverables/BUILD-SPEC-clinx-consent-webhook.md:215-218`
**Issue:** "Consent Hub Token is not empty" counts as owner on the grounds that `adhoc_` holders always have Owner Contact ID. If a member's owner link is later cleared (staff edit or backfill), the member gets the owner invite template with their own member link. This is not a disclosure, but the email is wrong.
**Fix:** Use "Member Type is owner OR (Consent Hub Token is not empty AND does not start with `adhoc_`)".

### IN-03: v9 classifies the holder from the lagging search index, not the fresh refetch

**File:** `.planning/phases/05-individual-consent-backend/harness/build-status-v9.js:89-90`
**Issue:** `holderIsMember` reads `owner_contact_id` and `member_type` from the `Find Owner by Token` search hit. The node's own header says the search index lags writes, and the fresh record `c` (line 93) is already available. Today the lag fails closed (an owner misread as a member), so the impact is limited.
**Fix:** Classify on `freshItems.find(x => x.id === own.ownerId) || holder`, and treat a missing fresh record as a member.

---

_Reviewed: 2026-10-08T03:40:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_

# Completion path for a member who opens their own hub link (HUB-04)

Proposal folder: `hint-api/proposals/2026-10-07-individual-consent/` (2026-10-07). Companion files:
`wf2-consent-hub-status.member-scope.json` (the edited wf2) and `wf2-member-scope.diff` (its diff
against `n8n/2-consent-hub-status.json`). Offline proof: the admin-theme harness
`.planning/phases/05-individual-consent-backend/harness/wf2-member-scope.harness.cjs`, which ends
`PASS 22/22`.

## Result

A family member who completes from their own hub link uses the same pages, forms, GHL workflows,
document chain, and wf3 recount as when the owner opens that member's card today. The only component
that changes is wf2's `Build Status` node (v8 to v9). For a member-held token it returns just the
holder's card, built by the same member-card code, so the link the member clicks is the same
`/family-part-1?<form_params>` link the owner's hub serves for that member. The harness proves the
two links are identical:
`ok - HUB-04: member-view form_params equal the owner-view form_params for the same member`.
Owner tokens are untouched: `ok - owner: byte-identical to v8 across 8 scenarios`. The hub page
(v11) needs no change (see the D-11 section).

## Trace

File paths are relative to `hint-api/`. "v11" means `ghl/consent-hub-v11-ELEMENT-PASTE.html`.

| Step | Component | Id | Evidence | Changed? |
|---|---|---|---|---|
| 1. Member clicks the email link `https://join.xcelsiorhealth.com/consent-hub?t=<member token>` | Hub page v11 on funnel "Family Consent Hub" | funnel `Oz0f515BAOp3gkwNlpbO`, page `8y71OTd9m7RjNgRA6EyC` | v11 lines 16-18: `token = params.get('t')`, then `sessionStorage.setItem('consentToken', token)`. Harness: `ok - hub: v11 renders the member response as one family-part-1 card` | no |
| 2. Hub fetches status with the member token | wf2 Consent Hub Status: Has Token?, Find Owner by Token, Extract Owner, Find Members, List Members, Refetch Member | `RxnpkyL0jng8hVx7` | v11 line 34 `fetch(STATUS_URL + '?t=' + encodeURIComponent(token))`. Has Token? is `notEmpty` only; Find Owner by Token searches `consent_hub_token eq <t>` and returns the member (the holder). Extract Owner's `ownerId` is the holder; Find Members uses the holder's `hint_membership_id`, which is the family's. Harness: `ok - token: adhoc_ token passes Has Token? and reaches Find Owner by Token unchanged` | no |
| 3. wf2 builds the member view | wf2 node `Build Status` v9 | `RxnpkyL0jng8hVx7` | `harness/build-status-v9.js` member-scope block: holder is a member (`owner_contact_id` set or `member_type` not `owner`), so the body is `owner: null` plus one card. Harness: `ok - member: adhoc_ member token returns only the holder's card`, `ok - leak: member response contains no other member's name, id, or email` | **yes (v8 to v9)** |
| 4. Hub renders one card; member clicks "Complete consent" | Hub page v11 member card | page `8y71OTd9m7RjNgRA6EyC` | v11 lines 78-96 render `members`; line 83 `href = FAMILY_PART1_URL + '?' + m.form_params` (`https://join.xcelsiorhealth.com/family-part-1?...`). form_params carry the member's own contact_id, email, names, hint_patient_id, member_type, and prefill | no |
| 5. Family Part 1, Part 2, Part 3 | Funnel steps Family Part 1 / 2 / 3 | `pZOnhyMAxryvLiW675mI`, `3j2clPHt1Q6u6oIccvJx`, `vlGvMKVj0e1GLVTH6oZm` | `GHL_Family_Consent_Flow_Design.md` Appendix E: Part 1 and Part 2 redirect on submit with `{{contact.id}}` and `{{contact.email}}` of the submitting contact; rehearsed 2026-07-30 with every hop resolving to the dependent, not the browser-session contact | no |
| 6. The forms write to the member's contact | Form "Family Consent - Adult" (and its Part 1-3 clones) | `T5tWa7nLM8QgMQHu6D8P` | Design §5.5: hidden fields `email`, `hint_patient_id`, `member_type` come from form_params; Email is Hidden and is the routing key; Sticky Contact OFF, so the browser's cookie contact is never used. Appendix E: the three clones keep these routing settings. The member's own email (real, or wf1's synthetic `+pat-<id>@` key) matches the member contact | no |
| 7. Consent marked complete and wf3 called | GHL workflow "Family Consent - Form Submitted" (§5.8) | `a56137e1-8cc5-470f-b94e-514be2d0417b` | Design §5.8 and Appendix E: on the Family Part 3 submission, runs on the member contact, sets `consent_status` complete and `consent_completed_at`, swaps `consent-pending` for `family-consent-complete`, then POSTs wf3 with `contact_id` and `hint_patient_id` (`testing/2026-08-24-phase1-wf3-patch/FINDINGS.md`: §5.8 sends both ids) | no |
| 8. Agreement minted in parallel | GHL workflow "Family Consent Submitted Webhook" (doc-gen) | `d68d9c2a` | Design Appendix D: same Part 3 trigger, GET n8n "Send Pt Registration document" with the member id, guard on `doc_ref_agreement`, mints from the family template `6a6a13afe2d84ef2744c8918` (chosen by the `family-member` tag, which every member who can receive an individual email has, per guard 1) | no |
| 9. Recount against the owner | wf3 Consent Completed: Extract Request, Get Contact by Id, Resolve Contact, Contact Resolved?, Extract Contact, Find All Members, Refetch Member, Compute Completion, Update Owner consents_received, All Complete?, Tag Owner all-consents-complete | `Ynvcy4MyE5W1PTXQ` | `n8n/3-consent-completed.json`: Extract Request takes `contact_id`; Get Contact by Id and Resolve Contact load the member; Extract Contact sets role `dependent` because `owner_contact_id` is set, so `recountOwnerId` is the owner; Find All Members searches by `hint_membership_id`; Compute Completion counts dependents from fresh GETs; Update Owner consents_received PUTs the owner; All Complete? gates Tag Owner all-consents-complete. Nothing in wf3 reads which token opened the hub | no |
| 10. Member returns to their own hub | Part 3 on-submit redirect and the family agreement's Finish redirect, both to bare `/consent-hub` | Part 3 `vlGvMKVj0e1GLVTH6oZm`, template `6a6a13afe2d84ef2744c8918` | Appendix E (Part 3 redirects to bare `/consent-hub`) and Appendix D v5.1 amendment (template-level redirect after Finish). v11 line 18 recovers the member's token from sessionStorage, so the member sees their own view again. Harness: `ok - hub: return visit without ?t= recovers the adhoc_ token and fetches with it` | no |
| 11. Owner's hub shows the member complete | Hub page v11 with the owner token; wf2 Build Status v9 owner path | `RxnpkyL0jng8hVx7` | The owner token skips the member-scope block and runs the v8 code unchanged; it reads the member's fresh `consent_status` and `doc_status_agreement` exactly as today. Harness: `ok - owner: byte-identical to v8 across 8 scenarios` (includes "children done and signed, owner pending" and "everyone complete and signed") | no |

## What the member-held token touches

- **wf2 `Has Token?`**: `notEmpty` on `query.t`. An `adhoc_` token passes unchanged (harness `token:` check).
- **wf2 `Find Owner by Token`**: passes the raw `query.t` as the `eq` value of a `consent_hub_token`
  contacts search. No transform, so `adhoc_<64 hex>` is matched as stored (harness `token:` check).
  Whether GHL's contacts search `eq` finds a value with an underscore is a live check (below).
- **wf2 `Extract Owner`**: takes `contacts[0]`, the holder. It throws if the holder has no
  `hint_membership_id`. The consent workflow's guard 3 refuses to mint for a member without one, so
  a member token always has it.
- **wf2 `Build Status` v9**: reads the holder from `Find Owner by Token` and returns only the
  holder's card. It reads `owner_contact_id` through the runtime custom-field map, so it does not need
  that field in Build CF Map's required list (the field exists live, phase0 FINDINGS item 7).
- **Hub v11**: reads, stores, recovers, and URL-encodes the token without validating it. The harness
  scans the hub and wf2 for regex, length, or hex tests on the token and finds none:
  `ok - hub: no regex, length, or hex check on the token in hub v11 or wf2`. `encodeURIComponent`
  leaves `adhoc_` plus hex unchanged (letters, digits, and `_` are unreserved).
- **wf1 `Check Idempotency`**: reads `consent_hub_token` only from the `Upsert Owner` response, which
  is the owner's record (`n8n/1-hint-membership-fanout.json`, Check Idempotency lines 4-18,
  `already = existingToken.length > 0 && existingMembership === ev.object.id`). A member's token
  cannot make a membership look already fanned out. `Build Dependents` never writes
  `consent_hub_token` (its upsert sends only hint_patient_id, hint_membership_id, member_type,
  owner_contact_id), so a re-signup neither clears nor overwrites a member token.
- **wf3**: `n8n/3-consent-completed.json` has 0 references to `consent_hub_token`. The recount keys on
  `contact_id`, `owner_contact_id`, and `hint_membership_id` only.
- **Offline scripts**: `testing/2026-08-25-phase3-backfill/backfill.py` (lines 80-85, class E12) treats
  any contact holding a `consent_hub_token` as a tokened owner. If the backfill is ever re-run after
  members hold `adhoc_` tokens, it should skip `adhoc_` values. A note only, no change proposed.

## Hub page v11 with a member-scoped response (D-11)

Decision: **no hub-page change needed.** No `hub-page.diff` is produced.

Evidence, by line of `ghl/consent-hub-v11-ELEMENT-PASTE.html`:

- Lines 16-18: `?t=` is read with `params.get('t')`, saved to sessionStorage `consentToken`, and
  recovered from it when the URL has no `?t=`. Line 26 shows the expired message only when neither
  exists. An `adhoc_` token is just a string here.
- Line 34: `fetch(STATUS_URL + '?t=' + encodeURIComponent(token))`. `encodeURIComponent` leaves
  `adhoc_` plus hex byte-identical.
- Lines 37-39: `members = data.members || []`; the guard throws only when `!data.owner && !members.length`.
  A member response (owner null, one member) passes, and `solo = members.length === 0` is false.
- Lines 46-67: the owner card renders only when `data.owner` is set, so a member never sees an owner
  card or the `family-owner-part-1` link.
- Lines 78-96: one card from `members`; line 83 links to `FAMILY_PART1_URL + '?' + m.form_params`.
- Line 68: `celebrate = all_signed` when defined. v9 sets `all_signed` true only when the member's own
  agreement is signed, so the member sees the celebration for their own forms.

v11 is the latest hub source by version number (`ghl/` holds v6 to v11 ELEMENT-PASTE files, no v12).
It carries both live markers from `testing/2026-08-24-phase0-live-export/FINDINGS.md` item 8:
`ok - hub: v11 carries the live markers from phase0 FINDINGS item 8`. `ghl/consent-hub-page.html` is
an older mirror: its header reads "MIRROR of the v9 build" and it contains no `signPollCount` code.
(FINDINGS item 8 says the live page "matches repo `ghl/consent-hub-page.html`"; by those markers it
matches v11, not that file.)

Harness lines for the hub:

```
ok - hub: v11 renders the member response as one family-part-1 card
ok - hub: return visit without ?t= recovers the adhoc_ token and fetches with it
ok - hub: no regex, length, or hex check on the token in hub v11 or wf2
ok - hub: v11 carries the live markers from phase0 FINDINGS item 8
```

## Questions for Rob

**Q-1 (attestation radio).** v8's `formParamsFor` prefills `form_behalf=Child` for `member_type`
child (owner cards get `Self`). In the member view, an adult child opening their own link would see
"Child" preselected on Part 1. v9 keeps the identical value so the member's link is exactly the link
the owner's hub serves (HUB-04). If you want "Self" for a member opening their own link, the change
is one line in the v9 member-scope block: `m.form_params = formParamsFor(c);` becomes
`m.form_params = formParamsFor(c, true);`. `isOwner` only drives the radio value, so nothing else in
the link changes, but the member's link would then differ from the owner-view link by that one
parameter (the harness HUB-04 check would need the same exception). Your call; the default ships
as-is.

**Q-2 (hub copy).** The member sees the eyebrow "Family Consent Forms" (v11 line 43) and the family
intro "One quick consent form for each family member on your membership..." (lines 75-77). The
greeting uses their own first name (line 44). This works and is only cosmetic. Changing it means a hub
re-paste with a member-mode copy swap, using the solo-mode swap from `HANDOFF-owner-return-path.md` §A
("Hub solo mode") as the precedent. Not proposed here.

## Live checks for Phase 6

1. On the first real member send, confirm the GHL contacts search `eq` filter finds the member by
   their `adhoc_` token (open the member's hub link; a 404 page means the search did not match).
2. The member's link opens one card with their own name, and nothing about anyone else.
3. The owner's hub is unchanged (same cards and states as before the publish).
4. After the member completes Part 3 and signs, the owner's hub shows them complete.
5. Before publishing v9, check the token holders you will test with. In the 2026-08-25 contact pull,
   6 of 10 token holders had empty `member_type` and empty `owner_contact_id`. All 6 are sandbox or
   test contacts (sandbox membership ids or test names). v9 treats that shape as a member (fail closed),
   so their hubs would show the could-not-load message. Real owners are fine: wf1 stamps
   `member_type` owner on every owner since 2026-08-24, and the backfill stamped the rest. If any of
   those 6 are still used for testing, set their `member_type` to `owner` first.

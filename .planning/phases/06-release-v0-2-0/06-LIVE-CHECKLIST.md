# Phase 6 live-test checklist: v0.2.0 on a real Xcelsior owner and member (REL-03, D-03)

This is the run log for the v0.2.0 live test. Rob, or Claude working in Rob's logged-in tab, walks it top to bottom and fills in the empty cells. It is committed to a public repository, so the rules below decide what may be written into it.

Run order (fixed): P rows, then load the release build, then M-01 to M-10 (M-05, the mint, strictly before M-06, the reuse), then R-01 to R-12, then H-01 to H-08. After the Plan 06-05 approval, the tag, and the push: PR-01 and PR-02, then RB-01 to RB-04 (recorded together as PR-03). PR-01 runs only after `checklist-gate.cjs --pre-release` exits 0.

## Rules for this run

- **Test contacts only.** Every row uses the named test owner and test member from P-04, whose emails are Rob's own mailboxes, or a curl with a fake contact id. Never direct a check at a real patient's record.
- **Never write into this file:** the consent webhook URL, a contact id, an email address, a phone number, a hub token, or a Hint patient id. The repository is public.
- **Record only:** the mailbox letter (A = the test owner's mailbox, B = the test member's mailbox), the email subject, link match yes/no, the Note text, and the requestId. For a notification, record seen yes/no, the R-id it names, and the requestId; never the contact id it carries.
- **Result cell:** fill each with exactly `pass`, `fail`, or `deferred: <reason>` (a real reason after the colon). `harness/checklist-gate.cjs` reads only that cell, and anything else counts as invalid.
- **Restore** each test contact after a refusal row (email, tags, Owner Contact ID, Hint Membership ID, Consent Status, Consent Hub Token), and confirm the restore before the next row. If a row needs a value cleared and put back (a hub token, for example), keep the original in a private scratch note outside this repository.
- **Client cooldown:** 60 s per item per browser tab. A reload resets it. Wait it out or reload between presses of the same item.
- **No push before approval (D-02).** Pre-release rows must not push anything, create a tag, or load the build from jsDelivr at a commit sha.
- **Consequences.** Any failed pre-release row (P, M, R, H) means Rob answers "hold" at the Plan 06-05 decision. Any failed post-release row (PR, RB) means run the rollback below.
- Every row table in this file ends with a `Result` column, left empty until the row is run. The M and R tables use the columns shown in their sections. The P, H, RB, and PR tables use `Id | Check | Expected | Observed | Result`.

After each session, run the gate and paste its output under "Result":

```bash
node .planning/phases/06-release-v0-2-0/harness/checklist-gate.cjs
node .planning/phases/06-release-v0-2-0/harness/checklist-gate.cjs --pre-release
```

## Before you start

| Id | Check | Expected | Observed | Result |
|---|---|---|---|---|
| P-01 | wf2 Build Status in n8n | v9 is published, and the node's first line reads `// v9: MEMBER SCOPE (2026-10-07)`. An existing owner hub still shows the whole family. | | |
| P-02 | Email template "Member Consent Forms" in ClinX | Saved, and its preview renders the Xcelsior header, the button, and the footer. | | |
| P-03 | "[Ready] Admin Menu: Consent Actions (webhook)" | Built and Published. BUILD-SPEC §10 V-01..V-13 are ticked, and the §6.3 pilot gate passed (record its date in the run header). | | |
| P-04 | Test contacts per BUILD-SPEC §6.3 step 2 | Test owner: Member Type owner, a Consent Hub Token, email = mailbox A. Test member: tag family-member, Owner Contact ID = the test owner, the same Hint Membership ID, no Consent Hub Token, email = mailbox B. Both emails use letters-only plus-tags. | | |
| P-05 | Legacy-shaped token holders (deliverables README check 5) | Member Type is set to owner on any test token holder used whose Member Type and Owner Contact ID were both empty. | | |
| P-06 | Release commit (Plan 06-04) | The consent URL is wired in config, `npm test` ends `PASS 165/165`, and `node .planning/phases/06-release-v0-2-0/harness/prepush-scan.cjs --history` ends `PASS 7/7`: the tree is clean, and after Plans 06-02 and 06-03 no unpushed commit carries a patient id. Record the release commit's short sha here and in the run header. | | |
| P-07 | Installed snippet version | `GHLC.version` in the console, before the release build is loaded, reads the installed version (0.1.1 or 0.1.2). Record it. | | |

## Load the release build into a logged-in ClinX tab

Staff use 365.clinx.net, where the agency snippet is already installed. Injecting the release build on top of it does nothing: the boot guard in `src/ghl-customizer.js` sees `window.GHLC` from the running copy, logs `duplicate-instance`, and returns. So the installed snippet must be kept from running, or its requests must be answered with the release bytes. Use one of these two methods.

**Method A (preferred; it worked live on 2026-10-07 in 04-UAT test 4).** In the logged-in Playwright tab, route the snippet's jsDelivr requests for `src/ghl-customizer.js`, `src/ghl-customizer.css`, and `config/agency-config.json` (at any tag) to the bytes of `git show <release sha>:<path>`, with the content types `application/javascript`, `text/css`, and `application/json`. Optionally route `test/fixtures/logos/*.svg` the same way; otherwise the Dummy Clinic logo URL at the new tag fails before the push and that location keeps its native logo, which is expected. Leave every other request untouched. Unlike 04-UAT, webhook POSTs must reach HighLevel this time, so do not block them. Then reload.

**Method B (Rob's Chrome with Claude-in-Chrome).** Open DevTools, Network, Request blocking, add the pattern `cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme`, enable it, and reload, so the installed snippet never runs. Then run the blob-URL recipe with the files from the release commit:

1. Create same-origin blob URLs for the config JSON and the CSS (`URL.createObjectURL(new Blob([text], { type: ... }))`).
2. Create a fake script element carrying `data-config` (the config blob URL) and `data-css` (the CSS blob URL), then `Object.defineProperty(document, 'currentScript', { configurable: true, get: () => fakeScriptEl })`.
3. Evaluate `src/ghl-customizer.js` from the release commit verbatim, then `delete document.currentScript`.
4. Read state in a second call (the javascript tool times out at 45 s).

After any full reload, repeat the injection. Request blocking stays on for the whole run. `http://127.0.0.1` script URLs do not work here: they are blocked as mixed content.

**Forbidden before the Plan 06-05 approval:** loading the build from jsDelivr at a commit sha. It needs `git push`, which D-02 forbids until Rob approves.

**Load check, after either method:** `GHLC.version` is `0.2.0`, `GHLC.verify().config.menuIds` includes `xcelsiorActions`, and the console shows no `duplicate-instance` line. Drive location changes with `history.pushState` followed by `history.back()`, because the sub-account picker closes under automation.

## Run header

| Field | Value |
|---|---|
| Date | |
| Release commit (short sha) | |
| Load method (A or B) | |
| Installed snippet version (P-07) | |
| Operator(s) | |
| Consent workflow published / pilot gate date | |

## Menu items on a real Xcelsior owner and member

Send individual consent and Resend Consent Hub link post to one shared URL, the consent workflow's Inbound Webhook trigger, and only `buttonId` (`send-individual-consent` or `resend-consent-hub`) tells them apart. The Note text on each row proves which branch ran.

| Id | Record | Do | Expected | Observed email | Observed Note | Observed notification | Result |
|---|---|---|---|---|---|---|---|
| M-01 | Test owner | Open the record and the Actions menu, at the default viewport and again at a short viewport height | One Actions trigger in the name row. Items in order: Send Invite, Send individual consent, Resend Consent Hub link, Copy contact ID; all four ready. The panel is fully visible at both heights, not clipped by any overflow ancestor (04-UAT test 4 re-check). | | | | |
| M-02 | Test owner | Keyboard and close paths (MENU-04, MENU-05) | Enter, Space, and ArrowDown open the menu with focus on the first item. ArrowUp and ArrowDown wrap; Home and End jump. Esc closes and returns focus to the trigger; Tab closes. An outside click closes it, and navigating to another contact closes it. | | | | |
| M-03 | Test owner, then test member | Send Invite on each; then press it again within 60 s | Each press makes one POST, and the trigger flashes "Actions · Workflow triggered". The Hint join link email arrives in mailbox A (owner) and B (member). Longevity branch (BUILD-SPEC §7.4): a contact without longevity tags gets the DPC email. The second press within 60 s is refused by the cooldown, and the other items stay usable meanwhile (per-item cooldown). | | | | |
| M-04 | Test owner, then test member | Copy contact ID on each | The clipboard equals the id in the address bar (record match yes/no, never the id). The trigger flashes "Actions · Contact ID copied". | | | | |
| M-05 | Test member | Send individual consent (mint path; the member holds no Consent Hub Token) | Mailbox B gets "Your Xcelsior consent forms". The link's `?t=` equals the member's saved Consent Hub Token, `adhoc_` plus 64 hex (record match yes/no). Tag consent-pending is added. Note: "Individual consent email sent by staff via Actions menu (request <requestId>)". No email in mailbox A. | | | | |
| M-06 | Test member | The same item again, after 60 s or a reload (reuse path). Run only after M-05. | Mailbox B gets a second "Your Xcelsior consent forms" with the same link as M-05 (record match yes/no). No new token is written. A second Note with the M-06 requestId. | | | | |
| M-07 | Test owner | Resend Consent Hub link | Mailbox A gets the d6cf9af1 invite for the owner's leaf (BUILD-SPEC §5.4; record the subject). The Note "Consent Hub link resent by staff via Actions menu (request <requestId>)" lands on the owner. | | | | |
| M-08 | Test member | Resend Consent Hub link | The owner (mailbox A) gets the d6cf9af1 invite, not the member. The Note lands on the owner, not the member. This confirms the Find Contact context switch live (STATE concern, V-05). | | | | |
| M-09 | Test member | Email flip (04-UAT test 5): save the member's email as a `+12@` form of mailbox B, reopen the menu, press Send individual consent; then restore the real email, save, reopen | With the `+12@` form: Send individual consent shows unavailable with "Needs the member's own email", the other three stay usable, and pressing it starts no workflow run (no POST, no Note, no email). After the restore: the item is ready again. | | | | |
| M-10 | A Dummy Clinic contact record | Switch location (`history.pushState`, then `history.back()`) and open a contact | No Actions menu and no Xcelsior action on the record. The Help Center header link is still present. | | | | |

## Refusal paths

For every row: the Note (R-01 has none) lands on the clicked record with the register text, an internal notification names the R-id, the buttonId, the requestId, and the contact id, the run ends at that refusal, and **Email sent must be none on every row** (check mailboxes A and B; write "none" or what arrived). For R-12 that means none from the refused run; the other run sends exactly one email. Restore the test contact after each row.

UI press where the menu can produce the refusal; otherwise use the curl helper. It reads the consent URL at run time from the release commit's config into a shell variable and never echoes it. Run it from the repository root with the release commit checked out. Set `TEST_OWNER_ID` and `TEST_MEMBER_ID` in your shell only, never in this file.

```bash
# Consent URL from the release config (both consent items share it). Never echo it.
CONSENT_URL="$(node -p 'require("./config/agency-config.json").menus[0].items.find((i) => i.id === "resend-consent-hub").action.url')"
[ -n "$CONSENT_URL" ] || echo "consent URL is empty: check out the release commit (Plan 06-04) first"
# live_post <contactId> <buttonId> <requestId>   (requestId form: live-<row id>-<n>)
live_post() {
  curl -sS -o /dev/null -w 'HTTP %{http_code}\n' -X POST "$CONSENT_URL" \
    -H "Content-Type: application/json" \
    -d "{\"contactId\":\"$1\",\"locationId\":\"Cp2XxBsRoyKS2CUf1Hwi\",\"buttonId\":\"$2\",\"requestId\":\"$3\",\"sentAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"email\":\"\",\"phone\":\"\",\"source\":\"phase6-live\"}"
}
```

| Id | D-03 path | Trigger | Setup on the test contact (restore after) | Expected Note (BUILD-SPEC §9) | Observed Note | Observed notification | Email sent | Result |
|---|---|---|---|---|---|---|---|---|
| R-01 | contact not found | curl: `live_post live-fake-contact-0001 send-individual-consent live-R-01-1` | None: the contactId resolves to nothing | None (there is no contact). Notification only: "Consent action failed: contact not found. Action {{inboundWebhookRequest.buttonId}}, request {{inboundWebhookRequest.requestId}}, contact {{inboundWebhookRequest.contactId}}." | | | | |
| R-02 | - | curl: `live_post "$TEST_OWNER_ID" unknown-action live-R-02-1` | None | "Consent action failed: unknown action ({{inboundWebhookRequest.buttonId}}). No email sent. Check the Actions menu item id in the admin-theme config." (on the test owner) | | | | |
| R-03 | - | UI: Send individual consent on the test owner | None: the owner has no family-member tag | "Not a family member. Use Resend Consent Hub link on the owner." | | | | |
| R-04 | synthetic email | UI: Send individual consent on the test member with tag synthetic-email and its real mailbox B email (the client does not read tags). Then the `+<digits>@` and `+pat-<id>@` forms: the item shows unavailable in the UI (record that), so curl `live_post "$TEST_MEMBER_ID" send-individual-consent live-R-04-<n>`. Also an empty saved email, and the `+<this member's hint_patient_id>@` form (UI if the item shows ready, else curl). | Add tag synthetic-email; then save each synthetic email form in turn; then clear the email. Restore: remove the tag and save mailbox B again. | "Member has no own email. Enter their real email first, or use Resend Consent Hub link on the owner." (each case) | | | | |
| R-05 | legacy member | UI: Send individual consent on the test member | Clear the member's Owner Contact ID (then separately its Hint Membership ID). Restore both. | "Legacy member without an owner link. Needs backfill before an individual consent can be sent." | | | | |
| R-06 | shared email | UI: Send individual consent on the test member, three times | (1) Save the owner's email (mailbox A) on the member. (2) The same address with a case-only difference: must still refuse. (3) Restore the member's email, then clear the owner's saved email: second text. Restore both emails. | "Member's email matches the owner's. Use Resend Consent Hub link on the owner." for (1) and (2). Second text for (3): "Could not confirm the member's email differs from the owner's. Check that both records have a saved email, then press again." | | | | |
| R-07 | already complete | UI: Send individual consent on the test member | Set the member's Consent Status to complete. Restore it. | "Already complete. Nothing to send." | | | | |
| R-08 | - | UI: Resend Consent Hub link on the test member | Clear the member's Owner Contact ID (the member is not an owner and holds only an `adhoc_` token or none). Restore it. | "No owner found for this member. Check the owner link or use the owner's own record." | | | | |
| R-09 | - | UI: Resend Consent Hub link on the test owner | Clear the owner's Consent Hub Token (keep the original in a private scratch note). Restore it. | "The owner has no Consent Hub link (legacy or never invited). Needs a hub token before a link can be resent." | | | | |
| R-10 | - | UI: Send individual consent on the test member | Test member only, with no Consent Hub Token: temporarily change the last line of "Mint member hub token" to `output = { token: 'broken', mintedAt: Date.now() };`. Restore the line, re-run Test your Code, and clear the member's Consent Hub Token. | "Member hub token could not be created or saved. Nothing was sent. Rob must check the Mint member hub token step and clear this member's Consent Hub Token if it is not empty." | | | | |
| R-11 | - | UI: Send individual consent on the test member | Paste the test owner's Consent Hub Token into the member's Consent Hub Token; press. Repeat with the value `adhoc_123`. Clear the member's token after each. | "This member holds a hub token that is not their own member token (it may be a copy of the family token). Nothing was sent. Rob must clear this member's Consent Hub Token, then press again." | | | | |
| R-12 | - | curl, two posts a few seconds apart: `live_post "$TEST_MEMBER_ID" send-individual-consent live-R-12-1`, wait about 5 s, then `live-R-12-2` | The member holds no Consent Hub Token (clear it first) | "Another press for this member saved a newer hub token and is sending the email. This run sent nothing." Exactly one R-12 Note, and exactly one "Your Xcelsior consent forms" email in mailbox B whose link equals the stored token (V-13). | | | | |

## Hub and completion path

These mirror the deliverables README "Phase 6 live checks" items 1-8, in order. Open hub links in a private window.

| Id | Check | Expected | Observed | Result |
|---|---|---|---|---|
| H-01 | Open the member's link from M-05 | The member's hub opens (the contacts search finds the member by their `adhoc_` token), not the not-found page. | | |
| H-02 | Contents of the member's hub | One card with the member's own name, and nothing about anyone else. | | |
| H-03 | Open the test owner's hub | Unchanged: the same cards and states as before the publish. | | |
| H-04 | Member completes Part 3 and signs | The owner's hub shows the member complete. May be `deferred: <reason>` if completion cannot be run in this session. | | |
| H-05 | Member Type owner on legacy-shaped test token holders | Done at P-05; this row records the same result. | | |
| H-06 | Open the consent hub page with `?t=adhoc` and with `?t=adhoc_` | Both show "We could not load your consent forms" (or "This link has expired"), never a card. | | |
| H-07 | The member's real link with the last character removed, and with one character changed | Both show the could-not-load message. | | |
| H-08 | The test owner's real link with one character changed | The could-not-load message, not the family. | | |

## Rollback to v0.1.2

Staff go back to v0.1.2 by changing only the tag in the HighLevel snippet, in both URLs. This is the README install snippet with the tag set to `v0.1.2`:

```html
<script src="https://cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme@v0.1.2/src/ghl-customizer.js"
        data-config="https://cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme@v0.1.2/config/agency-config.json"
        defer></script>
```

Nothing in ClinX changes for the rollback. To stop the consent workflow completely as well, set "[Ready] Admin Menu: Consent Actions (webhook)" to Draft (BUILD-SPEC §11).

| Id | Check | Expected | Observed | Result |
|---|---|---|---|---|
| RB-01 | Agency Settings, Company, Custom JavaScript: change the tag in both URLs to v0.1.2 and save | Both URLs read `@v0.1.2/`; saved. | | |
| RB-02 | Reload the test owner record | `GHLC.version` is 0.1.2. No Actions menu. The plain "Send Invite" button is in the name row. | | |
| RB-03 | Press Send Invite | "Workflow triggered", and the Hint join email in mailbox A, still through trigger bde416ab. No ClinX change was made. v0.1.2 behavior to expect: the button also shows at other locations (scope "all"), it cools down for 10 s, and no consent item exists anywhere. The consent workflow may stay Published, because nothing in v0.1.2 posts to it; to stop it completely, set it to Draft (BUILD-SPEC §11). | | |
| RB-04 | Roll forward: set both URLs back to v0.2.0, save, reload | `GHLC.version` is 0.2.0, and the Actions menu is back. | | |

## After the tag

Run these only after the Plan 06-05 approval, the tag, and the push.

| Id | Check | Expected | Observed | Result |
|---|---|---|---|---|
| PR-01 | Move staff to v0.2.0 (README "Releasing a new version" step 5) | Run only when `node .planning/phases/06-release-v0-2-0/harness/checklist-gate.cjs --pre-release` exits 0 (every P, M, R, and H row is pass or deferred with a reason, and none failed) and Plan 06-05 verified that jsDelivr serves @v0.2.0. Then switch both snippet URLs to v0.2.0, save, and reload. This holds even after an approve-live-deferred answer: deferring the live run defers staff, too (D-03). | | |
| PR-02 | Smoke test on the installed build | `GHLC.version` is 0.2.0, and `GHLC.verify()` shows menuIds `xcelsiorActions` and the contact mount found. Then repeat M-01 and M-04. | | |
| PR-03 | Rehearse the rollback | RB-01 to RB-04 all pass, ending back on v0.2.0. | | |

## Result

After each session, paste the gate's two count lines and its final line here (it prints counts and row ids only).

| Session date | pre-release line | post-release line | Final line |
|---|---|---|---|
| | | | |

- Any pre-release failure (a P, M, R, or H row is `fail`) means Rob answers "hold" at the D-02 decision in Plan 06-05.
- Any post-release failure (a PR or RB row is `fail`) means run the rollback to v0.1.2 above.
- Staff move to v0.2.0 (PR-01) only after `checklist-gate.cjs --pre-release` exits 0.
- Phase 6 verification stays open until the gate prints `LIVE-RUN-COMPLETE` and exits 0 (D-03).

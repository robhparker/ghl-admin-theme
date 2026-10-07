---
title: Audit — "WEBHOOK TEST Send Hint JOIN LINK & Reminders" vs "[Ready] Send Hint JOIN LINK & Reminders"
date: 2026-10-07
method: Read-only GETs against backend.leadconnectorhq.com using the logged-in Playwright session (canvas rendered blank). Nothing saved or published.
location: Cp2XxBsRoyKS2CUf1Hwi (Xcelsior Health)
---

# WEBHOOK TEST Send Hint JOIN LINK & Reminders (3dff9d94-403f-41ae-8496-c47320fc0ea6)

- **Status:** published, version 5. Duplicated from c140f93c on 2026-09-24; last edited 2026-09-26.
- **Folder:** e0a03a6d-… (same folder as the [Ready] workflow).
- **Trigger:** `inbound_webhook`, id **`bde416ab-a074-4946-bf99-7266eb1b0f4e`**. This is the
  URL Send Invite posts to (`config/agency-config.json`). It has no trigger filters. Active.
- **Contact matching:** the trigger itself does **not** attach a contact. The first action is
  **Find Contact** with `id == {{inboundWebhookRequest.contactId}}` (multi-path):
  - *Contact found* → continues on that exact contact.
  - *Contact not found* → empty branch; the run ends silently.
  - Evidence: run 1 (2026-09-26 19:14, v4, before Find Contact existed) enrolled with **no contact**
    and the email step was **skipped**. Runs 2 and 3 (19:25 and 19:26, v5) resolved the contact by ID and sent.
- **Actions in order:**
  1. Find Contact by Webhook Contact ID (`id = {{inboundWebhookRequest.contactId}}`)
  2. If/Else (on found): has any tag `form:longevity` | `longevity-interest` | `trigger:longevity` |
     `reason:longevity` **and** NOT tag `trigger:direct`
     - Branch → Email "Longevity Hint Link Email" (template 6a7a0bb98dcff31cf0c12fef)
     - None → Email "DPC Hint Link Email" (template 6a7a0b638dcff31cf0c12736; link-click on the
       Hint signup URL adds tag `hint-complete`)
  3. End. There are **no waits, SMS, reminders, field writes, or goals**, despite "& Reminders" in the name.
     The tag write happens only on link click.
- **Settings:** allowMultiple = true (re-entry allowed); removeContactFromLastStep = true.
- **Enrollments:** 3 total, 3 finished, all 2026-09-26 (Rob's test contacts). Trigger log: 3 fired, 3 qualified.
- **Sample execution (2026-09-26 19:26:44, contact MrNb0EcF5PQT6mwhhzz2):** added → Find Contact 200 →
  condition → None branch → DPC Hint Link Email 201 "Email queued" (subject "Robert, Welcome to
  Xcelsior Health") → removed at end of workflow. Total run time about 3 s.

# [Ready] Send Hint JOIN LINK & Reminders (c140f93c-3708-46f5-9238-c31495d09d8f)

(The brief called this "Send Hint Registration + Forms". No workflow by that name exists. The nearest
is the draft "Resp/NotResp Copy - [Ready] Stage 4: Send Hint Registration & Reminders", c24af6a2.)

- **Status:** published, version 35.
- **Trigger:** `pipeline_stage_updated` "Packet Sent". Filter: pipeline `GLEnO5x5RTlpwauylrRf`,
  stage `85b8329a-660e-4df6-bd54-00535679228c`.
- **Actions:** identical to steps 2–3 above (same If/Else, same two email templates). There is no Find Contact
  step, because the trigger already carries the contact.
- **Enrollments:** 49 total, 49 finished (latest early October 2026, all DPC branch in the sample).

# Diff

| | WEBHOOK TEST | [Ready] |
|---|---|---|
| Trigger | Inbound Webhook bde416ab | Pipeline stage "Packet Sent" |
| Contact resolution | Find Contact by payload `contactId` | Native (opportunity contact) |
| Steps after | Same If/Else + 2 emails | Same |
| Volume | 3 test runs | 49 production runs |

# Implications for v0.2.0

1. **Matching is by exact contact ID, not email.** This removes the email-collision risk in decision 6
   of `actions-menu-individual-consent.md`, provided the consent workflow uses the same Find Contact pattern.
   The proposed `contactId` vs `{{contact.id}}` If/Else guard is then redundant. Find Contact by ID is
   the guard. Still verify in the ClinX UI that the post-Find-Contact `{{contact.*}}` context is the found contact.
   Runs 2 and 3 suggest it is: the email went to the found contact.
2. "Contact not found" ends silently. Staff get no signal, but the client already shows "Request sent" or
   "unconfirmed". Consider adding an internal notification on that branch.
3. Send Invite inherits the Longevity branch. A contact tagged `longevity-interest` (without
   `trigger:direct`) gets the **Longevity** email from the Send Invite button. That may or may not be wanted
   (the LP menu item is deferred in the seed).
4. allowMultiple = true, and nothing server-side dedupes. The client 60 s cooldown is the only throttle
   (accepted in decision 4).
5. The name is misleading: it is a production path (the Send Invite button in v0.1.2), labeled TEST, and has no reminders.

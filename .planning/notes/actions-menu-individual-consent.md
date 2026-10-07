---
title: Actions menu + "Send individual consent" — exploration decisions
date: 2026-10-07
context: /gsd-explore on the brief ghl-action-menu-family-consents.md (admin theme v0.1.2 + hint-api family consent system). Input for /gsd-new-milestone.
---

# Decisions (Rob, 2026-10-07)

1. **Member token lives in `consent_hub_token`** (no new field). The member email
   reuses `https://join.xcelsiorhealth.com/consent-hub?t={{contact.consent_hub_token}}`.
   - wf2 lookup ("Find Owner by Token") already finds whichever contact holds the token,
     then lists the whole membership via `hint_membership_id`.
   - **Required wf2 change:** in Build Status, if the token holder is not the owner
     (`owner_contact_id` set / `member_type` != owner), return only the holder's card.
     Without this, a member would see every family card.
   - Completion path unchanged: Parts 1-3 -> 5.8 workflow on the member -> wf3 recount
     against owner via `hint_membership_id` -> owner's hub shows member done.
2. **Eligibility = staff judgment. No age/DOB gate.** Rob: parents often reuse their own
   email for children anyway.
3. **Email guard:** refuse when the member has tag `synthetic-email` or the email equals
   the owner's. Refusal message points staff to "Resend Consent Hub link" on the owner
   (wf1 already turns a shared signup email into a synthetic `+<hint_patient_id>` key).
4. **Hardening: client cooldown only.** No server-side dedupe, no INV-01..05 this milestone.
   Accepted risk AR-03-01 grows in volume (spam/confusing emails) but not in disclosure:
   the link only ever goes to the address already on file.
5. **Menu v1 = 4 items, Xcelsior only** (location `Cp2XxBsRoyKS2CUf1Hwi`): Send Invite,
   Send individual consent, Resend Consent Hub link, Copy contact ID. Other locations keep
   plain buttons. Longevity Plus deferred.
6. **Routing: ClinX Inbound Webhook**, one trigger branching on `buttonId`, matching on
   email only (never phone).
   - Known risk: if staff put the same real email on two members, email matching may run
     the workflow on the wrong member. Rob accepted Inbound Webhook over n8n-by-contactId.
   - Proposed cheap guard (UNVERIFIED — check in ClinX UI during build): If/Else comparing
     the payload `contactId` (`{{inboundWebhookRequest.contactId}}`) with `{{contact.id}}`;
     stop on mismatch. Needs no new payload field.

# Still open (ask in /gsd-new-milestone)

- What "WEBHOOK TEST Send Hint JOIN LINK & Reminders" does today; rename for production?
- Cooldown length per item.
- Is v0.1.2 installed in Agency Settings yet?
- Legacy backfilled members with no `owner_contact_id`/`hint_membership_id`: refuse with reason.
- Member already `consent_status=complete`: refuse with reason.

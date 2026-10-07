---
title: Deferred consent-action hardening + Longevity Plus menu item
trigger_condition: A wrong-contact or spam consent email incident, OR Longevity Plus invite launches, OR v2 companion work (INV-01..05) starts
planted_date: 2026-10-07
---

Deferred during the 2026-10-07 exploration (see notes/actions-menu-individual-consent.md):

- Route consent actions via n8n by `contactId` (no email-match ambiguity, no premium
  trigger, guards in code; n8n tags the exact contact, a tag-triggered ClinX workflow sends).
- Server-side dedupe by `requestId` / recent-send tag.
- INV-01..05 companion service (moves webhook URL out of public config; closes AR-03-01).
- Menu item "Send Longevity Plus invite" (template `membership-invite-lp.mjml` exists).

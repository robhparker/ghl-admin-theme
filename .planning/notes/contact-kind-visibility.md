---
title: Contact-kind visibility (showWhen) and the "Why?" view - decisions
date: 2026-11-12
context: Staff pressed "Send individual consent" on a lead and got refusal R-03. The Actions menu should only offer items that can work for the open contact. Rob also asked for a way to see why an item is greyed out for another user. Target release v0.3.0.
---

# Live probe (read-only, Dummy Clinic sample contacts on 365.clinx.net, 2026-11-11)

- Tags row: `div.record-tags` inside `#record-details-lhs` (the region the script already observes).
- Header `<p>`: `Tags (2)` with two tags; `Tags ` (no count) with none.
- Chip: `span.record-tag-chip#tag-<tag name>`, e.g. `tag-high priority`.
- On a cold load the header and chips appeared together; no empty intermediate state was seen at 200 ms resolution.
- Contact type: `div#contact.type`, text `Lead`. HighLevel defaults it to Lead, so it is not a member signal.
- Custom-field folders render headers only while collapsed. Member Type and Owner Contact ID are not in the DOM.
- app.gohighlevel.com only spun under automation; 365.clinx.net worked.

Live check on Rob's test lead (Xcelsior, 2026-11-12, commit e8b41b0 loaded over the installed v0.2.1 in one tab):
- The lead carried one tag (`prelaunch-contact`): Send Invite and Copy contact ID shown, both consent items hidden, with the right reasons in the report.
- Adding `family-member` through HighLevel's Select tags dialog produced one childList mutation inside the tags row, and both consent items appeared with no reload.
- To load an unreleased build beside the installed one: set `window.__GHLC_TEST__ = true`, inject the script tag at the commit sha, remove the old stylesheet link, call `GHLC.__test.boot()`, then remove the contact group and call `GHLC.__test.renderAll()` in the same tick so the new instance owns the menu.

Survey of the Xcelsior location (2026-11-12, Rob approved looking around; tallied in the page from the contact list the app itself loads, counts only):
- 1,870 contacts. Contact type: 1,269 active patient, 346 inactive patient, 185 lead, 70 n/a. So Contact type IS maintained here, unlike the Dummy Clinic default; it was not needed for the rule.
- `hint-complete`: 84 contacts (71 active, 10 inactive, 3 lead). `consents-needed`: 73, all of them also `hint-complete`. `all-consents-complete`: 40, all also `consents-needed`. These are the wf1 owners, the ones with a hub token.
- `family-member`: 13 (11 with `consent-pending`).
- 1,187 active patients carry none of those tags; 1,073 of them carry `legacy-system`. They have no hub token or owner link, so the consent workflow refuses them (R-05, R-08, R-09). Hiding both consent items for them matches the guards.
- Rob's hand-made pilot test owner carries no tags, so it reads as a lead. Real wf1 owners do carry `hint-complete`.
- Tags per contact: at most 9. 22 contacts have more than 6, and 21 of those are members.
- Long lists: HighLevel shows the first six chips (stored order) and `#tags-show-more-button-default` ("N more"), which adds the rest in place. Checked on a 9-tag and a 7-tag record. All 21 many-tag members have a rule tag among their first six.

Not yet checked:
- Whether an Account User sees the tags row.

# Decisions

- D-1 Signal = tag chips. No lookup endpoint, no network call. The endpoint is deferred to the hardening seed.
- D-2 Rule = `showWhen: { tagsAny?, tagsNone?, unknown? }`, a sibling of `requires`. At least one list. `unknown` defaults to `hide`. Any other shape is a validation error. Allowed on menu items and contact-placement buttons.
- D-3 Completeness check: the header count against the chip count. Equal means the whole list. Fewer chips means a collapsed list: a visible chip proves its tag (it can satisfy `tagsAny` or trip `tagsNone`), but absence proves nothing, so an unsettled rule is unknown until staff press "N more". More chips than the count means unknown. The script never clicks HighLevel's button itself.
- D-4 Hide for the wrong kind of contact; keep grey-with-reason for the fixable `requires` case.
- D-5 Hidden items stay in the DOM with the `hidden` attribute, so the menu is not rebuilt and an open menu stays open.
- D-6 The rule is re-read on reconcile, on menu open, and at click time.
- D-7 Shipped rules: `send-individual-consent` needs `family-member`; `resend-consent-hub` needs one of `family-member`, `hint-complete`, `consents-needed`, `all-consents-complete`; `sendInvite` and `copyContactId` have no rule.
- D-8 Label: "Send individual consent" becomes "Email this member their own consent forms". The id is unchanged.
- D-9 "Why?" view: Alt-click on the Actions trigger (Alt+Enter from the keyboard). Read-only. The first build used `?`; the live check on 2026-11-12 showed HighLevel binds `?` page-wide for its own shortcuts panel, and binds many other single keys, so the view has no key of its own. The panel is `position: fixed` because the contact column clips anything wider than itself. Copy report. `GHLC.diagnose()` returns the same report and `verify()` includes it. The report carries ids, states, counts, and config tag names only.
- D-10 A greyed menu item shows its reason beside its label (CSS only).

# Open questions answered with the recommended default (Rob approved the plan without changes, 2026-11-12)

1. Send Invite stays visible on existing members.
2. Resend Consent Hub link is hidden on a legacy dependent (tags cannot tell one from a lead).
3. "Member" tags are `hint-complete`, `consents-needed`, `all-consents-complete`. To confirm on the test owner before the tag is cut.
4. Version v0.3.0.
5. Tag names in the public config are accepted (workflow labels, not patient data).

# Manual steps for Rob

- R-03 text in the ClinX workflow (§4.1) and in BUILD-SPEC §4.1 and §9. Proposed: "This contact is not tagged as a family member, so there is no personal consent email to send. For an owner, use Resend Consent Hub link. For a lead, use Send Invite."
- Swap the Agency Settings snippet to v0.3.0 after the tag is served.
- Account User check of the tags row.

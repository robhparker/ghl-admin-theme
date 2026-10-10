---
phase: 06-release-v0-2-0
plan: 05
status: complete
requirements: [REL-02, REL-03]
---

# 06-05 Summary: v0.2.0 tagged, pushed, and served

**Decision:** Rob approved the release on 2026-10-10 ("Let's create V2 and run it"). That is equivalent to approve-live-deferred: the 06-LIVE-CHECKLIST pre-release rows were not walked. Rob's own §6.3 pilot of the consent workflow (runs 0101-0106, mailbox delivery confirmed by Rob) covered the backend. V-04 is closed with the sending-domain click redirect accepted, because the token survives it.

**Gates re-run right before tagging (HEAD 980fc7f):** npm test PASS 165/165; prepush-scan PASS 6/6; prepush-scan --history PASS 7/7 (no patient id in 80 commits); fast-forward ok; shipped files identical to the release commit 67cb44c. checklist-gate --pre-release: OPEN (37 rows open).

**Tag:** annotated v0.2.0, tag object df55386b80239fc7dd76bbbbaf114b23bc5bdeb4, on commit 980fc7f50b63cbcac70bc46a4987cac6f38f31fd.
**Push:** `git push origin main --tags`. origin main moved from 90c32ea to 980fc7f, and only the v0.2.0 tag was new. origin has no backup, scrub, refs/original or refs/t3 refs. The backup/pre-scrub-20261008 tip is not reachable from origin main.

**jsDelivr @v0.2.0:** HTTP 200; byte-identical to the tag (sha256 prefixes):
- src/ghl-customizer.js 108d6a3985f43fe4 (VERSION 0.2.0)
- src/ghl-customizer.css a6d0c010f677a98a
- config/agency-config.json 20092a07ab32a7ee
- test/fixtures/logos/loc-a.svg c6ce069ce50db030

**Rollback target:** @v0.1.2 still serves VERSION 0.1.2, and its config returns 200. The v0.1.0, v0.1.1 and v0.1.2 tag objects are unchanged.

Output lines: TAG-SERVED-AND-BYTE-IDENTICAL, PUBLISHED-CLEAN-AND-TAG-GUARDED.

**Next (Rob):**
1. Change both snippet URLs in Agency Settings → Company → Custom JavaScript from @v0.1.2 to @v0.2.0 (PR-01).
2. Smoke-test on a test contact (PR-02).
3. Rollback, if ever needed: put @v0.1.2 back in both URLs.

The live checklist rows stay open as UAT. Phase 6 verification stays human_needed until checklist-gate prints LIVE-RUN-COMPLETE.

**Owed:** a BUILD-SPEC update for the pilot redesign (§4.4, §4.6, §5.2, §8, §10, V-09b, R-13, the self-webhook forward, and V-04 with the redirect accepted). For /gsd-complete-milestone: v0.2.0 already exists, and the git-tag step skips it.

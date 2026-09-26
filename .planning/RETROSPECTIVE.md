# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.1.0 — GHL Customizer

**Shipped:** 2026-09-25 (archived 2026-09-26)
**Phases:** 3 | **Plans:** 7 (+1 quick task) | **Sessions:** ~14 working blocks over 2 days (89 commits)

### What Was Built
- One vanilla IIFE (2,513 lines) that reads a public JSON config, resolves location and contact from the URL through a single adapter, and renders a contact-record "Send Invite" button that POSTs once to a HighLevel Inbound Webhook trigger, plus header link buttons with per-location overrides.
- Per-location sidebar logo switching with agency-then-native fallbacks, generation-guarded preloads, and one scoped MutationObserver that survives HighLevel re-renders.
- Per-location accent colors as inline CSS custom properties on the customizer's own surfaces and the sidebar container, with WCAG 4.5:1 fallbacks and a marker-scoped stylesheet.
- README-driven install, GitHub + jsDelivr hosting pinned to immutable tags (v0.1.0, v0.1.1, v0.1.2), a 119-check zero-dependency test suite over a DOM shim, and an offline browser harness.
- Live-verified in the agency: Dummy Clinic (full theme) and Xcelsior Health (HighLevel-hosted logo, primary only).

### What Worked
- Verifying selectors against the live HighLevel DOM early (Phase 1) instead of trusting community guides; every class-based contact-record guess was wrong and the live check caught it before code depended on it.
- The adapter object as the only place HighLevel selectors live, plus `GHLC.verify()`: both live failures in Phase 3 UAT (sidebar specificity, active-nav classes) were diagnosed in minutes from the verify report and fixed without touching the rest of the script.
- Injecting the served build into a logged-in HighLevel tab (script tag pointed at a commit hash on jsDelivr) as the live test loop: it proved v0.1.1 and v0.1.2 before the snippet changed and needed no hosting.
- Zero dependencies and one static suite gate per invariant (ghlc-scoped selectors, no `!important`, tag-pinned URLs, no secrets in JSON) kept every fix honest; the gate that forbids `!important` forced the cleaner `:not(#ghlc-boost)` specificity boost.
- Immutable tags made rollback a one-line edit and let the UAT rehearse both rollback and the kill switch live.

### What Was Inefficient
- Phase 3 shipped v0.1.0 on unverified live assumptions (attribute-selector specificity, active-nav class names, which form the Custom JavaScript field accepts); all three were wrong and cost a v0.1.1 plus a README rewrite. A live smoke test before tagging would have folded them into v0.1.0.
- Verification staleness is content-fingerprinted, so every post-verification code commit (even the verifier's own recommended test fix, even a release bump) re-staled the report and needed a digest recompute; the milestone closed as an override for the same reason. Verify last, or budget a re-run.
- The harness linked the customizer stylesheet before its own styles, so the harness could never show the themed sidebar; nobody noticed until the automated walkthrough compared computed colors.
- Config-only changes (adding a client) cost a full version bump across seven files by design; fine at two locations, tedious at twenty.

### Patterns Established
- Every HighLevel selector, route regex, and DOM reader lives in the adapter; the rest of the script asks the adapter for mounts and values.
- Theme rules select only script-written markers (`data-ghlc-theme`, `.ghlc-*`) and win on specificity, never on importance.
- Every jsDelivr URL is tag-pinned and derived from one constant; the suite ties README, config, script, stylesheet, and package.json to a single tag.
- Live checks run by injecting `https://cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme@<sha>/...` into a logged-in tab; `GHLC.verify()` plus a screenshot is the acceptance record.
- Release = bump everywhere, `npm test`, annotated tag, push, poll jsDelivr for 200, byte-compare against the tag.

### Key Lessons
1. Treat "unverified live" as a blocker for a release, not a note for later: one injected smoke test on the real DOM before tagging is cheaper than a point release.
2. HighLevel's Custom JavaScript field takes HTML; raw JavaScript is rendered as inert text. Document the working form first.
3. HighLevel paints the sidebar with id-plus-four-class rules; a customizer that themes native containers needs a specificity plan, not just later stylesheet order.
4. Run the phase verifier as the last step before close, and keep files the transition edits (ROADMAP.md) out of its covered set.
5. A location's Business Profile logo is a stable public URL on HighLevel's storage, but it changes on re-upload and renders small in the 40px sidebar slot; prefer a tight-cropped asset per client.

### Cost Observations
- Model mix: orchestration, verification, planning, and execution all ran on the same model tier in this project (no per-role split configured).
- Sessions: ~14 working blocks across 2026-09-24 and 2026-09-25.
- Notable: the phase-3 live UAT plus two point releases took about as long as executing phase 3 itself; the live loop is the expensive part and the automated harness cannot replace it for cascade and markup questions.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v0.1.0 | ~14 | 3 | Live DOM verification via injected served builds became the acceptance step; releases pinned to immutable tags |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v0.1.0 | 119 checks | 63/63 must-haves verified (29 + 17 + 17), 15/15 UAT items passed | 0 (no dependencies) |

### Top Lessons (Verified Across Milestones)

1. Verify against the live HighLevel DOM before every release; community selectors and cascade assumptions have been wrong each time they were trusted.
2. Keep every invariant as a static suite gate; the gates caught the specificity and tag-pinning mistakes that reviews missed.

<!-- GSD:project-start source:PROJECT.md -->

## Project

**GHL Customizer (admin-theme)**

A small, configuration-driven browser customization layer for our HighLevel agency workspace. It shows the right client logo when staff switch locations, optionally applies per-location accent colors, and adds configurable buttons where staff work (global header and the individual contact record). It is one hosted vanilla JavaScript file, one optional scoped stylesheet, and one manually maintained JSON config.

**Core Value:** From an open contact record, a staff member can press one button and reliably trigger the right HighLevel workflow for that exact contact and location, with no stale context and no duplicate sends.

### Constraints

- **Tech stack**: Vanilla JavaScript (ES2019+, IIFE, no build step) and scoped CSS — PRD requires no framework, single hosted script
- **Configuration**: Manually maintained public JSON — no secrets, tokens, patient data, or contact records in it
- **Security**: No arbitrary JS from config; only `link` and `handler` action types with an allowlisted handler registry
- **Compatibility**: Must degrade gracefully — if a mount point is missing, omit the customization and leave native UI usable
- **Performance**: Bounded, scoped MutationObservers; no whole-page polling
- **Licensing**: Reference project has no license; all code must be original
- **Delivery**: Versioned assets on jsDelivr; `enabled` flag; pilot in selected locations

<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

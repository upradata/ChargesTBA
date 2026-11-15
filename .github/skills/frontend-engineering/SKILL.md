---
name: frontend-engineering
description: Implements and refactors production frontend features with maintainable architecture, rigorous typing, accessibility, and tests. Use for frontend components, forms, state, API integration, performance, or frontend test work; inspect the repository stack before choosing an approach.
---

# Frontend engineering

## 1. Inspect before changing code

- Read applicable repository instructions, package manifests, source structure, TypeScript/build configuration, existing UI conventions, and test scripts.
- Read the relevant `DESIGN.md` and design-knowledge entries when a UI pattern or token is involved. Confirm their recommendations match the implemented project state.
- Identify the smallest surface that satisfies the request. Do not assume a framework, state library, router, component library, or CSS strategy from another repository.

## 2. Design a small, clear implementation

- Keep responsibilities explicit and compose existing components. Add an abstraction only when it represents a stable concept or removes real duplication.
- Preserve existing APIs and architecture unless the task requires a change. Keep server state, local UI state, and domain rules in their established boundaries.
- Avoid new dependencies unless an existing tool cannot reasonably meet the requirement; explain the concrete trade-off before adding one.
- For CSS and design tokens, preserve one source of truth. If tokens move, update imports and document the new location; avoid duplicate declarations and verify both themes.

## 3. TypeScript, states, and accessibility

- Prefer precise domain types, explicit null handling, and discriminated unions where they clarify state. Avoid `any`, unsafe assertions, and unnecessary casts.
- Implement the relevant loading, error, empty, success, disabled, and validation states. Prevent duplicate submissions where applicable and preserve user-entered values after recoverable errors.
- Use semantic elements, associated labels, keyboard-operable controls, visible focus, accessible names, and reduced-motion support. Follow existing component-library APIs rather than mixing systems.
- Preserve financial invariants and locale handling; amounts, dates, and ownership rules must not be weakened for presentation.

## 4. Verify proportionally

- Add or update tests for meaningful behavior using the repository’s existing test tooling.
- Run the relevant typecheck, targeted tests, lint/format, and build scripts defined by the project. For styling/token changes, verify CSS processing and both light/dark themes when possible.
- Never report a check as passing unless it was run. State when visual/browser inspection was unavailable.
- If a reusable implementation pattern materially changes, propose or update the corresponding knowledge-base entry without claiming visual approval unless it was actually reviewed.

## Delivery

Report the implementation, architectural decisions, files changed, checks actually run, and known limitations. Coordinate design decisions with `product-design` and implementation verification with `visual-qa` when useful; neither is a prerequisite for a small code change.

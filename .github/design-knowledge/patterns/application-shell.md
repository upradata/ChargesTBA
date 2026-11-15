# Application shell and navigation

## Purpose

Provide persistent access to the primary ChargesTBA tasks while preserving page context across desktop and narrow screens.

## References

- Local implementation: `v3/src/App.tsx` (`App`, authenticated layout and route navigation) and `v3/src/components/PageHeading.tsx`.
- Product scope: `v3/PROJECT-PLAN.md`.
- Inspiration documents: [Twenty](../references/products/twenty.md), [Plane](../references/products/plane.md). These are documentation references only; no live interface was inspected.

## Design principles

- Keep primary concepts—dashboard, charges, payments, movements, settings, import—easy to find.
- Distinguish current navigation state and give icon-only controls accessible names.
- Preserve enough main-content width for financial information; mobile navigation must be dismissible and return focus sensibly.
- Use the existing semantic tokens, shared components, and Lucide icon set.

## Layout

- Current implementation: full-height desktop sidebar, page-context header, and constrained main content; mobile drawer with backdrop. Shared page headings identify the section and task.
- Navigation is labelled `Navigation principale`; active route uses `aria-current="page"`.
- Header includes menu toggle, theme toggle, and sign-out.

## Interactions and states

- Mobile menu toggles from the header; a backdrop and Escape close it; selecting a route closes it.
- Light/dark preference is stored in local storage.
- Session and query loading/error states are shown before page routes.

## Responsive behavior

- Authenticated desktop and mobile layouts are implemented in source but were not visually checked because no test account was created. Verify menu reachability, scroll, and focus at phone widths when an authorized account is available.

## Accessibility

- Source provides a labelled nav, current-page state, labels on icon buttons, `aria-expanded` for menu toggle, and hidden decorative nav icons.
- Verify focus management and keyboard order in a running browser; source inspection alone does not establish them.

## Implementation notes

- Keep the route-to-label/icon mapping centralized in the app shell.
- Do not turn the app into a chat/conversation layout; AI capabilities are explicitly deferred.
- Relevant tests currently cover shared/product logic, not the shell’s visual behavior.

## Evidence

- Source inspected 2026-11-15: `v3/src/App.tsx`, `v3/src/components/PageHeading.tsx`, `v3/src/main.tsx`, `v3/src/styles.css`, and `v3/src/styles/tokens.css`.
- Current UI validation: Oxfmt, v3 typecheck, 16 tests, and build passed. Browser checks covered login (light desktop, dark 390px mobile) and signup (light desktop); the authenticated shell was not inspected.

## Validation

- Observed: yes — source structure and attributes; live visual observation: no.
- Evaluated: yes — against the v3 product navigation goals.
- Adapted: yes — existing shell pattern refined with persistent desktop navigation, page context, and responsive login/signup presentation.
- Implemented: yes — evidenced by `App.tsx` and `PageHeading.tsx`.
- Verified: partial — login/signup visual checks and code checks recorded; authenticated shell responsive and keyboard behavior not browser-verified.
- Approved: no — no separate human sign-off recorded.

# Application shell and navigation

## Purpose

Provide persistent access to the primary ChargesTBA tasks while preserving page context across desktop and narrow screens.

## References

- Local implementation: `v3/src/App.tsx` (`App`, authenticated layout and route navigation) and `v3/src/components/PageHeading.tsx`.
- Product scope: `v3/PROJECT-PLAN.md`.
- Inspiration documents: [Twenty](../references/products/twenty.md), [Plane](../references/products/plane.md). These are documentation references only; no live interface was inspected.
- Product comparison: [shadcn-fintech](../references/products/shadcn-fintech.md); selected source files and live-page content were inspected, but rendered visuals and responsive behavior were not verified.

## Design principles

- Keep primary concepts—dashboard, charges, payments, movements, settings, import—easy to find.
- Distinguish current navigation state and give icon-only controls accessible names.
- Preserve enough main-content width for financial information; mobile navigation must be dismissible and return focus sensibly.
- Use the existing semantic tokens, shared components, and Lucide icon set.
- Treat grouped navigation and a keyboard command surface as optional information-architecture tools; add them only when the actual route/action set justifies them.

## Layout

- Current implementation: full-height desktop sidebar, page-context header, and constrained main content; mobile drawer with backdrop. Shared page headings identify the section and task.
- Navigation is labelled `Navigation principale`; active route uses `aria-current="page"`.
- Header includes menu toggle, theme toggle, and sign-out.
- External source comparison: shadcn-fintech composes a grouped sidebar, breadcrumb header, sidebar trigger, theme toggle, and global command palette (`src/app/(dashboard)/layout.tsx`, `src/components/app-sidebar.tsx`). This is source evidence, not a visual comparison.

## Interactions and states

- Mobile menu toggles from the header; a backdrop and Escape close it; selecting a route closes it.
- Light/dark preference is stored in local storage.
- Session and query loading/error states are shown before page routes.
- External source comparison: shadcn-fintech’s palette opens on ⌘K/Ctrl+K and groups destinations, recent transactions, quick-transfer recipients, crypto, and theme choices (`src/components/command-palette.tsx`). Keyboard accessibility and runtime behavior were not tested.

## Responsive behavior

- Authenticated desktop and mobile layouts are implemented in source but were not visually checked because no test account was created. Verify menu reachability, scroll, and focus at phone widths when an authorized account is available.

## Accessibility

- Source provides a labelled nav, current-page state, labels on icon buttons, `aria-expanded` for menu toggle, and hidden decorative nav icons.
- Verify focus management and keyboard order in a running browser; source inspection alone does not establish them.

## Implementation notes

- Keep the route-to-label/icon mapping centralized in the app shell.
- Do not add a palette or expand navigation solely to mimic the reference; prefer the smallest control surface that supports ChargesTBA’s six core tasks.
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

## External reference comparison — shadcn-fintech

- **Observed — source code, 2026-11-15:** Grouped navigation and header composition are described in [the product reference](../references/products/shadcn-fintech.md). `src/components/nav-main.tsx` uses exact pathname matching for active navigation; the demo’s route set is broader than ChargesTBA’s.
- **Evaluated:** Grouping and persistent page context are transferable principles. The reference’s separate “Auth” sidebar group is not appropriate to copy into ChargesTBA’s authenticated shell.
- **Adaptation status:** Not adapted or implemented in ChargesTBA by this comparison. Existing local shell behavior and status above remain the source of truth.
- **Observed — screenshots and browser interaction, 2026-11-15:** The [desktop dashboard](../screenshots/products/shadcn-fintech-dashboard-1440x1000.png), [mobile dashboard](../screenshots/products/shadcn-fintech-dashboard-mobile-390x844.png), and [open palette](../screenshots/products/shadcn-fintech-command-palette-1440x1000.png) were visually inspected. Ctrl+K opened and Escape closed the palette. The mobile screenshot shows a collapsed sidebar behind the header toggle; opening the drawer and assistive-technology behavior were not tested.

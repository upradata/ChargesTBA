# Application shell and navigation

## Purpose

Provide persistent access to the primary ChargesTBA tasks while preserving page context across desktop and narrow screens.

## References

- Local implementation: `v3/src/App.tsx` (authenticated layout), `v3/src/components/AppNavigation.tsx` (route navigation), and `v3/src/components/PageHeading.tsx`.
- Product scope: `v3/PROJECT-PLAN.md`.
- Inspiration documents: [Twenty](../references/products/twenty.md), [Plane](../references/products/plane.md). These are documentation references only; no live interface was inspected.
- Product comparison: [shadcn-fintech](../references/products/shadcn-fintech.md); selected source files and desktop/mobile screenshots were inspected.

## Design principles

- Keep primary concepts—dashboard, charges, payments, movements, settings, import—easy to find.
- Distinguish current navigation state and give icon-only controls accessible names.
- Preserve enough main-content width for financial information; mobile navigation must be dismissible and return focus sensibly.
- Use the existing semantic tokens, shared components, and Lucide icon set.
- Treat grouped navigation and a keyboard command surface as optional information-architecture tools; add them only when the actual route/action set justifies them.

## Layout

- Current implementation: transparent grouped desktop sidebar with a collapsible icon rail alongside one inset card for the sticky header and content. A faint horizontal rule separates the header from the content; a short vertical divider separates the toggle from the current route. On mobile the content is edge-to-edge and the drawer is opaque over a fading backdrop.
- Navigation is labelled `Navigation principale`; active route uses `aria-current="page"`.
- Header includes menu toggle, theme toggle, and sign-out.
- External source comparison: shadcn-fintech composes a grouped sidebar, breadcrumb header, sidebar trigger, theme toggle, and global command palette (`src/app/(dashboard)/layout.tsx`, `src/components/app-sidebar.tsx`). This is source evidence, not a visual comparison.

## Interactions and states

- Mobile menu toggles from the header; a backdrop and Escape close it; selecting a route closes it.
- The desktop sidebar starts expanded and can be collapsed independently of the mobile drawer; its state is not persisted.
- The desktop column resizes and the mobile drawer slides in both directions. Reduced-motion mode skips these transitions. The closed mobile drawer is inert, and dismissal restores focus to the trigger.
- Light/dark preference is stored in local storage.
- Session and query loading/error states are shown before page routes.
- External source comparison: shadcn-fintech’s palette opens on ⌘K/Ctrl+K and groups destinations, recent transactions, quick-transfer recipients, crypto, and theme choices (`src/components/command-palette.tsx`). Keyboard accessibility and runtime behavior were not tested.

## Responsive behavior

- The authenticated layout was exercised in headless Chrome with synthetic data at 390, 768, 1440, and 1920 CSS pixels; visual inspection and a complete focus-order audit remain outstanding.

## Accessibility

- Source provides a labelled nav, current-page state, labels on icon buttons, `aria-expanded` for menu toggle, and hidden decorative nav icons.
- Verify focus management and keyboard order in a running browser; source inspection alone does not establish them.

## Implementation notes

- Keep the route-to-label/icon mapping centralized in the app shell.
- Do not add a palette or expand navigation solely to mimic the reference; prefer the smallest control surface that supports ChargesTBA’s six core tasks.
- Do not turn the app into a chat/conversation layout; AI capabilities are explicitly deferred.
- Focused component tests cover the grouped destinations, current route and collapsed accessible labels; browser checks cover selected interactions, not visual appearance.

## Evidence

- Inset shell: isolated headless Chrome checked both themes at 390, 767, 768, and 1440 CSS pixels, including card inset, transparent desktop navigation, header dividers, and page overflow. It also checked both transition directions, reduced motion, Escape focus restoration, and close-on-navigation with synthetic data. These were DOM and interaction checks, not screenshot review.
- Source inspected 2026-11-15: `v3/src/App.tsx`, `v3/src/components/PageHeading.tsx`, `v3/src/main.tsx`, `v3/src/styles.css`, and `v3/src/styles/tokens.css`.
- Earlier UI validation: Oxfmt, v3 typecheck, 16 tests, and build passed. Browser checks covered login (light desktop, dark 390px mobile) and signup (light desktop); the authenticated shell was not inspected.
- 2026-11-18: An isolated headless Chrome session checked the expanded and collapsed desktop control, mobile menu open/Escape/route selection, and active route. The checks used synthetic data and did not visually inspect the rendered shell.
- 2026-11-18: Updated UI files passed Oxfmt and Oxlint; v3 typecheck, 21 tests, and an isolated-output production build passed.

## Validation

- Observed: yes — source structure and attributes; live visual observation: no.
- Evaluated: yes — against the v3 product navigation goals.
- Adapted: yes — existing shell pattern refined with persistent desktop navigation, page context, and responsive login/signup presentation.
- Implemented: yes — evidenced by `App.tsx` and `PageHeading.tsx`.
- Verified: partial — login/signup visual checks and the selected authenticated-shell browser interactions above; authenticated shell visuals and complete keyboard behavior remain unverified.
- Approved: no — no separate human sign-off recorded.

## External reference comparison — shadcn-fintech

- **Observed — source code, 2026-11-15:** Grouped navigation and header composition are described in [the product reference](../references/products/shadcn-fintech.md). `src/components/nav-main.tsx` uses exact pathname matching for active navigation; the demo’s route set is broader than ChargesTBA’s.
- **Evaluated:** Grouping and persistent page context are transferable principles. The reference’s separate “Auth” sidebar group is not appropriate to copy into ChargesTBA’s authenticated shell.
- **Adapted and implemented:** The existing destinations are grouped and the desktop sidebar can collapse, while the reference's extra destinations and command palette remain excluded.
- **Observed — screenshots and browser interaction, 2026-11-15:** The [desktop dashboard](../screenshots/products/shadcn-fintech-dashboard-1440x1000.png), [mobile dashboard](../screenshots/products/shadcn-fintech-dashboard-mobile-390x844.png), and [open palette](../screenshots/products/shadcn-fintech-command-palette-1440x1000.png) were visually inspected. Ctrl+K opened and Escape closed the palette. The mobile screenshot shows a collapsed sidebar behind the header toggle; opening the drawer and assistive-technology behavior were not tested.

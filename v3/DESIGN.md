# ChargesTBA v3 — Product design

> **Status:** Initial product design source of truth, grounded in the current product plan and source inspection. Not yet visually approved.

## Product and users

ChargesTBA v3 is a local-first, French-first application for a co-owner to record condominium charges, track schedules and payments, allocate payments to charges, import account data, and understand remaining amounts and account balance. The main concepts presented to users are **charges** and **payments**; allocation belongs in those workflows rather than a separate bookkeeping table.

The product is an early prototype, not a hosted production financial service. Treat the current implementation, product roadmap, and open decisions separately. `PROJECT-PLAN.md` is authoritative for product scope and unresolved questions; `README.md` records current behavior and limitations.

## Visual direction

Aim for a calm, precise, premium-minimal SaaS interface with fintech-grade clarity. Favor neutral surfaces, subtle dividers, deliberate alignment, legible financial data, and a restrained accent. Density should help users compare records without making forms feel cramped. Avoid generic dashboard decoration, unnecessary gradients, colorful cards, excessive shadows/radii, and motion without functional purpose.

This is a product direction, not a claim that the current screens have passed visual QA. Record observations and decisions in `.github/design-knowledge/` with their evidence and status.

## Source of truth and current implementation

- Design tokens: `src/styles/tokens.css`; `src/styles.css` imports Tailwind and the token sheet, defines the dark variant and base styles.
- Shared UI primitives: `src/components/ui/`; the app currently uses its shadcn-derived components. Do not add Proper UI or another component system without an explicit product decision.
- Application shell, route composition, and financial views: `src/App.tsx`; shared page headings: `src/components/PageHeading.tsx`.
- CSV preview/import UI: `src/ImportView.tsx`; parser and import invariants are in `server/import-csv.ts` and `server/app.ts`.
- Category and reusable schedule settings: `src/SettingsView.tsx`.
- Schedule arithmetic: `shared/schedule.ts`.

The implementation declares Inter before system sans-serif fallbacks in `src/styles.css`; font loading is not established by that declaration alone. Currency display is formatted with `fr-FR` and EUR. Dates are stored as ISO strings and displayed as `dd/mm/yyyy` in current flows.

## Foundations

### Tokens

Use semantic utilities backed by CSS variables: background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, and radius scales. Change the central tokens rather than scattering new color literals. Light/dark values are both defined in `src/styles/tokens.css`; any token change must preserve contrast and be checked in both themes.

The current primary accent is teal-green, based on the existing token values. Treat that as the current implementation, not a separately approved brand decision. Do not introduce parallel token files or hard-code a new palette in a component.

### Typography and financial data

Use the existing sans-serif stack and size/weight conventions unless a deliberate product decision changes them. Prefer concise French labels, meaningful heading hierarchy, and supportive copy only when it helps a task. Keep EUR/date formats consistent with the locale. Use tabular numerals where side-by-side financial values need comparison; do not alter accounting precision for display convenience.

### Surfaces, spacing, and icons

Use existing shared primitives and their current variants. Maintain consistent page padding, gaps, control sizes, border ownership, and radii. Prefer borders over shadows for persistent content; reserve elevation for floating UI. Keep Lucide icons consistent in size and pair icon-only controls with accessible names.

## Information architecture and workflows

The current authenticated navigation exposes Tableau de bord, Charges, Paiements, Mouvements, Paramètres, and Importer. Preserve those product terms unless a human-approved naming decision changes them.

- **Charges:** create/review/correct a charge and its schedule; make amount, date, category, installments, and validation understandable.
- **Payments:** record a payment and allocate it across unpaid charges; clearly distinguish recorded, allocated, and unallocated amounts.
- **Dashboard / Movements:** distinguish outstanding amounts, account balance, and unallocated credit; label informational overdue calculations and avoid implying reminders are sent.
- **Settings:** manage categories and reusable schedule templates; explain when changing a template does not update existing charges.
- **CSV import:** select file type and UTF-8 CSV, analyze, review rows/errors/possible duplicates, then explicitly confirm. Imported payments remain unallocated. Never imply preview alone writes data.

Do not invent roadmap behaviors such as reassignment history, demo mode, charge-first payment flow, automated reminders, or integrations as if already implemented.

## Responsive behavior

The app has a mobile menu and a desktop sidebar, a fluid content area capped at a readable maximum width, and horizontally scrollable table containers where needed. Preserve reachable navigation and table content at narrow widths. Test the actual changed screen at relevant phone, tablet, and desktop sizes; source classes alone do not prove the rendered layout is correct.

## States and interactions

Every meaningful data flow should make loading, validation errors, server errors, success, empty results, pending/disabled actions, and confirmation states clear. Preserve form contents after recoverable failures. Destructive category/template actions currently request confirmation. Respect keyboard operation, visible focus, semantic labels, Escape behavior where implemented, and `prefers-reduced-motion`.

## Accessibility and privacy

Use semantic HTML before ARIA. Keep every input labelled, alerts/statuses announced appropriately, icon-only controls named, navigation current-state identified, and keyboard focus visible. Use the WAI-ARIA APG for complex patterns and validate the actual composed widget. Do not rely on color alone for payment/charge status.

Use synthetic examples in screenshots and docs. Do not expose local account data, real statements, or personal financial details in design references. The app is local-first, and the database is not encrypted by the app; do not imply otherwise.

## Reference and decision workflow

Consult `.github/design-knowledge/README.md` and relevant references/patterns before substantial design work. External products inform principles, not copied layouts. For each new pattern, separate observed, evaluated, adapted, implemented, verified, and approved statuses. Visual verification requires actual browser/screenshot inspection; approval requires an explicit human decision.

## Initial verification evidence

- 2026-11-15: After the UI refresh, login was visually inspected in light mode at a 1440×1000 desktop viewport and dark mode at a 390×844 mobile viewport; signup was also inspected at desktop size. Login/signup fields and labels were present, the document width matched the 1440px viewport, and no console warnings/errors were observed.
- The authenticated shell, dashboard, charge/payment tables and forms, settings, and import workflow were not visually inspected because no test account was created. Their implementation is not thereby visually verified or product-approved.
- The browser reported a missing `/favicon.ico` (404), unrelated to the token move; it was not changed in this task.

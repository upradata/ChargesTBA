# Financial data tables

## Purpose

Present structured charges, payments, imported rows, or chronological movements so users can inspect and compare financial records.

## References

- Local table primitives: `v3/src/components/ui/table.tsx`.
- Import preview: `v3/src/ImportView.tsx`.
- Product requirements: `v3/PROJECT-PLAN.md`.
- Candidate external references: [Twenty](../references/products/twenty.md), [Plane](../references/products/plane.md); only documentation was inspected.
- External product comparison: [shadcn-fintech](../references/products/shadcn-fintech.md), with source and live-page inspection plus desktop/mobile screenshots; see visual evidence links below.

## Design principles

- Give columns clear, concise French labels; align comparable values consistently.
- Keep date, type/nature, description, and amount distinguishable.
- Use tabular numerals for financial comparisons where the local type scale supports them.
- Avoid using color alone to convey payment or validation status.
- Show a useful empty state and keep long labels from obscuring amounts or actions.
- If hiding columns at narrow breakpoints, keep essential financial information accessible and test the actual narrow layout; column hiding is not automatically better than horizontal scrolling.

## Layout

- Current shared table primitive uses a semantic `<table>` inside a horizontally scrollable container (`overflow-x-auto`).
- Charges show category/date, installment count, paid progress, total, remaining balance, and an edit action; payments distinguish total, allocated, and remaining credit; the ledger distinguishes charge/payment and shows a running balance.
- CSV preview presents row number, date, nature, label, type, and amount. Current scroll-container minimum widths vary by view (charges 760px, payments 760px, ledger 650px, import 720px).

## Interactions and states

- The import preview table is read-only; correction and duplicate approval occur through the surrounding workflow.
- Sorting, filtering, row selection, pagination, and column visibility are not evidenced by the inspected import table. Do not claim or add them by default.
- External source comparison: shadcn-fintech’s transaction page composes summary metrics, search/category/status/type filters, selectable rows with CSV export, expandable detail rows, and an empty-filter state. Its source hides transaction ID/date/status at progressively larger breakpoints. These are not behaviors of ChargesTBA’s import table.

## Responsive behavior

- Horizontal scrolling is implemented for charges, payments, movements, and import preview. Browser inspection of authenticated tables and mobile first/last-column access remains outstanding.

## Accessibility

- Shared primitive uses table, thead, tbody, tr, th, and td elements. Verify header associations and reading order in the rendered table.
- Ensure any future sort/selection controls expose state and keyboard behavior.
- For custom row expansion or selection, avoid making pointer row-click the only way to reach details; verify focus, semantics, and checkbox/row event behavior in the composed table.

## Implementation notes

- Reuse the local table components rather than introducing TanStack Table for simple static previews. Add a table abstraction only when feature needs justify it.
- Format amounts/dates through existing shared formatters.

## Evidence

- Source inspected 2026-11-15: `v3/src/components/ui/table.tsx`, `v3/src/App.tsx`, and `v3/src/ImportView.tsx`.
- Current UI validation: Oxfmt, v3 typecheck, 16 tests, and build passed. Authenticated tables were not visually or keyboard inspected.

## Validation

- Observed: yes — source markup and overflow wrapper; live visual observation: no.
- Evaluated: yes — against the import-review task.
- Adapted: yes — financial lists use compact, task-specific columns and tabular numeric alignment.
- Implemented: yes — shared table, charge/payment/ledger tables, and import preview are in source.
- Verified: no — responsive table behavior and keyboard interaction were not visually/keyboard verified.
- Approved: no.

## External reference comparison — shadcn-fintech

- **Observed — source, screenshots, and browser interaction, 2026-11-15:** The [desktop transactions table](../screenshots/products/shadcn-fintech-transactions-1440x1000.png) and mobile [dashboard recent-transactions table](../screenshots/products/shadcn-fintech-dashboard-mobile-390x844.png) were visually inspected. On the transactions page, searching Spotify reduced the table to one row, and clicking that row opened its detail row. Selection/export behavior remains source-inspected only. Details are in [the product reference](../references/products/shadcn-fintech.md).
- **Evaluated:** Summary + filters + results is a useful candidate structure for genuinely large transaction histories. Select/export and expandable details should be added only when they solve a ChargesTBA task; the existing CSV import preview is intentionally a different, review-oriented workflow.
- **Adaptation status:** No table behavior from the external reference was implemented in ChargesTBA.
- **Evidence limit:** The mobile dashboard screenshot shows a transaction amount clipped at the right edge. A mobile screenshot of the full Transactions route, keyboard operation, and accessibility were not tested; source breakpoint classes alone do not prove readable responsive tables.

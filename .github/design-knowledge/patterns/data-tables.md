# Financial data tables

## Purpose

Present structured charges, payments, imported rows, or chronological movements so users can inspect and compare financial records.

## References

- Local table primitives: `v3/src/components/ui/table.tsx`.
- Import preview: `v3/src/ImportView.tsx`.
- Product requirements: `v3/PROJECT-PLAN.md`.
- Candidate external references: [Twenty](../references/products/twenty.md), [Plane](../references/products/plane.md); only documentation was inspected.

## Design principles

- Give columns clear, concise French labels; align comparable values consistently.
- Keep date, type/nature, description, and amount distinguishable.
- Use tabular numerals for financial comparisons where the local type scale supports them.
- Avoid using color alone to convey payment or validation status.
- Show a useful empty state and keep long labels from obscuring amounts or actions.

## Layout

- Current shared table primitive uses a semantic `<table>` inside a horizontally scrollable container (`overflow-x-auto`).
- Charges show category/date, installment count, paid progress, total, remaining balance, and an edit action; payments distinguish total, allocated, and remaining credit; the ledger distinguishes charge/payment and shows a running balance.
- CSV preview presents row number, date, nature, label, type, and amount. Current scroll-container minimum widths vary by view (charges 760px, payments 760px, ledger 650px, import 720px).

## Interactions and states

- The import preview table is read-only; correction and duplicate approval occur through the surrounding workflow.
- Sorting, filtering, row selection, pagination, and column visibility are not evidenced by the inspected import table. Do not claim or add them by default.

## Responsive behavior

- Horizontal scrolling is implemented for charges, payments, movements, and import preview. Browser inspection of authenticated tables and mobile first/last-column access remains outstanding.

## Accessibility

- Shared primitive uses table, thead, tbody, tr, th, and td elements. Verify header associations and reading order in the rendered table.
- Ensure any future sort/selection controls expose state and keyboard behavior.

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

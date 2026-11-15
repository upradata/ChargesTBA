# Financial dashboard and balance overview

## Purpose

Help a user understand charge progress, recorded payments, remaining amounts, overdue information, and balance movement without changing accounting records from a chart.

## References

- Local implementation: `Overview` in `v3/src/App.tsx`.
- Product goals and terminology: `v3/PROJECT-PLAN.md`.
- Domain references: [FinTrack](../references/products/fintrack.md), [shadcn-fintech](../references/products/shadcn-fintech.md); only repository descriptions were inspected, not their live screens.

## Design principles

- Name each financial measure and define what it includes; account balance, amount due, and unallocated credit are not interchangeable.
- Use EUR locale formatting and preserve integer-cent arithmetic.
- Charts should answer a real question, have accessible names, and remain secondary to the actionable financial summary.
- Do not imply reminders or external bank integrations that are not implemented.

## Layout

- Current implementation presents four named metrics (account balance, outstanding charges, unallocated credit, overdue installments), a balance-over-time chart, the five nearest remaining installments, and five recent movements.
- The ledger route presents dated charge/payment movements and a running balance in a separate table view.
- The overdue amount remains informational and is explicitly tied to saved installments.

## Interactions and states

- Dashboard is derived from charges/payments data; the chart tooltip formats euro values. Upcoming installments are derived from saved schedules, and actions link to existing charge/payment routes.
- Loading and data-fetch errors are handled in the parent app shell. Empty and sparse states must remain understandable as data is added.

## Responsive behavior

- The chart uses `ResponsiveContainer`; this is source evidence, not proof of readable labels or tooltip behavior at each viewport. Test narrow widths and long localized values.

## Accessibility

- Chart wrapper has `role="img"` and an accessible description. Verify whether this sufficiently exposes chart data and whether a textual/table alternative is needed.
- Status and amounts must not depend on color alone.

## Implementation notes

- Data and monetary business rules belong to existing types/calculations; keep display formatting separate.
- Keep wording aligned with ChargesTBA’s product glossary in French.

## Evidence

- Source inspected 2026-11-15: `v3/src/App.tsx` and `v3/src/components/PageHeading.tsx`; product requirements in `v3/PROJECT-PLAN.md` and `v3/README.md`.
- Current UI validation: Oxfmt, v3 typecheck, 16 tests, and build passed. The dashboard and ledger were not visually inspected because no test account was created.

## Validation

- Observed: yes — source behavior; live visual observation: no.
- Evaluated: yes — terminology and product goals reviewed.
- Adapted: yes — financial summary now separates the four key measures and pairs the chart with upcoming installments and recent activity.
- Implemented: yes — evidenced by current source.
- Verified: no — dashboard, ledger, chart, and financial data states were not browser-verified.
- Approved: no.

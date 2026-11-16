# Financial dashboard and balance overview

## Purpose

Help a user understand charge progress, recorded payments, remaining amounts, overdue information, and balance movement without changing accounting records from a chart.

## References

- Local implementation: `Overview` in `v3/src/App.tsx`.
- Product goals and terminology: `v3/PROJECT-PLAN.md`.
- Domain references: [FinTrack](../references/products/fintrack.md) (README feature descriptions only) and [shadcn-fintech](../references/products/shadcn-fintech.md) (live dashboard screenshots, content, and selected source inspected).
- External product comparison: [shadcn-fintech](../references/products/shadcn-fintech.md), including live-page content extraction and source inspection; rendered visuals were not inspected.

## Design principles

- Name each financial measure and define what it includes; account balance, amount due, and unallocated credit are not interchangeable.
- Use EUR locale formatting and preserve integer-cent arithmetic.
- Charts should answer a real question, have accessible names, and remain secondary to the actionable financial summary.
- Do not imply reminders or external bank integrations that are not implemented.
- A comparison chart should name its series and period and expose values beyond color alone; retain only measures that answer a real ChargesTBA question.

## Layout

- Current implementation presents four named metrics (account balance, outstanding charges, unallocated credit, overdue installments), a balance-over-time chart, the five nearest remaining installments, and five recent movements.
- The ledger route presents dated charge/payment movements and a running balance in a separate table view.
- The overdue amount remains informational and is explicitly tied to saved installments.
- External source comparison: shadcn-fintech’s dashboard source assembles an overview chart, account cards, quick transfer/spending, money movement, health score, and recent transactions in a 12-column grid. The overview compares current/prior-year monthly values with a range picker; custom widget order is saved in localStorage. These are source-observed template features, not ChargesTBA requirements.

## Interactions and states

- Dashboard is derived from charges/payments data; the chart tooltip formats euro values. Upcoming installments are derived from saved schedules, and actions link to existing charge/payment routes.
- External source comparison: source handlers show a date-range filter and chart tooltip, and a “Customize”/“Lock”/“Reset layout” flow for draggable dashboard widgets. The transfer widget’s success UI is timer-simulated; none of these interactions was browser-tested.
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

## External reference comparison — shadcn-fintech

- **Observed — source, live-page content, and screenshots, 2026-11-15:** The external overview and customization details are documented in [the product reference](../references/products/shadcn-fintech.md). [Desktop](../screenshots/products/shadcn-fintech-dashboard-1440x1000.png) and [mobile](../screenshots/products/shadcn-fintech-dashboard-mobile-390x844.png) captures were visually inspected. The mobile screenshot shows the widgets stacked; the desktop capture shows a chart/account-card top row and three lower widget columns.
- **Evaluated:** Period comparison paired with labels/totals and an adjustable date range may inform a future meaningful ChargesTBA comparison. The broad wallet/crypto/investment dashboard and reorderable widget grid are likely excessive for the current condominium-bookkeeping scope.
- **Adaptation status:** No changes to the ChargesTBA dashboard were made from this reference. Existing local metrics, terminology, and visual direction remain authoritative.
- **Evidence limit:** Visual appearance was inspected only in the two saved viewport captures. Date-range and widget-reordering interactions, other viewports, accessibility, and live-data behavior were not verified.

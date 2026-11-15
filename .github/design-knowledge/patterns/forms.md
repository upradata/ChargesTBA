# Financial entry and settings forms

## Purpose

Let users create or correct charges, payments, categories, and reusable schedules while preserving clear financial meaning and validation feedback.

## References

- Current form flows: `v3/src/App.tsx` and `v3/src/SettingsView.tsx`.
- Shared field/button primitives: `v3/src/components/ui/primitives.tsx`, `input.tsx`, `select.tsx`, and `button.tsx`.
- Product constraints: `v3/PROJECT-PLAN.md`.

## Design principles

- Keep field labels visible and use French, domain-specific terminology.
- Make units, locale, date format, schedule behavior, and financial consequences explicit.
- Preserve entered values on recoverable errors; make pending and disabled states clear.
- Let users correct their own records without silently changing recorded payment/allocation history.

## Layout

- Current settings editors use cards with labelled fields, inline errors, and explicit save/cancel actions. Categories and reusable templates are organized into separate responsive sections.
- Category editor supports name and optional default schedule. Schedule editor exposes month offset, day, weight, add/remove rules, and a description.
- Charge/payment forms live in `App.tsx`; date and payment metadata are grouped separately from charge schedules or allocation controls.

## Interactions and states

- Settings forms show server errors, pending submission state, save/cancel actions, and use native form submission.
- Schedule rules can be added up to a source limit; deleting the last rule is disabled.
- Charge forms include French date validation, cent parsing, schedule preview, and error handling. Do not weaken server-side validation.

## Responsive behavior

- Source uses responsive grids, shared `Group` components, and wrapping; actual field wrapping and action order at mobile widths are not visually verified.

## Accessibility

- Shared `TextInput` associates `Label` and input through generated ids. Verify each select/number input label and error association in the rendered DOM.
- Keep keyboard submit/cancel behavior predictable and preserve visible focus from local controls.

## Implementation notes

- Use local primitives and existing form state. Amounts are represented in cents at API/domain boundaries; do not calculate accounting values in floating point.
- Categories and schedule templates are account-specific. Explain that existing charges retain their saved schedule when a reusable template later changes.

## Evidence

- Source inspected 2026-11-15: `v3/src/App.tsx`, `v3/src/SettingsView.tsx`, `v3/src/components/ui/primitives.tsx`, and `v3/shared/schedule.ts`.
- Current UI validation: Oxfmt, v3 typecheck, 16 tests, and build passed. Charge/payment/settings form submission and keyboard behavior were not browser-tested; no test account was created.

## Validation

- Observed: yes — source flows; live visual observation: no.
- Evaluated: yes — against product financial-safety constraints.
- Adapted: yes — fields are grouped by task and financial consequence, with allocation suggestions kept beside eligible charges.
- Implemented: yes — evidenced in source.
- Verified: no — form behavior, validation, focus, and responsive layout were not browser-verified.
- Approved: no.

# Financial entry and settings forms

## Purpose

Let users create or correct charges, payments, categories, and reusable schedules while preserving clear financial meaning and validation feedback.

## References

- Current form flows: `v3/src/App.tsx` and `v3/src/SettingsView.tsx`.
- Shared field/button primitives: `v3/src/components/ui/primitives.tsx`, `input.tsx`, `select.tsx`, and `button.tsx`.
- Product constraints: `v3/PROJECT-PLAN.md`.
- External product comparison: [shadcn-fintech](../references/products/shadcn-fintech.md); the dashboard’s compact quick-transfer card is visible in saved desktop/mobile screenshots. The full Transfers quick-send flow and its submission were not browser-tested.

## Design principles

- Keep field labels visible and use French, domain-specific terminology.
- Make units, locale, date format, schedule behavior, and financial consequences explicit.
- Preserve entered values on recoverable errors; make pending and disabled states clear.
- Let users correct their own records without silently changing recorded payment/allocation history.
- Expose a clear pending state and report success only after the operation itself succeeds; a presentational demo state is not a safe transaction pattern.

## Layout

- Current settings editors use cards with labelled fields, inline errors, and explicit save/cancel actions. Categories and reusable templates are organized into separate responsive sections.
- Category editor supports name and optional default schedule. Schedule editor exposes month offset, day, weight, add/remove rules, and a description.
- Charge/payment forms live in `App.tsx`; date and payment metadata are grouped separately from charge schedules or allocation controls.

## Interactions and states

- Settings forms show server errors, pending submission state, save/cancel actions, and use native form submission.
- Schedule rules can be added up to a source limit; deleting the last rule is disabled.
- Charge forms include French date validation, cent parsing, schedule preview, and error handling. Do not weaken server-side validation.
- External source comparison: shadcn-fintech quick-send presents recipient avatars, amount, optional note, disabled/pending state, and a success presentation. Its inspected implementation transitions to success using a timeout and demo data; it does not establish a real transfer result.

## Responsive behavior

- Source uses responsive grids, shared `Group` components, and wrapping; actual field wrapping and action order at mobile widths are not visually verified.

## Accessibility

- Shared `TextInput` associates `Label` and input through generated ids. Verify each select/number input label and error association in the rendered DOM.
- Keep keyboard submit/cancel behavior predictable and preserve visible focus from local controls.

## Implementation notes

- Use local primitives and existing form state. Amounts are represented in cents at API/domain boundaries; do not calculate accounting values in floating point.
- Categories and schedule templates are account-specific. Explain that existing charges retain their saved schedule when a reusable template later changes.
- Do not reuse the external quick-send UI as a payment/allocation flow: ChargesTBA records a payment already made and needs explicit allocation and server-confirmed outcomes.

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

## External reference comparison — shadcn-fintech

- **Observed — source and live-page content extraction, 2026-11-15:** Transfer recipient, amount, optional note, and visible send-state examples are described in [the product reference](../references/products/shadcn-fintech.md). The saved dashboard screenshots show the compact recipient/amount/send composition, not the full transfer form.
- **Evaluated:** Recipient confirmation and concise pending feedback can be useful interaction ideas. The simulated success state must not be interpreted as a verified financial transaction or copied into a consequential workflow.
- **Adaptation status:** No external form UI or transfer behavior was copied or implemented in ChargesTBA.
- **Evidence limit:** No browser submission, validation, network, keyboard, or responsive test was performed.

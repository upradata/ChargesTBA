# CSV import review and confirmation

## Purpose

Allow a signed-in user to import charge/payment records while reviewing parsing errors and possible duplicates before any write occurs.

## References

- UI: `v3/src/ImportView.tsx`.
- Parser and limits: `v3/server/import-csv.ts`.
- Server preview/commit boundary: `v3/server/app.ts`.
- User-facing rules: `v3/README.md`; tests: `v3/server/import.test.ts`, `v3/server/import-csv.test.ts`.

## Design principles

- Separate file selection, analysis, review, and commit; preview is non-destructive.
- Make invalid rows and possible duplicates visible before confirmation.
- Require explicit confirmation for duplicate imports; explain that imported payments remain unallocated.
- Keep the file’s data within the signed-in account and avoid logging statement contents.

## Layout

- Current UI presents a three-step progress indicator, file-type and file selection, an “Analyser le fichier” action, inline error/status alerts, an error/duplicate summary, category resolution for each distinct unmatched label, a row preview table, and a final confirmation action.
- The file selection card shows copyable comma- and semicolon-separated examples for the selected import type, including the header row and how to quote decimal commas.
- The confirmation button is disabled for invalid previews or no accepted rows; its label notes when duplicates are included.

## Interactions and states

- The shared file picker uses a decorative upload icon and a pointer cursor when enabled. The native control still handles keyboard activation and displays the selected file name.
- Client rejects files over 1 MB, reads UTF-8 strictly, requests a non-committing preview, then submits the confirmed import.
- Ordered regular-expression rules in Paramètres classify charge, refund, and payment labels. The preview groups labels by movement type and allows an explicit manual override for automatic matches; unmatched charges/refunds can still stage a new category, while unmatched payments retain their default unless a payment type is selected.
- Unmatched category labels can be mapped to an existing category or a staged new category. A choice applies to every row with the same trimmed, case-insensitive label; category creation occurs only in the confirmed import transaction.
- Server re-evaluates duplicates at commit. If rows or duplicates changed, the UI refreshes the preview and asks for review again.
- Successful import clears selected data, reports the count, and refreshes charges, payments, and settings.
- Errors and notices use alert/status roles. The backend import transaction is tested for atomic failure.

## Responsive behavior

- Preview table is explicitly horizontally scrollable with a 720px minimum width. No authenticated browser viewport check has been performed; test mobile table navigation and confirmation placement.

## Accessibility

- Source uses labelled select/file controls and alert/status roles. Verify focus movement and announcement behavior on category resolution, preview refresh, server errors, and commit completion.

## Implementation notes

- File size/row limits, accepted headers, locale parsing, duplicate matching, category resolution, account isolation, and atomicity are contracts in parser/server code; keep UI copy consistent with them.
- Never claim preview means data was saved. Keep commit as an explicit action.

## Evidence

- Source inspected 2026-11-15: `v3/src/ImportView.tsx`, `v3/server/import-csv.ts`, `v3/server/app.ts`.
- Source and tests updated 2026-11-20: category mapping is grouped by normalized label, and category creation is deferred to the confirmed import transaction.
- Mapping rules, payment types, and manual overrides added 2026-11-20; their settings controls and preview overrides were not visually inspected.
- 2026-11-15 validation: Oxfmt, v3 typecheck, 16 tests (including import parser/API tests), and build passed. The import workflow was not browser-tested; no statement data was loaded.
- 2026-11-20 browser screenshot: the shared `/import` route rendered its initial file-selection state. Category mapping controls were not exercised in the browser.
- 2026-11-20 validation: targeted parser/import API tests passed (14 tests), and typecheck passed. The full suite reports 41 passing tests and one unrelated migration test failure (`refunds` table already exists).
- File picker checked on `/import` in Chrome with a mocked API (2026-11-20): pointer on the field and native button, icon clearance at 1200 px in light mode and 360 px in dark mode, keyboard focus, disabled cursor, and selection of a synthetic CSV. No import was submitted.

## Validation

- Observed: yes — source, tests, and the initial file-selection state; category-resolution interaction was not visually inspected.
- Evaluated: yes — against non-destructive import requirements.
- Adapted: yes — the non-destructive import is presented as select, review, and explicit confirm steps.
- Implemented: yes — UI and server flow exist.
- Verified: no — parser/API tests and typecheck pass, but category-resolution interaction and responsive/accessibility behavior were not browser-verified.
- Approved: no.

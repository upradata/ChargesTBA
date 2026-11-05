# Architecture

## Core Sections (Required)

### 1) Architectural Style

- Primary style: Event-driven Google Apps Script with spreadsheet operations in global script functions.
- Why this classification: `onEdit` is the runtime trigger and directly dispatches spreadsheet work through `refresh`.
- Primary constraints: Apps Script global function visibility; runtime-provided `SpreadsheetApp`; clasp receives compiled JavaScript rather than TypeScript.

### 2) System Flow

```text
Spreadsheet edit -> onEdit -> refresh -> named charge table -> payment/status/format helpers -> spreadsheet updates
```

1. Apps Script calls `onEdit` with an event containing the edited range.
2. `onEdit` uses a global re-entrancy flag and passes the range to `refresh`.
3. `refresh` resolves the named range `TableCharges`, checks the edited cell is inside it, and creates row-relative accessors.
4. `createCreditRows` validates amount/count values and inserts or updates payment rows when the amount or payment count is edited.
5. `updateCreditRowStatus` recalculates payment text/progress and colors the parent amount; `setDebitRowFormat` styles the parent row.

### 3) Layer/Module Responsibilities

| Layer or module        | Owns                                                                | Must not own                          | Evidence               |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------- | ---------------------- |
| `src/Code.ts`          | Edit-trigger flow, payment rows, status, and formatting             | Build/deployment tooling              | `src/Code.ts`          |
| `src/Utils.ts`         | Table/range addressing, A1 helpers, and guarded error logging       | Trigger registration or charge policy | `src/Utils.ts`         |
| `src/Test.ts`          | Manual `onEdit` debug helper                                        | Automated Node test cases             | `src/Test.ts`          |
| `tests/logic.test.mjs` | Regression tests for pure row-count and numeric validation behavior | Live spreadsheet operations           | `tests/logic.test.mjs` |

### 4) Reused Patterns

| Pattern                         | Where found                  | Why it exists                                                    |
| ------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| Re-entrancy guard               | `onEdit` in `src/Code.ts`    | Avoids recursive processing when the handler modifies the sheet  |
| Row-relative accessor functions | `refresh` in `src/Code.ts`   | Keeps table coordinates separate from absolute sheet coordinates |
| Shared range helpers            | `src/Utils.ts`               | Centralizes named-table, row, column, and cell addressing        |
| Guarded callback with logging   | `tryCatch` in `src/Utils.ts` | Handles selected spreadsheet formatting/validation failures      |

### 5) Known Architectural Risks

- Business logic calls the Apps Script spreadsheet service directly, so behavior tests use stubs rather than an isolated data-access layer.
- The meaning and required shape of multi-cell edit events are `[TODO]`; `refresh` uses the event range's first row and column.
- Apps Script runtime behavior cannot be fully verified by the local Node test suite.

### 6) Evidence

- `src/Code.ts`
- `src/Utils.ts`
- `src/Test.ts`
- `tests/logic.test.mjs`
- `appsscript.json`
- `.clasp.json`

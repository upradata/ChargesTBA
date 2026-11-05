# Coding Conventions

## Core Sections (Required)

### 1) Naming Rules

| Item               | Rule                                                            | Example                            | Evidence                      |
| ------------------ | --------------------------------------------------------------- | ---------------------------------- | ----------------------------- |
| Files              | Mixed descriptive names; no uniform case convention established | `Code.ts`, `Utils.ts`              | `src/`                        |
| Functions/methods  | camelCase                                                       | `createCreditRows`, `getTableCell` | `src/Code.ts`, `src/Utils.ts` |
| Types/interfaces   | PascalCase                                                      | `ChargeData`, `TryCatchOptions`    | `src/Code.ts`, `src/Utils.ts` |
| Constants/env vars | Uppercase constants; no environment-variable convention found   | `TABLE_NAME`, `COLUMNS`            | `src/Code.ts`                 |

### 2) Formatting and Linting

- Formatter: oxfmt, configured in `.oxfmtrc.json`.
- Linter: oxlint with `oxlint-tsgolint`, configured in `.oxlintrc.json`.
- Enforced rules include no debugger statements, duplicate imports, unreachable code, and constant conditions. The no-console rule permits `warn`, `error`, and `info`.
- Run commands: `pnpm format`, `pnpm lint`, `pnpm typecheck`.
- TypeScript uses `strict`, targets ES2019, and uses legacy module detection so the Apps Script files remain globals.

### 3) Import and Module Conventions

- Apps Script source files intentionally contain no imports/exports; top-level functions are shared as globals.
- Node-based build/test support uses ESM imports in `.mjs` files.
- No barrel-export or alias convention is configured.

### 4) Error and Logging Conventions

- Selected spreadsheet operations use `tryCatch`, which logs the supplied context and, by default, error message/stack through `console.warn`.
- Missing named ranges throw an `Error`.
- `onEdit` resets the re-entrancy flag in a `finally` block.
- No explicit sensitive-data redaction policy is documented; logs should avoid spreadsheet values and credentials.

### 5) Testing Conventions

- Tests are under `tests/` and use Node's built-in `node:test` and `node:assert/strict`.
- Tests execute compiled Apps Script global scripts in a VM context and stub spreadsheet dependencies.
- No coverage tool or threshold is configured.

### 6) Evidence

- `.oxlintrc.json`
- `.oxfmtrc.json`
- `tsconfig.json`
- `src/Code.ts`
- `src/Utils.ts`
- `tests/logic.test.mjs`
- `package.json`

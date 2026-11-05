# Codebase Concerns

## Core Sections (Required)

### 1) Top Risks (Prioritized)

| Severity | Concern                                                                           | Evidence                                | Impact                                                    | Suggested action                                                                            |
| -------- | --------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Medium   | Local tests use Apps Script stubs and cannot confirm the live Sheets API behavior | `tests/logic.test.mjs`, `src/Code.ts`   | Runtime integration regressions may not be caught locally | Add an authorized test spreadsheet workflow if the project owner needs integration coverage |
| Medium   | Payment status processing recursively visits each payment row                     | `src/Code.ts` (`updateCreditRowStatus`) | Very large payment series could exceed recursion limits   | Convert to iterative processing if large series are a real use case                         |
| Low      | Table column positions and table name are hard-coded                              | `src/Code.ts` (`COLUMNS`, `TABLE_NAME`) | Spreadsheet layout changes can break processing           | Keep sheet layout changes coordinated with the code                                         |

### 2) Technical Debt

| Debt item                                              | Why it exists                                            | Where                  | Risk if ignored                                      | Suggested fix                                                       |
| ------------------------------------------------------ | -------------------------------------------------------- | ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| Apps Script service calls and charge logic are coupled | The current script is a small global Apps Script project | `src/Code.ts`          | Harder to test behaviors that depend on the platform | Extract pure calculations only when additional behavior requires it |
| No project-level Apps Script integration test          | Local tests run in Node with stubs                       | `tests/logic.test.mjs` | Platform-specific behavior remains unverified        | `[TODO]` Decide whether a test spreadsheet is available             |

The previously observed acceptance of non-positive values and incorrect payment-row count were fixed during migration and have regression tests in `tests/logic.test.mjs`.

### 3) Security Concerns

| Risk                                                                          | OWASP category (if applicable) | Evidence                         | Current mitigation                        | Gap                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------ | -------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| Script access and execution permissions are not specified in repository files | N/A                            | `appsscript.json`, `.clasp.json` | Google Apps Script platform authorization | `[TODO]` Confirm intended sharing/execution model; no security policy is present |

### 4) Performance and Scaling Concerns

| Concern                                                                      | Evidence                                | Current symptom                                | Scaling risk                                           | Suggested improvement                                   |
| ---------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| Per-payment status calculation uses recursion and individual cell operations | `src/Code.ts` (`updateCreditRowStatus`) | Each payment row reads/writes cells separately | Larger series may increase runtime and recursion depth | Batch range reads/writes if real sheet sizes warrant it |

### 5) Fragile/High-Churn Areas

| Area          | Why fragile                                             | Churn signal                                                        | Safe change strategy                                                         |
| ------------- | ------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/Code.ts` | Coordinates and side effects depend on the sheet layout | `[TODO]` No pre-existing Git history was available to measure churn | Validate changes against both regression tests and an authorized spreadsheet |

### 6) `[ASK USER]` Questions

None remain from the migration-scope questions answered for this task.

### 7) Evidence

- `src/Code.ts`
- `src/Utils.ts`
- `tests/logic.test.mjs`
- `appsscript.json`
- `.clasp.json`
- `package.json`

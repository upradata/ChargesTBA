# External Integrations

## Core Sections (Required)

### 1) Integration Inventory

| System                                      | Type (API/DB/Queue/etc) | Purpose                                                          | Auth model                                                                 | Criticality | Evidence                                        |
| ------------------------------------------- | ----------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------- | ----------------------------------------------- |
| Google Apps Script Spreadsheet service      | Hosted platform service | Read/write the active spreadsheet and show payment-split prompts | Apps Script execution authorization; exact deployment identity is `[TODO]` | High        | `src/Code.ts`, `src/Test.ts`, `appsscript.json` |
| Google Apps Script deployment API via clasp | Deployment CLI/API      | Push project files and deploy script versions                    | clasp credentials managed outside the project                              | High        | `.clasp.json`, `package.json`                   |

### 2) Data Stores

| Store                                    | Role                                                       | Access layer                                                                           | Key risk                                                            | Evidence                      |
| ---------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------- |
| Google Sheets named range `TableCharges` | Stores charges, payment rows, payment status, and progress | Direct `SpreadsheetApp` calls in `src/Code.ts`, addressed by helpers in `src/Utils.ts` | Table layout/name changes can invalidate row and column assumptions | `src/Code.ts`, `src/Utils.ts` |

### 3) Secrets and Credentials Handling

- Credential sources: clasp's external user auth configuration; the project contains a clasp script identifier in `.clasp.json`.
- No `.env` file or environment variable template is present.
- No credential rotation or account lifecycle process is documented: `[TODO]`.
- `.gitignore` excludes local clasp auth (`.clasprc.json`) and `.env` files.

### 4) Reliability and Failure Behavior

- Retry/backoff behavior: none found.
- Timeout policy: `[TODO]`; no application-level timeout configuration is present.
- Circuit-breaker/fallback behavior: none found.
- Named-range absence throws; selected formatting/data-validation failures are logged and swallowed by `tryCatch`.

### 5) Observability for Integrations

- Logging: `console.info` records the changed row/column; `tryCatch` logs contextual warnings.
- Apps Script manifest sets `exceptionLogging` to `STACKDRIVER`.
- Metrics/tracing: none found in project files.
- Visibility gap: no local or remote Apps Script integration test is configured.

### 6) Evidence

- `src/Code.ts`
- `src/Utils.ts`
- `appsscript.json`
- `.clasp.json`
- `.gitignore`
- `package.json`

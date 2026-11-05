# Codebase Structure

## Core Sections (Required)

### 1) Top-Level Map

| Path              | Purpose                                                                         | Evidence                                                                                             |
| ----------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/`            | Apps Script trigger, charge logic, and shared range helpers                     | `src/Code.ts`, `src/Utils.ts`, `src/Test.ts`                                                         |
| `tests/`          | Node.js tests for compiled behavior                                             | `tests/logic.test.mjs`                                                                               |
| `scripts/`        | Build support and compiled-output push watcher                                  | `scripts/copy-manifest.mjs`, `scripts/push-watch.mjs`                                                |
| `docs/codebase/`  | Project architecture and working-knowledge documents                            | This document and the other codebase documents                                                       |
| `dist/`           | Generated JavaScript and Apps Script manifest consumed by clasp; ignored by Git | `tsconfig.json`, `.clasp.json`, `.gitignore`                                                         |
| Root config files | TypeScript, clasp, Apps Script, package, lint, and format configuration         | `tsconfig.json`, `.clasp.json`, `appsscript.json`, `package.json`, `.oxlintrc.json`, `.oxfmtrc.json` |

### 2) Entry Points

- Main runtime entry: `onEdit` in `src/Code.ts`, invoked by the Apps Script edit trigger.
- Secondary entry point: `testDebug` in `src/Test.ts`, a manually invoked debug helper.
- Build entry: `pnpm build` compiles all `src/**/*.ts`, then copies `appsscript.json` into `dist/`.
- Deployment content root: `dist/`, configured in `.clasp.json`.

### 3) Module Boundaries

| Boundary       | What belongs here                                                               | What must not be here                     |
| -------------- | ------------------------------------------------------------------------------- | ----------------------------------------- |
| `src/Code.ts`  | Trigger handling, charge/payment row operations, status and formatting behavior | Node-specific runtime APIs                |
| `src/Utils.ts` | Reusable spreadsheet range/table helpers and error wrapper                      | Charge-specific trigger flow              |
| `src/Test.ts`  | Manual Apps Script debug invocation                                             | Production test runner cases              |
| `tests/`       | Node tests against compiled scripts with API stubs                              | Live Google account or spreadsheet access |
| `scripts/`     | Build/deployment tooling                                                        | Apps Script business logic                |

### 4) Naming and Organization Rules

- Source files use mixed descriptive names (`Code.ts`, `Test.ts`, `Utils.ts`); no broader naming rule is established.
- Functions and local variables use camelCase; constants use uppercase names such as `TABLE_NAME`.
- Source is organized in one `src/` directory, not by feature or application layer.
- Apps Script source files are global scripts with no import/export statements so the trigger and helpers remain visible to the Apps Script runtime.

### 5) Evidence

- `src/Code.ts`
- `src/Utils.ts`
- `src/Test.ts`
- `tests/logic.test.mjs`
- `scripts/copy-manifest.mjs`
- `tsconfig.json`
- `.clasp.json`

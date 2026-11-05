# Technology Stack

## Core Sections (Required)

### 1) Runtime Summary

| Area                | Value                                                                                        | Evidence                                                    |
| ------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Primary language    | TypeScript 7.0.2; strict mode                                                                | `package.json`, `tsconfig.json`                             |
| Runtime + version   | Google Apps Script V8                                                                        | `appsscript.json`                                           |
| Package manager     | pnpm 12.16.1                                                                                 | `package.json`, `pnpm-lock.yaml`                            |
| Module/build system | Global Apps Script scripts compiled by `tsc` to `dist/`; `clasp` uploads compiled JavaScript | `tsconfig.json`, `.clasp.json`, `scripts/copy-manifest.mjs` |

### 2) Production Frameworks and Dependencies

There are no npm production dependencies. The script uses the Google Apps Script Spreadsheet service supplied by its runtime.

| Dependency                             | Version                | Role in system                                       | Evidence                         |
| -------------------------------------- | ---------------------- | ---------------------------------------------------- | -------------------------------- |
| Google Apps Script Spreadsheet service | Apps Script V8 runtime | Spreadsheet reads, writes, dialogs, and edit trigger | `src/Code.ts`, `appsscript.json` |

### 3) Development Toolchain

| Tool                         | Purpose                                          | Evidence                               |
| ---------------------------- | ------------------------------------------------ | -------------------------------------- |
| TypeScript                   | Strict type-checking and JavaScript compilation  | `package.json`, `tsconfig.json`        |
| `@types/google-apps-script`  | Apps Script API declarations                     | `package.json`, `tsconfig.json`        |
| `@google/clasp`              | Apps Script login, push, pull, and deployment    | `package.json`                         |
| oxlint + `oxlint-tsgolint`   | JavaScript/TypeScript linting                    | `package.json`, `.oxlintrc.json`       |
| oxfmt                        | Formatting                                       | `package.json`, `.oxfmtrc.json`        |
| Node.js built-in test runner | Regression tests against compiled global scripts | `package.json`, `tests/logic.test.mjs` |

### 4) Key Commands

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm push
pnpm deploy
```

### 5) Environment and Config

- Config sources: `appsscript.json`, `.clasp.json`, `tsconfig.json`.
- Required environment variables: none identified in project files.
- Apps Script authorization is managed through clasp credentials outside the tracked project; the local auth lifecycle is exposed by `pnpm login`.
- Deployment uses the existing Apps Script project ID in `.clasp.json`; compiled scripts and a copied manifest are placed under `dist/`.
- The supported Node.js version is `[TODO]`; no `engines` field or version file is configured.

### 6) Evidence

- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `appsscript.json`
- `.clasp.json`
- `scripts/copy-manifest.mjs`

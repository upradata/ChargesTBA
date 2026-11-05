# Testing Patterns

## Core Sections (Required)

### 1) Test Stack and Commands

- Primary test framework: Node.js built-in test runner (version follows the installed Node runtime; exact minimum is `[TODO]`).
- Assertion/mocking tools: `node:assert/strict`; a VM context supplies the Apps Script global script environment.
- Commands:

```bash
pnpm test
node --test
pnpm typecheck
```

`pnpm test` builds JavaScript and copies the Apps Script manifest before running the tests.

### 2) Test Layout

- Test files live in `tests/` and use the `*.test.mjs` naming pattern.
- Build/deployment support scripts live in `scripts/`.
- No separate test setup file is configured.

### 3) Test Scope Matrix

| Scope       | Covered? | Typical target                                          | Notes                                          |
| ----------- | -------- | ------------------------------------------------------- | ---------------------------------------------- |
| Unit        | Yes      | Payment row count and positive numeric input validation | Uses compiled scripts and in-memory cell stubs |
| Integration | No       | Real Apps Script Spreadsheet service                    | `[TODO]`                                       |
| E2E         | No       | Full spreadsheet editing workflow                       | `[TODO]`                                       |

### 4) Mocking and Isolation Strategy

- Main mocking approach: invoke compiled global scripts in a Node `vm` context and provide stub cell/range objects.
- Isolation guarantees: each test process constructs a fresh VM context.
- Common failure mode: tests do not model all Apps Script runtime behaviors or spreadsheet typing.

### 5) Coverage and Quality Signals

- Coverage tool + threshold: `[TODO]`; none configured.
- Current reported coverage: `[TODO]`; no coverage command is configured.
- Known gaps: prompts, actual row insertion/formatting, and live Apps Script integration are not exercised.

### 6) Evidence

- `tests/logic.test.mjs`
- `package.json`
- `tsconfig.json`
- `src/Code.ts`

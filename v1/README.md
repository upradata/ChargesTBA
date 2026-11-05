# ChargesTBA v1

Google Apps Script (TypeScript) automation for managing co-ownership charges and payments in a Google Sheets table.

## Stack

- TypeScript compiled to Apps Script, deployed with [clasp](https://github.com/google/clasp)
- pnpm workspace (lint/format run from the repository root with oxlint/oxfmt)
- Node test runner

## Scripts

| Command          | Description                   |
| ---------------- | ----------------------------- |
| `pnpm build`     | Compile and copy the manifest |
| `pnpm test`      | Build and run tests           |
| `pnpm typecheck` | Type-check without emitting   |
| `pnpm login`     | Authenticate clasp            |
| `pnpm push`      | Build and push to Apps Script |
| `pnpm deploy`    | Build, push and deploy        |

## Structure

- `src/` – Apps Script sources (`Code.ts`, `Utils.ts`)
- `tests/` – unit tests for the table logic
- `scripts/` – build helpers
- `docs/codebase/` – codebase documentation

## Notes

The sheet table is loaded in memory, edited, then written back in one pass to minimize Apps Script calls.

For temporary performance diagnostics, set `PERFORMANCE_TIMING_ENABLED` to `true` in `src/Code.ts`, run `pnpm push`, then inspect the Apps Script execution logs after editing a cell. Set it back to `false` and push again after measuring. Timings cover server-side execution, not the Sheets client repaint.

## License

ISC

# ChargesTBA

pnpm workspace for co-ownership charges and payments tracking in Google Sheets.

| Package    | Description                                                   |
| ---------- | ------------------------------------------------------------- |
| [v1](./v1) | Apps Script `onEdit` automation (current production)          |
| [v2](./v2) | Formula-driven rewrite (payments, charges, allocations) — WIP |

## Commands (from the root)

| Command          | Description                        |
| ---------------- | ---------------------------------- |
| `pnpm install`   | Install all workspace dependencies |
| `pnpm build`     | Build every package                |
| `pnpm test`      | Run every package's tests          |
| `pnpm typecheck` | Type-check every package           |
| `pnpm lint`      | Lint the whole repository          |
| `pnpm format`    | Format the whole repository        |

Package-specific commands (`push`, `deploy`, …) run from the package directory, e.g. `pnpm --filter ./v1 push`.

## License

ISC

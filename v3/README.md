# ChargesTBA v3

Early local-first prototype. This is not yet a replacement for v1 or v2.

## Run locally

Use Node.js `^22.18.0`, `^24.11.0` or `>=26.0.0` and pnpm from the workspace
root:

```sh
pnpm install
pnpm --filter @upradata/charges-tba-v3 dev
```

Open <http://127.0.0.1:5173>, then create a local account. The frontend and
Hono API bind to loopback only. The Vite+ CLI is installed in this workspace;
no global installation is needed.

Data and the authentication secret are stored in `v3/.data/`, which is ignored
by Git. Back up the entire directory while the server is stopped. Password
recovery and account export are not implemented. The database is **not
encrypted by the app**; use an encrypted disk and restrict operating-system
access. Do not expose this development server to the Internet or enter
production financial data without assessing its security and backup needs.

## Current functionality

- Local email/password accounts, charge entry and correction, payment entry
  and correction.
- Account-specific categories and reusable schedule templates are managed in
  Settings. A category may have a default template; a new category can also be
  entered directly on a charge.
- Charges can use a template or custom instalments with individual dates and
  amounts. Template offsets are relative to the charge month, and their weights
  determine the share of the total. The three-month preset starts on the first
  of the month after the charge date. Instalments are saved with the charge, so
  later template edits do not change existing charges. Dates use French
  `dd/mm/yyyy` display and amounts are stored in integer cents.
- Allocate payments across unpaid charges and apply previously unallocated
  credit later. Amounts already allocated cannot currently be reassigned.
- Dashboard with overdue amounts, balance graph and chronological movements.

Charge-first payment, modifying existing allocations, tags, demo mode,
email/calendar integrations and bank or syndic connections remain to be built.
The dashboard's overdue figure is informational and does not send reminders.

## Checks

```sh
pnpm --filter @upradata/charges-tba-v3 typecheck
pnpm --filter @upradata/charges-tba-v3 test
pnpm --filter @upradata/charges-tba-v3 build
```

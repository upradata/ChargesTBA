# ChargesTBA v3

Early local-first prototype. This is not yet a replacement for v1 or v2.

See the [product plan](./PROJECT-PLAN.md) for recorded decisions, release
milestones, and open questions.

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
- CSV import for charges, payments and mixed account statements, available
  after signing in.

Charge-first payment, modifying existing allocations, tags, demo mode,
email/calendar integrations and bank or syndic connections remain to be built.
The dashboard's overdue figure is informational and does not send reminders.

## Frontend architecture

The client is a React and TypeScript single-page app built with Vite Plus. It
uses Tailwind CSS v4 and shadcn/ui primitives for its interface, React Router
for client-side navigation, TanStack Query for server state, Zod for runtime
validation, and Recharts for the balance graph. Shared UI components live in
`src/components/ui`; feature-specific workflows remain in the client source.

The API remains a separate Hono service with Better Auth and SQLite/Drizzle.
AI capabilities are intentionally deferred: Vercel AI SDK, AI Elements and
streaming transports are not dependencies until an AI feature is implemented.

## CSV import

Select **Importer** after signing in, select the file type and a UTF-8 CSV,
then inspect the preview before confirming. Data is added to the signed-in
account only. The file is not retained separately; resulting records remain in
the local database. No CSV contents are written to the import log.

The first row contains column names, in any order. Names are case-insensitive;
French aliases `libellé`, `catégorie`, `montant`, `crédit` and `débit` are
accepted in place of `label`, `type`, `amount`, `credit` and `debit`.
Use commas or semicolons as separators, and quote fields containing the
separator, quotes (doubled as `""`), or line breaks. Dates must be `YYYY-MM-DD`
or `DD/MM/YYYY`. Amounts are positive euros with up to two decimal places,
using a comma or a point; thousands separators and currency symbols are not
accepted. Quote decimal commas in comma-separated files. Files are limited to
1,000 data rows and 1,000,000 bytes.

Charge example:

```csv
date;label;type;amount
31/01/2026;Premier trimestre;Appel de fonds;125,50
```

Each charge has one installment. Payment example:

```csv
date;type;amount
01/02/2026;Virement;100,00
```

An optional `label` column is also accepted for payment files. Statement
(`solde`) example:

```csv
date;label;type;crédit;débit
31/01/2026;Premier trimestre;Appel de fonds;;125,50
01/02/2026;Règlement;Virement;100,00;
```

Exactly one of credit or debit must be positive in each statement row. Debits
create charges and credits create payments. The label and type are retained.
Payments are not automatically allocated; use **Utiliser le crédit** to
allocate them later.

The preview identifies invalid rows and possible exact duplicates in the file
or the current account. A charge matches on date, label, type and amount; a
payment matches on date, type, amount and optional label. Invalid rows block
the entire import. Duplicates are not skipped: confirm explicitly to import
them. Duplicates are checked again at confirmation, and changed matches
require another review. The import is atomic: a failed import saves no rows.

## Checks

```sh
pnpm --filter @upradata/charges-tba-v3 typecheck
pnpm --filter @upradata/charges-tba-v3 test
pnpm --filter @upradata/charges-tba-v3 build
```

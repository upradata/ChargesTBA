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

### Temporary tunnel development

If a dev tunnel rewrites the request origin, start the app with its public HTTPS
origin and the explicitly unsafe development option:

```sh
APP_ORIGIN='https://YOUR-TUNNEL-5173.euw.devtunnels.ms' pnpm --filter @upradata/charges-tba-v3 dev:unsafe-origins
```

Replace the URL with the exact tunnel origin. `APP_ORIGIN` remains necessary for
authentication and secure cookies. This option accepts requests from **every
origin** and disables CSRF protections: other websites may perform actions as a
signed-in user. Use only with disposable development data, never in production.
Stop and restart using the normal `dev` command to restore the protections.

Data and the authentication secret are stored in `v3/.data/`, which is ignored
by Git. Back up the entire directory while the server is stopped. Password
recovery and account export are not implemented. The database is **not
encrypted by the app**; use an encrypted disk and restrict operating-system
access. Do not expose this development server to the Internet or enter
production financial data without assessing its security and backup needs.

## Calculate a password hash

From the workspace root, run `node v3/scripts/hash-password.mjs`. Enter a
password and leave the salt blank to generate a new hash, or enter the salt
before the colon in an existing `account.password` value to reproduce it.
Compare the output with the stored value. The password is visible as you type;
run this locally and do not share passwords or hashes.

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

The first row contains exactly `date`, `label`, `credit` and `debit`, in any
order. Names are case-insensitive; French aliases `libellé`, `crédit` and
`débit` are also accepted.
Use commas or semicolons as separators, and quote fields containing the
separator, quotes (doubled as `""`), or line breaks. Dates must be `YYYY-MM-DD`
or `DD/MM/YYYY`. Amounts are euros with up to two decimal places,
using a comma or a point; thousands separators and currency symbols are not
accepted. Quote decimal commas in comma-separated files. Files are limited to
1,000 data rows and 1,000,000 bytes.

Statement example:

```csv
date;libellé;crédit;débit
31/01/2026;APPEL DE FONDS TRIMESTRIEL;;125,50
01/02/2026;Virement;100,00;
02/02/2026;APPEL DE FONDS TRIMESTRIEL;;-10,00
```

Exactly one of credit or debit must be nonzero. Positive debits create charges,
negative debits create refunds, and positive credits create payments. Payments
and refunds receive proposed allocations that can be changed before confirmation.

In **Paramètres**, payment types and ordered CSV label rules can be added,
edited and removed. Rules use JavaScript regular-expression patterns without
slash delimiters; case-insensitive matching is configurable. The first matching
rule for the movement type wins. Defaults cover quarterly and reserve calls,
roof and miscellaneous works, the two refund labels in the supplied sample,
transfers, direct debits and cheques. Unmatched
payments keep the `Paiement importé` category. Deleting a category or payment
type also deletes its rules; existing payment records are unchanged.

The preview identifies invalid rows and possible exact duplicates in the file
or the current account. A charge matches on date, label, category and amount; a
payment matches on date, amount and optional label. Invalid rows block
the entire import. Duplicates are not skipped: confirm explicitly to import
them. Duplicates are checked again at confirmation, and changed matches
require another review. Preview lines are numbered from 1, not counting the
header. In the preview table, use the edit button in the **Catégorie** column to
override an automatic match for any labeled charge, refund or payment; the
choice applies to every line with the same label. Unmatched debit labels are
shown as **À définir** and can use an existing category or stage a new one;
unmatched payment labels keep the default payment category unless you choose a
payment type. New categories are saved only when the import is confirmed. To
change an allocation, select the button next to a payment or refund amount:
only unpaid charges dated on or before it remain visible (same category for
refunds), including existing charges. Tick charges and adjust amounts, then
select **OK** in the bottom bar. The import is atomic: a failed import saves no
rows.

## Checks

```sh
pnpm --filter @upradata/charges-tba-v3 typecheck
pnpm --filter @upradata/charges-tba-v3 test
pnpm --filter @upradata/charges-tba-v3 build
```

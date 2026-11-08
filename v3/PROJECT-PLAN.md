# ChargesTBA product plan

> **Status:** Working roadmap  
> **Audience:** Product owner and contributors  
> **Scope:** Product decisions, release milestones, and acceptance criteria for the web application in this `v3/` directory.

The directory name `v3` identifies this implementation alongside the existing
v1 and v2 projects. The **Product V1, V2, ...** milestones below are the
planned releases of this web application; they are not the same as the
repository directory versions.

## Product goal

Replace the Google Sheets workflow with an approachable French-first
application for recording condominium charges, tracking payment schedules,
allocating payments, and understanding the resulting balance.

The main workflow is organized around **charges** and **payments**:

1. Record a charge from a syndic notice, including its amount, category, dates,
   and expected payment schedule.
2. Record a payment already made, or select charges first to see the amount to
   pay.
3. Allocate some or all of that payment to one or more eligible charges.
4. See what remains due, what is late, and any unallocated credit.

Allocation is part of the payment workflow. Do not expose a separate
third-party attribution table or make users maintain a separate allocation
spreadsheet. The application may keep the underlying relationships needed for
correct accounting, but users should work through clear charge and payment
views.

## Decisions made

| Area                          | Decision                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                      | React and TypeScript                                                                                                                                    |
| Frontend toolchain            | Project-local Vite+ (`vp`) for Vite, Oxc and tests; pnpm remains the workspace package manager. Do not require a global Vite+ installation.             |
| Backend                       | Hono on Node.js with a typed HTTP API and conventional TypeScript; do not adopt Effect as the application-wide programming model for now.               |
| Persistence                   | SQLite with Drizzle ORM for the local-first starting point. Moving to PostgreSQL later requires an explicit migration.                                  |
| UI                            | Mantine components and forms, with a polished, spacious dashboard inspired by ChatGPT's visual simplicity. This is not a conversational/chat interface. |
| Supporting frontend libraries | React Router for navigation, TanStack Query for server state, Zod for runtime validation, and Mantine Charts/Recharts for visualizations.               |
| Authentication                | Local email/password accounts using Better Auth; isolate each account's data. A demo account must be synthetic and explicitly enabled by the user.      |
| Initial operation             | Local-first and loopback-bound. Do not expose the development server to the Internet or imply that local authentication is production hosting.          |
| Currency and amounts          | Euro-first UX; persist money as integer cents and avoid floating-point accounting.                                                                      |
| Language and dates            | French-first interface. Keep date entry and display unambiguous and distinguish a syndic due date from a user's preferred payment date.                 |
| Data-entry UX                 | Users can correct their own records. Defaults make entry faster but can be overridden on a charge and later where accounting remains consistent.        |

### Product constraints

- Never require users to edit a third allocation/attribution table.
- A payment can cover multiple charges, and one charge can be paid over time.
- Support full, partial, catch-up, and overpayment scenarios without changing
  the amount already recorded as paid.
- Preserve an auditable, understandable history when correcting money records;
  never silently lose or reassign a recorded payment.
- Keep external services optional. Do not promise fee-free bank transfers,
  unattended email, calendar sync, or syndic integrations until their access,
  legal, security, and operational requirements are validated.

## Product V1 — dependable local bookkeeping

**Goal:** Replace the everyday spreadsheet workflow with a safe, usable local
application for charges, payments, and balances.

### Features

- Local account creation, sign-in, sign-out, and account data isolation.
- An opt-in synthetic demo mode. The user chooses whether to enter the demo
  already signed in; never prefill or expose a real user's data as demo data.
- French-first responsive shell with dashboard, charges, payments, movements,
  and preferences navigation; light and dark themes.
- Create, review, and correct charges with a title, category, amount, date,
  and one-time or monthly schedule.
- Create, review, and correct payments with a date, payment method/category,
  and amount. Default the method to _virement_ while allowing an override.
- Allocate payment amounts to one or more charges from within payment entry.
  Show only charges that still have an unpaid balance.
- Show per-charge paid and remaining amounts, total outstanding charges,
  unallocated payment credit, and a chronological debit/credit ledger with a
  running total.
- Dashboard cards and a balance-over-time graph, with clear labels for
  outstanding charges, account balance, and available/unallocated credit.
- Correct common situations: partial payment, two instalments paid together,
  an amount below the suggested instalment, and extra money left after a
  payment.
- Store monetary amounts in cents and validate ownership and allocation limits
  on the server, not just in the browser.
- Provide a visible, non-destructive way to leave demo mode and keep demo data
  isolated from normal accounts.

### Acceptance criteria

- A new user can create an account, record a charge and a payment, allocate
  that payment, and see the updated charge progress and ledger.
- A payment cannot be allocated beyond its recorded amount or beyond the
  charge's unpaid amount.
- One user's account cannot read or alter another user's records.
- Invalid or rejected operations do not leave partial payments or allocations.
- UI and API tests cover cents, ownership, edits, payment allocation, unused
  credit, and relevant error states.
- The app remains usable at narrow/mobile widths and supports keyboard access
  and labelled form controls.
- Document local storage, backups, authentication limits, and the absence of
  application-level database encryption. Do not present the prototype as a
  secure hosted service.

## Product V2 — recurring schedules and flexible allocation

**Goal:** Model real syndic calls and user-specific payment habits without
forcing a single schedule per charge.

### Features

- Schedule frequencies: one-time, weekly, twice per month, every two months,
  monthly, quarterly, and a custom schedule.
- Make twice-monthly and every-two-months distinct options.
- Support recurring charge templates for regular calls such as quarterly
  _appels de fonds_, with generated future due dates and amounts.
- Keep the official syndic due date separate from the user's planned payment
  date and payment frequency.
- Save default schedules and payment methods in preferences, apply them to
  new entries, and allow per-charge overrides and later edits.
- Split totals into exact cent-valued instalments with deterministic remainder
  handling and month-end date clamping.
- Suggest the earliest unpaid instalment amount when allocating a payment.
- Let users pay one instalment, several instalments, a chosen percentage, or a
  custom partial amount; update remaining instalments and overdue amounts
  accordingly.
- Add a charge-first flow: select one or more outstanding charges/instalments,
  see the total requested, then record a payment the user has already made.
- Apply unallocated credit to eligible future charges from the payment or
  charge workflow, without exceeding either available credit or the amount
  still due.
- Allow correction of schedules and allocation decisions with an explicit
  history and safeguards for previously recorded money.
- Add user-defined categories and tags, such as _travaux piscine_, for
  filtering and reporting.

### Acceptance criteria

- Schedule generation handles leap years, month ends, custom dates, and exact
  cent totals.
- Users can distinguish a twice-monthly plan from a two-month interval.
- A late or partial payment leaves a visible remaining amount; no amount is
  marked paid until recorded and allocated.
- Editing a schedule never silently changes past payment history.
- Both payment-first and charge-first entry produce the same ledger and
  outstanding balance for equivalent transactions.

## Product V3 — arrears, reminders, and syndic communication

**Goal:** Help users understand and resolve overdue charges.

### Features

- Configurable in-app alerts for upcoming and overdue instalments.
- A notification center with late amount, related charge, due date, and
  remaining balance.
- A French email draft addressed to the syndic for a payment delay.
- Optional explanation/reason and an optional resolution plan, such as a
  future date or proposed instalment schedule.
- Review and edit the message before opening the user's configured email
  application. Sending email automatically is a separate, opt-in integration.
- Mark reminders as seen or resolved and recalculate them when a payment or
  schedule is corrected.

### Acceptance criteria

- Reminder status is derived from the official due date and unpaid amount,
  rather than the user's preferred payment day alone.
- The app does not send messages without explicit user action and configured
  delivery.
- Reminder content does not expose one account's charges to another account.
- Users can correct the charge, date, and proposed resolution without losing
  prior payment history.

## Product V4 — calendar, bank, and syndic integrations

**Goal:** Reduce duplicate entry with carefully scoped external connections.

### Calendar

- Start with downloadable calendar events (for example, ICS) for selected
  one-time or recurring due dates.
- Consider Google Calendar connection and updates only after consent,
  permission scopes, token storage, disconnect, and revocation behavior are
  specified.
- Let users select which charges and schedule events are exported.

### Bank transfers

- Investigate whether a supported bank flow can prepare or initiate a transfer
  to the syndic IBAN.
- Keep manual _virement_ recording available regardless of integrations.
- Explain that an IBAN by itself cannot initiate a bank transfer and that
  initiating transfers may require bank authorization, a regulated provider,
  or bank-specific services.
- Do not promise no fees; validate costs and terms for each supported route.
- Do not add Stripe merely to simulate a bank transfer. Any payment initiation
  provider requires an explicit product decision.

### Syndic portals and document imports

- Research authorized APIs, exports, or import mechanisms for specific syndic
  providers; do not assume there is a universal extranet interface.
- Provide user-controlled document/CSV import with preview and confirmation
  before creating charges.
- Avoid storing syndic passwords or automating access in ways that violate
  provider terms. Define credential handling and deletion before any connector.
- Detect likely duplicates and let users correct imported charge details.

### Acceptance criteria

- Each integration is optional, permission-scoped, disconnectable, and
  documented before release.
- Imports are previewed and confirmed; failed or duplicate imports do not
  create partial or repeated charges.
- Calendar changes and imported charges can be reconciled after a user edits
  the source charge.

## Product V5 — deployment and multi-device readiness

**Goal:** Decide whether to grow beyond a single local installation.

This milestone is intentionally conditional. The product is local-first today;
online access, synchronization, shared household accounts, and hosted services
have not yet been selected.

### Potential scope

- Decide whether accounts represent one person, a household, or a property and
  what roles or sharing are required.
- Decide hosting model, supported regions, backup/restore, update process, and
  incident response.
- Reassess SQLite versus PostgreSQL and plan a tested migration if multiple
  concurrent remote users are required.
- Add secure account recovery, export, erasure, retention, and operational
  monitoring appropriate to the chosen deployment.
- Review privacy, security, legal obligations, and subprocessors before
  sending personal or financial data to external services.

## Current implementation snapshot

The current `v3/` prototype is an early foundation, not a completed Product
V1. The source of truth for implementation status is also documented in
[README.md](./README.md).

Implemented so far:

- React/TypeScript and Vite+ frontend; Hono API; Better Auth email/password;
  SQLite persistence; Drizzle schema access.
- Local account creation/sign-in and server-side account ownership checks.
- Charge and payment creation and correction, including validation that
  recorded allocations are not invalidated by reducing amounts.
- Payment-first allocation to charges, later allocation of unallocated payment
  credit, and protection against over-allocation.
- Dashboard, monthly schedule summary, informational overdue calculation,
  balance graph, and movement ledger.
- Tests for schedule arithmetic, API ownership, payment/charge boundaries, and
  allocation behavior.

Not implemented yet:

- Opt-in demo mode and pre-authenticated demo launch.
- Preferences and saved defaults.
- Schedule frequencies beyond one-time/monthly, recurring charge generation,
  and official due-date tracking separate from planned payments.
- Charge-first payment selection and custom tags/categories.
- Editing/reassigning existing allocations or an audit history for corrections.
- In-app notification center, email drafts, and calendar export/synchronization.
- Bank transfer initiation, syndic portal connections, and automated imports.
- Hosted deployment, multi-device synchronization, and production-grade
  account recovery/operations.

## Open decisions

Resolve these before the milestone that depends on them; do not treat them as
already selected:

1. Should accounts and data remain on one machine, or should users be able to
   synchronize across devices or share them with a household?
2. What is the preferred demo entry point: a launch-screen choice, a
   pre-populated demo account, or both? How should demo resets work?
3. What constitutes a syndic's authoritative due date, and how should custom
   and irregular schedules represent it?
4. When a payment is split across several charges, should automatic
   suggestions follow earliest due date, user-selected order, or a saved
   preference?
5. Should corrections to confirmed payments be direct edits, reversal plus
   replacement, or a user-selectable workflow?
6. Which calendar/email providers should be supported first, if any?
7. Which syndic providers and document formats are important enough to
   prioritize?
8. Is bank-transfer initiation a required goal, and what fees and authorization
   constraints are acceptable?
9. What deployment, backup, recovery, retention, and support expectations apply
   before real financial data is used beyond a local prototype?

## Delivery principles

- Keep charges and payments as the main user concepts; expose allocation only
  where users need to choose how money is applied.
- Prefer clear explanations and actionable choices over accounting jargon.
- Make defaults visible and overridable; never silently change user-entered
  dates or amounts.
- Validate all financial invariants on the server and cover them with tests.
- Preserve cents exactly and make the ledger reconcile with recorded charges,
  payments, and unallocated credit.
- Treat integrations as explicit, optional capabilities, not assumed
  dependencies.
- Update this plan and the current implementation snapshot when scope or
  decisions change.

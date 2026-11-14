# ChargesTBA v3 frontend migration

## Audit

- The v3 package is part of the pnpm workspace. The workspace provides pnpm 12, Oxlint and OXFmt; v3 uses Vite Plus for its Vite, test, build and development commands.
- The frontend uses React 19 and strict TypeScript. `src/App.tsx` is a 926-line application containing login, dashboard, charges, payments, ledger, routing, queries and mutations; import and settings views are separate files.
- The UI is built on Mantine core, forms, hooks and charts, with a small custom stylesheet. Routes use `react-router` 8.5.1. The Mantine chart package is used alongside Recharts.
- TanStack Query already owns server state; Zod validates API inputs. The typed Hono client communicates with a Hono/Node API. Better Auth, SQLite/Drizzle and shared schedule and CSV-import modules are already in place.
- The product includes local accounts, charge/payment creation and correction, payment allocation, settings, dashboard/ledger, and CSV preview/import. These behaviors and existing tests must be preserved.
- Baseline checks: TypeScript passed; all 16 tests in four files passed. The root workspace has an Oxlint command. The working tree was clean before this audit.

## Differences from target and dependency decisions

- Migrate the existing Mantine UI to Tailwind CSS v4 and shadcn/ui, including the shared shell, auth, financial workflows, settings, import, dashboard and ledger. Keep existing product behavior and accessibility.
- The attachment names React Router 7, but the user chose to retain the installed React Router 8.5.1. Keep the current client-side routing model and avoid framework-mode adoption.
- Retain React, TypeScript, Vite Plus, TanStack Query, Zod, Recharts, Hono, Better Auth, SQLite/Drizzle and existing backend boundaries. Use Recharts directly after removing the Mantine chart wrapper.
- Do not add Zustand, TanStack Table, Motion or nuqs without a concrete feature that needs them. Use component-local state for local UI state and TanStack Query for server state. Add other UI packages only when required by the migrated interface.
- Do not install Vercel AI SDK or AI Elements, add speculative AI abstractions, or build AI functionality.
- Split the oversized app only as needed to migrate its existing responsibilities into focused feature and shared UI modules; do not create speculative modules or rewrite backend/business logic for visual conformity.

## Risks and safeguards

- Replacing Mantine changes nearly every existing screen and form; preserve French labels, validation, loading/error/empty states, keyboard/focus behavior, responsive layout and all financial calculations.
- Keep authentication and authorization behavior unchanged and backend authorization authoritative. Preserve API contracts, account isolation, CSV validation/atomicity and persisted data.
- Tailwind/shadcn setup must work with Vite Plus and workspace tooling. shadcn primitives are adopted only where used; avoid introducing a second design system or unnecessary runtime dependencies.
- React Router 8 is intentionally retained despite the target's v7 label; no route-version migration is in scope.

## Implementation order

1. Establish Tailwind v4 and the shadcn/ui conventions, update Vite/CSS/entry-point configuration and dependency lockfile as needed.
2. Replace Mantine components and form/chart usage with the target UI while extracting focused modules where that reduces the existing App monolith; preserve all current flows and state boundaries.
3. Update directly related setup/architecture documentation and review the final dependency and file lists.
4. Run workspace lint plus v3 TypeScript, tests and production build; fix migration-caused failures and verify existing workflows remain represented by tests.

## Completion report

Report the original architecture, implemented changes, retained behavior, final dependency versions and rationale for dependency changes, final structure, conventions and trade-offs, deferred work, verification results and remaining limitations. Clearly identify AI work as intentionally deferred.

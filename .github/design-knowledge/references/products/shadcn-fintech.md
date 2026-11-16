# shadcn-fintech — financial dashboard product reference

- **Canonical source:** [Official GitHub repository](https://github.com/abderrahimghazali/shadcn-fintech)
- **Live demo:** [Dashboard](https://shadcn-fintech.vercel.app/dashboard)
- **Inspected:** 2026-11-15.
- **License / reuse:** The official repository’s [`LICENSE`](https://github.com/abderrahimghazali/shadcn-fintech/blob/main/LICENSE) is MIT and requires retaining copyright and license notices when distributing copies or substantial portions. This entry records design research; it does not authorize copying assets or code. The official README warns of a malicious third-party re-upload; use only the canonical repository.

## Evidence scope

- **Live interface inspection:** Opened the dashboard and transactions pages in a browser and inspected their rendered screenshots and accessibility snapshots. Page text and links were also retrieved for `/transfers`, `/accounts`, `/budgets`, `/settings`, and `/crypto`; those routes received content inspection only, not screenshot review.
- **Source code:** Inspected the root and dashboard layouts; global CSS; app sidebar and primary navigation; command palette; financial-overview chart; dashboard customizer and quick-transfer widget; transaction filters, table and page client; and transfer quick-send. Representative source URLs include [`src/app/layout.tsx`](https://github.com/abderrahimghazali/shadcn-fintech/blob/main/src/app/layout.tsx), [`src/app/globals.css`](https://github.com/abderrahimghazali/shadcn-fintech/blob/main/src/app/globals.css), [`src/app/(dashboard)/layout.tsx`](https://github.com/abderrahimghazali/shadcn-fintech/blob/main/src/app/%28dashboard%29/layout.tsx), [`src/components/app-sidebar.tsx`](https://github.com/abderrahimghazali/shadcn-fintech/blob/main/src/components/app-sidebar.tsx), [`src/components/command-palette.tsx`](https://github.com/abderrahimghazali/shadcn-fintech/blob/main/src/components/command-palette.tsx), [`financial-overview.tsx`](https://github.com/abderrahimghazali/shadcn-fintech/blob/main/src/components/dashboard/financial-overview.tsx), [`dashboard-customizer.tsx`](https://github.com/abderrahimghazali/shadcn-fintech/blob/main/src/components/dashboard/dashboard-customizer.tsx), [`transaction-table.tsx`](https://github.com/abderrahimghazali/shadcn-fintech/blob/main/src/components/transactions/transaction-table.tsx), and [`quick-send.tsx`](https://github.com/abderrahimghazali/shadcn-fintech/blob/main/src/components/transfers/quick-send.tsx).
- **Repository documentation:** Inspected README feature/page descriptions, package manifest, and MIT license.
- **Browser interaction checks:** Ctrl+K opened the command palette, Escape dismissed it, searching `Spotify` reduced the transaction table to one row, and clicking that row revealed merchant/card details and a View Receipt action. These spot checks do not constitute a complete interaction or accessibility audit.
- **Not inspected:** Tablet behavior, assistive-technology output, network behavior, or back-end integration. The README-linked showcase image was not inspected; the local screenshots below are fresh captures of the live demo instead.

## Information architecture

**Observed — screenshot, live content, and source:** The sidebar displays Overview (linking to `/dashboard`), Accounts, Transactions, and Cards under “Daily”; Transfers, Investments, and Crypto under “Money”; Analytics and Budgets under “Insights”; and Sign In/Sign Up under “Auth.” Notifications, Settings, and Help & Support appear separately near the sidebar footer. The header breadcrumb says “Dashboard,” while the sidebar calls the route “Overview.” The root README describes 11 product pages, while the source and demo expose additional support and authentication routes.

**Design interpretation:** The groups divide everyday account activity, money movement, and analysis. The separate Auth group is an unusual navigation choice for a signed-in finance dashboard and should not be copied without a product reason. For ChargesTBA, preserve the simpler task model of dashboard, charges, payments, movements, settings, and import.

## Application shell and navigation

**Observed — source:** `src/app/(dashboard)/layout.tsx` composes `SidebarProvider`, `AppSidebar`, `SidebarInset`, a 16-unit-high header, sidebar trigger, separator, dynamic breadcrumb, theme toggle, and `CommandPalette`. The sidebar source defines grouped destinations and a user footer. `src/components/nav-main.tsx` derives the active item from the current pathname. The page content is placed in a flexible main region.

**Observed — source, behavior not runtime-verified:** `src/components/command-palette.tsx` opens on ⌘K or Ctrl+K, presents searchable groups for pages, recent transactions, quick-transfer contacts, crypto, and theme options, and routes selected items. `src/components/app-sidebar.tsx` uses the shadcn sidebar primitives. These implementation details do not verify focus handling, mobile collapse behavior, or accessibility in the rendered app.

**Screenshot observation:** At the captured desktop width, the sidebar stays visible beside the main pane; a slim top header holds the sidebar toggle, breadcrumb, shortcut hint, and theme control. On the captured mobile width the sidebar is collapsed behind a header toggle. The customizer remains at the upper right of the content.

**Design interpretation:** Persistent section navigation plus breadcrumb context supports orientation in a broad multi-page template. The “Overview”/“Dashboard” label mismatch may weaken naming consistency. The global palette shortens navigation when the route set grows, but its groups and entities should be limited to genuine product tasks.

## Typography, spacing, color, and surfaces

**Observed — source:** `src/app/layout.tsx` loads Geist Sans and Geist Mono through `next/font/google` and sets a sans-serif base. `src/app/globals.css` defines Tailwind/shadcn semantic color roles as CSS variables using OKLCH, with separate light and dark values; the base chart tokens are neutral grayscale, and the radius token is `0.625rem`. The same file maps semantic sidebar, chart, foreground/background, and surface roles into Tailwind theme tokens. Component source uses repeated compact spacing utilities (for example `gap-4`, `p-4`, small card headings, and tabular numeric classes).

**Inference, not visual measurement:** These choices suggest a neutral, token-driven visual foundation with a compact dashboard rhythm. Screenshots provide rendered examples, but do not establish exact type scales, contrast ratios, spacing tokens, or visual behavior in other states. Do not treat source utilities as proof of every rendered detail.

**Observed — screenshots:** Captures show a white/off-white canvas, dark text, thin light-gray borders, rounded cards, and compact sans-serif labels. The desktop chart is mostly black and gray; financial directions also use green/red and category chips use multiple hues. The dashboard’s widget cards share a consistent border and radius, while the wallet card is a visually strong black surface. These are visual observations from the saved captures, not measured design tokens or contrast results.

## Dashboard and data visualization

**Observed — live content extraction:** The dashboard surfaces a financial overview, account cards, wallet balance, quick transfer, monthly spending limit, money movement, financial-health scores, and recent transactions. The financial overview includes monthly values for current and prior years. The dashboard data includes multiple currencies and account types.

**Observed — source:** `src/components/dashboard/financial-overview.tsx` renders a Recharts area chart with a date-range picker, current/prior-year totals, month axis, formatted tooltip, faint prior-period line, and a primary-color current-period area fill. Its filter logic expands selections shorter than three months for chart readability. `src/components/dashboard/dashboard-customizer.tsx` composes widgets in a 12-column CSS grid with small/large/full widths. “Customize” enables dragging; “Lock” exits editing; “Reset layout” restores defaults. Widget order is stored in localStorage under `vault-dashboard-order`.

**Design interpretation:** The comparison chart connects a selected period to explicit totals and labels, while the responsive grid gives overview users a way to prioritize content. The many independent metrics, widgets, crypto, and investment panels create substantial dashboard density; ChargesTBA should show only measures that support charge/payment decisions. Widget reordering is an optional template feature, not a default requirement.

## Tables, search, and filtering

**Observed — live content extraction:** Transactions are presented with merchant, category, identifier, amount, and date examples; the page also surfaces total-in, total-out, largest-transaction, and count summaries.

**Observed — source:** `src/components/transactions/transactions-page-client.tsx` derives filtered rows from seeded data and composes summary, filters, table, and bulk actions. Search matches merchant, transaction ID, and category; category, status, and income/expense filters are available. Row selection drives selected-row CSV export. `src/components/transactions/transaction-table.tsx` includes select-all/indeterminate state, expandable transaction details, and an empty-filter state. Responsive classes hide transaction ID below `sm`, date below `md`, and status below `lg` rather than keeping every column visible. Amounts use tabular numerals; income is prefixed and accented.

**Design interpretation:** Summary → filters → results makes scope and volume visible before row-level inspection. Responsive column prioritization trades detail for width; it may conceal data on smaller screens and needs actual viewport testing. For ChargesTBA, compare this with the existing horizontally scrollable tables and keep essential dates, amounts, and balances reachable.

**Observed — screenshots and browser checks:** At the captured desktop width the transaction table shows selection, merchant/category, transaction ID, amount, date, and status in one wide bordered grid; summary metrics and filter controls sit above it. Searching `Spotify` visibly reduced the table to one row, and clicking that row opened a details row with merchant information, card suffix, and View Receipt. At the captured mobile width, the dashboard’s recent-transactions table hides identifier/date columns but clips the right edge of a long amount (`$120.00`); the reference implementation therefore needs further narrow-layout QA.

## Forms and interaction states

**Observed — live content extraction:** The Transfers page exposes recipient selection, amount, optional note, and a Send control. Settings shows tab-like Profile, Security, Notifications, Billing, and Appearance sections with visible profile fields and a Save Changes action. Content extraction does not establish form validation or submission results.

**Observed — source:** `src/components/transfers/quick-send.tsx` provides contact-avatar selection, amount and optional note inputs, disabled inputs while sending, a sending state, and a success presentation. The success is driven by a client-side timeout and optional callback; it is a simulation, not evidence of an actual transfer. Dashboard `quick-transfer.tsx` has a related, more compact amount-and-recipient flow.

**Design interpretation:** Recipient confirmation, amount, optional context, and an explicit pending/success transition form a legible short flow. The simulation demonstrates presentation states only. Never copy a “sent” confirmation into a real-money workflow without authoritative transaction success, error handling, and safe retry semantics.

**Screenshot observation:** The dashboard’s compact transfer card places overlapping contact avatars above the selected-recipient label, then an amount field and Send button on one row at desktop width. In the mobile screenshot, the input and action remain side by side. The full Transfers quick-send form was not visually captured.

## Distinctive UX patterns

- **Observed — source and live browser:** The global command palette is present in the shell; Ctrl+K opens it and Escape closes it. See [the command-palette pattern](../../patterns/command-palette.md) and its saved capture.
- **Observed — source, not runtime-tested:** The dashboard customizer supports drag reordering, a Lock mode, Reset layout, and localStorage persistence. The card customization UI is visible in the dashboard screenshot, but drag, reset, and persistence were not tested.
- **README-described only:** Interactive credit-card flip/freeze, a virtual-card generator, investment ticker animations, a spending heatmap, actionable notifications, animated budget rings, and AI insights are advertised in the README. These features were not independently inspected in screenshots or implementation source for this review; do not treat their detail or quality as verified.

**Design interpretation:** The palette and layout customization make the template feel configurable and shortcut-oriented. That flexibility is distinctive but also adds controls and state. ChargesTBA should only adopt such complexity when it measurably improves a recurring workflow.

## Responsive behavior and accessibility limits

**Observed — source and screenshots:** Responsive classes are present in dashboard chart headers, grid spans, form layouts, and transaction columns. At the configured 1440×1000 desktop viewport (1425 CSS-pixel page content in the capture), the sidebar is persistent and dashboard widgets use a multi-column layout. At the configured 390×844 mobile viewport (375 CSS-pixel layout width in the captured page), the sidebar is collapsed behind the header toggle, dashboard widgets stack vertically, and recent transactions show fewer columns. The amount clipping described above is visible in the mobile capture. These are observations at two tested viewport configurations, not proof for all devices or orientations.

**Not established:** Opening the mobile navigation drawer, tablet/orientation behavior, touch-target adequacy, focus order, screen-reader announcements, measured color contrast, reduced-motion behavior, or responsive behavior on other devices. No full accessibility audit was performed.

## Reusable principles and implementation ideas

- Group a sizeable navigation set into a few stable user-goal sections; use a clear current-route state and retain page context in the header.
- Consider a global command surface only when route/entity/action breadth makes it useful; expose its keyboard shortcut and ensure the dialog remains accessible.
- Pair chart series with named totals, a visible period, and useful tooltips; do not make color the only series cue.
- For dense records, combine useful summary metrics and scoped filters with detail expansion only when it reduces navigation cost. Preserve critical financial fields at narrow widths.
- Make pending, disabled, success, and empty states explicit, but connect success to the actual operation result rather than a timer.
- Use semantic theme tokens and tabular numerals as implementation techniques, not as evidence of a particular visual quality.

For ChargesTBA, these are candidate ideas to adapt against its French-first, local-first condominium bookkeeping workflows and existing tokens/components. This reference does not add financial integrations, multiple currencies, budgets, crypto, transfers, or dashboard customization to product scope.

## Limitations and reuse cautions

- The README and source describe a polished-looking finance template, but the live app content and source indicate seeded demo data. Do not present example balances, transactions, tickers, or simulated transfers as real financial functionality.
- The interface combines USD, EUR, crypto, investments, and personal-finance concepts. Those domain assumptions differ from ChargesTBA’s condominium ledger.
- Source inspection is not visual QA, and page text extraction does not expose every visible detail or interaction.
- The repository is MIT-licensed; preserve required notices if any code is reused after review. Independently check third-party assets, fonts, and dependencies. Prefer adapting principles rather than copying source or screenshots.
- Use only `abderrahimghazali/shadcn-fintech`; the official README warns about a malicious similarly named third-party re-upload.

## Evidence and status

- **Observed — live interface content extraction:** Demo routes listed in Evidence scope; page text, labels, links, and sample content only.
- **Observed — source code:** Layout, CSS tokens, navigation, palette, chart, widget customizer, transaction filters/table, and quick-send files listed above.
- **Observed — repository documentation:** README, `package.json`, and `LICENSE` inspected.
- **Observed — screenshots:** Dashboard desktop/mobile, transaction desktop, and open command-palette captures are linked below and were visually inspected.
- **Observed — browser interaction checks:** Ctrl+K opened and Escape closed the command palette; transaction search filtered to Spotify; clicking the filtered row expanded its details.
- **Evaluated:** Candidate principles assessed for ChargesTBA fit; the product-specific cautions above apply.
- **Inferred:** Explanations of hierarchy, density, and usability are labeled as interpretations, not observed outcomes.
- **Not established:** Broader accessibility and keyboard behavior, backend money movement, or real transaction data.
- **Repository showcase image:** Not visually inspected; the local captures are of the live demo.
- **ChargesTBA pattern status:** Reference only. No external pattern is marked adapted, implemented, verified, or approved for ChargesTBA by this research.

## Saved screenshots

Captured from `https://shadcn-fintech.vercel.app/` on 2026-11-15 and visually inspected. Full-page captures are evidence of the rendered state at capture time, not interaction specifications.

- [Dashboard — initial 906 CSS-pixel browser width, full page](../../screenshots/products/shadcn-fintech-dashboard-desktop.png)
- [Dashboard — configured 1440×1000 desktop viewport, full page](../../screenshots/products/shadcn-fintech-dashboard-1440x1000.png)
- [Dashboard — configured 390×844 mobile viewport, full page; rendered layout width 375 CSS pixels](../../screenshots/products/shadcn-fintech-dashboard-mobile-390x844.png)
- [Transactions — configured 1440×1000 desktop viewport, full page](../../screenshots/products/shadcn-fintech-transactions-1440x1000.png)
- [Command palette open — configured 1440×1000 desktop viewport](../../screenshots/products/shadcn-fintech-command-palette-1440x1000.png)

# Global command palette

## Purpose

Provide a fast, keyboard-invoked way to navigate to destinations or invoke a small set of common actions when an application has enough routes and entities to justify a global command surface.

## References

- [shadcn-fintech product reference](../references/products/shadcn-fintech.md).
- External implementation source: [`command-palette.tsx`](https://github.com/abderrahimghazali/shadcn-fintech/blob/main/src/components/command-palette.tsx) and [dashboard layout](https://github.com/abderrahimghazali/shadcn-fintech/blob/main/src/app/%28dashboard%29/layout.tsx).
- Local navigation: `v3/src/App.tsx`; the palette is not currently an implemented ChargesTBA pattern.

## Design principles

- Add a palette only when it reduces navigation effort; a small route set may be clearer with ordinary navigation alone.
- Make the keyboard shortcut discoverable in the interface and avoid conflicts with browser or assistive-technology shortcuts.
- Group results by task or entity, keep names understandable out of context, and show useful secondary information only when it helps distinguish matches.
- Close the palette after choosing an item and preserve a predictable return-to-trigger focus path.
- Do not expose actions that are not actually supported or authorized in the current state.

## Layout

The reference implementation uses a dialog with a search input and grouped command list. Source categories include pages, recent transactions, quick-transfer contacts, crypto assets, and theme choices. This breadth reflects its template domain and is not a recommended ChargesTBA grouping.

## Interactions and states

**Observed — source:** The component listens for ⌘K or Ctrl+K, toggles a command dialog, has a no-results message, and routes selected entries. Selecting an item closes the dialog before executing its action. Theme commands set light, dark, or system mode.

**Observed — browser interaction and screenshot, 2026-11-15:** Ctrl+K opened the palette on the live Transactions page and Escape dismissed it. The [saved desktop capture](../screenshots/products/shadcn-fintech-command-palette-1440x1000.png) shows a centered search dialog over a blurred page; only a portion of the grouped results is visible within the dialog’s scroll area at the captured state.

**Not established:** Search ranking/fuzzy-match behavior, keyboard focus restoration, screen-reader announcements, shortcut discoverability in the rendered header, or operation under browser/OS shortcut conflicts. The source invokes shadcn `Command` primitives; source inspection alone does not verify their composed accessibility behavior.

## Responsive behavior

The source provides no viewport-specific evidence sufficient to assess dialog sizing or usability on a phone. Verify narrow layouts and mobile keyboard behavior before adopting.

## Accessibility

- Preserve dialog title/description and searchable input labeling.
- Verify focus entry, arrow-key navigation, selection, Escape dismissal, and focus restoration with the actual composed primitive.
- Ensure every command is keyboard reachable and its name/action is clear to assistive technology.
- Make the shortcut visible without requiring users to memorize it.

## Implementation notes

- The reference uses `CommandDialog`, `CommandInput`, grouped items, and route calls; its implementation and feature breadth are specific to that Next.js/shadcn application.
- For ChargesTBA, first evaluate whether the six core destinations and current workflows warrant this extra interaction surface. If adapted, use local primitives, routing, labels, and theme behavior rather than transplanting the external component.
- Do not assume a palette requires new packages; inspect the local component set first.

## Evidence

- Source inspected 2026-11-15: external `src/components/command-palette.tsx` and `src/app/(dashboard)/layout.tsx`.
- Live demo accessibility snapshots exposed the command dialog and its groups. Ctrl+K/Escape were tested; no command selection was made.
- Screenshot captured and visually inspected: [command palette open at a configured 1440×1000 desktop viewport](../screenshots/products/shadcn-fintech-command-palette-1440x1000.png).
- The official product reference records the source/demo scope, license, and broader limitations.

## Validation

- Observed: yes — source code, live page, one keyboard open/close check, and screenshot; command selection not tested.
- Evaluated: yes — potentially useful only when route/entity/action breadth warrants it.
- Adapted: no — not adapted to ChargesTBA.
- Implemented: no — no local implementation is evidenced.
- Verified: partial — Ctrl+K opened and Escape closed the dialog in one desktop browser session; focus quality, selection, accessibility, and responsive behavior were not tested.
- Approved: no — no human approval recorded.

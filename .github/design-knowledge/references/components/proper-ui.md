# Proper UI — optional registry reference

- **Sources:** https://properui.dev/ and https://github.com/properui/properui
- **Inspected:** 2026-11-15. Public product page and the repository’s installed `properui` skill were consulted. The registry was queried with `npx @properui/cli@latest info --json` from `v3/`.
- **License / reuse:** The public product page identifies the source as MIT; verify the exact registry entry and current license before reusing code.

## Findings for this repository

The project is React/Vite, TypeScript, and Tailwind CSS v4 with `components.json`, but no `@properui/ui` or Proper UI components are installed. It already has shadcn-derived UI components. Proper UI is therefore an optional reference, not a second component system to add implicitly.

## Usage guidance

If a future task explicitly considers Proper UI, inspect the candidate’s actual source/docs and compare it with local components, architecture, and tokens first. Never mix component systems within a screen without an explicit decision. MCP access is optional and its setup must not be changed as part of routine design work.

## Evidence and status

- **Observed:** Project facts from CLI output; local Proper UI skill and public page inspected.
- **Evaluated:** Not selected for current v3 UI implementation.
- **Not established:** Any registry component’s fit for a particular ChargesTBA screen.
- **Validation:** No component was installed.

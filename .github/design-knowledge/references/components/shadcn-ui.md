# shadcn/ui — component implementation reference

- **Sources:** https://github.com/shadcn-ui/ui and https://ui.shadcn.com/docs
- **Inspected:** 2026-11-15. Public repository and documentation landing content were consulted. This is not a component-by-component API review.
- **License / reuse:** The repository identifies MIT; check the current component and dependency licenses before reuse.

## Useful qualities to study

shadcn/ui provides customizable component source and composable primitives rather than requiring every project to use one fixed runtime design system. The ChargesTBA v3 implementation already contains shadcn-derived primitives in `v3/src/components/ui/`.

## Usage in this project

Prefer the local primitives and their established APIs. Do not re-install or overwrite components simply because the upstream registry changes. Review current local source before changing behavior, styles, or accessibility attributes. A registry example is a reference, not a reason to replace an existing product screen wholesale.

## Evidence and status

- **Observed:** Repository/docs description and local v3 component files.
- **Evaluated:** Existing component foundation; local implementation is the primary source for actual behavior.
- **Not established:** Full current upstream APIs, every component’s behavior, or live demo visuals.
- **Validation:** No upstream component added as part of this reference record.

# Color, typography, and icon references

## Sources

- Radix Colors: https://www.radix-ui.com/colors
- Inter: https://fonts.google.com/specimen/Inter
- Geist: https://vercel.com/font
- Lucide: https://lucide.dev/
- **Inspected:** 2026-11-15. Public documentation/product pages were consulted; no asset/font packages were installed.

## Extracted guidance

- Radix Colors organizes color scales by UI role and includes light/dark and alpha variants. Use it as a reference for semantic role mapping and contrast—not as a mandatory palette or dependency.
- Inter’s public specimen describes a family with multiple weights. ChargesTBA’s CSS currently lists Inter before local system fallbacks; that CSS declaration alone does not prove a font file is loaded.
- Geist is an optional interface/code typography reference; it is not selected for ChargesTBA.
- Lucide provides a consistent SVG icon family and tree-shakeable packages. ChargesTBA already uses `lucide-react`; keep icon language and sizing consistent rather than adding a second icon set.

## Project application

The implementation tokens are defined only in `v3/src/styles/tokens.css`. Preserve their semantic roles and current light/dark pairing. A new palette or font is a product decision requiring evaluation of contrast, availability, loading/performance, localization, and existing usage.

## Evidence and status

- **Observed:** Official documentation/product pages and current local CSS/dependencies were inspected.
- **Evaluated:** References are useful for token semantics and consistency.
- **Adapted:** Existing v3 semantic CSS variables and Lucide use predate this entry; no upstream values/assets have been copied here.
- **Verified / approved:** No new color, font, or icon-system change is approved by this note.

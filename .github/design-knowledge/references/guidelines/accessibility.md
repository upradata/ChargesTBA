# Accessibility and interface guidelines

## Sources

- WAI-ARIA Authoring Practices Guide: https://www.w3.org/WAI/ARIA/apg/
- Vercel Web Interface Guidelines: https://github.com/vercel-labs/web-interface-guidelines
- **Inspected:** 2026-11-15. Public overview pages and guidance content were consulted; this entry is a summary, not a complete conformance audit.

## Principles to apply

- Prefer semantic HTML and native controls; use ARIA only when needed to provide semantics or behavior that native HTML does not provide.
- For a custom widget, follow the applicable APG interaction pattern, including keyboard behavior, focus entry/return, accessible name, and state announcement. Do not infer this behavior from visual appearance.
- Ensure visible, unobscured focus; labels and accessible names; usable zoom; appropriate contrast; and keyboard alternatives for pointer/drag interactions.
- Cover empty, loading, error, success, and dense/long-content states. Keep feedback near the affected control and provide a recovery path.
- Respect `prefers-reduced-motion`; avoid motion that distracts or obscures state.
- For financial data, do not use color as the sole status indicator and keep dates/currency locale-aware.

## Scope and limits

The APG is authoritative pattern guidance, not proof that a given implementation is accessible. Vercel’s guidelines are a living, non-exhaustive reference and include product-specific preferences; adapt rather than copy. Verify the actual composed interface with keyboard and assistive-technology/browser tools where available.

## Status

- **Observed:** Official guidance documents inspected.
- **Evaluated:** Relevant for all interactive v3 workflows.
- **Implemented / verified:** Must be assessed per component and feature; not implied by this reference.

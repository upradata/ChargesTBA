# Design principles reference

Use these as a direction, not a rigid theme. The current product `DESIGN.md`, existing tokens, and accessible behavior take precedence.

## Premium minimal SaaS / fintech

- Make hierarchy obvious through type, alignment, spacing, and restrained contrast before adding decoration.
- Use neutral surfaces and borders as the foundation. Reserve the brand accent for meaningful actions, focus, selection, and important data.
- Keep information density appropriate to the task: financial tables can be compact, while explanations and forms need breathing room.
- Prefer crisp borders and minimal shadows; reserve stronger elevation for overlays that need it.
- Use consistent icon sizing, a single icon family, and tabular numerals for comparable financial values.
- Make loading, empty, error, disabled, success, hover, focus, and active states part of the design—not afterthoughts.
- Use motion only to communicate state or cause-and-effect. Respect `prefers-reduced-motion` and avoid distracting loops.
- Avoid generic dashboard cards, arbitrary gradients, decorative charts, excessive radii/shadows, and one-off styles that fracture the product.

## Evidence and adaptation

- A reference is inspiration, not a specification. Name the observed pattern and its underlying principle; adapt it to the product’s data, terminology, and constraints.
- Record whether evidence came from a live interface, source code, documentation, or a static image. Do not infer interactions from a screenshot.
- Verify reuse/license conditions before copying code, fonts, icons, images, or other assets. A design principle can be documented without importing its implementation.

## Accessibility defaults

- Prefer native elements and semantic HTML. Add ARIA only when native semantics are insufficient.
- Keep keyboard operation, visible focus, meaningful accessible names, contrast, zoom, and reduced-motion behavior in scope.
- Use the WAI-ARIA Authoring Practices Guide for complex patterns such as dialogs, menus, comboboxes, and tabs; verify the pattern against the actual component implementation.

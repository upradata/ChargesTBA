# ChargesTBA design knowledge

This library is project knowledge, not a screenshot scrapbook. It starts with the local-first frontend in `v3/`; it does not describe the Apps Script implementations in `v1/` or `v2/`. Read `v3/DESIGN.md` for the current product design source of truth and `v3/src/styles/tokens.css` for the implemented CSS/Tailwind tokens.

## Structure

- `references/products/` — what was inspected in a product or product repository.
- `references/components/` — component-library capabilities and reuse/licensing constraints.
- `references/design-systems/` — token, typography, icon, and color-system references.
- `references/guidelines/` — authoritative accessibility and interface guidance.
- `patterns/` — reusable product patterns extracted and adapted for ChargesTBA.
- `screenshots/` — optional visual evidence, only when actually captured and suitable to retain.
- `decisions/` — project-level decisions, rationale, date, and superseded choices.

Add a category or file only when it will be used or maintained; do not create empty folders. A reference records what an external source says or shows. A pattern records the reusable principle and behavior extracted from one or more references and adapted to this product. A project decision is not implied by an external reference.

## Evidence and statuses

For every entry, name its evidence type: live interface, source code, official documentation, local implementation, automated test, or screenshot. Record source URLs, inspection date, license/usage status where relevant, and what was not inspected. A README or screenshot is not proof of runtime behavior; source inspection is not visual QA.

Track pattern statuses independently:

- **Observed** — the referenced behavior or source was actually inspected; state which kind.
- **Evaluated** — relevance and trade-offs for this product were assessed.
- **Adapted** — the extracted principle was intentionally tailored to the product.
- **Implemented** — the pattern exists in the application source.
- **Verified** — the relevant behavior and/or visual presentation was actually tested; state exactly how.
- **Approved** — a human explicitly accepted it as part of the product’s design language.

A status is not a forecast. Do not mark a visual pattern verified based only on code, tests, or a screenshot; do not mark it approved without explicit human approval. Keep evidence for each status separate and date it.

## Pattern record template

Use this structure for each reusable pattern. Remove sections only when they genuinely do not apply.

```markdown
# Pattern name

## Purpose

## References

## Design principles

## Layout

## Interactions and states

## Responsive behavior

## Accessibility

## Implementation notes

## Evidence

## Validation

- Observed:
- Evaluated:
- Adapted:
- Implemented:
- Verified:
- Approved:
```

For app-implemented patterns, include the source paths and relevant tests. Separate source-based facts from visual observations. Keep exact business rules in code/tests; the knowledge entry summarizes UX implications, not a second accounting specification.

## Acquisition workflow

1. Understand the feature and consult relevant existing patterns before external research.
2. Research only when current knowledge is insufficient. Prefer the actual product, original repository, or authoritative documentation. Check source identity and reuse constraints.
3. Extract a principle, interaction behavior, and implementation implications; do not copy a product screen wholesale.
4. For useful findings, propose capturing them here; add them when the task authorizes building/maintaining this library. Reuse an existing entry instead of making a duplicate.
5. During QA, update only statuses supported by actual evidence. Keep human approval explicit.

## Current project facts

- Product scope and open decisions: `../../v3/PROJECT-PLAN.md`.
- Current user-facing behavior and limitations: `../../v3/README.md`.
- Design source of truth: `../../v3/DESIGN.md`.
- Implemented tokens: `../../v3/src/styles/tokens.css`.
- The current web UI uses React, TypeScript, Tailwind CSS v4, shadcn/ui primitives, React Router, TanStack Query, and Recharts. The app is local-first and French-first; do not describe it as a hosted production fintech service.
- The `.mcp.json` files and connected registries are optional tooling, not prerequisites. Do not alter global VS Code/Copilot configuration as part of knowledge capture.

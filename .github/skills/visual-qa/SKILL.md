---
name: visual-qa
description: Inspects, fixes, and verifies visual and interaction quality in web interfaces. Use after implementing a UI feature or when reviewing responsive layouts, accessibility, visual consistency, or interaction states; report only checks actually performed.
---

# Visual QA

## 1. Establish scope and expected behavior

- Identify the route, user task, important states, and acceptance criteria. Read the project `DESIGN.md`, relevant pattern entries, and nearby implementation before assessing quality.
- Confirm which reference patterns are implemented, merely proposed, or still unverified. A roadmap item is not evidence that a workflow exists.

## 2. Inspect with available tools

- Start the app using its documented command and inspect the actual page with a browser, screenshot, or visual QA tool when available.
- Do not claim a visual inspection if you only read code, documentation, or a static screenshot. Clearly label those as source-based or documentation-based observations.
- Check the viewports relevant to the feature. For broad page changes, include mobile, tablet, laptop, and wide desktop when feasible; for a small control change, focus on the affected sizes.
- Exercise the real workflow: pointer and keyboard navigation, links, forms, filters, menus, dialogs, tables, loading, error, empty, success, hover, focus, and disabled states as applicable.

## 3. Assess and prioritize

Check visual hierarchy, alignment, spacing, typography, contrast, token usage, data formatting, responsive wrapping/overflow, component consistency, accessible names, focus visibility, keyboard behavior, and reduced motion. Do not mistake personal taste for a defect; compare against the project’s design direction and user goal.

Prioritize findings:

- **Critical:** broken task, data loss risk, inaccessible primary action, or major layout failure.
- **High:** a substantial workflow or comprehension defect.
- **Medium:** inconsistent hierarchy, spacing, responsive behavior, or state treatment.
- **Low:** small polish issue with limited user impact.

## 4. Fix and recheck when requested

- Find the root cause and fix it at the right level (shared component, token, layout, or feature), not with a one-off override that creates drift.
- Preserve the design system and existing behavior. Recheck the affected path and nearby states after changes; run relevant tests/build checks.
- If browser or viewport inspection is unavailable, provide evidence-based findings from source/tests and state the limitation rather than presenting them as visually verified.

## 5. Update knowledge only from evidence

- A pattern may be marked **observed** only with a recorded source and inspection type; **evaluated** only after its relevance and trade-offs are assessed; **adapted** only when incorporated; **implemented** only when present in code; **verified** only after the actual relevant visual/functional check; and **approved** only after explicit human acceptance.
- Never advance a status because a screenshot exists or because the agent expects a test to pass. Record the evidence, date, route/viewports, states checked, and any limitations.
- When the review yields a reusable finding, propose adding or updating the matching pattern rather than creating duplicate notes.

## QA report

Summarize severity, findings and fixes, route/states/viewports actually inspected, tools/checks used, knowledge entries updated, and remaining limitations. Separate verified observations from assumptions.

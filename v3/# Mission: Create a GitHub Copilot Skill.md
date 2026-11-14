# Mission: Create a GitHub Copilot Skills Toolkit for Frontend Product Development

You are a Senior Product Designer, Staff Frontend Engineer, and AI Developer Tools specialist.

Your task is to generate **three complementary, production-quality GitHub Copilot Agent Skills** for VS Code. These skills must work together as a reusable toolkit for designing, implementing, and validating modern SaaS and Fintech applications.

Do not merely explain how to create them. Generate the complete files, with their contents, and package them into a ZIP archive ready to install in a repository.

---

# 1. Context and objectives

I am a Senior Software Engineer with 10+ years of experience in full-stack development, distributed systems, backend architecture, and modern frontend engineering.

I use VS Code with GitHub Copilot agents to develop production applications.

I want to equip Copilot with reusable expertise in three areas:

1. Product design and UI/UX direction.
2. Frontend engineering and implementation.
3. Visual quality assurance and refinement.

The goal is not to generate generic AI-looking interfaces or copy existing products. The goal is to create **original, polished, coherent, premium-quality SaaS interfaces**, using proven design patterns and established products as sources of inspiration.

The skills should be useful across different projects and repositories. They must inspect the current project rather than blindly assuming a particular stack.

# 2. Decisions already made

## 2.1 Skills rather than a custom agent

We decided to use **GitHub Copilot Agent Skills**, not a dedicated custom agent.

Reasons:

- Skills are modular and reusable.
- They can be invoked explicitly when needed.
- Copilot can discover and activate relevant skills based on their descriptions.
- They can be installed per repository or globally.
- They allow different areas of expertise to remain independent.

Use the standard repository structure:

`skills/<skill-name>/SKILL.md` and optional supporting files under `skills/<skill-name>/references/`.

Each skill must have a valid YAML frontmatter with at least:

- `name`
- `description`

Follow the current official GitHub Copilot Agent Skills format and conventions.

## 2.2 Preferred visual direction

The design philosophy is:

**Premium Minimal SaaS / Modern AI Product / Fintech-grade UI**

The visual language should emphasize:

- Minimalism without looking empty or unfinished.
- Precise spacing and consistent alignment.
- Thin, subtle borders.
- Restrained rounded corners.
- Very subtle shadows.
- Excellent typography and hierarchy.
- Neutral backgrounds and carefully controlled accent colors.
- High information density when appropriate.
- Clear and predictable interactions.
- Refined hover, focus, active, loading, and transition states.
- Strong visual consistency across the entire application.

The interfaces should feel intentional, sophisticated, modern, and production-ready.

Avoid:

- Generic AI-generated dashboard aesthetics.
- Excessive gradients.
- Excessive glassmorphism.
- Unnecessary decorative elements.
- Overuse of colorful cards.
- Excessive border radii.
- Excessive shadows.
- Inconsistent spacing.
- Random component styling.
- Unnecessary animations.
- UI that looks like a collection of unrelated shadcn components.

## 2.3 Reference products and design inspiration

Use existing products as references for their design qualities, not as templates to copy.

Important references:

| Product | Qualities to study                                              |
| ------- | --------------------------------------------------------------- |
| ChatGPT | Minimalism, typography, whitespace, conversation UX             |
| Grok    | Contrast, visual personality, dark mode                         |
| Linear  | Precision, navigation, information density, interaction quality |
| Stripe  | Sophisticated dashboards, financial data, forms, charts         |
| Ramp    | Fintech interfaces, transaction tables, financial workflows     |
| Revolut | Financial product UX, account management, visual hierarchy      |

Other relevant products can be explored when useful.

The skills should instruct Copilot to:

- Inspect available reference material when browsing, MCP tools, or other research tools are available.
- Prefer actual products and real interfaces over generic inspiration galleries.
- Extract specific patterns and explain why they work.
- Combine patterns from multiple references into an original design direction.
- Never claim to have inspected a website or resource if it has not actually been accessed.
- Never reproduce an existing product's interface wholesale.

## 2.4 Existing frontend stack (when relevant)

One of my projects uses this stack:

- React
- TypeScript
- Vite
- React Router v8
- Tailwind CSS v4
- shadcn/ui
- TanStack Query
- Zustand
- Vercel AI SDK
- Recharts
- Motion
- TanStack Table

However, this is only an example of an existing project stack.

**Do not assume this stack is used in every repository.**

Always inspect:

- `package.json`
- Existing source structure
- Build configuration
- Styling configuration
- Component libraries
- Existing design tokens
- Routing and state management
- Testing tools
- Existing project instructions and conventions

Reuse the existing architecture and libraries whenever possible. Do not introduce dependencies without a concrete reason.

---

# 3. Skill 1 — product-design

Directory:

`.github/skills/product-design/`

File:

`SKILL.md`

Optional supporting reference files can be added under:

`.github/skills/product-design/references/`

## Purpose

This skill transforms GitHub Copilot into a senior product designer and UI/UX specialist for modern SaaS, AI products, and Fintech applications.

It should be activated when:

- Creating a new page.
- Redesigning an existing page.
- Designing a dashboard.
- Building onboarding flows.
- Creating settings, forms, tables, navigation, or complex interactions.
- Establishing or improving a design system.
- Improving the visual quality or UX of an existing application.

## Required workflow

### Step 1 — Understand the product

Before designing:

- Understand the application's purpose.
- Identify its users and primary workflows.
- Understand the business domain.
- Identify the main actions and information hierarchy.
- Inspect existing pages and UI patterns.

Do not design without understanding the context.

### Step 2 — Inspect the existing design system

Inspect:

- Existing components.
- Theme and color tokens.
- Typography.
- Spacing conventions.
- Border radii.
- Shadows.
- Icons.
- Layout patterns.
- Responsive behavior.

Extend the existing design system rather than creating a competing one.

### Step 3 — Research inspiration

When research tools are available:

- Explore 3–5 relevant references from at least two products.
- Look for specific UI patterns relevant to the requested feature.
- Identify what makes those patterns effective.
- Extract principles rather than copying layouts.
- Explain the design decisions briefly.

If external research is unavailable, rely on established design principles and clearly state that no external references were inspected.

### Step 4 — Define the design direction

Before implementation, establish:

- Visual hierarchy.
- Layout structure.
- Component organization.
- Typography.
- Spacing.
- Color usage.
- Interaction behavior.
- Responsive behavior.

The result should be a coherent design, not a collection of individually styled components.

### Step 5 — Implement or guide implementation

When asked to implement:

- Reuse existing components.
- Follow the project's conventions.
- Avoid unnecessary dependencies.
- Preserve accessibility.
- Implement all relevant states.
- Ensure responsive behavior.

### Step 6 — Evaluate the result

Review the interface critically:

- Does it look professional?
- Is the hierarchy obvious?
- Is the layout balanced?
- Are spacing and alignment consistent?
- Does it feel like one coherent product?
- Are there unnecessary visual elements?
- Does it work at different screen sizes?

## Design principles

Use these as initial guidelines, not rigid rules:

- Inputs and buttons: approximately 8–10px radius.
- Menus and popovers: approximately 10–12px radius.
- Cards: approximately 12–16px radius.
- Dialogs: approximately 16–20px radius.
- Borders: thin and low-contrast.
- Shadows: subtle; primarily for overlays and elevation.
- Typography: strong hierarchy, restrained font weights.
- Financial values: tabular numerals where appropriate.
- Color: neutral foundations with purposeful accent colors.
- Spacing: consistent scale, deliberate whitespace.
- Animation: subtle, functional, and never distracting.

Prefer the project's existing tokens and conventions over these default values.

---

# 4. Skill 2 — frontend-engineering

Directory:

`.github/skills/frontend-engineering/`

File:

`SKILL.md`

## Purpose

This skill transforms GitHub Copilot into a Staff-level frontend engineer focused on robust, maintainable, scalable production implementations.

It should be activated when:

- Implementing frontend features.
- Refactoring frontend architecture.
- Creating reusable components.
- Improving TypeScript code.
- Implementing complex forms.
- Managing frontend state.
- Integrating APIs.
- Improving performance.
- Writing frontend tests.

## Required workflow

### Step 1 — Inspect the repository

Before coding, inspect:

- Project structure.
- Framework and version.
- Dependencies.
- TypeScript configuration.
- Build tooling.
- Existing architectural patterns.
- Component conventions.
- Tests and scripts.
- Repository-specific instructions.

Never assume the framework or stack.

### Step 2 — Architecture and component design

Prioritize:

- Clear separation of concerns.
- Reusable components with meaningful abstractions.
- Composition over unnecessary inheritance or complexity.
- Explicit component responsibilities.
- Consistent naming.
- Maintainable folder structure.
- Avoiding premature abstraction.

Do not create abstractions merely to reduce the number of lines of code.

### Step 3 — TypeScript quality

Use TypeScript rigorously:

- Avoid `any`.
- Prefer precise types.
- Use discriminated unions where appropriate.
- Model domain concepts explicitly.
- Avoid unnecessary type assertions.
- Keep public component APIs simple and predictable.
- Handle nullable and optional values explicitly.

### Step 4 — State and data management

Respect the existing architecture.

When applicable:

- Separate server state from client state.
- Use the existing data-fetching solution.
- Avoid duplicating state.
- Handle loading, error, empty, and success states.
- Prevent unnecessary requests and rerenders.
- Use optimistic updates only when justified.
- Keep API boundaries explicit.

Do not introduce TanStack Query, Zustand, or another state library if the project does not already need it.

### Step 5 — Forms and validation

Prioritize:

- Clear validation rules.
- Useful error messages.
- Accessible labels.
- Predictable submission behavior.
- Loading and disabled states.
- Prevention of duplicate submissions.
- Consistent field components.

### Step 6 — Accessibility

Follow semantic HTML and accessibility best practices:

- Keyboard navigation.
- Focus management.
- Accessible names.
- Appropriate ARIA attributes.
- Contrast.
- Screen reader support.
- Reduced motion preferences.

### Step 7 — Performance

Avoid unnecessary complexity and optimize based on evidence.

Consider:

- Bundle size.
- Lazy loading.
- Rendering behavior.
- Memoization only when useful.
- Large lists and tables.
- Expensive computations.
- Network waterfalls.
- Image optimization.

Do not prematurely optimize.

### Step 8 — Testing and delivery

Use the project's existing test infrastructure.

Add or update tests for meaningful behavior.

Run relevant checks:

- Type checking.
- Linting.
- Unit tests.
- Build.

Report:

- What was implemented.
- Important architectural decisions.
- Files changed.
- Tests and checks executed.
- Known limitations.

Never claim a test or build passed if it was not actually executed.

---

# 5. Skill 3 — visual-qa

Directory:

`.github/skills/visual-qa/`

File:

`SKILL.md`

## Purpose

This skill transforms GitHub Copilot into a senior visual QA engineer and frontend refinement specialist.

It should be activated after implementing a feature or when reviewing an existing interface.

The objective is to identify and fix visual and interaction problems, not merely describe them.

## Required workflow

### Step 1 — Identify the scope

Understand:

- Which page or feature is being reviewed.
- Its intended behavior.
- Its design references.
- Its existing design system.
- The expected user workflows.

### Step 2 — Run the application

Use the project's existing workflow.

Inspect the available scripts and start the application when possible.

Use browser automation, screenshots, or other visual inspection tools if available.

Do not claim to have visually inspected an interface if no visual inspection actually took place.

### Step 3 — Review responsive layouts

Inspect at least:

- Wide desktop.
- Standard laptop.
- Tablet.
- Mobile.

Look for:

- Overflow.
- Broken layouts.
- Inconsistent spacing.
- Misaligned elements.
- Typography problems.
- Poor information density.
- Incorrect wrapping.
- Inconsistent component sizing.

### Step 4 — Review interaction quality

Test:

- Navigation.
- Buttons.
- Links.
- Forms.
- Dropdowns.
- Dialogs.
- Tabs.
- Tables.
- Filters.
- Search.
- Loading states.
- Empty states.
- Error states.
- Hover and focus states.
- Keyboard interactions.

### Step 5 — Evaluate visual quality

Assess:

- Typography and hierarchy.
- Spacing and rhythm.
- Alignment.
- Contrast.
- Borders and radii.
- Shadows and elevation.
- Color consistency.
- Icon consistency.
- Component consistency.
- Responsive behavior.

Use the premium minimal SaaS design direction defined in the product-design skill.

### Step 6 — Prioritize issues

Classify issues:

- Critical: broken functionality, inaccessible controls, major layout failures.
- High: significant visual defects or broken user workflows.
- Medium: inconsistent spacing, hierarchy, or component behavior.
- Low: minor polish and cosmetic refinements.

Prioritize the issues that have the greatest impact on usability and product quality.

### Step 7 — Fix and recheck

When asked to perform QA:

- Identify the root cause.
- Fix issues directly when appropriate.
- Avoid superficial CSS patches.
- Preserve the existing design system.
- Re-run relevant checks.
- Reinspect the affected interface after modifications.

Do not stop at a list of recommendations if implementation was requested.

### Step 8 — Deliver a QA report

Summarize:

- Issues identified.
- Fixes applied.
- Remaining issues.
- Viewports inspected.
- Interactions tested.
- Tools used.
- Checks actually executed.

Clearly distinguish verified findings from assumptions.

---

# 6. How the three skills should work together

The three skills are independent but complementary.

Their intended workflow is:

1. `product-design`: Understand the product, define the UX and visual direction, and design the interface.
2. `frontend-engineering`: Implement the design using sound architecture and production-quality code.
3. `visual-qa`: Inspect the implementation, identify problems, refine it, and verify the result.

They should be independently invocable but should also be able to reference one another when appropriate.

Avoid duplicating large amounts of content across skills. Keep each skill focused on its own responsibilities.

---

# 7. Technical requirements

Generate the following structure:

```text
.github/
└── skills/
    ├── product-design/
    │   ├── SKILL.md
    │   └── references/
    │       └── design-principles.md
    ├── frontend-engineering/
    │   └── SKILL.md
    └── visual-qa/
        └── SKILL.md
```

Also include a root `README.md` explaining:

- What the toolkit does.
- What each skill is responsible for.
- When to invoke each skill.
- How to install the skills in a project.
- How to install them globally if supported by the current GitHub Copilot environment.
- How to invoke them explicitly in VS Code.
- How automatic skill discovery works.
- How to customize them for a particular repository.

Example installation:

```bash
mkdir -p .github/skills
unzip copilot-frontend-skills.zip
```

The ZIP should contain the `.github/skills/` directory and the README.

Verify the current recommended GitHub Copilot skill format and VS Code compatibility before finalizing. Do not invent configuration options or unsupported features.

# 8. Quality requirements

The generated skills must be:

- Detailed enough to guide an advanced coding agent.
- Concise enough to avoid unnecessary context consumption.
- Action-oriented rather than theoretical.
- Compatible with different frontend stacks.
- Reusable across multiple repositories.
- Explicit about tool limitations.
- Focused on real implementation and measurable quality.
- Written in clear, professional English.

Do not produce generic instructions such as "write clean code" without explaining what that means operationally.

Do not force a design process for trivial changes. Skills should adapt their workflow to the scope of the task.

Do not make every implementation request require external research or a lengthy design brief.

Avoid adding arbitrary tools, dependencies, or configuration files.

# 9. Expected deliverables

Produce:

1. The complete `product-design` skill.
2. The complete `frontend-engineering` skill.
3. The complete `visual-qa` skill.
4. Supporting design principles reference file.
5. A comprehensive README.

Before packaging:

- Check the YAML frontmatter.
- Check the directory structure.
- Check that the skills do not contradict one another.
- Check that the instructions are practical and actionable.

Finally, provide:

- The directory tree.
- A short explanation of each skill.
- Example VS Code Copilot prompts for invoking each skill.

# 10. Open-source Product Design Knowledge Base

An important objective is to equip the `product-design` skill with a structured, reusable knowledge base of real-world product design references, component libraries, design systems, and UI engineering guidelines.

The agent should not rely exclusively on its general training knowledge or generate interfaces from generic design patterns.

It should be able to explore existing products, inspect their implementations when possible, extract useful design patterns, and progressively build a library of validated references.

The knowledge base should distinguish between five categories.

## 10.1 Product references

Study real SaaS and Fintech products to understand how production interfaces are designed.

Initial reference projects:

| Project                 | What to study                                                        |
| ----------------------- | -------------------------------------------------------------------- |
| Plane                   | Project management, navigation, filters, data views, complex layouts |
| Twenty CRM              | CRM interfaces, tables, relationships, records, navigation           |
| Dub                     | Minimal SaaS design, analytics, dashboards, forms                    |
| Cal.com                 | Scheduling UX, calendars, configuration, onboarding                  |
| Lago                    | Billing, subscriptions, invoices, financial workflows                |
| shadcn-fintech          | Banking dashboards, transactions, cards, financial data              |
| React Fintech Dashboard | Financial metrics, charts, portfolio and risk interfaces             |
| FinTrack                | Personal finance, multi-currency, analytics                          |

Repositories and references:

- https://github.com/makeplane/plane
- https://github.com/twentyhq/twenty
- https://github.com/dubinc/dub
- https://github.com/calcom/cal.com
- https://github.com/getlago/lago
- https://github.com/abderrahimghazali/shadcn-fintech
- https://github.com/Viprasol/react-fintech-dashboard
- https://github.com/AshishKapoor/fintrack

These projects are references for product design and UX, not necessarily architectural templates to reproduce.

The agent should distinguish between inspecting a live interface, inspecting source code, and reading documentation.

## 10.2 Component references

Use established component libraries as sources of implementation patterns and visual inspiration.

| Resource   | Main purpose                                               |
| ---------- | ---------------------------------------------------------- |
| Proper UI  | AI-ready React components and implementation patterns      |
| shadcn/ui  | Accessible, composable application components              |
| React Bits | Visual details, animations, typography and interactions    |
| Magic UI   | Subtle animations, backgrounds and visual effects          |
| HyperUI    | Tailwind layouts, forms, navigation and marketing sections |

Resources:

- https://properui.dev/
- https://github.com/shadcn-ui/ui
- https://reactbits.dev/
- https://github.com/DavidHDev/react-bits
- https://magicui.design/
- https://github.com/magicuidesign/magicui
- https://hyperui.dev/
- https://github.com/markmead/hyperui

The agent must not blindly import components. It should understand the design pattern, evaluate its relevance, and adapt it to the current product's design system.

## 10.3 Design systems and foundations

Use established design systems and design foundations to improve visual consistency.

Initial references:

| Resource     | Purpose                                            |
| ------------ | -------------------------------------------------- |
| Open Props   | Design tokens and CSS primitives                   |
| Radix Colors | Accessible color scales and semantic color systems |
| Geist        | Typography and visual language                     |
| Inter        | Neutral and highly readable typography             |
| Lucide       | Consistent iconography                             |
| Radix UI     | Accessible interaction primitives                  |

Resources:

- https://open-props.style/
- https://www.radix-ui.com/colors
- https://vercel.com/font
- https://fonts.google.com/specimen/Inter
- https://lucide.dev/
- https://www.radix-ui.com/primitives

These are references, not mandatory dependencies. The agent must first inspect the existing project's design system and reuse it whenever appropriate.

## 10.4 Design intelligence and implementation guidelines

Explore agent-accessible resources that make design research and implementation more efficient.

### Frontend Inspo MCP

https://github.com/notsointresting/frontend-inspo-mcp

Investigate whether this MCP server is compatible with the current Copilot environment and whether its available sources are useful.

Potential uses:

- Search across multiple UI libraries.
- Discover React, TypeScript, Tailwind and HTML components.
- Explore themes, tokens and animations.
- Retrieve implementation examples.
- Discover relevant design and accessibility guidelines.

Do not assume all aggregated sources have the same license or quality.

### Vercel Web Interface Guidelines

https://github.com/vercel-labs/web-interface-guidelines

Use these guidelines as a reference for interface quality, accessibility, interaction behavior, responsive design and implementation details.

### WAI-ARIA

https://www.w3.org/WAI/ARIA/apg/

Use the official WAI-ARIA Authoring Practices Guide for accessible interaction patterns, keyboard behavior, and component semantics.

The agent should prefer authoritative documentation and machine-readable resources where available.

## 10.5 Project-specific design system

Every substantial project should progressively develop its own design system.

The agent should be able to create and maintain a project-level design knowledge base.

Suggested structure:

```text
project/
├── DESIGN.md
├── src/
│   └── styles/
│       └── tokens.css
├── .github/
│   └── design-knowledge/
│       ├── README.md
│       ├── product-references/
│       ├── patterns/
│       ├── screenshots/
│       └── decisions/
└── ...
```

Adapt this structure to the existing repository. Do not create unnecessary files or folders.

### DESIGN.md

This file should describe the project's design language:

- Product positioning and intended users.
- Design philosophy.
- Visual direction.
- Typography.
- Color palette.
- Spacing scale.
- Border radii.
- Borders and shadows.
- Component conventions.
- Layout principles.
- Responsive behavior.
- Accessibility requirements.
- Interaction and animation principles.
- Approved design references.
- Explicit anti-patterns.

### tokens.css

Maintain the actual design tokens in the project's existing styling architecture.

Avoid duplicating token definitions across unrelated files.

### Patterns library

The agent should progressively build a reusable collection of validated UI patterns.

For every pattern, preserve:

1. **Name** — a clear, reusable pattern name.
2. **Category** — navigation, dashboard, table, chart, form, modal, onboarding, etc.
3. **Screenshot** — a screenshot or visual reference when available and legally usable.
4. **Source** — original product, repository or documentation URL.
5. **Description** — what the pattern does and where it is useful.
6. **Design principles** — the underlying principles extracted from the reference.
7. **Interaction behavior** — relevant states and transitions.
8. **Implementation notes** — useful technical details.
9. **Validation status** — observed, adapted, implemented, tested or approved.
10. **License and usage constraints** — where relevant.

A pattern should be considered validated only after it has been inspected and evaluated. A screenshot alone is not proof that its behavior or implementation is understood.

---

# 11. Progressive design knowledge acquisition

This is a key requirement.

The agent should not start every new feature from scratch.

It should progressively build and reuse its own library of validated design patterns.

## 11.1 Research before implementation

When designing a substantial new feature:

1. Understand the feature and its UX requirements.
2. Search the existing project-specific pattern library.
3. Identify relevant validated patterns.
4. Search external references only when necessary.
5. Compare multiple approaches.
6. Extract the principles that apply.
7. Adapt them to the current product.

Do not repeat research unnecessarily when a relevant, validated pattern already exists.

## 11.2 Capture and document useful findings

When a new reference provides meaningful value:

- Capture a screenshot if the available tools support it.
- Record the source URL.
- Describe the observed pattern.
- Extract the design principles.
- Document relevant interaction behavior.
- Record implementation considerations.
- Add it to the appropriate knowledge-base category.

Never fabricate screenshots, observations, source URLs or validation results.

If screenshot capture is unavailable, preserve the source URL and a sufficiently detailed textual description.

## 11.3 Reuse and evolution

Before proposing a new UI pattern, check whether an existing validated pattern can be reused.

The agent should:

- Reuse established patterns when appropriate.
- Adapt them to the current product.
- Avoid unnecessary visual inconsistencies.
- Update documentation when design decisions change.
- Avoid accumulating redundant or contradictory patterns.

The library should evolve with the product rather than become an unstructured collection of screenshots.

## 11.4 Human validation

The agent may propose new patterns and document its findings, but should distinguish between:

- Observed: discovered in an external reference.
- Evaluated: assessed for relevance and quality.
- Adapted: incorporated into a project design.
- Implemented: actually implemented in the application.
- Verified: visually and functionally tested.
- Approved: explicitly accepted as part of the project's design language.

Do not automatically treat every discovered pattern as an approved design decision.

---

# 12. MCP and external resource integration

The agent should investigate whether MCP integration can improve its ability to research and retrieve UI references.

In particular, evaluate:

- Frontend Inspo MCP.
- Available component registries.
- shadcn-compatible registries.
- Documentation sources.
- Browser automation and screenshot tools, when available.

However:

- Do not assume an MCP server is installed.
- Do not invent tool names or capabilities.
- Do not modify global VS Code or Copilot configuration without explicit authorization.
- Do not make the skills depend on an MCP server.
- Provide useful fallback behavior when external research tools are unavailable.

The skills must remain useful even without network access or MCP integration.

---

# 13. Integration with the three skills

The knowledge base must be shared conceptually across the three skills.

### product-design

Responsible for:

- Researching product references.
- Extracting design principles.
- Defining UX patterns.
- Creating and maintaining DESIGN.md.
- Recording useful patterns.
- Establishing the visual direction.

### frontend-engineering

Responsible for:

- Implementing the approved design system.
- Reusing existing components and tokens.
- Maintaining implementation consistency.
- Documenting reusable technical patterns when appropriate.
- Avoiding unnecessary dependencies and duplicated abstractions.

### visual-qa

Responsible for:

- Comparing implementations against the design direction.
- Checking consistency with validated patterns.
- Identifying visual and interaction regressions.
- Verifying responsive behavior.
- Updating validation status when a pattern is actually tested.

Keep the skills independent. They should reference the same project-level documentation rather than duplicating it.

---

# 14. Final objective

The final result should be more than three generic Copilot skills.

It should be a reusable **AI-assisted Product Design and Frontend Engineering Toolkit**.

The long-term workflow should look like this:

```text
External product references
          |
          v
   Design research
          |
          v
  Validated UI patterns
          |
          v
 Project-specific knowledge
          |
          v
      DESIGN.md
          |
          v
    Implementation
          |
          v
     Visual QA
          |
          v
   Refined patterns
          |
          +------> Knowledge base evolves
```

The objective is to make each subsequent feature faster, more consistent, and visually better than the previous one.

The agent should accumulate useful knowledge instead of repeatedly rediscovering the same design principles.

organisation :
.github/skills/
Compétences

Les instructions comportementales des agents

- product-design/SKILL.md
- frontend-engineering/SKILL.md
- visual-qa/SKILL.md

    .github/design-knowledge/
    Connaissances

    Les références et patterns accumulés dans le projet

- product-references/
- patterns/
- screenshots/
- decisions/
- README.md

    DESIGN.md + tokens.css
    Design system

    La source de vérité graphique et UX du produit

    On pourrait avoir cette structure poyr la bibliothèque de connaissances de design, mais il faut l'adapter à chaque projet. Ne pas créer de fichiers ou dossiers inutiles.

── design-knowledge/
├── README.md
│
├── references/
│ ├── products/
│ │ ├── plane.md
│ │ ├── twenty.md
│ │ ├── linear.md
│ │ └── ramp.md
│ │
│ ├── components/
│ │ ├── shadcn-ui.md
│ │ ├── proper-ui.md
│ │ └── react-bits.md
│ │
│ └── design-systems/
│ ├── radix-colors.md
│ ├── geist.md
│ └── typography.md
│
├── patterns/
│ ├── application-shell.md
│ ├── data-tables.md
│ ├── financial-dashboard.md
│ ├── forms.md
│ ├── navigation.md
│ └── empty-states.md
│
├── screenshots/
│ ├── products/
│ └── patterns/
│
└── decisions/
├── design-principles.md
└── rejected-patterns.md

La distinction importante :

- references/ : ce que tu observes dans les produits et bibliothèques externes.
- patterns/ : ce que tu en extrais sous forme de patterns réutilisables.
- screenshots/ : les preuves visuelles et exemples concrets.
- decisions/ : les conventions et choix validés pour tes projets.

Chaque pattern devrait suivre le même format. C'est ce qui permettra à l'agent de retrouver et de réutiliser facilement les connaissances.

Par exemple, patterns/data-tables.md :

# Data Tables

## Purpose

Display and manage structured business data.

## References

- Linear: [source URL]
- Ramp: [source URL]
- Twenty: [source URL]

## Design principles

- Clear column hierarchy
- Compact but readable density
- Tabular numerals for financial values
- Subtle row separators
- Persistent column headers where useful

## Layout

- Toolbar
- Search and filters
- Table header
- Data rows
- Pagination

## Interactions

- Sorting
- Filtering
- Row selection
- Bulk actions
- Column visibility

## Responsive behavior

- Horizontal scrolling or alternative mobile presentation

## Accessibility

- Semantic table markup
- Keyboard navigation
- Accessible sort states

## Implementation notes

- Existing project components
- Recommended component composition
- State management

## Evidence

- Screenshot paths
- Source URLs
- Observations

## Validation

- Observed: yes
- Evaluated: yes
- Implemented: no
- Verified: no
- Approved: no

Comment les agents utilisent la bibliothèque
C'est le point le plus important : la bibliothèque ne doit pas être alimentée uniquement manuellement.

Je recommande ce workflow :

1. Recherche externe

Linear, Ramp, Plane, Proper UI, etc.

2. Analyse et extraction

Patterns, captures, principes et interactions

3. Bibliothèque de connaissances

Références et patterns documentés

4. Product Design Skill

Consultation et adaptation au besoin produit

5. Frontend Engineering

Implémentation conforme au design validé

6. Visual QA

Vérification, corrections et enrichissement des connaissances

Le cycle recommence à chaque nouvelle fonctionnalité.

Il faut ajouter une règle dans product-design/SKILL.md : avant toute conception, consulter la bibliothèque existante ; après une recherche ou une analyse pertinente, proposer de capitaliser les nouvelles connaissances.

Même principe pour visual-qa : ne jamais modifier le statut d'un pattern sans vérification réelle.

**Important: Generate the actual files. Do not respond with only the Markdown contents or instructions.**

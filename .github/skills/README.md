# Product Design & Frontend Skills

Three repository-level GitHub Copilot Agent Skills for product design, frontend implementation, and visual QA. They are stack-aware and consult the project’s own `DESIGN.md` and `.github/design-knowledge/` rather than imposing a universal framework or design system.

## Skills

| Skill                  | Use it for                                                                                                                                                        | Example                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `product-design`       | New or redesigned pages, workflows, dashboards, forms, tables, navigation, and design-system decisions. It checks project knowledge before proposing a direction. | `/product-design Review the charge-entry flow and propose a clearer schedule editor.`                    |
| `frontend-engineering` | Implementing/refactoring frontend components, forms, API state, accessibility, performance, and tests.                                                            | `/frontend-engineering Implement the approved charge-entry changes using this repository’s conventions.` |
| `visual-qa`            | Reviewing or refining a completed interface, responsive layouts, accessibility, and interaction states.                                                           | `/visual-qa Inspect the CSV import flow on mobile and desktop; fix verified issues.`                     |

Skills can be invoked independently or in sequence: design → implementation → QA. For small changes, invoke only the skill that fits.

## Install in a repository

These skills are already located in `.github/skills/` in this repository. To copy them into another project, copy the required skill directories (including each complete directory, not only `SKILL.md`) into that project’s `.github/skills/`. Copy `.github/design-knowledge/` and the project-specific `DESIGN.md` only when adapting their contents is appropriate; do not copy ChargesTBA’s product decisions into another product.

## Install for personal use in VS Code

VS Code documents personal Copilot skills under `~/.copilot/skills/`. Copy each complete skill folder there, for example:

- `~/.copilot/skills/product-design/`
- `~/.copilot/skills/frontend-engineering/`
- `~/.copilot/skills/visual-qa/`

Keep the shared design-knowledge base in the repository; these skills expect to adapt to the current project rather than carry a personal product’s decisions everywhere.

## Invoke and discover

Type `/` in Copilot Chat and select a skill, or ask naturally, such as “Use product-design to plan this dashboard.” Copilot can also load a skill when the task matches its frontmatter description. Availability does not guarantee automatic selection for every prompt; verify in a new chat for the intended VS Code harness. The slash command and auto-discovery behavior are provided by the agent environment, not configured by these files.

## Customize for a project

1. Inspect the repository, its instructions, product flows, existing components, and CSS token source.
2. Write or update that project’s `DESIGN.md` and only the knowledge-base categories that will be maintained.
3. Keep patterns evidence-based: distinguish source/documentation inspection from live visual inspection, and retain URLs, dates, license/usage constraints, and validation status.
4. Keep MCP servers optional. Do not add global editor configuration or depend on a particular registry; provide a useful fallback when external tools are unavailable.
5. Preserve each skill’s scope and keep its directory name identical to the frontmatter `name`.

For this repository, the design system and initial project knowledge are scoped to the local-first ChargesTBA application in `v3/`. The root `README.md` continues to document the whole monorepo.

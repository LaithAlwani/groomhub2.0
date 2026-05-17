@AGENTS.md

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# Code style rules

## File size

- **Every component file must be ≤ 200 lines.** If a component is growing past
  that, split it: extract sub-components, move inline helpers to a separate
  file, or pull shared pieces into `components/forms/`, `components/ui/`,
  `components/auth/`, etc.
- This applies to React component files. Convex function files (queries,
  mutations, http) and helper modules should also stay focused but the
  hard 200-line cap is for components.

## Naming

- **Use full, descriptive identifiers.** No single-letter or two-letter
  abbreviations for variables you read more than once. Examples:
  - `event.target.value`, never `e.target.value`
  - `membership.organization.name`, never `m.organization.name`
  - `appointment.startTime`, never `a.startTime`
  - `candidate`, `slot`, `index`, `field` — pick the word that names what
    the value is.
- One exception: Convex's `(q) => q.eq(...)` callback inside `.withIndex()`.
  Use `(index) => index.eq(...)` for readability — `q` looks like a typo on
  the way past.
- Function and component names should be verbs/nouns that describe what
  they do at a glance: `verifyStandardWebhook`, `useDebouncedValue`,
  `GoogleButton`. Avoid suffixes like `Helper`, `Util`, `Manager` unless
  they really mean something.

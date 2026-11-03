---
inclusion: fileMatch
fileMatchPattern: "**/*.tsx,**/*.css,**/*.module.css"
---

# Content Tooltips

This is distinct from `calculated-totals.md`. That rule covers tooltips on **derived numbers**
(how a total was computed). This rule covers **descriptive/explanatory tooltips on named game
content** — telling the user what a thing *is* and *does*.

## Rule

Named game-content elements displayed in the UI must offer a descriptive tooltip explaining
the element, so the user doesn't have to open the rulebook. This applies to:

- **Skills** — what the skill covers and its linked (spellcasting/ability) characteristic.
- **Spells** — the effect summary (plus level, school, casting time, range, components,
  duration, concentration/ritual) from the spell catalog.
- **Feats** — what the feat grants, its category, and prerequisites.
- **Class / species / subclass features** — what the feature does.
- **Conditions** — description, effects, and how it ends.
- **Backgrounds** — what it grants.
- Any other named rules element the user would otherwise look up (weapon properties,
  item descriptions, actions, etc.).

## How to implement (mirror PWACharSheet's pattern)

PWACharSheet resolves content tooltips through a `logic/tooltip-content.ts` module that returns
a structured shape and is surfaced via the shared `Tooltip`. Mirror that here:

1. A resolver module (e.g. `src/logic/tooltip-content.ts`) exposes per-type resolvers
   (`resolveSkillTooltip`, `resolveSpellTooltip`, `resolveFeatTooltip`,
   `resolveConditionTooltip`, `resolveFeatureTooltip`, …) returning a structured
   `{ title, sections: { label, text }[] }` (or null when no content is available).
2. The resolver reads from the data catalogs in `src/data/` (the authoritative, PHB-cited
   content), not from hard-coded strings in components.
3. Components render the content through the shared `Tooltip` component, consistent with how
   the equivalent PWACharSheet component does it (see `ui-parity.md`).
4. Hover on desktop, tap/long-press on touch (same activation as `calculated-totals.md`).

## Content & licensing

- Tooltip text comes from the data catalogs and must follow `rules-compliance.md`:
  PHB-cited, paraphrased, no long verbatim passages. Spell descriptions reuse the existing
  spell catalog's `description`/`effect` fields; licensing for spell content is managed by
  the user.
- If no description is available for an element, the resolver returns null and the UI simply
  omits the tooltip (never show a broken/empty tooltip).

## Scope / pragmatism

- Add content tooltips as each content area is built or ported; don't block a stage solely to
  retrofit tooltips onto pre-existing areas, but new/ported content should include them.
- This is a strong convention: wire the resolver + data for the content a stage introduces.

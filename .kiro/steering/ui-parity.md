---
inclusion: fileMatch
fileMatchPattern: "**/*.tsx,**/*.css,**/*.module.css"
---

# UI Parity with PWACharSheet

This app (D&D 5.5e) is a deliberate clone of the sibling WFRP app at `d:\Git\PWACharSheet`,
reskinned for D&D with D&D rules content. The goal is for the two apps to feel like the
same application. When building or porting any feature that has an equivalent in
PWACharSheet, **match the source app's look and feel.**

## Rule

When a feature being built here exists in PWACharSheet, mirror the source component's
**presentation choices** unless D&D content genuinely makes that impossible. This is a
**strong preference**, not an absolute mandate: match where it makes sense, and when you
deviate, say why in a code comment or the PR/implementer summary.

## What "match the look and feel" covers

1. **Tables vs cards vs grids.** If PWACharSheet presents a given kind of data as a table
   (e.g. a stat grid, a skills list), use a table here. If it uses cards (e.g. weapon cards,
   trapping cards), use cards. If it uses a two-line rich card or a compact chip, replicate
   that structure. Do not swap one presentation for another without a content-driven reason.

2. **Section grouping and order.** Mirror how the source groups content into sections /
   sub-tabs / collapsible panels, and the order those appear, adapting only the labels and
   the items to D&D.

3. **Density and layout patterns.** Match compact-vs-rich density, hover-reveal control
   patterns, breakdown-tooltip placement (the little "ⓘ"/underline affordance on a derived
   total), and the two-line name/stats card structure described in `ui-layout.md`.

4. **Shared primitives.** Reuse the ported shared primitives (`Card`, `SectionHeader`,
   `CollapsibleSection`, `SubTabBar`, `Tooltip`, `CalculatedValue`, `EditableField`,
   `EmptyState`, etc.) exactly as PWACharSheet uses its equivalents, rather than hand-rolling
   new layout.

## How to apply it

- When porting a feature, **read the specific PWACharSheet source component(s) first** and
  note its table/card/section/density choices; the D&D implementation should reproduce them.
- A port blueprint should include a short **"presentation parity"** note naming the source
  component(s) and the layout choices to replicate.
- Reviewers of a ported feature should check it against the named source component for
  visual parity, flagging unjustified presentation deviations.

## When to deviate (and document it)

- D&D data has a materially different shape than the WFRP equivalent (e.g. D&D AC is one
  number vs WFRP per-location armour points), so the source layout doesn't fit the data.
- The source component itself violates `ui-layout.md` / `calculated-totals.md` / the content
  tooltip rule — in that case, follow the rules here, not the source's mistake.
- A deviation is a genuine improvement for D&D content — allowed under "strong preference,"
  but note it so it's a conscious choice, not drift.

# Calculated Total Tooltips

## Rule

Wherever a calculated total number is displayed in the UI, it must have a tooltip that shows how that number was calculated — including the individual components and formula that produce the total.

## Guidelines

1. **Show the breakdown**: The tooltip should list each contributing value with a label, e.g., `10 (base) + 2 (Dex mod) + 2 (shield) + 1 (ring) = 15 AC`.
2. **Use the existing Tooltip component**: The project should have a shared `Tooltip` component (e.g. `src/components/shared/Tooltip.tsx`) — use it for consistency.
3. **Format clearly**: Use a simple additive format like `A + B + C = Total`, or a labeled list when there are many components.
4. **Include zero values**: Show components even when they are 0 (e.g. a +0 ability modifier), so users can see every factor that could contribute.
5. **Name the sources**: Use meaningful labels (e.g., "Base", "Dex mod", "Proficiency", "Shield", "Class feature", "Magic item") rather than just raw numbers. Where a bonus has a type (enhancement, circumstance, etc.) that matters for stacking, name it.
6. **Examples of calculated totals that need tooltips** (D&D 5.5e):
   - Ability modifiers (from ability score)
   - Proficiency bonus (by character level)
   - Skill and ability check totals (ability mod + proficiency if proficient + expertise + other bonuses)
   - Saving throw totals (ability mod + proficiency if proficient + bonuses)
   - Armour Class (base/armour + Dex mod capped by armour + shield + other bonuses)
   - Hit point maximum (per-level hit die/average + Con mod × level + bonuses e.g. Tough)
   - Spell save DC (8 + proficiency + spellcasting ability mod)
   - Spell attack bonus (proficiency + spellcasting ability mod)
   - Attack roll bonus (ability mod + proficiency + magic/other)
   - Damage (dice + ability mod + magic/feature bonuses)
   - Initiative (Dex mod + bonuses)
   - Passive Perception / passive checks (10 + relevant check modifier)
   - Carrying capacity / encumbrance (Strength × 15, variant thresholds)
   - Speed (base ± effects)
   - Any summed or derived stat
7. **Make stacking legible**: When the rules disallow stacking (e.g. two sources of the same bonus type, or two things that both set a value), the breakdown should show which source actually applied and, where useful, note what was superseded — so the number is explainable, not just correct.
8. **Hover on desktop, tap on mobile**: Tooltip should appear on hover for desktop users and on tap/long-press for touch users.

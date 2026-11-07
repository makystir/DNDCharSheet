# Rules Compliance

## Mandatory Rulebook Adherence

All game mechanics, calculations, data, and logic in this application MUST comply with the official Dungeons & Dragons 5.5e (2024) rules. The rulebook documents in the project are the authoritative source of truth for how the app should behave.

## Authoritative Sources

Reference these documents (in priority order) when implementing or modifying any game logic. The first is present in the project today; add the others and update the paths as you obtain them:

1. #[[file:Docs/PlayersHandbook.md]] — Player's Handbook (2024) — character build, rules glossary, spells (highest authority for player-facing mechanics)
2. Dungeon Master's Guide (2024) — DM-facing rules, magic items, optional/variant rules — *(add to the project and link here when available)*
3. Monster Manual (2024) — stat blocks, creature rules — *(add to the project and link here when available)*
4. Sage Advice Compendium / official errata (overrides the core books where they conflict) — *(add to the project and link here when available)*

> When you add a reference document, place it in the project and update this list with a `#[[file:<path>]]` link so it is pulled into context automatically. Keep the priority order above.

## Rules

1. **Never invent mechanics.** If a calculation, cost, DC, threshold, or game rule is not documented in one of the sources above, do not implement it. Ask the user for clarification instead.

2. **2024 rules are primary; errata overrides.** This app targets the 2024 (5.5e) ruleset. When the Sage Advice Compendium / official errata contradicts a core book, follow the errata. When 2024 rules differ from 2014 (5e) rules, follow 2024.

3. **Do not silently mix editions.** 2014 (5e) content may only be used where it is explicitly compatible with 2024 rules, and when it is, note the edition in a comment. If a 2024 equivalent exists, prefer it. Flag any place where edition compatibility is uncertain rather than guessing.

4. **Rules-as-written by default; variants are opt-in.** Implement the core rules as written. Optional and variant rules (e.g. flanking, variant encumbrance, proficiency dice, alternative resting) must not change default behaviour — gate them behind an explicit toggle/house-rule setting, and cite the book and page where the variant is defined.

5. **Verify before implementing.** When implementing any game mechanic (ability modifiers, proficiency bonus, AC, HP, spell save DC, attack/damage, skill checks, saving throws, conditions, rests, class/species features), read the relevant rules section first to confirm the formula/rule. Do not rely on memory or assumptions.

6. **Cite the source.** When implementing a rule, note which book and page/section it comes from in a code comment (e.g., `// PHB 2024 p.XX: Proficiency Bonus by level`). For errata-driven behaviour, cite the Sage Advice entry.

7. **Flag ambiguities.** If a rule is unclear or could be interpreted multiple ways, flag it to the user rather than picking an interpretation silently. D&D has many edge cases (stacking bonuses, "bonus" vs "modifier", advantage interactions) — surface them.

8. **New rulebooks.** Any new rules documents added to the project (supplements, adventure-specific rules, Unearthed Arcana the user opts into) should be treated as additional authoritative sources and referenced where relevant, respecting the edition-precedence rules above.

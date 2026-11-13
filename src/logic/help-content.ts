/**
 * Help content registry for the contextual help popovers.
 *
 * FRAMEWORK ported from PWACharSheet's logic/help-content.ts (a concept-id ->
 * text lookup). The CONTENT is D&D-app-specific: short, app-UX help text that
 * explains how to USE a surface of this app, NOT rules content. These strings
 * are kept brief (<=280 characters) and factual, and are deliberately NOT a
 * transcription of any rulebook passage (no PHB citation needed — this is app
 * help, not game-rules content).
 */

const helpContent: Record<string, string> = {
  'command-palette':
    'Press Ctrl/⌘+K anywhere to open the command palette. Type to jump to a page, run an action, or look up a condition, then press Enter to go.',
  'character-manager':
    'Keep several characters in one place. Use the switcher to change the active character, or open the manager to rename, duplicate, delete, or create a new one.',
  'spells-tab':
    'The Spells page appears only for a spellcaster. Track your known cantrips, prepared spells, and spell slots here; it updates as your class and level change.',
  'advancement-tab':
    'Record level-ups on the Advancement page. Changing your level updates the derived values across the sheet automatically.',
  'companions-tab':
    'Track everyone who travels with you. Creatures: a Primal Companion, familiar, steed, or a pet, mount or pack animal. People: hirelings, NPC party members and sidekicks. Their HP and conditions are edited on this page only.',
  'theme-toggle':
    'Switch between the dark and light colour themes from Settings. Your choice is saved on this device for next time.',
};

/**
 * Retrieve help text for a given concept identifier.
 * Returns the help string if found, or an empty string if the concept ID is unknown.
 */
export function getHelpContent(conceptId: string): string {
  return helpContent[conceptId] ?? '';
}

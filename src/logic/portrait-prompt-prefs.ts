import {
  DEFAULT_PORTRAIT_FRAMING,
  DEFAULT_PORTRAIT_MOOD,
  DEFAULT_PORTRAIT_STYLE,
  PORTRAIT_MOODS,
  PORTRAIT_STYLES,
} from './portrait-prompt';
import type { PortraitFraming, PortraitMood, PortraitStyle } from './portrait-prompt';

/** localStorage key for the remembered portrait-prompt choices (not character data). */
export const PORTRAIT_PROMPT_PREFS_KEY = 'portraitPrompt:prefs';

export interface PortraitPromptPrefs {
  style: PortraitStyle;
  framing: PortraitFraming;
  mood: PortraitMood;
}

export const DEFAULT_PORTRAIT_PREFS: PortraitPromptPrefs = {
  style: DEFAULT_PORTRAIT_STYLE,
  framing: DEFAULT_PORTRAIT_FRAMING,
  mood: DEFAULT_PORTRAIT_MOOD,
};

/** Load remembered prefs; any failure or invalid value falls back to the defaults. */
export function loadPortraitPrefs(): PortraitPromptPrefs {
  try {
    const raw = localStorage.getItem(PORTRAIT_PROMPT_PREFS_KEY);
    if (!raw) return { ...DEFAULT_PORTRAIT_PREFS };
    const parsed = JSON.parse(raw) as Partial<PortraitPromptPrefs> | null;
    return {
      style: PORTRAIT_STYLES.some((s) => s.id === parsed?.style)
        ? (parsed!.style as PortraitStyle)
        : DEFAULT_PORTRAIT_PREFS.style,
      framing:
        parsed?.framing === 'fullBody' || parsed?.framing === 'portrait'
          ? parsed.framing
          : DEFAULT_PORTRAIT_PREFS.framing,
      mood: PORTRAIT_MOODS.some((m) => m.id === parsed?.mood)
        ? (parsed!.mood as PortraitMood)
        : DEFAULT_PORTRAIT_PREFS.mood,
    };
  } catch {
    return { ...DEFAULT_PORTRAIT_PREFS };
  }
}

/** Persist prefs; storage failures (private mode, quota) are ignored. */
export function savePortraitPrefs(prefs: PortraitPromptPrefs): void {
  try {
    localStorage.setItem(PORTRAIT_PROMPT_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Graceful fallback - localStorage unavailable or quota exceeded.
  }
}

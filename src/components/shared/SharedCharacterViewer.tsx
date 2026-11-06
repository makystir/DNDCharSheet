import { useState, useEffect } from 'react';
import type { Character } from '../../types/character';
import { ABILITIES, ABILITY_NAMES, SKILLS } from '../../types/character';
import { decodeSharePayload } from '../../logic/share-codec';
import { validateSharedPayload } from '../../logic/share-validate';
import {
  abilityModifierBreakdown,
  proficiencyBonusBreakdown,
} from '../../logic/abilities';
import { effectiveAbilityScores } from '../../logic/feats';
import { characterArmorClassBreakdown } from '../../logic/armor-class';
import { characterHitPointMaxBreakdown } from '../../logic/hit-points-state';
import { initiativeBreakdown } from '../../logic/initiative';
import { passivePerceptionBreakdown } from '../../logic/passive-checks';
import { speedBreakdown } from '../../logic/species';
import { allSavingThrowBreakdowns } from '../../logic/saving-throws';
import { allSkillBreakdowns } from '../../logic/skills';
import {
  isSpellcaster,
  spellSaveDcBreakdown,
  spellAttackBreakdown,
} from '../../logic/spellcasting';
import { primaryClass, resolveClass } from '../../logic/classes';
import { resolveSpecies } from '../../logic/species';
import { CalculatedValue } from './CalculatedValue';
import styles from './SharedCharacterViewer.module.css';

/**
 * Read-only GM viewer for a shared character (Stage B5).
 *
 * Mounted by App ONLY on a `#view/…` route, BEFORE the welcome/shell branch, so
 * it renders stand-alone (no Navigation, no WelcomeScreen, no management sheet)
 * and works even with an empty local character DB.
 *
 * SECURITY: the `encoded` payload comes from the URL hash and is UNTRUSTED. It
 * is size-capped + decoded defensively via the share codec (never throws), then
 * validated + migrated through the B2 import path (share-validate) before any
 * display. A malformed/oversized/garbage payload yields a clean "invalid share
 * link" state — never a crash. This viewer is STRICTLY READ-ONLY: it performs
 * NO storage/manager writes, never adopts the shared character, and mounts no
 * editable fields. Every calculated total carries a breakdown tooltip via
 * `CalculatedValue` (calculated-totals steering).
 *
 * Bucket-1 port of the WFRP app's `SharedCharacterViewer`, re-themed to the D&D
 * character display. No game rules math is computed here — every number comes
 * from a Part-1 logic function — so no rulebook citation applies.
 */

interface SharedCharacterViewerProps {
  /** The opaque encoded payload after `#view/` (empty string for the bare route). */
  encoded: string;
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'sheet'; character: Character };

/** Map a decode error code to a friendly, non-technical message. */
function decodeErrorMessage(code: string): string {
  switch (code) {
    case 'too-large':
      return 'This shared character is too large to open.';
    case 'bad-version':
      return 'This link was made with a newer version of the app and can’t be opened here.';
    case 'bad-base64url':
    case 'empty':
      return 'This share link looks incomplete or corrupted.';
    case 'bad-gzip':
    case 'bad-utf8':
      return 'The shared data could not be read. The link may be corrupted.';
    default:
      return 'The shared character could not be opened.';
  }
}

/** Validate a decoded JSON string into the next sheet/error state. */
function loadFromJson(json: string): LoadState {
  const validated = validateSharedPayload(json);
  if (!validated.ok) {
    return { phase: 'error', message: validated.error };
  }
  return { phase: 'sheet', character: validated.character };
}

/** Navigate back to the user's own characters: clear the view hash + notify listeners. */
function goBackToMyCharacters(): void {
  history.replaceState(null, '', window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function SharedCharacterViewer({ encoded }: SharedCharacterViewerProps) {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

  // Decode + validate the UNTRUSTED link payload asynchronously (gunzip is
  // async). Guarded against a race if `encoded` changes mid-flight. This is the
  // only effect: it reflects the external `encoded` prop (driven by the hash)
  // into the viewer's read-only display state. No storage/manager write occurs.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ phase: 'loading' });
    void (async () => {
      const decoded = await decodeSharePayload(encoded);
      if (cancelled) return;
      if (!decoded.ok) {
        setState({ phase: 'error', message: decodeErrorMessage(decoded.code) });
        return;
      }
      const next = loadFromJson(decoded.json);
      if (cancelled) return;
      setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [encoded]);

  if (state.phase === 'loading') {
    return (
      <div className={styles.viewer}>
        <div className={styles.statusBox}>Opening shared character…</div>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className={styles.viewer}>
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>Can’t open this shared character</div>
          <div className={styles.errorMessage}>{state.message}</div>
          <button type="button" className={styles.backButton} onClick={goBackToMyCharacters}>
            Back to my characters
          </button>
        </div>
      </div>
    );
  }

  const { character } = state;
  const effScores = effectiveAbilityScores(character);
  const cls = resolveClass(character);
  const species = resolveSpecies(character);

  const acBreakdown = characterArmorClassBreakdown(character);
  const hpBreakdown = characterHitPointMaxBreakdown(character);
  const initBreakdown = initiativeBreakdown(effScores, character.initiativeBonus);
  const ppBreakdown = passivePerceptionBreakdown(character);
  const speed = speedBreakdown(character);
  const saves = allSavingThrowBreakdowns(character);
  const skillBreakdowns = allSkillBreakdowns(character);
  const spellcaster = isSpellcaster(character);
  const dcBreakdown = spellcaster ? spellSaveDcBreakdown(character) : undefined;
  const spellAtk = spellcaster ? spellAttackBreakdown(character) : undefined;

  const primaryEntry = primaryClass(character);
  const classLabel = cls
    ? `${cls.name}${primaryEntry?.level ? ` ${primaryEntry.level}` : ''}`
    : 'No class';

  return (
    <div className={styles.viewer}>
      <div className={styles.banner}>
        Read-only shared view. Nothing here is saved to your characters.
        <button type="button" className={styles.backButton} onClick={goBackToMyCharacters}>
          Back to my characters
        </button>
      </div>

      {/* Identity */}
      <div className={styles.card}>
        <div className={styles.identityMeta}>
          <div className={styles.characterName}>{character.name || 'Unnamed Character'}</div>
          <div className={styles.identitySub}>
            {species?.name ?? 'No species'} · {classLabel} · Level {character.level}
          </div>
          {character.alignment && <div className={styles.identitySub}>{character.alignment}</div>}
        </div>
      </div>

      {/* Core derived stats */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Core Stats</div>
        <div className={styles.statGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Proficiency Bonus</span>
            <CalculatedValue label="Proficiency Bonus" breakdown={proficiencyBonusBreakdown(character.level)} />
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Armor Class</span>
            <CalculatedValue label="Armor Class" breakdown={acBreakdown} />
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Hit Point Max</span>
            <CalculatedValue label="Hit Point maximum" breakdown={hpBreakdown} />
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Initiative</span>
            <CalculatedValue label="Initiative" breakdown={initBreakdown} />
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Speed</span>
            <CalculatedValue label="Speed" breakdown={speed}>
              {speed.total} ft
            </CalculatedValue>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Passive Perception</span>
            <CalculatedValue label="Passive Perception" breakdown={ppBreakdown} />
          </div>
          {dcBreakdown && (
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Spell Save DC</span>
              <CalculatedValue label="Spell Save DC" breakdown={dcBreakdown} />
            </div>
          )}
          {spellAtk && (
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Spell Attack</span>
              <CalculatedValue label="Spell Attack" breakdown={spellAtk} />
            </div>
          )}
        </div>
      </div>

      {/* Ability scores + modifiers */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Ability Scores</div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Ability</th>
              <th scope="col">Score</th>
              <th scope="col">Modifier</th>
              <th scope="col">Save</th>
            </tr>
          </thead>
          <tbody>
            {ABILITIES.map((ability) => (
              <tr key={ability}>
                <td>{ABILITY_NAMES[ability]}</td>
                <td>{effScores[ability]}</td>
                <td>
                  <CalculatedValue
                    label={`${ABILITY_NAMES[ability]} Modifier`}
                    breakdown={abilityModifierBreakdown(ability, effScores[ability])}
                  />
                </td>
                <td>
                  <CalculatedValue
                    label={`${ABILITY_NAMES[ability]} Save`}
                    breakdown={saves[ability]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Skills */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Skills</div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Ability</th>
              <th scope="col">Modifier</th>
            </tr>
          </thead>
          <tbody>
            {SKILLS.map((skill) => (
              <tr key={skill.id}>
                <td>{skill.name}</td>
                <td>{ABILITY_NAMES[skill.ability].slice(0, 3)}</td>
                <td>
                  <CalculatedValue
                    label={`${skill.name} Modifier`}
                    breakdown={skillBreakdowns[skill.id]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { Fragment } from 'react';
import { BookOpen } from 'lucide-react';
import type { Character } from '../../../types/character';
import { getSpell } from '../../../data/spells';
import type { SpellId } from '../../../data/spells';
import { knownSpellsByClass } from '../../../logic/known-spells';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { SpellName } from '../../shared/SpellName';
import styles from './KnownSpellsCard.module.css';

export interface KnownSpellsCardProps {
  character: Character;
  /** Jump to the Prepared tab, where the lists are edited. */
  onEdit: () => void;
}

function SpellItem({ id, always }: { id: SpellId; always: boolean }) {
  const spell = getSpell(id);
  return (
    <li className={styles.item}>
      <SpellName id={id} />
      {always && <span className={styles.tag}>Always prepared</span>}
      {spell?.concentration && <span className={styles.tag}>Concentration</span>}
      {spell?.ritual && <span className={styles.tag}>Ritual</span>}
    </li>
  );
}

/**
 * Read-only list of the character's known cantrips and prepared spells, per
 * spellcasting class, for the Spells Summary. Each name has its spell tooltip.
 * Editing happens on the Prepared tab.
 */
export function KnownSpellsCard({ character, onEdit }: KnownSpellsCardProps) {
  const classes = knownSpellsByClass(character);
  if (classes.length === 0) return null;
  const multi = classes.length > 1;

  return (
    <Card>
      <SectionHeader icon={BookOpen} title="Your spells" />
      {classes.map((c) => {
        const levels = [...new Set(c.prepared.map((id) => getSpell(id)!.level))];
        return (
          <section key={c.classId} className={styles.classBlock} aria-label={`${c.className} spells`}>
            {multi && <h4 className={styles.className}>{c.className}</h4>}

            <h5 className={styles.groupHeading}>Cantrips ({c.cantrips.length})</h5>
            {c.cantrips.length === 0 ? (
              <p className={styles.empty}>No cantrips chosen yet.</p>
            ) : (
              <ul className={styles.list} aria-label={`${c.className} cantrips`}>
                {c.cantrips.map((id) => (
                  <SpellItem key={id} id={id} always={false} />
                ))}
              </ul>
            )}

            <h5 className={styles.groupHeading}>Prepared spells ({c.prepared.length})</h5>
            {c.prepared.length === 0 ? (
              <p className={styles.empty}>No spells prepared yet.</p>
            ) : (
              levels.map((lvl) => (
                <Fragment key={lvl}>
                  <p className={styles.levelLabel}>Level {lvl}</p>
                  <ul className={styles.list} aria-label={`${c.className} level ${lvl} prepared spells`}>
                    {c.prepared
                      .filter((id) => getSpell(id)!.level === lvl)
                      .map((id) => (
                        <SpellItem key={id} id={id} always={c.alwaysPrepared.includes(id)} />
                      ))}
                  </ul>
                </Fragment>
              ))
            )}
          </section>
        );
      })}
      <button type="button" className={styles.editBtn} onClick={onEdit}>
        Change spells on the Prepared tab
      </button>
    </Card>
  );
}

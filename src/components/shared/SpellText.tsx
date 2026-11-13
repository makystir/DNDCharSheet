import styles from './SpellText.module.css';

/**
 * A spell's full printed text (the catalog `effect`), keeping its paragraphs
 * and bullet lists. Lines starting with "- " become list items; a leading
 * "Using a Higher-Level Spell Slot." or "Cantrip Upgrade." label is bolded as
 * in the book. The text itself is never altered.
 */
export function SpellText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={styles.text} data-testid="spell-text">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => l.startsWith('- '))) {
          return (
            <ul key={i} className={styles.list}>
              {lines.map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        }
        const label = /^(Using a Higher-Level Spell Slot\.|Cantrip Upgrade\.)\s*/.exec(block);
        return (
          <p key={i} className={styles.paragraph}>
            {label ? (
              <>
                <strong>{label[1]}</strong> {block.slice(label[0].length)}
              </>
            ) : (
              block
            )}
          </p>
        );
      })}
    </div>
  );
}

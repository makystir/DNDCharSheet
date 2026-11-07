import styles from './OverviewShared.module.css';

export interface OverviewLink {
  href: string;
  text: string;
}

/** A plain hash-route link in the shared Overview link style. */
export function OverviewLinkAnchor({ href, text }: OverviewLink) {
  return (
    <a className={styles.link} href={href}>
      {text}
    </a>
  );
}

/**
 * The one empty-state used by every Overview card: muted, left-aligned text,
 * with an optional link on its own line underneath.
 */
export function OverviewEmpty({ text, link }: { text: string; link?: OverviewLink }) {
  return (
    <div className={styles.empty} role="status" data-testid="overview-empty">
      <p className={styles.emptyText}>{text}</p>
      {link && <OverviewLinkAnchor {...link} />}
    </div>
  );
}

/** The card footer: its "manage on X" link(s), always on their own line. */
export function OverviewFooter({ links }: { links: OverviewLink[] }) {
  return (
    <div className={styles.footer} data-testid="overview-footer">
      {links.map((l) => (
        <OverviewLinkAnchor key={l.href + l.text} {...l} />
      ))}
    </div>
  );
}

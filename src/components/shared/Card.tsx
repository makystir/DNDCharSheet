import type { CSSProperties, ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  /** Optional element id, so a link can scroll to this card (see ScrollLink). */
  id?: string;
}

/** A plain elevation/surface primitive that everything else sits in. */
export function Card({ children, style, id }: CardProps) {
  return (
    <div className={styles.card} style={style} id={id} tabIndex={id ? -1 : undefined}>
      {children}
    </div>
  );
}

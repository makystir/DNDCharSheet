import type { CSSProperties, ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
}

/** A plain elevation/surface primitive that everything else sits in. */
export function Card({ children, style }: CardProps) {
  return (
    <div className={styles.card} style={style}>
      {children}
    </div>
  );
}

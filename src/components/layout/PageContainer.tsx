import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';
import { PageTransition } from '../shared/PageTransition';
import { OfflineIndicator } from '../shared/OfflineIndicator';
import styles from './PageContainer.module.css';

interface PageContainerProps {
  children: ReactNode;
  pageKey: string;
}

/**
 * The routed main-content region. Renders the `<main id="main-content">`
 * landmark (the skip-link target), moves focus to it on every route change so
 * keyboard/screen-reader users land on the new page, provides a scroll-to-top
 * affordance, and wraps content in a PageTransition crossfade.
 */
export function PageContainer({ children, pageKey }: PageContainerProps) {
  const ref = useRef<HTMLElement>(null);
  const [showScroll, setShowScroll] = useState(false);

  const handleScroll = useCallback(() => {
    if (ref.current) {
      setShowScroll(ref.current.scrollTop > 300);
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Move focus to the main region on route change so keyboard users follow the
  // navigation (FR-5 / review #1). The region is tabIndex=-1 so it is
  // programmatically focusable without entering the tab order.
  useEffect(() => {
    ref.current?.focus();
  }, [pageKey]);

  const scrollToTop = () => {
    ref.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main ref={ref} id="main-content" tabIndex={-1} className={styles.container}>
      <div className={styles.offlineWrapper}>
        <OfflineIndicator />
      </div>
      <PageTransition pageKey={pageKey}>{children}</PageTransition>
      {showScroll && (
        <button
          type="button"
          onClick={scrollToTop}
          className={styles.scrollBtn}
          aria-label="Scroll to top"
        >
          <ChevronUp size={20} />
        </button>
      )}
    </main>
  );
}

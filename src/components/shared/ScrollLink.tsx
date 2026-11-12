import type { ReactNode } from 'react';

export interface ScrollLinkProps {
  /** Id of the element on the current page to scroll to. */
  targetId: string;
  /** The page hash to fall back to without script (keeps the user on this page). */
  fallbackHref: string;
  className?: string;
  children: ReactNode;
}

/**
 * A link to another spot on the SAME page. The app routes on the URL hash
 * (#page/subtab), so a plain #fragment would be read as an unknown page; this
 * scrolls to the target and moves focus there instead (keyboard and screen
 * reader users land in the right place), respecting reduced-motion.
 */
export function ScrollLink({ targetId, fallbackHref, className, children }: ScrollLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(targetId);
    if (!el) return; // fall through to the plain hash link
    e.preventDefault();
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    el.focus?.({ preventScroll: true });
  };
  return (
    <a className={className} href={fallbackHref} onClick={handleClick}>
      {children}
    </a>
  );
}

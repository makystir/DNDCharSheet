import { Component, Suspense } from 'react';
import type { ReactNode } from 'react';
import styles from './PageLoader.module.css';

/**
 * Suspense fallback + chunk-load error boundary for lazy-loaded pages (Stage
 * B9). Bucket-1 port of PWACharSheet's PageLoader, re-themed to the DND token
 * set. Pure presentation — it reads no character data.
 */

/**
 * Accessible loading indicator displayed while a lazy page chunk is fetched
 * (the generic fallback when no page-specific skeleton is supplied).
 */
export function LoadingIndicator() {
  return (
    <div role="status" aria-label="Loading page content" className={styles.loadingContainer}>
      <span className={styles.spinner} />
      <span>Loading…</span>
    </div>
  );
}

/**
 * Determines whether an error is a chunk-load failure.
 * Vite/Rollup surfaces these as a TypeError with a dynamic-import message; the
 * module-preload helper throws "Unable to preload CSS for <url>" when a hashed
 * CSS chunk referenced by a stale shell is missing after a new deploy.
 */
function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Loading CSS chunk') ||
    error.message.includes('Unable to preload CSS')
  );
}

interface LazyErrorBoundaryProps {
  children: ReactNode;
}

interface LazyErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Specialized error boundary that catches chunk-load failures and renders a
 * retry button. On retry for a chunk error it triggers a full page reload to
 * re-attempt fetching the failed chunk; for any other error it simply clears.
 */
export class LazyErrorBoundary extends Component<LazyErrorBoundaryProps, LazyErrorBoundaryState> {
  constructor(props: LazyErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): LazyErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    if (this.state.error && isChunkLoadError(this.state.error)) {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null });
    }
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error && isChunkLoadError(this.state.error);
      return (
        <div className={styles.errorContainer} role="alert">
          <h2 className={styles.errorHeading}>Page could not be loaded</h2>
          <p className={styles.errorMessage}>
            {isChunkError
              ? 'A network error prevented this page from loading. Please check your connection and try again.'
              : (this.state.error?.message || 'An unexpected error occurred.')}
          </p>
          <button type="button" onClick={this.handleRetry} className={styles.retryButton}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface PageLoaderProps {
  children: ReactNode;
  /** Page-specific skeleton fallback; falls back to the generic LoadingIndicator. */
  skeleton?: ReactNode;
}

/**
 * Wrapper combining React.Suspense with LazyErrorBoundary. Use it to wrap a
 * lazily-loaded page. When a `skeleton` is provided it is used as the Suspense
 * fallback instead of the generic LoadingIndicator.
 */
export function PageLoader({ children, skeleton }: PageLoaderProps) {
  return (
    <Suspense fallback={skeleton ?? <LoadingIndicator />}>
      <LazyErrorBoundary>{children}</LazyErrorBoundary>
    </Suspense>
  );
}

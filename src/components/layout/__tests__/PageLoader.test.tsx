import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Suspense } from 'react';
import { PageLoader, LoadingIndicator, LazyErrorBoundary } from '../PageLoader';
import { CombatSkeleton } from '../../skeletons';

describe('PageLoader', () => {
  it('renders its children when they resolve synchronously', () => {
    render(
      <PageLoader>
        <div>Loaded content</div>
      </PageLoader>,
    );
    expect(screen.getByText('Loaded content')).toBeInTheDocument();
  });

  it('renders the generic LoadingIndicator fallback', () => {
    render(<LoadingIndicator />);
    expect(screen.getByRole('status', { name: 'Loading page content' })).toBeInTheDocument();
  });

  it('shows the provided skeleton as the Suspense fallback while a child suspends', () => {
    // A component that never resolves: suspends forever so the fallback shows.
    function Suspends(): never {
      throw new Promise<void>(() => {});
    }
    render(
      <PageLoader skeleton={<CombatSkeleton />}>
        <Suspends />
      </PageLoader>,
    );
    // The CombatSkeleton exposes a status region with the loading label.
    expect(screen.getByRole('status', { name: 'Loading page content' })).toBeInTheDocument();
  });

  it('falls back to the generic indicator when no skeleton is given', () => {
    function Suspends(): never {
      throw new Promise<void>(() => {});
    }
    render(
      <Suspense fallback={null}>
        <PageLoader>
          <Suspends />
        </PageLoader>
      </Suspense>,
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});

describe('LazyErrorBoundary', () => {
  it('renders a retry affordance when a child throws', () => {
    function Throws(): never {
      throw new Error('boom');
    }
    render(
      <LazyErrorBoundary>
        <Throws />
      </LazyErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

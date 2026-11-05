import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  CombatSkeleton,
  AdvancementSkeleton,
  SettingsSkeleton,
  InventorySkeleton,
  SpellsSkeleton,
} from '..';

/**
 * The skeletons are pure presentation shown before a page's data is available,
 * so they must render with NO character data and expose an accessible loading
 * status (role="status", aria-label="Loading page content").
 */
const cases = [
  ['CombatSkeleton', <CombatSkeleton key="c" />],
  ['AdvancementSkeleton', <AdvancementSkeleton key="a" />],
  ['SettingsSkeleton', <SettingsSkeleton key="s" />],
  ['InventorySkeleton', <InventorySkeleton key="i" />],
  ['SpellsSkeleton', <SpellsSkeleton key="p" />],
] as const;

describe('loading skeletons', () => {
  it.each(cases)('%s renders an accessible loading status without a character', (_name, element) => {
    render(element);
    expect(screen.getByRole('status', { name: 'Loading page content' })).toBeInTheDocument();
  });
});

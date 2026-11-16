import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ConditionAwareText } from '../ConditionAwareText';

describe('ConditionAwareText', () => {
  it('keeps comma-separated text unchanged', () => {
    const { container } = render(<ConditionAwareText text="Charmed, Poisoned" />);
    expect(container.textContent).toBe('Charmed, Poisoned');
  });

  it('keeps a semicolon separator', () => {
    const { container } = render(<ConditionAwareText text="Charmed; Frightened" />);
    expect(container.textContent).toBe('Charmed; Frightened');
  });

  it('leaves unknown tokens as plain text', () => {
    const { container } = render(<ConditionAwareText text="Bludgeoning, Fire" />);
    expect(container.textContent).toBe('Bludgeoning, Fire');
    expect(container.querySelector('button')).toBeNull();
  });

  it('gives a condition token a tooltip trigger', () => {
    const { container } = render(<ConditionAwareText text="Charmed" />);
    expect(container.querySelector('button')).not.toBeNull();
  });
});

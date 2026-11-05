import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeScreen } from '../WelcomeScreen';

describe('WelcomeScreen', () => {
  it('offers exactly the three creation modes', () => {
    render(<WelcomeScreen onCharacterReady={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Guided Wizard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll a Random Character' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip the Wizard' })).toBeInTheDocument();
  });

  it('Roll a Random Character produces a complete character', () => {
    const onReady = vi.fn();
    render(<WelcomeScreen onCharacterReady={onReady} />);
    fireEvent.click(screen.getByRole('button', { name: 'Roll a Random Character' }));
    expect(onReady).toHaveBeenCalledTimes(1);
    const character = onReady.mock.calls[0][0];
    // A fully generated character has a class, species, and a background applied.
    expect(character.class?.id).toBeTruthy();
    expect(character.species?.id).toBeTruthy();
    expect(character.backgroundSelection?.id).toBeTruthy();
    expect(character.name.length).toBeGreaterThan(0);
  });

  it('Guided Wizard mounts the wizard (shows the Class step)', () => {
    render(<WelcomeScreen onCharacterReady={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guided Wizard' }));
    expect(screen.getByRole('heading', { name: /Step 1: Class/ })).toBeInTheDocument();
  });

  it('Skip the Wizard creates a blank named character', () => {
    const onReady = vi.fn();
    render(<WelcomeScreen onCharacterReady={onReady} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip the Wizard' }));
    const input = screen.getByRole('textbox', { name: 'Character name' });
    fireEvent.change(input, { target: { value: 'Grognard' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));
    expect(onReady).toHaveBeenCalledTimes(1);
    const character = onReady.mock.calls[0][0];
    expect(character.name).toBe('Grognard');
    // A blank sheet has no class/species/background chosen yet.
    expect(character.class).toBeUndefined();
    expect(character.backgroundSelection).toBeUndefined();
  });

  it('Skip mode disables Create until a name is entered', () => {
    render(<WelcomeScreen onCharacterReady={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip the Wizard' }));
    expect(screen.getByRole('button', { name: 'Create Character' })).toBeDisabled();
  });
});

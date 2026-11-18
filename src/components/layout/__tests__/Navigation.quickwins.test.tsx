import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Navigation } from '../Navigation';
import { AdvancementPage } from '../../pages/AdvancementPage';
import { CommandPaletteProvider } from '../../command-palette/CommandPaletteContext';
import { AssistantProvider } from '../../assistant/AssistantContext';
import { createCharacter } from '../../../storage/character-store';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderNav() {
  return render(
    <CommandPaletteProvider navigate={vi.fn()} runAction={vi.fn()}>
      <AssistantProvider>
        <Navigation activePage="character" onPageChange={vi.fn()} />
      </AssistantProvider>
    </CommandPaletteProvider>,
  );
}

function mockViewport(mobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: mobile ? query.includes('max-width: 767px') : query.includes('min-width: 768px'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('Keyboard shortcuts button (P-B3)', () => {
  it('is not offered in the mobile nav', () => {
    mockViewport(true);
    renderNav();
    expect(screen.queryByRole('button', { name: 'Keyboard shortcuts' })).toBeNull();
  });

  it('is still offered in the desktop nav', () => {
    mockViewport(false);
    renderNav();
    expect(screen.getByRole('button', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });
});

describe('Advancement jump links (P-B4)', () => {
  it('offers a jump to each section named in the nav hint', () => {
    mockViewport(false);
    render(<AdvancementPage character={createCharacter('Tester')} onChange={vi.fn()} now={() => 1000} />);
    const bar = screen.getByRole('navigation', { name: 'Advancement sections' });
    const links = Array.from(bar.querySelectorAll('a')).map((a) => a.textContent);
    expect(links).toEqual(['Level', 'Hit Points', 'Next level', 'Feats', 'Multiclass', 'Log']);
    for (const id of ['adv-section-level', 'adv-section-hp', 'adv-section-next-level', 'adv-section-feats', 'adv-section-multiclass', 'adv-section-log']) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });
});

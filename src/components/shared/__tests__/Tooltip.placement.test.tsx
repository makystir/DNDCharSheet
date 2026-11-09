import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Tooltip } from '../Tooltip';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Regression for a hover flicker: the tooltip was placed using a fixed 200px height
 * guess, so a taller tooltip flipped above a trigger near the bottom of the screen
 * extended DOWN over the trigger. The cursor was then over the tooltip, which hid it,
 * and it reappeared, flickering rapidly. Placement must use the measured size and
 * never overlap the anchor.
 */
function anchorAt(rect: { top: number; left: number; width: number; height: number }): HTMLElement {
  const el = document.createElement('button');
  document.body.appendChild(el);
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  });
  return el;
}

function mockTooltipSize(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
}

function placed() {
  const tip = screen.getByRole('tooltip');
  return {
    top: parseFloat(tip.style.top),
    left: parseFloat(tip.style.left),
    maxHeight: tip.style.maxHeight ? parseFloat(tip.style.maxHeight) : undefined,
  };
}

describe('Tooltip placement', () => {
  it('flips above a trigger near the bottom and ends above it even when taller than 200px', () => {
    window.innerHeight = 700;
    window.innerWidth = 1200;
    mockTooltipSize(300, 320); // taller than the old 200px estimate
    const anchor = anchorAt({ top: 640, left: 100, width: 140, height: 24 });
    render(
      <Tooltip id="t" anchorEl={anchor} title="Spellcasting" onClose={() => {}}>
        long text
      </Tooltip>,
    );
    const p = placed();
    // The tooltip's bottom edge must sit above the anchor's top edge (no overlap).
    expect(p.top + 320).toBeLessThanOrEqual(640);
    expect(p.top).toBeGreaterThanOrEqual(0);
  });

  it('goes below the trigger when there is room', () => {
    window.innerHeight = 900;
    window.innerWidth = 1200;
    mockTooltipSize(300, 200);
    const anchor = anchorAt({ top: 100, left: 400, width: 100, height: 24 });
    render(
      <Tooltip id="t" anchorEl={anchor} title="x" onClose={() => {}}>
        text
      </Tooltip>,
    );
    expect(placed().top).toBeGreaterThanOrEqual(124);
  });

  it('caps its height instead of covering the trigger when neither side fits', () => {
    window.innerHeight = 400;
    window.innerWidth = 1200;
    mockTooltipSize(300, 600);
    const anchor = anchorAt({ top: 200, left: 400, width: 100, height: 24 });
    render(
      <Tooltip id="t" anchorEl={anchor} title="x" onClose={() => {}}>
        text
      </Tooltip>,
    );
    const p = placed();
    expect(p.maxHeight).toBeDefined();
    const overlapsAnchor = p.top < 224 && p.top + (p.maxHeight ?? 0) > 200;
    expect(overlapsAnchor).toBe(false);
  });

  it('keeps the tooltip inside the viewport horizontally', () => {
    window.innerHeight = 900;
    window.innerWidth = 500;
    mockTooltipSize(320, 100);
    const anchor = anchorAt({ top: 100, left: 470, width: 20, height: 24 });
    render(
      <Tooltip id="t" anchorEl={anchor} title="x" onClose={() => {}}>
        text
      </Tooltip>,
    );
    const p = placed();
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.left + 320).toBeLessThanOrEqual(500 - 8);
  });
});

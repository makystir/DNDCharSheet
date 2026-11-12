import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Tooltip } from '../Tooltip';
import styles from '../Tooltip.module.css';

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

  /*
   * All content must be readable without scrolling: the page may already be scrolled
   * to the bottom and a hover tooltip ignores the pointer, so it cannot be scrolled.
   * The tooltip is never height-capped unless it is taller than the whole screen.
   */
  it('goes beside the trigger, uncapped, when it fits neither below nor above', () => {
    window.innerHeight = 700;
    window.innerWidth = 1200;
    mockTooltipSize(300, 500);
    const anchor = anchorAt({ top: 300, left: 100, width: 140, height: 24 });
    render(
      <Tooltip id="t" anchorEl={anchor} title="Friends" onClose={() => {}}>
        long text
      </Tooltip>,
    );
    const p = placed();
    expect(p.maxHeight).toBeUndefined();
    expect(p.left).toBeGreaterThanOrEqual(240); // right of the anchor, not over it
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.top + 500).toBeLessThanOrEqual(700 - 8);
  });

  it('widens so the text takes fewer lines instead of capping its height', () => {
    window.innerHeight = 700;
    window.innerWidth = 1200;
    // Rendered height shrinks as the allowed width grows (fewer wrapped lines).
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return parseFloat(this.style.maxWidth) || 300;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      const w = parseFloat(this.style.maxWidth) || 320;
      return w <= 320 ? 600 : 450;
    });
    // Full-width anchor: no room to either side, so only widening can help.
    const anchor = anchorAt({ top: 100, left: 0, width: 1200, height: 24 });
    render(
      <Tooltip id="t" anchorEl={anchor} title="x" onClose={() => {}}>
        text
      </Tooltip>,
    );
    const tip = screen.getByRole('tooltip');
    expect(tip.style.maxWidth).toBe('440px');
    expect(tip.style.maxHeight).toBe('');
    expect(parseFloat(tip.style.top)).toBeGreaterThanOrEqual(124); // below the anchor
  });

  it('is placed fully on screen, uncapped, when it fits nowhere beside the trigger', () => {
    window.innerHeight = 400;
    window.innerWidth = 1200;
    mockTooltipSize(300, 350);
    const anchor = anchorAt({ top: 200, left: 0, width: 1200, height: 24 });
    render(
      <Tooltip id="t" anchorEl={anchor} title="x" onClose={() => {}}>
        text
      </Tooltip>,
    );
    const tip = screen.getByRole('tooltip');
    const p = placed();
    expect(p.maxHeight).toBeUndefined();
    expect(tip.className).not.toContain(styles.scrollable);
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.top + 350).toBeLessThanOrEqual(400 - 8);
  });

  it('only scrolls (and takes the pointer) when taller than the whole screen', () => {
    window.innerHeight = 400;
    window.innerWidth = 1200;
    mockTooltipSize(300, 600);
    const anchor = anchorAt({ top: 200, left: 400, width: 100, height: 24 });
    render(
      <Tooltip id="t" anchorEl={anchor} title="x" onClose={() => {}}>
        text
      </Tooltip>,
    );
    const tip = screen.getByRole('tooltip');
    const p = placed();
    expect(tip.className).toContain(styles.compact);
    expect(tip.className).toContain(styles.scrollable);
    expect(p.maxHeight).toBe(384);
    expect(p.top).toBe(8);
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

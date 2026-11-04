import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CurrencyInput } from '../CurrencyInput';
import { CoinWeightBreakdownContent } from '../CoinWeightBreakdownContent';
import { EncumbranceBreakdownContent } from '../EncumbranceBreakdownContent';
import { ZERO_CURRENCY } from '../../../logic/currency';

describe('CurrencyInput', () => {
  it('parses a valid delta and calls onSubmit, then clears', () => {
    const onSubmit = vi.fn();
    render(<CurrencyInput onSubmit={onSubmit} />);
    const input = screen.getByLabelText('Currency adjustment') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '+2 GP -5 SP +10 CP' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onSubmit).toHaveBeenCalledWith({ pp: 0, gp: 2, ep: 0, sp: -5, cp: 10 });
    expect(input.value).toBe('');
  });

  it('shows an inline error and does not submit on invalid input', () => {
    const onSubmit = vi.fn();
    render(<CurrencyInput onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Currency adjustment'), {
      target: { value: 'nonsense' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('CoinWeightBreakdownContent', () => {
  it('renders the full zero-valued calculation (incl. every component) for an empty purse', () => {
    render(<CoinWeightBreakdownContent coins={ZERO_CURRENCY} />);
    // Empty-state message is additive context, not a replacement for the breakdown.
    expect(screen.getByText('No coins carried')).toBeInTheDocument();
    // calculated-totals: all five denomination rows, the sum, the ÷50 formula,
    // and the resulting weight must be present even when everything is zero.
    expect(screen.getByText('PP:')).toBeInTheDocument();
    expect(screen.getByText('GP:')).toBeInTheDocument();
    expect(screen.getByText('EP:')).toBeInTheDocument();
    expect(screen.getByText('SP:')).toBeInTheDocument();
    expect(screen.getByText('CP:')).toBeInTheDocument();
    expect(screen.getByText('Sum:')).toBeInTheDocument();
    // Five zero denominations + Sum: 0 → six "0" value cells.
    expect(screen.getAllByText('0')).toHaveLength(6);
    expect(screen.getByText(/÷ 50/)).toBeInTheDocument();
    expect(screen.getByText('0 lb')).toBeInTheDocument();
  });

  it('renders per-denomination rows, the ÷50 divider, and the weight', () => {
    render(<CoinWeightBreakdownContent coins={{ pp: 10, gp: 20, ep: 10, sp: 10, cp: 10 }} />);
    expect(screen.getByText('PP:')).toBeInTheDocument();
    expect(screen.getByText('CP:')).toBeInTheDocument();
    expect(screen.getByText(/÷ 50/)).toBeInTheDocument();
    // 60 coins → 1 lb.
    expect(screen.getByText('1 lb')).toBeInTheDocument();
  });
});

describe('EncumbranceBreakdownContent', () => {
  it('renders the Strength × multiplier rows and the capacity total', () => {
    render(
      <EncumbranceBreakdownContent
        strengthScore={14}
        multiplier={15}
        sizeLabel="Small/Medium"
        total={210}
      />,
    );
    expect(screen.getByText('Strength:')).toBeInTheDocument();
    expect(screen.getByText('× multiplier (Small/Medium):')).toBeInTheDocument();
    expect(screen.getByText('210 lb')).toBeInTheDocument();
    expect(screen.getByText(/Strength 14 × 15 \(Small\/Medium\) = 210 lb/)).toBeInTheDocument();
  });
});

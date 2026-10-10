import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CurrencyToggle } from '@/components/finance/currency-toggle';
import { CurrencySummary } from '@/components/finance/currency-summary';
import { barOpacity } from '@/components/finance/year-chart';

describe('CurrencyToggle', () => {
  it('is hidden with a single currency', () => {
    const { container } = render(<CurrencyToggle currencies={['KRW']} value="KRW" onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows KRW and IDR as radio chips', () => {
    render(<CurrencyToggle currencies={['KRW', 'IDR']} value="IDR" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /IDR/ })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('CurrencySummary', () => {
  const summary = { income: 3000000, expense: 7000, balance: 2993000, month: 10, year: 2026 };
  const cat = (name: string, type: 'INCOME' | 'EXPENSE', amount: number) =>
    ({ categoryId: name, categoryName: name, amount, percentage: 100, type, color: '#000' });

  it('shows income, expense, net and both category lists', () => {
    render(<CurrencySummary currency="KRW" monthLabel="October 2026" summary={summary}
      expenses={[cat('Food', 'EXPENSE', 7000)]} incomes={[cat('Salary', 'INCOME', 3000000)]} />);
    expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.getAllByText('+₩3,000,000', { selector: 'p' })).toHaveLength(2); // summary tile + Salary row
    expect(screen.getByText('₩2,993,000')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Salary')).toBeInTheDocument();
  });

  it('shows the empty message for a month with nothing', () => {
    render(<CurrencySummary currency="KRW" monthLabel="September 2026" summary={{ ...summary, income: 0, expense: 0, balance: 0 }} expenses={[]} incomes={[]} />);
    expect(screen.getByText('No transactions in September 2026')).toBeInTheDocument();
  });
});

describe('YearChart', () => {
  it('dims every month except the highlighted one', () => {
    expect(barOpacity(10, 10)).toBe(1);
    expect(barOpacity(3, 10)).toBeLessThan(1);
  });
});

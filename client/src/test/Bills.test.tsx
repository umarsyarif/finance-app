import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from '@/lib/axios';
import Bills from '@/pages/Bills';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('@/hooks/use-wallets', () => ({
  useWallets: () => ({ wallets: [{ id: 'w1', name: 'Cash', currency: 'KRW' }, { id: 'w2', name: 'BCA', currency: 'IDR' }] }),
}));
vi.mock('@/hooks/use-categories', () => ({
  useCategories: () => ({ categories: [{ id: 'c1', name: 'Bills', type: 'EXPENSE' }, { id: 'c2', name: 'Salary', type: 'INCOME' }] }),
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;

const bill = (o: object = {}) => ({
  id: 'b1', name: 'Rent', amount: 500000, currency: 'KRW', walletId: 'w1', categoryId: 'c1', dayOfMonth: 25,
  remindDaysBefore: 1, active: true, createdAt: '', wallet: { id: 'w1', name: 'Cash' }, category: { id: 'c1', name: 'Bills' }, ...o,
});
const serve = (bills: unknown[]) => vi.mocked(axios.get).mockResolvedValue({ data: { data: { bills } } });
const renderPage = () => render(<MemoryRouter><Bills /></MemoryRouter>);

describe('Bills page', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('lists bills with ordinals and reminder text', async () => {
    serve([bill(), bill({ id: 'b2', name: 'A', dayOfMonth: 1, remindDaysBefore: 0 }), bill({ id: 'b3', name: 'B', dayOfMonth: 2, remindDaysBefore: 3 }),
      bill({ id: 'b4', name: 'C', dayOfMonth: 3 }), bill({ id: 'b5', name: 'D', dayOfMonth: 22, active: false })]);
    renderPage();
    expect(await screen.findByText('Rent')).toBeInTheDocument();
    expect(screen.getAllByText('₩500,000').length).toBeGreaterThan(0);
    expect(screen.getByText('Every month on the 25th · remind 1 day before')).toBeInTheDocument();
    expect(screen.getByText('Every month on the 1st · remind on the due day')).toBeInTheDocument();
    expect(screen.getByText('Every month on the 2nd · remind 3 days before')).toBeInTheDocument();
    expect(screen.getByText('Every month on the 3rd · remind 1 day before')).toBeInTheDocument();
    expect(screen.getByText('Every month on the 22nd · remind 1 day before')).toBeInTheDocument();
    expect(screen.getAllByText('Cash').length).toBeGreaterThan(0);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('adds a bill', async () => {
    serve([]);
    vi.mocked(axios.post).mockResolvedValue({});
    renderPage();
    expect(await screen.findByText('No bills yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add bill/ }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Phone' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '55000' } });
    fireEvent.change(screen.getByLabelText('Wallet'), { target: { value: 'w1' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText('Day of month'), { target: { value: '3' } });
    expect(screen.getByText('Short months use the last day')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '1 day before' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/api/bills', {
      name: 'Phone', amount: 55000, currency: 'KRW', walletId: 'w1', categoryId: 'c1', dayOfMonth: 3, remindDaysBefore: 1, active: true,
    }));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  });

  it('edits and deletes', async () => {
    serve([bill()]);
    vi.mocked(axios.patch).mockResolvedValue({});
    vi.mocked(axios.delete).mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Rent' }));
    const amount = await screen.findByLabelText('Amount');
    expect(amount).toHaveValue(500000);
    fireEvent.change(amount, { target: { value: '510000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(axios.patch).toHaveBeenCalledWith('/api/bills/b1', expect.objectContaining({ amount: 510000 })));

    fireEvent.click(await screen.findByRole('button', { name: 'Rent' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    fireEvent.click((await screen.findAllByRole('button', { name: 'Delete' })).at(-1)!); // the confirmation's button
    await waitFor(() => expect(axios.delete).toHaveBeenCalledWith('/api/bills/b1'));
  });

  it('filters wallets by currency and clears a mismatched wallet', async () => {
    serve([bill()]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Rent' }));
    const wallet = (await screen.findByLabelText('Wallet')) as HTMLSelectElement;
    expect([...wallet.options].map((o) => o.text)).toEqual(['No wallet', 'Cash']);
    expect(wallet.value).toBe('w1');
    fireEvent.click(screen.getByRole('radio', { name: 'IDR' }));
    expect([...wallet.options].map((o) => o.text)).toEqual(['No wallet', 'BCA']);
    expect(wallet.value).toBe('');
  });

  it('shows a server error inline', async () => {
    serve([]);
    vi.mocked(axios.post).mockRejectedValue(Object.assign(new Error('x'), { isAxiosError: true, response: { data: { message: 'Name is taken' } } }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Add bill/ }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Phone' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is taken');
  });
});

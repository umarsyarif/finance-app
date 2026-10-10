import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from '@/lib/axios';
import { TransferForm } from '@/components/finance/transfer-form';

vi.mock('@/lib/axios', () => ({ default: { post: vi.fn(), patch: vi.fn(), get: vi.fn() } }));
vi.mock('@/hooks/use-wallets', () => ({
  useWallets: () => ({
    wallets: [
      { id: 'k1', name: 'Won bank', currency: 'KRW', isMain: true },
      { id: 'k2', name: 'Won cash', currency: 'KRW', isMain: false },
      { id: 'i1', name: 'Rupiah', currency: 'IDR', isMain: false },
    ],
    loading: false,
    error: null,
  }),
}));

const pick = async (label: string, option: string) => {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
};

describe('TransferForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('same currency: one amount field, posts amountSent only', async () => {
    const onSuccess = vi.fn();
    (axios.post as any).mockResolvedValue({ data: {} });
    render(<TransferForm defaultWalletId="k1" onSuccess={onSuccess} />);
    await pick('To wallet', 'Won cash');
    expect(screen.queryByLabelText(/Received/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save transfer' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(axios.post).toHaveBeenCalledWith('/api/transfers', expect.objectContaining({
      fromWalletId: 'k1', toWalletId: 'k2', amountSent: 50000, amountReceived: undefined,
    }));
  });

  it('ignores a stale default wallet and starts from the main wallet', () => {
    render(<TransferForm defaultWalletId="deleted" />);
    expect(screen.getByRole('combobox', { name: 'From wallet' })).toHaveTextContent('Won bank');
  });

  it('different currency: received field and rate line', async () => {
    render(<TransferForm defaultWalletId="k1" />);
    await pick('To wallet', 'Rupiah');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100000' } });
    fireEvent.change(screen.getByLabelText('Received (IDR)'), { target: { value: '1150000' } });
    expect(screen.getByText('1 KRW = 11.5 IDR')).toBeInTheDocument();
  });

  it('To list leaves out the From wallet, and picking From = To clears To', async () => {
    render(<TransferForm defaultWalletId="k1" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'To wallet' }));
    expect(screen.queryByRole('option', { name: 'Won bank' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('option', { name: 'Won cash' }));
    await pick('From wallet', 'Won cash');
    expect(screen.getByRole('combobox', { name: 'To wallet' })).toHaveTextContent('Choose');
  });

  it('offline: shows the message and sends nothing', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<TransferForm defaultWalletId="k1" />);
    await pick('To wallet', 'Won cash');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save transfer' }));
    expect(await screen.findByText('Transfers need a connection')).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });
});

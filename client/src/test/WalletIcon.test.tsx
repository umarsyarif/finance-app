import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WalletTile, WALLET_ICONS } from '@/components/finance/wallet-icon';
import { IconPicker } from '@/components/finance/category-icon';

describe('WalletTile', () => {
  it('fills with the wallet colour and draws an icon', () => {
    const { container } = render(<WalletTile icon="landmark" color="#EF4444" />);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile.style.backgroundColor).toBe('rgb(239, 68, 68)');
    expect(tile.querySelector('svg')).toBeInTheDocument();
  });

  it('falls back to the wallet icon for none or an unknown name', () => {
    const { container } = render(<WalletTile icon={null} color="#3B82F6" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    render(<WalletTile icon="nope" color="#3B82F6" />);
  });
});

describe('IconPicker with a custom set', () => {
  it('offers exactly the wallet icons', () => {
    const onChange = vi.fn();
    render(<IconPicker value={null} onChange={onChange} icons={WALLET_ICONS} />);
    expect(screen.getAllByRole('radio')).toHaveLength(12);
    fireEvent.click(screen.getByRole('radio', { name: 'piggy-bank' }));
    expect(onChange).toHaveBeenCalledWith('piggy-bank');
  });
});

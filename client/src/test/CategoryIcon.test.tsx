import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryIcon, IconPicker, CATEGORY_ICONS } from '@/components/finance/category-icon';

describe('CategoryIcon', () => {
  it('draws the named icon', () => {
    const { container } = render(<CategoryIcon icon="coffee" name="Coffee" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByText('C')).not.toBeInTheDocument();
  });

  it('falls back to the first letter without an icon or with an unknown one', () => {
    const { rerender } = render(<CategoryIcon icon={null} name="groceries" />);
    expect(screen.getByText('G')).toBeInTheDocument();
    rerender(<CategoryIcon icon="not-a-real-icon" name="Rent" />);
    expect(screen.getByText('R')).toBeInTheDocument();
  });
});

describe('IconPicker', () => {
  it('offers the curated icons and selects one', () => {
    const onChange = vi.fn();
    render(<IconPicker value={null} onChange={onChange} />);
    expect(screen.getAllByRole('radio')).toHaveLength(Object.keys(CATEGORY_ICONS).length);
    fireEvent.click(screen.getByRole('radio', { name: 'coffee' }));
    expect(onChange).toHaveBeenCalledWith('coffee');
  });

  it('tapping the selected icon clears it', () => {
    const onChange = vi.fn();
    render(<IconPicker value="coffee" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'coffee' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'coffee' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

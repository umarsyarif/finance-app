import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';

const setup = (props: Partial<React.ComponentProps<typeof ConfirmationModal>> = {}) => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ConfirmationModal isOpen onClose={onClose} onConfirm={onConfirm} title="Delete wallet?"
      description={'"Cash" will be removed.'} confirmText="Delete" {...props} />
  );
  return { onClose, onConfirm };
};

describe('ConfirmationModal', () => {
  it('shows the title and description, with Cancel left and the destructive action right', () => {
    setup();
    expect(screen.getByRole('alertdialog', { name: 'Delete wallet?' })).toHaveAccessibleDescription('"Cash" will be removed.');
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Cancel', 'Delete']);
    expect(buttons[1].className).toContain('bg-expense');
  });

  it('confirms and cancels', async () => {
    const { onClose, onConfirm } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('has no corner close button', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('disables both buttons and keeps the label while working', () => {
    setup({ isLoading: true, confirmText: 'Revoke' });
    expect(screen.getByRole('button', { name: /Revoke/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DateTimePicker } from '@/components/ui/datetime-picker';

// Mock the UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, className, ...props }: any) => (
    <button 
      data-testid="datetime-picker-button" 
      data-variant={variant}
      className={className}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverContent: ({ children, className }: any) => (
    <div data-testid="popover-content" className={className}>{children}</div>
  ),
  PopoverTrigger: ({ children }: any) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ selected, onSelect, mode, ...props }: any) => (
    <div data-testid="calendar" {...props}>
      <button
        data-testid="calendar-date-button"
        onClick={() => onSelect && onSelect(new Date('2024-01-15T10:30:00'))}
      >
        Select Date
      </button>
      {selected && (
        <div data-testid="selected-date">
          {selected.toISOString()}
        </div>
      )}
    </div>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, type, ...props }: any) => (
    <input
      data-testid="time-input"
      type={type}
      value={value}
      onChange={onChange}
      {...props}
    />
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

const mockOnSelect = vi.fn();

describe('DateTimePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<DateTimePicker />);
    expect(screen.getByTestId('datetime-picker-button')).toBeInTheDocument();
  });

  it('displays placeholder when no date is selected', () => {
    render(<DateTimePicker placeholder="Pick a date & time" />);
    expect(screen.getByText('Pick a date & time')).toBeInTheDocument();
  });

  it('displays formatted date and time when date is provided', () => {
    const testDate = new Date('2024-01-15T14:30:00');
    render(<DateTimePicker date={testDate} />);
    
    // Should display the formatted date and time (PPP format with time)
    // The exact format depends on date-fns PPP format
    expect(screen.getByTestId('datetime-picker-button')).toBeInTheDocument();
    // We'll check that the button contains some representation of the date
    const button = screen.getByTestId('datetime-picker-button');
    expect(button.textContent).toContain('2024');
  });

  it('calls onSelect when date is selected from calendar', async () => {
    render(<DateTimePicker onSelect={mockOnSelect} />);
    
    // Click the calendar date button
    const calendarButton = screen.getByTestId('calendar-date-button');
    fireEvent.click(calendarButton);
    
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalled();
    });
  });

  it('calls onSelect when time is changed', async () => {
    const testDate = new Date('2024-01-15T14:30:00');
    render(<DateTimePicker date={testDate} onSelect={mockOnSelect} />);
    
    // Change the time input
    const timeInput = screen.getByTestId('time-input');
    fireEvent.change(timeInput, { target: { value: '16:45' } });
    
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalled();
      // Verify the new date has the updated time
      const calledDate = mockOnSelect.mock.calls[0][0];
      expect(calledDate.getHours()).toBe(16);
      expect(calledDate.getMinutes()).toBe(45);
    });
  });

  it('handles invalid time input gracefully', async () => {
    const testDate = new Date('2024-01-15T14:30:00');
    render(<DateTimePicker date={testDate} onSelect={mockOnSelect} />);
    
    // Enter invalid time
    const timeInput = screen.getByTestId('time-input');
    fireEvent.change(timeInput, { target: { value: '25:70' } });
    
    // Should not call onSelect for invalid time
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    render(<DateTimePicker disabled={true} />);
    
    const button = screen.getByTestId('datetime-picker-button');
    expect(button).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<DateTimePicker className="custom-class" />);
    
    const button = screen.getByTestId('datetime-picker-button');
    expect(button).toHaveClass('custom-class');
  });

  it('preserves date when only time is changed', async () => {
    const testDate = new Date('2024-01-15T14:30:00');
    render(<DateTimePicker date={testDate} onSelect={mockOnSelect} />);
    
    // Change only the time
    const timeInput = screen.getByTestId('time-input');
    fireEvent.change(timeInput, { target: { value: '09:15' } });
    
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalled();
      const calledDate = mockOnSelect.mock.calls[0][0];
      // Date should remain the same
      expect(calledDate.getFullYear()).toBe(2024);
      expect(calledDate.getMonth()).toBe(0); // January
      expect(calledDate.getDate()).toBe(15);
      // Time should be updated
      expect(calledDate.getHours()).toBe(9);
      expect(calledDate.getMinutes()).toBe(15);
    });
  });

  it('preserves time when only date is changed', async () => {
    const testDate = new Date('2024-01-15T14:30:00');
    render(<DateTimePicker date={testDate} onSelect={mockOnSelect} />);
    
    // Click calendar to change date
    const calendarButton = screen.getByTestId('calendar-date-button');
    fireEvent.click(calendarButton);
    
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalled();
      const calledDate = mockOnSelect.mock.calls[0][0];
      // Time should be preserved from the original date
      expect(calledDate.getHours()).toBe(14);
      expect(calledDate.getMinutes()).toBe(30);
    });
  });
});
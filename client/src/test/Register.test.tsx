import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Register from '../pages/Register';
import { useAuth } from '@/contexts/auth.context';

// Mock the useAuth hook
vi.mock('@/contexts/auth.context');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: any) => <p data-testid="card-description">{children}</p>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h1 data-testid="card-title">{children}</h1>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid={`input-${props.name}`} {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => (
    <button data-testid="submit-button" {...props}>{children}</button>
  ),
}));

vi.mock('@/components/app-logo', () => ({
  AppLogo: () => <div data-testid="app-logo">Finance App</div>,
}));

const mockUseAuth = vi.mocked(useAuth);
const mockRegister = vi.fn();


const renderRegister = () => {
  return render(
    <BrowserRouter>
      <Register />
    </BrowserRouter>
  );
};

describe('Register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      login: vi.fn(),
      register: mockRegister,
      logout: vi.fn(),
      user: null,
      isAuthenticated: false,
      biometricEnabled: false,
      biometricSupported: false,
      enableBiometric: vi.fn(),
      disableBiometric: vi.fn(),
      biometricLogin: vi.fn().mockResolvedValue({ success: false }),
      refreshUser: vi.fn(),
    });
  });

  it('renders register form with all required fields', () => {
    renderRegister();

    expect(screen.getByTestId('card-title')).toHaveTextContent('Create an account');
    expect(screen.getByTestId('card-description')).toHaveTextContent(
      'Enter your details to create your account'
    );
    expect(screen.getByTestId('input-name')).toBeInTheDocument();
    expect(screen.getByTestId('input-email')).toBeInTheDocument();
    expect(screen.getByTestId('input-password')).toBeInTheDocument();
    expect(screen.getByTestId('input-passwordConfirm')).toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    expect(screen.getByTestId('app-logo')).toBeInTheDocument();
  });

  it('updates form fields when user types', () => {
    renderRegister();

    const nameInput = screen.getByTestId('input-name') as HTMLInputElement;
    const emailInput = screen.getByTestId('input-email') as HTMLInputElement;
    const passwordInput = screen.getByTestId('input-password') as HTMLInputElement;
    const confirmPasswordInput = screen.getByTestId('input-passwordConfirm') as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

    expect(nameInput.value).toBe('John Doe');
    expect(emailInput.value).toBe('john@example.com');
    expect(passwordInput.value).toBe('password123');
    expect(confirmPasswordInput.value).toBe('password123');
  });

  it('calls register function when form is submitted with valid data', async () => {
    renderRegister();

    const nameInput = screen.getByTestId('input-name');
    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const confirmPasswordInput = screen.getByTestId('input-passwordConfirm');
    const submitButton = screen.getByTestId('submit-button');

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'John Doe',
        'john@example.com',
        'password123',
        'password123'
      );
    });
  });

  it('displays error message when registration fails', async () => {
    mockRegister.mockRejectedValueOnce(new Error('Email already exists'));
    renderRegister();

    const nameInput = screen.getByTestId('input-name');
    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const confirmPasswordInput = screen.getByTestId('input-passwordConfirm');
    const submitButton = screen.getByTestId('submit-button');

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });
  });

  it('shows loading state during registration process', async () => {
    mockRegister.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    renderRegister();

    const nameInput = screen.getByTestId('input-name');
    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const confirmPasswordInput = screen.getByTestId('input-passwordConfirm');
    const submitButton = screen.getByTestId('submit-button');

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Creating account...')).toBeInTheDocument();

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('has link to login page', () => {
    renderRegister();

    const loginLink = screen.getByRole('link', { name: /sign in/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('validates required fields', () => {
    renderRegister();

    const nameInput = screen.getByTestId('input-name');
    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const confirmPasswordInput = screen.getByTestId('input-passwordConfirm');

    expect(nameInput).toHaveAttribute('required');
    expect(emailInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('required');
    expect(confirmPasswordInput).toHaveAttribute('required');
  });

  it('has correct input types', () => {
    renderRegister();

    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const confirmPasswordInput = screen.getByTestId('input-passwordConfirm');

    expect(emailInput).toHaveAttribute('type', 'email');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
  });
});
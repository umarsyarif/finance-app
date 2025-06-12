import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { getCurrentDate, getCurrentMonth, getCurrentYear, formatDateToLocaleString } from '../lib/date-utils'
import { MonthlyTransactionsView } from '../pages/Transactions'
import { useTransactions } from '@/hooks/use-transactions'

// Mock the useTransactions hook
vi.mock('@/hooks/use-transactions')

// Mock the transaction details modal
vi.mock('@/components/finance/transaction-details-modal', () => ({
  TransactionDetailsModal: ({ isOpen }: { isOpen: boolean; onClose: () => void }) => 
    isOpen ? <div data-testid="transaction-modal">Transaction Modal</div> : null
}))

const mockUseTransactions = vi.mocked(useTransactions)

const mockTransactions = [
  {
    id: '1',
    title: 'Test Transaction 1',
    description: 'Test Transaction 1',
    amount: 1000,
    date: '2024-05-15T10:00:00Z',
    type: 'EXPENSE' as const,
    walletId: 'wallet1',
    categoryId: 'cat1',
    wallet: { id: 'wallet1', name: 'Test Wallet', currency: 'USD' },
    category: { id: 'cat1', name: 'Test Category' }
  },
  {
    id: '2',
    title: 'Test Transaction 2',
    description: 'Test Transaction 2',
    amount: 2000,
    date: '2024-05-20T14:00:00Z',
    type: 'INCOME' as const,
    walletId: 'wallet1',
    categoryId: 'cat2',
    wallet: { id: 'wallet1', name: 'Test Wallet', currency: 'USD' },
    category: { id: 'cat2', name: 'Test Category 2' }
  }
]

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <MonthlyTransactionsView />
    </BrowserRouter>
  )
}

describe('MonthlyTransactionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTransactions.mockReturnValue({
      transactions: mockTransactions,
      loading: false,
      error: null,
      refetch: vi.fn(),
      totalCount: 2,
      hasMore: false
    })
  })

  it('renders the component with transactions', () => {
    renderComponent()
    
    // Check that transactions are rendered (they should be clickable elements)
    expect(screen.getByText('Test Transaction 1')).toBeInTheDocument()
    expect(screen.getByText('Test Transaction 2')).toBeInTheDocument()
    
    // Check that the transaction amounts are displayed in USD format
    expect(screen.getByText('-$1,000.00')).toBeInTheDocument()
    expect(screen.getByText('+$2,000.00')).toBeInTheDocument()
  })

  it('displays current month and year', () => {
    renderComponent()
    
    const currentDate = getCurrentDate()
    const expectedText = formatDateToLocaleString(currentDate, 'en-US', {
      month: 'long',
      year: 'numeric'
    })
    
    expect(screen.getByText(expectedText)).toBeInTheDocument()
  })

  it('calls useTransactions with correct month and year parameters', () => {
    renderComponent()
    
    const expectedMonth = getCurrentMonth()
    const expectedYear = getCurrentYear()
    
    expect(mockUseTransactions).toHaveBeenCalledWith({
      month: expectedMonth,
      year: expectedYear,
      limit: 100
    })
  })

  it('updates month when navigation buttons are clicked', async () => {
    renderComponent()
    
    // Find navigation buttons - there should be 2 buttons for prev/next
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    
    // Click the next month button (second button)
    const nextButton = buttons[1]
    fireEvent.click(nextButton)
    
    await waitFor(() => {
      // Should be called twice - once for initial render, once for next month
      expect(mockUseTransactions).toHaveBeenCalledTimes(2)
    })
  })

  it('opens transaction modal when transaction is clicked', async () => {
    renderComponent()
    
    const transactionItem = screen.getByText('Test Transaction 1')
    fireEvent.click(transactionItem)
    
    await waitFor(() => {
      expect(screen.getByTestId('transaction-modal')).toBeInTheDocument()
    })
  })

  it('displays loading state', () => {
    mockUseTransactions.mockReturnValue({
      transactions: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
      totalCount: 0,
      hasMore: false
    })
    
    renderComponent()
    
    // Check for the spinner element
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('displays error state', () => {
    mockUseTransactions.mockReturnValue({
      transactions: [],
      loading: false,
      error: 'Failed to fetch transactions',
      refetch: vi.fn(),
      totalCount: 0,
      hasMore: false
    })
    
    renderComponent()
    
    expect(screen.getByText('Failed to fetch transactions')).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
  })

  it('displays empty state when no transactions', () => {
    mockUseTransactions.mockReturnValue({
      transactions: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
      totalCount: 0,
      hasMore: false
    })
    
    renderComponent()
    
    expect(screen.getByText('No transactions for this month')).toBeInTheDocument()
  })
})
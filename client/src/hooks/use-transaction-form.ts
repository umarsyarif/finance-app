import { useState, useEffect } from 'react';
import { formatDateForInput, convertFormDateToISO } from '@/lib/date-utils';
import { useWallets } from './use-wallets';
import { useCategories } from './use-categories';
import { Transaction } from '../components/finance/transactions-list';
import axios from '@/lib/axios';

type TransactionType = 'INCOME' | 'EXPENSE';

interface UseTransactionFormProps {
  type?: TransactionType;
  transaction?: Transaction;
  onSuccess?: () => void;
  defaultWalletId?: string;
}

interface TransactionFormData {
  description: string;
  amount: string;
  date: string;
  walletId: string;
  categoryId: string;
}

export function useTransactionForm({ type, transaction, onSuccess, defaultWalletId }: UseTransactionFormProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    description: '',
    amount: '',
    date: new Date().toISOString(), // Set current date/time as default
    walletId: '',
    categoryId: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const { wallets, loading: loadingWallets, error: walletsError } = useWallets();
  const { categories, loading: loadingCategories, error: categoriesError, refetch: refetchCategories } = useCategories();

  // Filter categories based on transaction type
  const filteredCategories = type 
    ? categories.filter(category => category.type === type)
    : categories;

  // Populate form with transaction data for editing
  useEffect(() => {
    if (transaction) {
      // Handle missing or invalid dates by falling back to current date
      let dateValue = new Date().toISOString();
      if (transaction.date) {
        const parsedDate = new Date(transaction.date);
        if (!isNaN(parsedDate.getTime())) {
          dateValue = transaction.date; // Use the original ISO string if valid
        }
      }
      
      setFormData({
        description: transaction.title || transaction.description || '',
        amount: transaction.amount.toString() || '',
        walletId: transaction.walletId || '',
        categoryId: transaction.categoryId || '',
        date: dateValue,
      });
    }
  }, [transaction]);

  // Set default wallet when provided and not editing
  useEffect(() => {
    if (defaultWalletId && !transaction) {
      setFormData(prev => ({ ...prev, walletId: defaultWalletId }));
    }
  }, [defaultWalletId, transaction]);



  const updateField = (field: keyof TransactionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      date: new Date().toISOString(), // Set current date/time as default
      walletId: '',
      categoryId: '',
    });
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const validateForm = (): boolean => {
    if (!formData.description.trim()) {
      setSubmitError('Description is required');
      return false;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setSubmitError('Valid amount is required');
      return false;
    }
    if (!formData.date) {
      setSubmitError('Date is required');
      return false;
    }
    if (!formData.walletId) {
      setSubmitError('Wallet is required');
      return false;
    }
    if (!formData.categoryId) {
      setSubmitError('Category is required');
      return false;
    }
    return true;
  };

  const submitForm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const transactionData = {
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: formData.date, // Already in ISO format from datetime picker
        walletId: formData.walletId,
        categoryId: formData.categoryId,
      };

      if (transaction) {
        // Update existing transaction
        await axios.patch(`/api/transactions/${transaction.id}`, transactionData);
      } else {
        // Create new transaction
        await axios.post('/api/transactions', transactionData);
      }

      setSubmitSuccess(true);
      onSuccess?.();

      // Reset form for new transactions
      if (!transaction) {
        resetForm();
      }

    } catch (err: any) {
      console.error('Failed to submit transaction:', err);
      setSubmitError(err.response?.data?.message || 'Failed to submit transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    updateField,
    resetForm,
    submitForm,
    isSubmitting,
    submitError,
    submitSuccess,
    wallets,
    categories: filteredCategories,
    loadingWallets,
    loadingCategories,
    walletsError,
    categoriesError,
    refetchCategories,
  };
}
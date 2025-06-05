import { useState, useEffect } from 'react';
import { useWallets } from './use-wallets';
import { useCategories } from './use-categories';
import { Transaction } from '../components/finance/transaction-item';
import axios from '../lib/axios';

type TransactionType = 'income' | 'expense';

interface UseTransactionFormProps {
  type?: TransactionType;
  transaction?: Transaction;
  onSuccess?: () => void;
}

interface TransactionFormData {
  description: string;
  amount: string;
  date: string;
  walletId: string;
  categoryId: string;
}

export function useTransactionForm({ type, transaction, onSuccess }: UseTransactionFormProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    description: '',
    amount: '',
    date: '',
    walletId: '',
    categoryId: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const { wallets, loading: loadingWallets, error: walletsError } = useWallets();
  const { categories, loading: loadingCategories, error: categoriesError } = useCategories();

  // Filter categories based on transaction type
  const filteredCategories = type 
    ? categories.filter(category => category.type === type)
    : categories;

  // Populate form with transaction data for editing
  useEffect(() => {
    if (transaction) {
      setFormData({
        description: transaction.title || transaction.description || '',
        amount: transaction.amount.toString() || '',
        walletId: transaction.walletId || '',
        categoryId: transaction.categoryId || '',
        date: formatDateForInput(transaction.date),
      });
    }
  }, [transaction]);

  const formatDateForInput = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 16);
      }
    } catch (error) {
      console.error('Error formatting date:', error);
    }
    // Fallback to current date
    return new Date().toISOString().slice(0, 16);
  };

  const updateField = (field: keyof TransactionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      date: '',
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

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        date: new Date(formData.date).toISOString(),
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
  };
}
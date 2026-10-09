import { useState, useEffect } from 'react';

import { useWallets } from './use-wallets';
import { useCategories } from './use-categories';
import { Transaction } from '../components/finance/transactions-list';
import axios from '@/lib/axios';
import { toast } from 'sonner';
import { queuePendingChange } from './use-offline';

type TransactionType = 'INCOME' | 'EXPENSE';

interface UseTransactionFormProps {
  type?: TransactionType;
  transaction?: Transaction;
  onSuccess?: () => void;
  defaultWalletId?: string;
}

interface TransactionFormData {
  title: string;
  description: string;
  amount: string;
  date: string;
  walletId: string;
  categoryId: string;
}

export function useTransactionForm({ type, transaction, onSuccess, defaultWalletId }: UseTransactionFormProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    title: '',
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
        title: transaction.title || '',
        description: transaction.description || '',
        amount: transaction.amount.toString() || '',
        walletId: transaction.walletId || '',
        categoryId: transaction.categoryId || '',
        date: dateValue,
      });
    }
  }, [transaction]);

  // New transactions start on the given wallet, else the main wallet, else the first one
  useEffect(() => {
    if (transaction) return;
    const fallback = wallets.find(w => w.isMain) ?? wallets[0];
    const walletId = defaultWalletId ?? fallback?.id;
    if (walletId) {
      setFormData(prev => (prev.walletId ? prev : { ...prev, walletId }));
    }
  }, [defaultWalletId, transaction, wallets]);



  const updateField = (field: keyof TransactionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      title: '',
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
        title: formData.title,
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: formData.date, // Already in ISO format from datetime picker
        walletId: formData.walletId,
        categoryId: formData.categoryId,
      };

      if (!transaction && !navigator.onLine) {
        // Offline: queue the create and sync it when the connection returns
        queuePendingChange({ type: 'CREATE_TRANSACTION', payload: transactionData });
        toast.info('Saved offline. It will sync when you are back online.');
      } else if (transaction) {
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
import React from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useTransactionForm } from '../../hooks/use-transaction-form';
import { Transaction } from './transactions-list';

type TransactionType = 'income' | 'expense';

interface TransactionFormProps {
  type?: TransactionType;
  transaction?: Transaction;
  onSuccess?: () => void;
  submitButtonText?: string;
}

export function TransactionForm({ 
  type, 
  transaction, 
  onSuccess, 
  submitButtonText = 'Submit' 
}: TransactionFormProps) {
  const {
    formData,
    updateField,
    submitForm,
    isSubmitting,
    submitError,
    submitSuccess,
    wallets,
    categories,
    loadingWallets,
    loadingCategories,
    walletsError,
    categoriesError,
  } = useTransactionForm({ type, transaction, onSuccess });

  if (loadingWallets || loadingCategories) {
    return (
      <Card className="p-6">
        <div className="text-center">Loading...</div>
      </Card>
    );
  }

  if (walletsError || categoriesError) {
    return (
      <Card className="p-6">
        <div className="text-center text-pastel-red">
          Error loading data: {walletsError || categoriesError}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={submitForm} className="space-y-4">
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <input
            type="text"
            id="description"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter description"
            required
          />
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
            Amount
          </label>
          <input
            type="number"
            id="amount"
            value={formData.amount}
            onChange={(e) => updateField('amount', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
            step="0.01"
            min="0"
            required
          />
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            type="datetime-local"
            id="date"
            value={formData.date}
            onChange={(e) => updateField('date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="wallet" className="block text-sm font-medium text-gray-700 mb-1">
            Wallet
          </label>
          <select
            id="wallet"
            value={formData.walletId}
            onChange={(e) => updateField('walletId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select a wallet</option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="category"
            value={formData.categoryId}
            onChange={(e) => updateField('categoryId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {submitError && (
          <div className="text-pastel-red text-sm">
            {submitError}
          </div>
        )}

        {submitSuccess && (
          <div className="text-pastel-green-dark text-sm">
            {transaction ? 'Transaction updated successfully!' : 'Transaction added successfully!'}
          </div>
        )}

        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? 'Submitting...' : submitButtonText}
        </Button>
      </form>
    </Card>
  );
}
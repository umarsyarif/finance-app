import React from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Combobox } from '../ui/combobox';
import { DatePicker } from '../ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';
import { useTransactionForm } from '../../hooks/use-transaction-form';
import { Transaction } from './transactions-list';
import axios from '@/lib/axios';
import { format } from 'date-fns';

type TransactionType = 'INCOME' | 'EXPENSE';

interface TransactionFormProps {
  type?: TransactionType;
  transaction?: Transaction;
  onSuccess?: () => void;
  submitButtonText?: string;
  defaultWalletId?: string;
}

export function TransactionForm({ 
  type, 
  transaction, 
  onSuccess, 
  submitButtonText = 'Add Transaction',
  defaultWalletId
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
    refetchCategories,
  } = useTransactionForm({ type, transaction, onSuccess, defaultWalletId });

  // Generate random color for new categories
  const generateRandomColor = () => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Handle creating new category
  const handleCreateCategory = async (name: string) => {
    try {
      const color = generateRandomColor();
      const response = await axios.post('/api/categories', {
        name,
        type: type || 'EXPENSE',
        color
      });
      
      // Refetch categories to update the list
      if (refetchCategories) {
        await refetchCategories();
      }
      
      // Set the newly created category as selected
      updateField('categoryId', response.data.id);
      
      return response.data.id;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  };

  // Filter categories based on transaction type
  const filteredCategories = categories.filter(category => 
    !type || category.type === type
  );

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

        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <DatePicker
            date={formData.date ? new Date(formData.date) : undefined}
            onSelect={(date) => updateField('date', date ? format(date, "yyyy-MM-dd'T'HH:mm") : '')}
            placeholder="Select transaction date"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wallet">Wallet</Label>
          <Select
            value={formData.walletId}
            onValueChange={(value) => updateField('walletId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a wallet" />
            </SelectTrigger>
            <SelectContent>
              {wallets.map((wallet) => (
                <SelectItem key={wallet.id} value={wallet.id}>
                  {wallet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <Combobox
            id="category"
            value={formData.categoryId}
            onValueChange={(value) => updateField('categoryId', value)}
            placeholder="Select or create a category"
            searchPlaceholder="Search categories..."
            emptyText="No categories found."
            options={filteredCategories.map((category) => ({
              value: category.id,
              label: category.name,
              color: category.color
            }))}
            onCreateNew={handleCreateCategory}
          />
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
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Edit, Trash2, Calendar, Wallet, Tag } from 'lucide-react';
import { EditTransactionSheet } from './edit-transaction-sheet';
import { ConfirmationModal } from '../ui/confirmation-modal';
import { Transaction } from './transactions-list';
import axios from '@/lib/axios';
import { formatAmount, formatDate } from '../../lib/format-utils';
// Using console.log instead of toast since sonner is not installed

interface TransactionDetailsModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}

export function TransactionDetailsModal({
  transaction,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: TransactionDetailsModalProps) {
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!transaction) return null;

  const handleEdit = () => {
    setIsEditSheetOpen(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await axios.delete(`/api/transactions/${transaction.id}`);
      console.log('Transaction deleted successfully');
      onDelete();
      setIsDeleteModalOpen(false);
      onClose();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setIsEditSheetOpen(false);
    onUpdate();
  };


  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-semibold">
              Transaction Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Category Badge */}
            <div className="flex justify-end">
              <Badge 
                className={`px-3 py-1 text-sm font-medium ${
                  transaction.type === 'INCOME' 
                    ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' 
                    : 'bg-orange-100 text-orange-800 hover:bg-orange-100'
                }`}
              >
                {transaction.category?.name}
              </Badge>
            </div>

            {/* Amount */}
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {formatAmount(transaction.amount, transaction.type)}
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm">{transaction.description}</span>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">💳</span>
                </div>
                <span className="text-sm font-medium text-blue-800">
                  메모 결제를 떠미다 직접
                </span>
                <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                  확인
                </Badge>
              </div>
            </div>

            {/* Details List */}
            <div className="space-y-4">

              <div className="flex justify-between">
                <span className="text-gray-600">Transaction Type</span>
                <span className="font-medium">{transaction.type}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Transaction Date</span>
                <span className="font-medium">{formatDate(transaction.date)}</span>
              </div>

              <Separator />

              <div className="flex justify-between">
                <span className="text-gray-600">Wallet</span>
                <span className="font-medium">{transaction.wallet?.name}</span>
              </div>

            </div>


            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleEdit}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Sheet */}
      <EditTransactionSheet
        transaction={transaction}
        isOpen={isEditSheetOpen}
        onClose={() => setIsEditSheetOpen(false)}
        onTransactionChange={handleEditSuccess}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Transaction"
        description={`Are you sure you want to delete "${transaction.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
      />
    </>
  );
}
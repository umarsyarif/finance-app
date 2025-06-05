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
import { Transaction } from './transaction-item';
import axios from '../../lib/axios';
import { formatDateDetailed, formatAmount } from '../../lib/format-utils';
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Transaction Details</span>
              {/* <Badge 
                variant="outline"
                className={transaction.type === 'income' 
                  ? 'bg-pastel-green text-pastel-green-dark border-pastel-green-dark' 
                  : 'bg-pastel-red text-red-800 border-red-300'
                }
              >
                {transaction.type}
              </Badge> */}
            </DialogTitle>
            <DialogDescription>
              View and manage your transaction information
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Title and Description */}
            <div>
              <h3 className="text-lg font-semibold">{transaction.title}</h3>
              {transaction.type && (
                <p className="text-sm text-muted-foreground mt-1 mb-2">
                  {transaction.type}
                </p>
              )}
              {transaction.category && (
                <Badge 
                  variant="outline"
                  className={transaction.type === 'income' 
                    ? 'bg-pastel-green text-pastel-green-dark border-pastel-green-dark' 
                    : 'bg-pastel-red text-red-800 border-red-300'
                  }
                >
                  {transaction.category.name}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Amount */}
            <div className="text-center">
              <p className="text-2xl font-bold">
                <span className={transaction.type === 'income' ? 'text-pastel-green-dark' : 'text-pastel-red'}>
                  {formatAmount(transaction.amount, transaction.type)}
                </span>
              </p>
            </div>

            <Separator />

            {/* Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{formatDateDetailed(transaction.date)}</span>
              </div>
              
              {transaction.wallet && (
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{transaction.wallet.name}</span>
                </div>
              )}

            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleEdit}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
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
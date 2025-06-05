import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Middleware to automatically update wallet balance when transactions are modified
prisma.$use(async (params, next) => {
  // Only handle Transaction model operations
  if (params.model === 'Transaction') {
    // Store original transaction data before modification for update/delete operations
  let originalTransaction: any = null;
  
  if (params.action === 'update' || params.action === 'delete') {
    const whereClause = (params as any).args?.where;
    
    if (whereClause) {
      try {
        originalTransaction = await prisma.transaction.findUnique({
          where: whereClause,
          include: {
            category: true,
            wallet: true
          }
        });
      } catch (error) {
        console.error('Error fetching original transaction:', error);
      }
    }
  }

  // Execute the original operation
  const result = await next(params);

  // Handle different operations
  if (params.action === 'create') {
    await updateWalletBalanceOnCreate(result);
  } else if (params.action === 'update') {
    await updateWalletBalanceOnUpdate(originalTransaction, result);
  } else if (params.action === 'delete') {
    await updateWalletBalanceOnDelete(originalTransaction);
  }

    return result;
  }

  return next(params);
});

// Helper function to update wallet balance when a transaction is created
async function updateWalletBalanceOnCreate(transaction: any) {
  const { walletId, amount, categoryId } = transaction;
  
  // Get the category type to determine if it's income or expense
  const categoryData = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { type: true }
  });

  if (!categoryData) return;

  // Calculate balance change based on category type
  const balanceChange = categoryData.type === 'income' ? amount : -amount;

  // Update wallet balance
  await prisma.wallet.update({
    where: { id: walletId },
    data: {
      balance: {
        increment: balanceChange
      }
    }
  });
}

// Helper function to update wallet balance when a transaction is updated
async function updateWalletBalanceOnUpdate(originalTransaction: any, updatedTransaction: any) {
  if (!originalTransaction) {
    return;
  }

  // Get the updated category if it changed
  const updatedCategory = await prisma.category.findUnique({
    where: { id: updatedTransaction.categoryId },
    select: { type: true }
  });

  if (!updatedCategory) {
    return;
  }

  // Calculate the original balance change
  const originalBalanceChange = originalTransaction.category.type === 'income' 
    ? originalTransaction.amount 
    : -originalTransaction.amount;

  // Calculate the new balance change
  const newBalanceChange = updatedCategory.type === 'income' 
    ? updatedTransaction.amount 
    : -updatedTransaction.amount;

  // Handle wallet change if the transaction was moved to a different wallet
  if (originalTransaction.walletId !== updatedTransaction.walletId) {
    // Revert the original transaction from the old wallet
    await prisma.wallet.update({
      where: { id: originalTransaction.walletId },
      data: {
        balance: {
          increment: -originalBalanceChange
        }
      }
    });

    // Apply the new transaction to the new wallet
    await prisma.wallet.update({
      where: { id: updatedTransaction.walletId },
      data: {
        balance: {
          increment: newBalanceChange
        }
      }
    });
  } else {
    // Same wallet, calculate the net difference
    const balanceDifference = newBalanceChange - originalBalanceChange;
    
    if (balanceDifference !== 0) {
      await prisma.wallet.update({
        where: { id: updatedTransaction.walletId },
        data: {
          balance: {
            increment: balanceDifference
          }
        }
      });
    }
  }
}

// Helper function to update wallet balance when a transaction is deleted
async function updateWalletBalanceOnDelete(originalTransaction: any) {
  if (!originalTransaction) return;
  
  const { walletId, amount, category } = originalTransaction;

  // Calculate the balance change to revert (opposite of what was applied)
  const balanceChange = category.type === 'income' ? -amount : amount;

  // Update wallet balance
  await prisma.wallet.update({
    where: { id: walletId },
    data: {
      balance: {
        increment: balanceChange
      }
    }
  });
}

export default prisma;
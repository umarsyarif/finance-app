import { useState } from 'react';
import { PageHeader, PageHeaderHeading } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Wallet as WalletIcon } from 'lucide-react';
import { useWallets } from '@/hooks/use-wallets';
import { useCategories } from '@/hooks/use-categories';
import { WalletForm } from '@/components/finance/wallet-form';
import { CategoryForm } from '@/components/finance/category-form';
import { formatAmount } from '@/lib/format-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import axios from '@/lib/axios';
import { toast } from 'sonner';

export function Wallets() {
  const { wallets, loading: walletsLoading, error: walletsError, refetch: refetchWallets } = useWallets();
  const { categories, loading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useCategories();
  
  const [editingWallet, setEditingWallet] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [isWalletDialogOpen, setIsWalletDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [deleteWalletId, setDeleteWalletId] = useState<string | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  const handleWalletSuccess = () => {
    setIsWalletDialogOpen(false);
    setEditingWallet(null);
    refetchWallets();
    toast.success(editingWallet ? 'Wallet updated successfully' : 'Wallet created successfully');
  };

  const handleCategorySuccess = () => {
    setIsCategoryDialogOpen(false);
    setEditingCategory(null);
    refetchCategories();
    toast.success(editingCategory ? 'Category updated successfully' : 'Category created successfully');
  };

  const handleDeleteWallet = async (walletId: string) => {
    try {
      await axios.delete(`/api/wallets/${walletId}`);
      refetchWallets();
      toast.success('Wallet deleted successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete wallet');
    }
    setDeleteWalletId(null);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await axios.delete(`/api/categories/${categoryId}`);
      refetchCategories();
      toast.success('Category deleted successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete category');
    }
    setDeleteCategoryId(null);
  };

  const openEditWallet = (wallet: any) => {
    setEditingWallet(wallet);
    setIsWalletDialogOpen(true);
  };

  const openEditCategory = (category: any) => {
    setEditingCategory(category);
    setIsCategoryDialogOpen(true);
  };

  const openCreateWallet = () => {
    setEditingWallet(null);
    setIsWalletDialogOpen(true);
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setIsCategoryDialogOpen(true);
  };

  if (walletsLoading || categoriesLoading) {
    return (
      <>
        <PageHeader>
          <PageHeaderHeading>Wallets</PageHeaderHeading>
        </PageHeader>
        <div className="text-center py-8">Loading...</div>
      </>
    );
  }

  if (walletsError || categoriesError) {
    return (
      <>
        <PageHeader>
          <PageHeaderHeading>Wallets</PageHeaderHeading>
        </PageHeader>
        <div className="text-center py-8 text-red-500">
          Error: {walletsError || categoriesError}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>Wallets & Categories</PageHeaderHeading>
      </PageHeader>
      
      <Tabs defaultValue="wallets" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        
        <TabsContent value="wallets" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">My Wallets</h2>
            <Dialog open={isWalletDialogOpen} onOpenChange={setIsWalletDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateWallet}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Wallet
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingWallet ? 'Edit Wallet' : 'Create New Wallet'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingWallet 
                      ? 'Update your wallet information and color.' 
                      : 'Add a new wallet to track your finances.'}
                  </DialogDescription>
                </DialogHeader>
                <WalletForm 
                  wallet={editingWallet}
                  onSuccess={handleWalletSuccess}
                />
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wallets.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500">
                No wallets found
              </div>
            ) : (
              wallets.map((wallet) => (
                <Card key={wallet.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: wallet.color }}
                      />
                      <WalletIcon className="h-5 w-5" />
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditWallet(wallet)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setDeleteWalletId(wallet.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    </div>
                  </div>
                  <CardTitle className="text-lg">{wallet.name}</CardTitle>
                  <CardDescription>{wallet.currency}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatAmount(wallet.balance, null, wallet.currency)}
                  </div>
                </CardContent>
              </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">My Categories</h2>
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateCategory}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingCategory ? 'Edit Category' : 'Create New Category'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingCategory 
                      ? 'Update your category information and color.' 
                      : 'Add a new category to organize your transactions.'}
                  </DialogDescription>
                </DialogHeader>
                <CategoryForm 
                  category={editingCategory}
                  onSuccess={handleCategorySuccess}
                />
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500">
                No categories found
              </div>
            ) : (
              categories.map((category) => (
                <Card key={category.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      {/* <Tag className="h-5 w-5" /> */}
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditCategory(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setDeleteCategoryId(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    </div>
                  </div>
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                  <CardDescription className="capitalize">{category.type}</CardDescription>
                </CardHeader>
              </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      <ConfirmationModal
        isOpen={!!deleteWalletId}
        onClose={() => setDeleteWalletId(null)}
        onConfirm={() => {
          if (deleteWalletId) {
            handleDeleteWallet(deleteWalletId);
            setDeleteWalletId(null);
          }
        }}
        title="Delete Wallet"
        description="Are you sure you want to delete this wallet? This action cannot be undone."
        confirmText="Delete"
      />
      
      <ConfirmationModal
        isOpen={!!deleteCategoryId}
        onClose={() => setDeleteCategoryId(null)}
        onConfirm={() => {
          if (deleteCategoryId) {
            handleDeleteCategory(deleteCategoryId);
            setDeleteCategoryId(null);
          }
        }}
        title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone."
        confirmText="Delete"
      />
  </>
  );
}
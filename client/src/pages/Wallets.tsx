import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Wallet as WalletIcon } from 'lucide-react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { PageTitle, PillButton } from '@/components/page-header';
import { useWallets } from '@/hooks/use-wallets';
import { useCategories } from '@/hooks/use-categories';
import { WalletForm } from '@/components/finance/wallet-form';
import { CategoryForm } from '@/components/finance/category-form';
import { FilterChips } from '@/components/finance/filter-chips';
import { RowsCard } from '@/components/finance/transactions-list';
import { formatAmount } from '@/lib/format-utils';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { useAppShell } from '@/components/app-layout';
import axios from '@/lib/axios';

type Tab = 'wallets' | 'categories';
type Wallet = ReturnType<typeof useWallets>['wallets'][number];
type Category = ReturnType<typeof useCategories>['categories'][number];

const apiMessage = (err: unknown) => (isAxiosError(err) ? err.response?.data?.message : undefined);

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted hover:bg-border focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

function FormSheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[92vh] max-w-[480px] overflow-y-auto rounded-t-[28px] px-6 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle className="text-[19px] font-bold">{title}</SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function Wallets() {
  const { wallets, loading: walletsLoading, error: walletsError, refetch: refetchWallets } = useWallets();
  const { categories, loading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useCategories();
  const { dataVersion } = useAppShell();
  const [tab, setTab] = useState<Tab>('wallets');
  const [walletSheet, setWalletSheet] = useState<{ wallet: Wallet | null } | null>(null);
  const [categorySheet, setCategorySheet] = useState<{ category: Category | null } | null>(null);
  const [deleteWallet, setDeleteWallet] = useState<Wallet | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);

  useEffect(() => {
    if (dataVersion) refetchWallets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);

  const removeWallet = async (wallet: Wallet) => {
    setDeleteWallet(null);
    try {
      await axios.delete(`/api/wallets/${wallet.id}`);
      refetchWallets();
      toast.success('Wallet deleted');
    } catch (error) {
      toast.error(apiMessage(error) || 'Failed to delete wallet');
    }
  };

  const removeCategory = async (category: Category) => {
    setDeleteCategory(null);
    try {
      await axios.delete(`/api/categories/${category.id}`);
      refetchCategories();
      toast.success('Category deleted');
    } catch (error) {
      toast.error(apiMessage(error) || 'Failed to delete category');
    }
  };

  const loading = (walletsLoading && wallets.length === 0) || (categoriesLoading && categories.length === 0);
  const error = walletsError || categoriesError;

  return (
    <>
      <PageTitle
        eyebrow="Accounts"
        title="Wallets"
        action={
          <PillButton onClick={() => (tab === 'wallets' ? setWalletSheet({ wallet: null }) : setCategorySheet({ category: null }))}>
            <Plus /> {tab === 'wallets' ? 'Add wallet' : 'Add category'}
          </PillButton>
        }
      />

      <FilterChips
        label="Show"
        className="mb-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'wallets', label: 'Wallets', count: wallets.length },
          { value: 'categories', label: 'Categories', count: categories.length },
        ]}
      />

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="py-8 text-center text-expense">{error}</p>
      ) : tab === 'wallets' ? (
        wallets.length === 0 ? (
          <p className="rounded-[24px] bg-card p-6 text-center text-muted-foreground shadow-resting">No wallets yet. Add one to start tracking.</p>
        ) : (
          <div className="space-y-3">
            {wallets.map((wallet) => (
              <article key={wallet.id} aria-label={wallet.name} className="space-y-4 rounded-[24px] bg-card p-5 shadow-resting">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-[14px]" style={{ backgroundColor: `${wallet.color}26`, color: wallet.color }}>
                    <WalletIcon className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[19px] font-bold">{wallet.name}</h3>
                      {wallet.isMain && <span className="rounded-full bg-lime-soft px-2 py-0.5 text-xs font-semibold">Main</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {wallet._count?.transactions ?? 0} {wallet._count?.transactions === 1 ? 'transaction' : 'transactions'} · {wallet.currency}
                    </p>
                  </div>
                  <IconButton label={`Edit ${wallet.name}`} onClick={() => setWalletSheet({ wallet })}><Pencil /></IconButton>
                  <IconButton label={`Delete ${wallet.name}`} onClick={() => setDeleteWallet(wallet)}><Trash2 /></IconButton>
                </div>
                <p className="text-2xl font-bold tabular-nums">{formatAmount(wallet.balance, null, wallet.currency)}</p>
              </article>
            ))}
          </div>
        )
      ) : categories.length === 0 ? (
        <p className="rounded-[24px] bg-card p-6 text-center text-muted-foreground shadow-resting">No categories yet. Add one, or create them while adding a transaction.</p>
      ) : (
        <RowsCard>
          {categories.map((category) => (
            <div key={category.id} aria-label={category.name} className="flex items-center gap-3 py-3">
              <span aria-hidden className="size-10 shrink-0 rounded-[14px]" style={{ backgroundColor: `${category.color}40` }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{category.name}</p>
                <p className="text-xs text-muted-foreground">{category.type === 'INCOME' ? 'Income' : 'Expense'}</p>
              </div>
              <IconButton label={`Edit ${category.name}`} onClick={() => setCategorySheet({ category })}><Pencil /></IconButton>
              <IconButton label={`Delete ${category.name}`} onClick={() => setDeleteCategory(category)}><Trash2 /></IconButton>
            </div>
          ))}
        </RowsCard>
      )}

      <FormSheet open={!!walletSheet} onOpenChange={(open) => !open && setWalletSheet(null)} title={walletSheet?.wallet ? 'Edit wallet' : 'New wallet'}>
        {walletSheet && (
          <WalletForm
            wallet={walletSheet.wallet}
            onSuccess={() => {
              toast.success(walletSheet.wallet ? 'Wallet updated' : 'Wallet created');
              setWalletSheet(null);
              refetchWallets();
            }}
          />
        )}
      </FormSheet>

      <FormSheet open={!!categorySheet} onOpenChange={(open) => !open && setCategorySheet(null)} title={categorySheet?.category ? 'Edit category' : 'New category'}>
        {categorySheet && (
          <CategoryForm
            category={categorySheet.category}
            onSuccess={() => {
              toast.success(categorySheet.category ? 'Category updated' : 'Category created');
              setCategorySheet(null);
              refetchCategories();
            }}
          />
        )}
      </FormSheet>

      <ConfirmationModal
        isOpen={!!deleteWallet}
        onClose={() => setDeleteWallet(null)}
        onConfirm={() => deleteWallet && removeWallet(deleteWallet)}
        title="Delete wallet?"
        description={`"${deleteWallet?.name}" will be removed. This can't be undone.`}
        confirmText="Delete"
      />
      <ConfirmationModal
        isOpen={!!deleteCategory}
        onClose={() => setDeleteCategory(null)}
        onConfirm={() => deleteCategory && removeCategory(deleteCategory)}
        title="Delete category?"
        description={`"${deleteCategory?.name}" will be removed. This can't be undone.`}
        confirmText="Delete"
      />
    </>
  );
}

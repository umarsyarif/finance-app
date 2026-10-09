import { CategoryType } from '@prisma/client';
import type { AiExtraction } from './ai.service';
import { createCategory, findCategory } from './category.service';
import { MAX_AMOUNT } from '../schemas/transaction.schema';

export class CaptureError extends Error {}

export interface DraftWallet {
  id: string;
  name: string;
  currency: string;
  isMain: boolean;
}

export interface DraftCategory {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface TransactionDraft {
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  date: string; // ISO instant
  walletId: string;
  walletName: string;
  currency: string;
  categoryId: string;
  categoryName: string;
}

export interface ResolveContext {
  wallets: DraftWallet[];
  categories: DraftCategory[];
  now: Date;
  otherCategory: (type: 'INCOME' | 'EXPENSE') => Promise<DraftCategory>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const same = (a: unknown, b: string) => typeof a === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

function pickWallet(x: AiExtraction, wallets: DraftWallet[]): DraftWallet {
  if (wallets.length === 0) throw new CaptureError('Add a wallet first');
  const normalized = typeof x.currency === 'string' ? x.currency.trim().toUpperCase() : '';
  const currency = /^[A-Z]{3}$/.test(normalized) ? normalized : null;
  const named = wallets.find((w) => same(x.walletName, w.name));
  if (named && (!currency || named.currency === currency)) return named;

  const main = wallets.find((w) => w.isMain) ?? wallets[0];
  if (!currency) return main;
  if (main.currency === currency) return main;
  const sameCurrency = wallets.find((w) => w.currency === currency);
  if (!sameCurrency) throw new CaptureError(`No ${currency} wallet`);
  return sameCurrency;
}

// Local date-times (no offset) are read in the server timezone (process.env.TZ)
function pickDate(raw: string | null, now: Date): Date {
  if (typeof raw !== 'string' || !raw.trim()) return now;
  const value = /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? `${raw.trim()}T12:00:00` : raw.trim();
  const date = new Date(value);
  if (isNaN(date.getTime())) return now;
  if (date.getTime() - now.getTime() > DAY_MS) return now;
  if (now.getTime() - date.getTime() > 400 * DAY_MS) return now;
  return date;
}

// Turn the AI's labels into a concrete draft; our rules, not the model, decide what is saved
export async function resolveDraft(x: AiExtraction, ctx: ResolveContext): Promise<TransactionDraft> {
  if (!x.found || typeof x.amount !== 'number' || !Number.isFinite(x.amount)) {
    throw new CaptureError("Couldn't find an amount");
  }
  if (x.type !== 'INCOME' && x.type !== 'EXPENSE') {
    throw new CaptureError("Couldn't tell if this was income or an expense");
  }
  if (!(x.amount > 0) || x.amount > MAX_AMOUNT) {
    throw new CaptureError('The amount looks wrong; enter it manually');
  }

  const wallet = pickWallet(x, ctx.wallets);
  const category =
    ctx.categories.find((c) => c.type === x.type && same(x.categoryName, c.name)) ??
    (await ctx.otherCategory(x.type));
  const cleaned = typeof x.description === 'string' ? x.description.replace(/\s+/g, ' ').trim() : '';
  const description = Array.from(cleaned).slice(0, 255).join('') || category.name;

  return {
    type: x.type,
    amount: x.amount,
    description,
    date: pickDate(x.date, ctx.now).toISOString(),
    walletId: wallet.id,
    walletName: wallet.name,
    currency: wallet.currency,
    categoryId: category.id,
    categoryName: category.name,
  };
}

// The user's "Other" category for this type, created on first use
export async function findOrCreateOtherCategory(userId: string, type: 'INCOME' | 'EXPENSE'): Promise<DraftCategory> {
  // Check-then-create can race into a duplicate "Other"; harmless for this single-user app
  const existing = await findCategory({
    type,
    name: { equals: 'Other', mode: 'insensitive' },
    OR: [{ userId }, { userId: null }],
  });
  const category = existing ?? (await createCategory({ name: 'Other', type: type as CategoryType, user: { connect: { id: userId } } }));
  return { id: category.id, name: category.name, type };
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

// One line for the iOS Shortcut notification
export function summarize(d: TransactionDraft): string {
  const sign = d.type === 'INCOME' ? '+' : '-';
  return `Added ${sign}${money(d.amount, d.currency)} ${d.description} · ${d.categoryName} · ${d.walletName}`;
}

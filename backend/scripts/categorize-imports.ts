/**
 * One-off: split the "Other" bucket from import-statements.ts into real categories, by keyword
 * matching on each transaction's description. Only touches transactions currently in the user's
 * "Other"/"Others" category (EXPENSE and INCOME) — doesn't touch type or amount, just categoryId,
 * so wallet balances are untouched.
 *
 * Usage (dry run prints match counts, writes nothing):
 *   npm run categorize-imports
 * Add --commit to actually write.
 */
require('dotenv').config();

import prisma from '../src/middleware/prismaMiddleware';
import { createCategory, findCategory } from '../src/services/category.service';

const args = process.argv.slice(2);
const flag = (name: string, def?: string) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const COMMIT = args.includes('--commit');
const EMAIL = flag('email', 'umarsyarif1607@gmail.com')!;

// "Food" already exists as a category for this user (made before the import) — reuse it rather
// than creating a near-duplicate "Food & Dining".
const EXPENSE_RULES: [string, RegExp][] = [
  ['Food', /GO-FOOD|Re\.juve/i],
  ['Groceries & Convenience', /이마트24|씨유|CU경대|GS25|SWALAYAN|INDOMARET|D[' ]?SEVEN/i],
  ['Transportation', /GO-RIDE|HELLORIDE|후불교통|Toll|카카오T|카카오택시/i],
  ['Bills & Utilities', /통신료|지로|GoBills|Indihome|건강보험/i],
  ['Cash Withdrawal', /Cash Withdrawal|ATM출금|CD현금|CD이체/i],
  ['Shopping', /쿠팡|다이소|Daiso/i],
  ['Entertainment & Subscriptions', /CJENM|GPAY TEMP|트립닷컴|Trip\.com/i],
  ['Investments', /Mutual Fund|Bibit/i],
  ['Interest', /^Tax on Interest|결산소득세/i],
];

const INCOME_RULES: [string, RegExp][] = [
  ['Cashback & Rewards', /카드 캐시백|Cashback|프로모션입금|복권/i],
  ['Interest', /^Interest|예금이자|이자입금|통장.?이자/i],
  ['Investments', /Mutual Fund|Bibit/i],
  ['Business & Other Income', /FLIPTECH LENTERA/i],
];

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error(`No user with email ${EMAIL}`);

  const otherExpense = await prisma.category.findFirst({ where: { userId: user.id, type: 'EXPENSE', name: { in: ['Other', 'Others'] } } });
  const otherIncome = await prisma.category.findFirst({ where: { userId: user.id, type: 'INCOME', name: { in: ['Other', 'Others'] } } });
  if (!otherExpense || !otherIncome) throw new Error('No "Other" category found — run import-statements.ts first');

  const categoryIdCache = new Map<string, string>();
  async function ensureCategory(name: string, type: 'INCOME' | 'EXPENSE') {
    const key = `${type}:${name}`;
    if (categoryIdCache.has(key)) return categoryIdCache.get(key)!;
    const existing = (await findCategory({ userId: user!.id, type, name })) as { id: string } | null;
    const category = existing ?? (COMMIT ? await createCategory({ name, type, user: { connect: { id: user!.id } } }) : { id: `(new:${name})` });
    categoryIdCache.set(key, category.id);
    return category.id;
  }

  async function recategorize(otherCategoryId: string, type: 'INCOME' | 'EXPENSE', rules: [string, RegExp][]) {
    const txns = await prisma.transaction.findMany({ where: { categoryId: otherCategoryId }, select: { id: true, description: true } });
    const counts = new Map<string, number>();
    const unmatchedDesc = new Map<string, number>();
    let unmatched = 0;
    for (const t of txns) {
      const rule = rules.find(([, re]) => re.test(t.description ?? ''));
      if (!rule) {
        unmatched++;
        const d = t.description ?? '(none)';
        unmatchedDesc.set(d, (unmatchedDesc.get(d) ?? 0) + 1);
        continue;
      }
      const [name] = rule;
      counts.set(name, (counts.get(name) ?? 0) + 1);
      if (COMMIT) {
        const categoryId = await ensureCategory(name, type);
        await prisma.transaction.update({ where: { id: t.id }, data: { categoryId } });
      }
    }
    console.log(`${type}: ${txns.length} in "Other", ${unmatched} stay there`);
    for (const [name, count] of counts) console.log(`  -> ${name}: ${count}`);
    if (!COMMIT) {
      console.log('  top unmatched descriptions:');
      [...unmatchedDesc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([d, c]) => console.log(`    ${c}  ${d}`));
    }
  }

  await recategorize(otherExpense.id, 'EXPENSE', EXPENSE_RULES);
  await recategorize(otherIncome.id, 'INCOME', INCOME_RULES);

  console.log(COMMIT ? '\nDone.' : '\nDry run only, nothing written. Pass --commit to apply.');
}

main()
  .catch((err) => {
    console.error(err?.message ?? String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

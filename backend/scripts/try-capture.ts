/**
 * Manual check against real Gemini (uses your quota). Not part of any test run.
 * Usage: GEMINI_API_KEY=... npm run try-capture -- "STARBUCKS 6,500원 10/09 14:20 신한카드 승인"
 */
require('dotenv').config();
process.env.TZ = process.env.TZ || 'Asia/Seoul';
import { extractTransaction } from '../src/services/ai.service';

const text = process.argv.slice(2).join(' ') || 'STARBUCKS 6,500원 10/09 14:20 신한카드 승인';

extractTransaction(
  { text },
  {
    wallets: [
      { name: 'KRW Main', currency: 'KRW', isMain: true },
      { name: 'Rupiah', currency: 'IDR', isMain: false },
    ],
    categories: [
      { name: 'Coffee', type: 'EXPENSE' },
      { name: 'Groceries', type: 'EXPENSE' },
      { name: 'Salary', type: 'INCOME' },
    ],
    now: new Date(),
    timeZone: process.env.TZ ?? 'Asia/Seoul',
  }
)
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });

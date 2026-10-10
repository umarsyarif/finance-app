/**
 * One-off: import historical transactions from e-statements sitting in ../../data.
 *   - Jago "Pockets Transactions History" PDFs (Daily Expenses, Main Pocket) via `pdftotext -layout`
 *   - Toss Bank export, pre-decrypted to TSV (the xlsx is password-protected; see conversation history
 *     for the one-off python decrypt+dump — not worth a node dependency for a single run)
 *   - NH Bank "거래내역 이메일 전송 서비스" PDFs (nh 2024/2025/2026.pdf) via `pdftotext -layout`
 *
 * Movements between the Daily Expenses and Main Pocket wallets are paired up (by date+time+amount,
 * since each side gets its own ledger id) and written as one Transfer instead of two transactions.
 * Everything else (including transfers to Jago pockets we don't have statements for) becomes a plain
 * transaction in category "Other". Interest / Tax on Interest / 이자입금 rows are skipped (noise).
 *
 * Usage (dry run prints a summary, writes nothing):
 *   npm run import-statements -- --toss-tsv=/path/to/toss.tsv
 * Add --commit to actually write. Add --new-only on a DB that already has a prior run's Jago/NH/Toss
 * data committed — writes only the BSI and Emergency Fund wallets/transfers, since this script has no
 * idempotency check and a second full run would duplicate everything.
 */
require('dotenv').config();
process.env.TZ = process.env.TZ || 'Asia/Seoul';

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import prisma from '../src/middleware/prismaMiddleware';
import { createWallet, findWallets } from '../src/services/wallet.service';
import { findCategory, createCategory } from '../src/services/category.service';
import { createTransaction, deleteTransaction } from '../src/services/transaction.service';
import { createTransfer } from '../src/services/transfer.service';

const DATA_DIR = path.resolve(__dirname, '../../data');
const DAILY_PDF = path.join(DATA_DIR, 'Jago_Daily Expenses_History_10102026.pdf');
const MAIN_PDF = path.join(DATA_DIR, 'Jago_Main Pocket_History_10102026.pdf');
const NH_PDFS = ['nh 2024.pdf', 'nh 2025.pdf', 'nh 2026.pdf'].map((f) => path.join(DATA_DIR, f));
const BSI_PDFS = [
  'bsi_estatment-2026-10-11 02:07:59.pdf',
  'bsi_estatment-2026-10-11 02:08:20.pdf',
  'bsi_estatment-2026-10-11 02:08:32.pdf',
  'bsi_estatment-2026-10-11 02:08:48.pdf',
  'bsi_estatment-2026-10-11 02:09:06.pdf',
  'bsi_estatment-2026-10-11 02:09:21.pdf',
].map((f) => path.join(DATA_DIR, f));

const args = process.argv.slice(2);
const flag = (name: string, def?: string) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const COMMIT = args.includes('--commit');
// For a target DB that already has the Jago/NH/Toss import from an earlier run of this script:
// parses everything as usual (BSI<->Main Pocket and Toss<->Emergency Fund matching both need the
// full mainRows/tossRows), but only commits the two new sources, so nothing already there gets
// duplicated (this script has no idempotency check — a second full run WILL double-count).
const NEW_ONLY = args.includes('--new-only');
const EMAIL = flag('email', 'umarsyarif1607@gmail.com')!;
const TOSS_TSV = flag('toss-tsv');

// ---------- Jago PDF parsing ----------

type JagoRow = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  source: string;
  amount: number; // signed, IDR
  balance: number; // the statement's own running balance after this row, for the sanity check below
  isPocketMovement: boolean;
  block: string; // full raw block text (Notes/bank-detail lines live here, not in `source`)
  used: boolean; // consumed as one half of a transfer pair
};

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

// "1.234.567,89" -> 1234567.89
const idn = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'));

// pdftotext -layout occasionally collides a transaction row with the page footer/disclaimer text
// (page-break artifact), splitting the amount+balance pair onto their own line(s) within the block
// instead of the transaction's first line. Two recovery tiers handle that before giving up on a row.
function parseJago(pdfPath: string): { rows: JagoRow[]; skipped: string[] } {
  const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { maxBuffer: 1024 * 1024 * 64 }).toString('utf8');
  const lines = text.split('\n');
  const DATE_RE = /^(\d{2}) ([A-Za-z]{3}) (\d{4})\s+(.*)$/;
  const TRAIL_RE = /([+-][\d.,]+)\s+([\d.,]+)\s*$/;
  const AMOUNT_ONLY_RE = /[+-][\d.,]+/g;
  const BARE_NUM_RE = /^\s*([\d.,]+)\s*$/;
  const TIME_RE = /^\s*(\d{2}:\d{2})/;
  const rows: JagoRow[] = [];
  const skipped: string[] = [];
  const dateLineIndices: number[] = [];
  lines.forEach((l, i) => {
    if (DATE_RE.test(l)) dateLineIndices.push(i);
  });
  for (let k = 0; k < dateLineIndices.length; k++) {
    const i = dateLineIndices[k];
    const line = lines[i];
    const m = DATE_RE.exec(line)!;
    const [, dd, mon, yyyy, rest] = m;
    const month = MONTHS[mon];
    if (!month) continue;
    const blockEnd = k + 1 < dateLineIndices.length ? dateLineIndices[k + 1] : lines.length;
    const block = lines.slice(i, blockEnd);

    let amount: number | undefined;
    let balance: number | undefined;
    let source: string | undefined;

    const tm = TRAIL_RE.exec(rest);
    if (tm) {
      source = rest.slice(0, tm.index).trim();
      amount = idn(tm[1]);
      balance = idn(tm[2]);
    } else {
      const candidates = block.map((l, j) => ({ j, m: TRAIL_RE.exec(l) })).filter((c) => c.m);
      if (candidates.length === 1) {
        amount = idn(candidates[0].m![1]);
        balance = idn(candidates[0].m![2]);
        source = rest.trim();
      } else {
        // tier 2: the amount and balance got split onto separate lines
        const amountLines = block
          .map((l, j) => ({ j, matches: l.match(AMOUNT_ONLY_RE) }))
          .filter((c) => c.matches);
        const bareLines = block
          .map((l, j) => ({ j, m: BARE_NUM_RE.exec(l) }))
          .filter((c) => c.m && c.m[1]);
        if (amountLines.length === 1 && bareLines.length >= 1) {
          const aj = amountLines[0].j;
          const aMatches = amountLines[0].matches!;
          const [bj, bm] = bareLines.reduce((best, c) => (Math.abs(c.j - aj) < Math.abs(best[0] - aj) && c.j !== aj ? [c.j, c.m] : best), [
            bareLines[0].j,
            bareLines[0].m,
          ] as [number, RegExpExecArray | null]);
          amount = idn(aMatches[aMatches.length - 1]);
          balance = idn(bm![1]);
          source = rest.trim();
        }
      }
    }

    if (amount === undefined || balance === undefined) {
      skipped.push(line.trim());
      continue;
    }
    const timeMatch = block.map((l) => TIME_RE.exec(l)).find((t) => t);
    rows.push({
      date: `${yyyy}-${month}-${dd}`,
      time: timeMatch ? timeMatch[1] : '12:00',
      source: (source || '').replace(/\s{2,}/g, ' ') || '(recovered)',
      amount,
      balance,
      isPocketMovement: block.some((l) => l.includes('Movement between Pockets')),
      block: block.join('\n'),
      used: false,
    });
  }
  return { rows, skipped };
}

// Sanity check: the statement's own running balance should equal prevBalance + amount for every
// row. A mismatch means parsing dropped or corrupted a transaction (page-break glitches etc).
function checkInvariant(rows: { date: string; time: string; amount: number; balance: number }[], label: string) {
  let prev = 0;
  let mismatches = 0;
  for (const r of rows) {
    const expected = Math.round((prev + r.amount) * 100) / 100;
    if (Math.abs(expected - r.balance) > 1) {
      mismatches++;
      console.log(`  INVARIANT MISMATCH (${label}) ${r.date} ${r.time}: expected ${expected}, statement says ${r.balance}`);
    }
    prev = r.balance;
  }
  return mismatches;
}

type PlainTxn = { walletName: string; date: string; amount: number; description: string };
type TransferPair = { date: string; fromWallet: string; toWallet: string; amountSent: number; amountReceived?: number };

function walletCurrency(name: string) {
  return ['Toss Bank', 'NH Bank', 'Emergency Fund'].includes(name) ? 'KRW' : 'IDR';
}

// pdftotext -layout garbles these two Daily Expenses rows beyond recovery (the page footer's text
// physically overlaps the transaction row at a page break). Found by hand from the raw PDF text
// and the running-balance gap; transcribed here so --commit stays reproducible from scratch.
const DAILY_MANUAL_ROWS: PlainTxn[] = [
  { walletName: 'Daily Expenses', date: '2024-05-15T14:34:00+07:00', amount: -32_500, description: 'Gopay Payment with Jago Pay Gopay - Generic Jago (ID# 699777534)' },
  { walletName: 'Daily Expenses', date: '2026-02-15T06:35:00+07:00', amount: -84_000, description: 'GoPay Payment with Jago Pay 004 - Gopay - Generic Jago' },
];

function buildJagoPlan(daily: JagoRow[], main: JagoRow[]) {
  // Pair up Daily<->Main pocket movements: same date+time+abs(amount), opposite sign.
  // Keyed, FIFO per key since a handful of movements can share a timestamp+amount.
  const mainCandidates = new Map<string, JagoRow[]>();
  for (const r of main) {
    if (r.isPocketMovement && r.source.startsWith('Daily Expenses')) {
      const key = `${r.date}|${r.time}|${Math.abs(r.amount)}`;
      (mainCandidates.get(key) ?? mainCandidates.set(key, []).get(key)!).push(r);
    }
  }

  const transfers: TransferPair[] = [];
  for (const r of daily) {
    if (!(r.isPocketMovement && r.source.startsWith('Main Pocket'))) continue;
    const key = `${r.date}|${r.time}|${Math.abs(r.amount)}`;
    const candidates = mainCandidates.get(key) ?? [];
    const idx = candidates.findIndex((c) => !c.used && Math.sign(c.amount) === -Math.sign(r.amount));
    if (idx === -1) continue; // no match in the Main Pocket file; falls through as a plain transaction below
    const match = candidates[idx];
    match.used = true;
    r.used = true;
    const [fromWallet, toWallet] = r.amount > 0 ? ['Main Pocket', 'Daily Expenses'] : ['Daily Expenses', 'Main Pocket'];
    transfers.push({ date: `${r.date}T${r.time}:00+07:00`, fromWallet, toWallet, amountSent: Math.abs(r.amount) });
  }

  const plain: PlainTxn[] = [];
  const skippedInterest = { count: 0 };
  for (const [walletName, rows] of [['Daily Expenses', daily], ['Main Pocket', main]] as const) {
    for (const r of rows) {
      if (r.used) continue;
      if (r.source.startsWith('Interest') || r.source.startsWith('Tax on Interest')) skippedInterest.count++;
      plain.push({ walletName, date: `${r.date}T${r.time}:00+07:00`, amount: r.amount, description: r.source });
    }
  }
  return { transfers, plain, skippedInterest: skippedInterest.count };
}

// ---------- NH Bank PDF parsing ----------

type NhRow = { date: string; time: string; amount: number; content: string; record: string; used: boolean };

const isInterestNH = (content: string) => content === '결산소득세' || content === '예금이자';

// Each row is a fixed 3-line group: date (+ a branch-name fragment), then type/amount/balance/content/
// counterparty, then time (+ a branch-number fragment). "정정" (correction) rows carry their own
// leading '-' on the amount, so folding the sign into (입금=+1/출금=-1)*amount handles reversals for free.
function parseNH(pdfPath: string): NhRow[] {
  const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { maxBuffer: 1024 * 1024 * 64 }).toString('utf8');
  const lines = text.split('\n');
  const DATE_RE = /^\s*(\d{4}-\d{2}-\d{2})\s*/;
  const MID_RE = /^\s*(입금|출금)(?:정정)?\s+(-?[\d,]+)원\s+([\d,]+)원\s+(\S+)(?:\s+(.*?))?\s*$/;
  const TIME_RE = /^\s*(\d{2}:\d{2}:\d{2})/;
  const num = (s: string) => parseFloat(s.replace(/,/g, ''));

  const rows: NhRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = MID_RE.exec(lines[i]);
    if (!m) continue;
    const [, dir, amtStr, , content, record] = m;
    let date: string | undefined;
    for (let j = i; j >= Math.max(0, i - 2); j--) {
      const dm = DATE_RE.exec(lines[j]);
      if (dm) {
        date = dm[1];
        break;
      }
    }
    let time = '12:00:00';
    for (let j = i; j <= Math.min(lines.length - 1, i + 2); j++) {
      const tm = TIME_RE.exec(lines[j]);
      if (tm) {
        time = tm[1];
        break;
      }
    }
    if (!date) continue;
    const amount = (dir === '입금' ? 1 : -1) * num(amtStr);
    rows.push({ date, time, amount, content, record: (record ?? '').trim(), used: false });
  }
  return rows;
}

// ---------- Toss TSV parsing ----------

type TossRow = { date: string; time: string; amount: number; desc: string; type: string; inst: string; used: boolean };

function parseToss(tsvPath: string): TossRow[] {
  const lines = fs.readFileSync(tsvPath, 'utf8').split('\n').filter((l) => l.trim());
  const [, ...dataLines] = lines; // drop header
  const rows: TossRow[] = [];
  for (const line of dataLines) {
    const [datetime, desc, type, inst, , amountStr] = line.split('\t');
    if (!datetime || !amountStr) continue;
    const m = /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(datetime.trim());
    if (!m) continue;
    const [, y, mo, d, h, mi, s] = m;
    rows.push({ date: `${y}-${mo}-${d}`, time: `${h}:${mi}:${s}`, amount: parseFloat(amountStr), desc, type, inst: inst ?? '', used: false });
  }
  return rows;
}

// ---------- BSI (Bank Syariah Indonesia) PDF parsing ----------

type BsiRow = { date: string; time: string; amount: number; balance: number; desc: string; used: boolean };

const MONTHS_ID: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', Mei: '05', Jun: '06',
  Jul: '07', Agu: '08', Sep: '09', Okt: '10', Nov: '11', Des: '12',
};

// Each row is a date line (name/ref + trailing Debit/Kredit/Saldo), then an "HH:MM  Dana Masuk|Keluar
// | <description>" line, sometimes wrapping onto a 3rd line. The per-file trailing summary block
// ("Saldo Awal/Mutasi.../Saldo Akhir") never starts with a date, so it's naturally excluded — except
// the last transaction's block swallows it as trailing lines, filtered out below.
function parseBSI(pdfPath: string): BsiRow[] {
  const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { maxBuffer: 1024 * 1024 * 64 }).toString('utf8');
  const lines = text.split('\n');
  const DATE_RE = /^(\d{2}) ([A-Za-z]{3}) (\d{4})\s+(.*)$/;
  const TRAIL3_RE = /([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$/;
  const SUMMARY_RE = /Saldo Awal|Mutasi Debit|Mutasi Kredit|Saldo Akhir/;
  const dateLineIndices: number[] = [];
  lines.forEach((l, i) => {
    if (DATE_RE.test(l)) dateLineIndices.push(i);
  });

  const rows: BsiRow[] = [];
  for (let k = 0; k < dateLineIndices.length; k++) {
    const i = dateLineIndices[k];
    const m = DATE_RE.exec(lines[i])!;
    const [, dd, mon, yyyy, rest] = m;
    const month = MONTHS_ID[mon];
    if (!month) continue;
    const tm = TRAIL3_RE.exec(rest);
    if (!tm) continue;
    const debit = idn(tm[1]);
    const kredit = idn(tm[2]);
    const balance = idn(tm[3]);
    const blockEnd = k + 1 < dateLineIndices.length ? dateLineIndices[k + 1] : lines.length;
    const descLines = lines.slice(i + 1, blockEnd).map((l) => l.trim()).filter((l) => l && !SUMMARY_RE.test(l));
    const time = (descLines[0] ?? '').slice(0, 5) || '12:00';
    const desc = descLines.map((l, j) => (j === 0 ? l.slice(5).trim() : l)).join(' ').replace(/\s{2,}/g, ' ').trim();
    rows.push({ date: `${yyyy}-${month}-${dd}`, time, amount: kredit - debit, balance, desc, used: false });
  }
  return rows;
}

// ---------- NH <-> Toss / NH <-> Main Pocket transfer matching ----------

// Both sides are KST, so treating date+time as naive-UTC for the diff is fine — only the relative
// gap matters, and both rows get the same (non-)treatment.
const asMs = (date: string, time: string) => Date.parse(`${date}T${time}Z`);

function matchNhToss(nhRows: NhRow[], tossRows: TossRow[]): TransferPair[] {
  const transfers: TransferPair[] = [];
  for (const t of tossRows) {
    if (t.used || !t.inst.includes('NH농협')) continue;
    const match = nhRows.find((n) => !n.used && Math.abs(asMs(n.date, n.time) - asMs(t.date, t.time)) <= 120_000 && Math.abs(n.amount + t.amount) < 1);
    if (!match) continue;
    match.used = true;
    t.used = true;
    const [fromWallet, toWallet] = t.amount < 0 ? ['Toss Bank', 'NH Bank'] : ['NH Bank', 'Toss Bank'];
    transfers.push({ date: `${t.date}T${t.time}+09:00`, fromWallet, toWallet, amountSent: Math.abs(t.amount) });
  }
  return transfers;
}

// Found by hand (see conversation history): NH's "오픈지머니트랜스" (OpenG Money Transfer) KRW->IDR
// remittance withdrawals, cross-referenced against Main Pocket incoming transfers by WIB = KST-2h
// timestamp and a plausible (9-15) implied FX rate. 3 of the 42 OpenG withdrawals had no plausible
// match within a week either way and are left as plain NH expenses.
const NH_MAIN_POCKET_TRANSFERS = [
  { nhDate: '2024-11-21', nhTime: '15:01:17', amountKRW: 500000, jagoDate: '2024-11-21', jagoTime: '13:01', amountIDR: 5639750 },
  { nhDate: '2024-12-18', nhTime: '19:14:14', amountKRW: 635000, jagoDate: '2024-12-18', jagoTime: '17:14', amountIDR: 7083204 },
  { nhDate: '2024-12-19', nhTime: '17:30:43', amountKRW: 270000, jagoDate: '2024-12-19', jagoTime: '15:30', amountIDR: 2973369 },
  { nhDate: '2025-02-05', nhTime: '11:11:26', amountKRW: 200000, jagoDate: '2025-02-05', jagoTime: '09:11', amountIDR: 2216424 },
  { nhDate: '2025-02-25', nhTime: '20:40:14', amountKRW: 200000, jagoDate: '2025-02-25', jagoTime: '18:40', amountIDR: 2237576 },
  { nhDate: '2025-03-22', nhTime: '09:05:40', amountKRW: 400000, jagoDate: '2025-03-22', jagoTime: '07:05', amountIDR: 4464402 },
  { nhDate: '2025-04-03', nhTime: '18:32:20', amountKRW: 200000, jagoDate: '2025-04-03', jagoTime: '16:32', amountIDR: 2240064 },
  { nhDate: '2025-04-08', nhTime: '13:45:02', amountKRW: 402528, jagoDate: '2025-04-08', jagoTime: '11:45', amountIDR: 4500000 },
  { nhDate: '2025-04-19', nhTime: '17:45:29', amountKRW: 300000, jagoDate: '2025-04-19', jagoTime: '15:45', amountIDR: 3512671 },
  { nhDate: '2025-04-22', nhTime: '14:48:14', amountKRW: 855000, jagoDate: '2025-04-22', jagoTime: '12:48', amountIDR: 10060608 },
  { nhDate: '2025-05-03', nhTime: '18:41:14', amountKRW: 80000, jagoDate: '2025-05-03', jagoTime: '17:48', amountIDR: 900883 },
  { nhDate: '2025-06-09', nhTime: '11:23:25', amountKRW: 200000, jagoDate: '2025-06-09', jagoTime: '09:24', amountIDR: 2327000 },
  { nhDate: '2025-06-22', nhTime: '20:14:58', amountKRW: 420000, jagoDate: '2025-06-22', jagoTime: '18:15', amountIDR: 4964200 },
  { nhDate: '2025-07-18', nhTime: '20:05:58', amountKRW: 310000, jagoDate: '2025-07-18', jagoTime: '18:06', amountIDR: 3593906 },
  { nhDate: '2025-08-14', nhTime: '19:24:27', amountKRW: 410000, jagoDate: '2025-08-14', jagoTime: '17:24', amountIDR: 4744441 },
  { nhDate: '2025-08-31', nhTime: '15:06:35', amountKRW: 300000, jagoDate: '2025-08-31', jagoTime: '13:06', amountIDR: 3519573 },
  { nhDate: '2025-09-19', nhTime: '16:26:58', amountKRW: 450000, jagoDate: '2025-09-19', jagoTime: '14:27', amountIDR: 5301532 },
  { nhDate: '2025-10-20', nhTime: '19:35:07', amountKRW: 645000, jagoDate: '2025-10-20', jagoTime: '17:35', amountIDR: 7466042 },
  { nhDate: '2025-12-20', nhTime: '02:40:37', amountKRW: 547500, jagoDate: '2025-12-20', jagoTime: '00:40', amountIDR: 6151415 },
  { nhDate: '2026-01-21', nhTime: '02:19:19', amountKRW: 725000, jagoDate: '2026-01-21', jagoTime: '00:19', amountIDR: 8237366 },
  { nhDate: '2026-02-03', nhTime: '09:29:07', amountKRW: 470000, jagoDate: '2026-02-03', jagoTime: '07:35', amountIDR: 5393173 },
  { nhDate: '2026-02-16', nhTime: '18:51:50', amountKRW: 1000000, jagoDate: '2026-02-16', jagoTime: '17:00', amountIDR: 11567209 },
  { nhDate: '2026-03-02', nhTime: '17:01:08', amountKRW: 325000, jagoDate: '2026-03-02', jagoTime: '15:01', amountIDR: 3694527 },
  { nhDate: '2026-03-05', nhTime: '11:41:04', amountKRW: 200000, jagoDate: '2026-03-05', jagoTime: '09:54', amountIDR: 2258000 },
  { nhDate: '2026-03-21', nhTime: '19:16:24', amountKRW: 450000, jagoDate: '2026-03-21', jagoTime: '17:16', amountIDR: 5049455 },
  { nhDate: '2026-03-23', nhTime: '13:14:25', amountKRW: 250000, jagoDate: '2026-03-23', jagoTime: '11:14', amountIDR: 2781132 },
  { nhDate: '2026-04-07', nhTime: '17:15:10', amountKRW: 150000, jagoDate: '2026-04-07', jagoTime: '15:15', amountIDR: 1674656 },
  { nhDate: '2026-04-19', nhTime: '20:35:19', amountKRW: 400000, jagoDate: '2026-04-19', jagoTime: '18:35', amountIDR: 4619943 },
  { nhDate: '2026-05-21', nhTime: '12:45:09', amountKRW: 400000, jagoDate: '2026-05-21', jagoTime: '10:45', amountIDR: 4673208 },
  { nhDate: '2026-06-02', nhTime: '17:18:11', amountKRW: 300000, jagoDate: '2026-06-02', jagoTime: '15:18', amountIDR: 3492977 },
  { nhDate: '2026-06-19', nhTime: '01:17:34', amountKRW: 300000, jagoDate: '2026-06-18', jagoTime: '23:17', amountIDR: 3431811 },
  { nhDate: '2026-07-10', nhTime: '22:33:52', amountKRW: 200000, jagoDate: '2026-07-10', jagoTime: '20:34', amountIDR: 2349637 },
  { nhDate: '2026-07-16', nhTime: '17:58:10', amountKRW: 350000, jagoDate: '2026-07-16', jagoTime: '15:58', amountIDR: 4179903 },
  { nhDate: '2026-07-24', nhTime: '09:13:26', amountKRW: 250000, jagoDate: '2026-07-24', jagoTime: '07:13', amountIDR: 2991730 },
  { nhDate: '2026-08-20', nhTime: '18:50:03', amountKRW: 250000, jagoDate: '2026-08-20', jagoTime: '16:50', amountIDR: 3132063 },
  { nhDate: '2026-09-22', nhTime: '01:37:38', amountKRW: 300000, jagoDate: '2026-09-21', jagoTime: '23:37', amountIDR: 3805739 },
  { nhDate: '2026-09-24', nhTime: '20:03:49', amountKRW: 400000, jagoDate: '2026-09-24', jagoTime: '18:04', amountIDR: 5173240 },
  { nhDate: '2026-09-26', nhTime: '20:04:53', amountKRW: 800000, jagoDate: '2026-09-26', jagoTime: '18:05', amountIDR: 10452880 },
  { nhDate: '2026-10-10', nhTime: '15:43:42', amountKRW: 160000, jagoDate: '2026-10-10', jagoTime: '13:43', amountIDR: 2088072 },
] as const;

function matchNhMainPocket(nhRows: NhRow[], mainRows: JagoRow[]): TransferPair[] {
  const transfers: TransferPair[] = [];
  for (const p of NH_MAIN_POCKET_TRANSFERS) {
    const nh = nhRows.find((n) => !n.used && n.date === p.nhDate && n.time === p.nhTime && Math.abs(n.amount + p.amountKRW) < 1);
    const jago = mainRows.find((r) => !r.used && r.date === p.jagoDate && r.time === p.jagoTime && Math.abs(r.amount - p.amountIDR) < 1);
    if (!nh || !jago) {
      console.log(`  WARNING: expected NH<->Main Pocket pair not found: ${p.nhDate} ${p.nhTime} (${p.amountKRW} KRW) -- nh:${!!nh} jago:${!!jago}`);
      continue;
    }
    nh.used = true;
    jago.used = true;
    transfers.push({ date: `${p.nhDate}T${p.nhTime}+09:00`, fromWallet: 'NH Bank', toWallet: 'Main Pocket', amountSent: p.amountKRW, amountReceived: p.amountIDR });
  }
  return transfers;
}

// `used` only keeps a row out of THIS run's own plain-list build — it says nothing about a plain
// transaction a PRIOR run already committed to the DB for that same row (e.g. prod already has
// Jago/NH/Toss imported). `supersededPlain` is exactly the PlainTxn shape that prior run's code
// would have produced for the now-transferred side, so --new-only can find and delete it before
// inserting the transfer (see main()). The newly-added side (BSI, Emergency Fund) never had a prior
// plain transaction, so it isn't included here.

// Both sides name each other explicitly (BSI rows say "BANK JAGO"; Main Pocket rows carry "Bank
// Syariah Indonesia" + the BSI account number "1040607467" in their Notes lines, now in `block`),
// so this is a real deterministic match, not forensic — same date+time+amount, opposite sign.
function matchBsiMainPocket(bsiRows: BsiRow[], mainRows: JagoRow[]): { transfers: TransferPair[]; supersededPlain: PlainTxn[] } {
  const transfers: TransferPair[] = [];
  const supersededPlain: PlainTxn[] = [];
  for (const b of bsiRows) {
    if (b.used || !/BANK JAGO/i.test(b.desc)) continue;
    const match = mainRows.find(
      (r) =>
        !r.used &&
        r.block.includes('Bank Syariah Indonesia') &&
        r.block.includes('1040607467') &&
        r.date === b.date &&
        r.time === b.time &&
        Math.abs(Math.abs(r.amount) - Math.abs(b.amount)) < 1
    );
    if (!match) continue;
    b.used = true;
    match.used = true;
    const [fromWallet, toWallet] = b.amount > 0 ? ['Main Pocket', 'Bank BSI'] : ['Bank BSI', 'Main Pocket'];
    transfers.push({ date: `${b.date}T${b.time}:00+07:00`, fromWallet, toWallet, amountSent: Math.abs(b.amount) });
    supersededPlain.push({ walletName: 'Main Pocket', date: `${match.date}T${match.time}:00+07:00`, amount: match.amount, description: match.source });
  }
  return { transfers, supersededPlain };
}

// Toss's own "Emergency Fund" pocket shows up as self-transfers in the main account statement
// (institution "토스뱅크" = itself, not an external bank) — each row is a complete transfer event on
// its own, no second file to cross-reference.
function matchTossEmergencyFund(tossRows: TossRow[]): { transfers: TransferPair[]; supersededPlain: PlainTxn[] } {
  const transfers: TransferPair[] = [];
  const supersededPlain: PlainTxn[] = [];
  for (const t of tossRows) {
    if (t.used || t.desc !== 'Emergency Fund' || t.inst !== '토스뱅크') continue;
    t.used = true;
    const [fromWallet, toWallet] = t.amount < 0 ? ['Toss Bank', 'Emergency Fund'] : ['Emergency Fund', 'Toss Bank'];
    transfers.push({ date: `${t.date}T${t.time}+09:00`, fromWallet, toWallet, amountSent: Math.abs(t.amount) });
    supersededPlain.push({ walletName: 'Toss Bank', date: `${t.date}T${t.time}+09:00`, amount: t.amount, description: t.desc || t.type });
  }
  return { transfers, supersededPlain };
}

// ---------- main ----------

async function ensureWallet(userId: string, name: string, currency: string, cache: Map<string, { id: string }>) {
  if (cache.has(name)) return cache.get(name)!;
  const existing = await findWallets({ userId, name });
  const wallet = existing[0] ?? (COMMIT ? await createWallet({ name, currency, user: { connect: { id: userId } } }) : { id: `(new:${name})` });
  cache.set(name, wallet);
  return wallet;
}

async function ensureOtherCategory(userId: string, type: 'INCOME' | 'EXPENSE', cache: Map<string, { id: string }>) {
  if (cache.has(type)) return cache.get(type)!;
  const existing = (await findCategory({ type, OR: [{ userId }, { userId: null }], name: { in: ['Other', 'Others'] } })) as { id: string } | null;
  const category = existing ?? (COMMIT ? await createCategory({ name: 'Other', type, user: { connect: { id: userId } } }) : { id: `(new:${type})` });
  cache.set(type, category);
  return category;
}

// --new-only, against a DB a prior run already populated: find the specific plain transaction that
// prior run committed for a now-transferred row, and delete it (via the service, so the balance
// reversal is correct) before the new Transfer gets inserted. Matches on wallet + exact date + exact
// amount + exact description — if that's not unique, something's off, so it refuses to guess.
async function deleteSupersededPlain(userId: string, items: PlainTxn[], walletCache: Map<string, { id: string }>) {
  for (const p of items) {
    const wallet = await ensureWallet(userId, p.walletName, walletCurrency(p.walletName), walletCache);
    const matches = await prisma.transaction.findMany({
      where: { walletId: wallet.id, date: new Date(p.date), amount: Math.abs(p.amount), description: p.description },
      select: { id: true },
    });
    if (matches.length !== 1) {
      console.log(`  WARNING: expected exactly 1 superseded transaction for ${p.walletName} ${p.date} ${p.amount} "${p.description}", found ${matches.length} — skipping, not guessing`);
      continue;
    }
    await deleteTransaction({ id: matches[0].id });
    console.log(`  deleted superseded: ${p.walletName} ${p.date} ${p.amount}`);
  }
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error(`No user with email ${EMAIL}`);

  const { rows: dailyRows, skipped: dailySkipped } = parseJago(DAILY_PDF);
  const { rows: mainRows, skipped: mainSkipped } = parseJago(MAIN_PDF);

  const tossRows = TOSS_TSV ? parseToss(TOSS_TSV) : [];
  const nhRows = NH_PDFS.flatMap((p) => parseNH(p));
  const bsiRows = BSI_PDFS.flatMap((p) => parseBSI(p));

  // Matching against mainRows must run before buildJagoPlan reads it, so matched rows are already
  // flagged `used` and don't also get imported as plain "FLIPTECH/UMAR SYARIF" income.
  const nhTossTransfers = matchNhToss(nhRows, tossRows);
  const nhMainTransfers = matchNhMainPocket(nhRows, mainRows);
  const { transfers: bsiMainTransfers, supersededPlain: bsiSuperseded } = matchBsiMainPocket(bsiRows, mainRows);
  const { transfers: tossEmergencyTransfers, supersededPlain: emergencySuperseded } = matchTossEmergencyFund(tossRows);

  const { transfers: jagoTransfers, plain: jagoPlain, skippedInterest: jagoInterest } = buildJagoPlan(dailyRows, mainRows);
  const allTransfers = [...jagoTransfers, ...nhTossTransfers, ...nhMainTransfers, ...bsiMainTransfers, ...tossEmergencyTransfers];

  const tossPlain: PlainTxn[] = tossRows
    .filter((r) => !r.used)
    .map((r) => ({ walletName: 'Toss Bank', date: `${r.date}T${r.time}+09:00`, amount: r.amount, description: r.desc || r.type }));
  const tossInterest = tossRows.filter((r) => r.type === '이자입금').length;

  const nhPlain: PlainTxn[] = nhRows
    .filter((r) => !r.used)
    .map((r) => ({ walletName: 'NH Bank', date: `${r.date}T${r.time}+09:00`, amount: r.amount, description: `${r.content} ${r.record}`.trim() }));
  const nhInterest = nhRows.filter((r) => isInterestNH(r.content)).length;

  const bsiPlain: PlainTxn[] = bsiRows
    .filter((r) => !r.used)
    .map((r) => ({ walletName: 'Bank BSI', date: `${r.date}T${r.time}:00+07:00`, amount: r.amount, description: r.desc }));

  const allPlain = [...jagoPlain, ...DAILY_MANUAL_ROWS, ...tossPlain, ...nhPlain, ...bsiPlain];
  const income = allPlain.filter((t) => t.amount > 0);
  const expense = allPlain.filter((t) => t.amount < 0);

  console.log('=== Parse summary ===');
  console.log('Jago Daily Expenses rows:', dailyRows.length, '(unparsed lines:', dailySkipped.length, ')');
  dailySkipped.forEach((l) => console.log('  SKIPPED:', l));
  console.log('  balance-invariant mismatches:', checkInvariant(dailyRows, 'Daily'));
  console.log('Jago Main Pocket rows:', mainRows.length, '(unparsed lines:', mainSkipped.length, ')');
  mainSkipped.forEach((l) => console.log('  SKIPPED:', l));
  console.log('  balance-invariant mismatches:', checkInvariant(mainRows, 'Main'));
  console.log('Transfer pairs (Daily <-> Main):', jagoTransfers.length);
  console.log('Interest/Tax-on-interest rows (Jago, included):', jagoInterest);
  if (TOSS_TSV) console.log('Toss rows:', tossPlain.length, '| interest rows (included):', tossInterest);
  console.log('NH Bank rows:', nhPlain.length, '| interest rows (included):', nhInterest);
  console.log('Transfer pairs (NH <-> Toss):', nhTossTransfers.length);
  console.log('Transfer pairs (NH <-> Main Pocket):', nhMainTransfers.length, '/', NH_MAIN_POCKET_TRANSFERS.length, 'expected');
  console.log('BSI rows:', bsiPlain.length + bsiMainTransfers.length, '(balance-invariant mismatches:', checkInvariant(bsiRows, 'BSI'), ')');
  console.log('Transfer pairs (BSI <-> Main Pocket):', bsiMainTransfers.length);
  console.log('Transfer pairs (Toss <-> Emergency Fund):', tossEmergencyTransfers.length);
  console.log('Plain transactions to import:', allPlain.length, '-> income:', income.length, 'expense:', expense.length);
  console.log(COMMIT ? '\n--commit set: writing to DB...' : '\nDry run only, nothing written. Pass --commit to apply.');

  if (!COMMIT) {
    process.exit(0);
  }

  const walletCache = new Map<string, { id: string }>();
  const categoryCache = new Map<string, { id: string }>();

  const transfersToWrite = NEW_ONLY ? [...bsiMainTransfers, ...tossEmergencyTransfers] : allTransfers;
  const plainToWrite = NEW_ONLY ? bsiPlain : allPlain;

  if (NEW_ONLY) {
    const superseded = [...bsiSuperseded, ...emergencySuperseded];
    console.log(`\n--new-only: deleting ${superseded.length} plain transactions a prior run already committed for these rows...`);
    await deleteSupersededPlain(user.id, superseded, walletCache);
    console.log(`--new-only: writing ${transfersToWrite.length} transfers + ${plainToWrite.length} plain txns (BSI + Emergency Fund only)`);
  }

  for (const t of transfersToWrite) {
    const from = await ensureWallet(user.id, t.fromWallet, walletCurrency(t.fromWallet), walletCache);
    const to = await ensureWallet(user.id, t.toWallet, walletCurrency(t.toWallet), walletCache);
    await createTransfer(user.id, {
      fromWalletId: from.id,
      toWalletId: to.id,
      amountSent: t.amountSent,
      amountReceived: t.amountReceived,
      date: t.date,
    });
  }

  for (const t of plainToWrite) {
    const wallet = await ensureWallet(user.id, t.walletName, walletCurrency(t.walletName), walletCache);
    const type = t.amount > 0 ? 'INCOME' : 'EXPENSE';
    const category = await ensureOtherCategory(user.id, type, categoryCache);
    await createTransaction({
      wallet: { connect: { id: wallet.id } },
      category: { connect: { id: category.id } },
      amount: Math.abs(t.amount),
      description: t.description,
      date: new Date(t.date),
    });
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err?.message ?? String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

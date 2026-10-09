import { NextFunction, Request, Response } from 'express';
import { CapturePhotoInput, CaptureTextInput } from '../schemas/capture.schema';
import { AiInput, AiNotConfiguredError, AiUnavailableError, extractTransaction } from '../services/ai.service';
import { CaptureError, findOrCreateOtherCategory, resolveDraft, summarize, TransactionDraft } from '../services/capture.service';
import { findCategories } from '../services/category.service';
import { createTransaction } from '../services/transaction.service';
import { findWalletsByUserId } from '../services/wallet.service';
import AppError from '../utils/appError';

const timeZone = () => process.env.TZ || 'Asia/Seoul';

async function draftFor(userId: string, input: AiInput): Promise<TransactionDraft> {
  const [wallets, categories] = await Promise.all([
    findWalletsByUserId(userId),
    findCategories({ OR: [{ userId }, { userId: null }] }),
  ]);
  const now = new Date();
  const extraction = await extractTransaction(input, { wallets, categories, now, timeZone: timeZone() });
  return resolveDraft(extraction, {
    wallets,
    categories,
    now,
    otherCategory: (type) => findOrCreateOtherCategory(userId, type),
  });
}

// Readable, Shortcut-friendly errors
function captureFailure(err: unknown, next: NextFunction) {
  if (err instanceof AiNotConfiguredError) return next(new AppError(503, "AI capture isn't set up"));
  if (err instanceof AiUnavailableError) return next(new AppError(503, 'AI is unavailable, try again later'));
  if (err instanceof CaptureError) return next(new AppError(422, err.message));
  return next(err);
}

// iOS Shortcut: OCR text in, saved transaction + one-line summary out
export const captureTextHandler = async (req: Request<{}, {}, CaptureTextInput>, res: Response, next: NextFunction) => {
  try {
    const draft = await draftFor(res.locals.user.id, { text: req.body.text });
    const transaction = await createTransaction({
      wallet: { connect: { id: draft.walletId } },
      category: { connect: { id: draft.categoryId } },
      amount: draft.amount,
      description: draft.description,
      date: new Date(draft.date),
    });
    res.status(201).json({ status: 'success', message: summarize(draft), data: { transaction } });
  } catch (err) {
    captureFailure(err, next);
  }
};

// App: photo in, draft out; the user confirms by saving through POST /api/transactions
export const capturePhotoHandler = async (req: Request<{}, {}, CapturePhotoInput>, res: Response, next: NextFunction) => {
  try {
    const draft = await draftFor(res.locals.user.id, { image: req.body.image, mimeType: req.body.mimeType });
    res.status(200).json({ status: 'success', data: { draft } });
  } catch (err) {
    captureFailure(err, next);
  }
};

// The fixed JSON shape Gemini must return (see the spec's "AI contract")
export interface AiExtraction {
  found: boolean;
  type: 'INCOME' | 'EXPENSE';
  amount: number | null;
  currency: string | null;
  description: string;
  date: string | null;
  categoryName: string | null;
  walletName: string | null;
}

export const extractTransaction = async (): Promise<AiExtraction> => {
  throw new Error('not implemented');
};

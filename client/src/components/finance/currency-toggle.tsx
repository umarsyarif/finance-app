import { FilterChips } from './filter-chips';

// Home's currency switch; hidden when every wallet uses the same currency
export function CurrencyToggle({ currencies, value, onChange }: { currencies: string[]; value: string; onChange: (c: string) => void }) {
  if (currencies.length < 2) return null;
  return <FilterChips label="Currency" options={currencies.map((c) => ({ value: c, label: c }))} value={value} onChange={onChange} />;
}

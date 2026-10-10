import { useMemo } from 'react';
import { useTheme } from '@/contexts/theme.context';

// Chart colors come from the theme tokens (SVG attributes can't read CSS variables)
export function useTokenColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const get = (name: string) => css.getPropertyValue(name).trim();
    return { income: get('--income'), expense: get('--expense'), grid: get('--border'), muted: get('--muted-foreground') };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

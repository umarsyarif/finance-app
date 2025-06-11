import { ThemeProvider } from '@/contexts/theme.context';
import { AuthProvider } from '@/contexts/auth.context';
import { PWAPrompt } from '@/components/pwa-prompt';
import { Toaster } from 'sonner';
import Router from './Router';
import { BrowserRouter } from 'react-router-dom';

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <AuthProvider>
          <Router />
          <PWAPrompt />
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

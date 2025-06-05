import { ThemeProvider } from '@/contexts/theme.context';
import { AuthProvider } from '@/contexts/auth.context';
import Router from './Router';
import { BrowserRouter } from 'react-router-dom';

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <AuthProvider>
          <Router />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/app-layout';
import NotMatch from './pages/NotMatch';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import { MonthlyTransactionsView } from './pages/Transactions';
import { Wallets } from './pages/Wallets';
import Settings from './pages/Settings';
import { useAuth } from '@/contexts/auth.context';

const ProtectedRoutes = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    return user ? children : <Navigate to="/login" replace />;
};

export default function Router() {
    const { user } = useAuth();
    return (
        <Routes>
            {/* Auth routes without AppLayout */}
            <Route path="login" element={user ? <Navigate to="/" replace /> : <Login />} />
            <Route path="register" element={user ? <Navigate to="/" replace /> : <Register />} />
            {/* Protected routes with AppLayout */}
            <Route element={<ProtectedRoutes><AppLayout /></ProtectedRoutes>}>
                <Route path="" element={<Dashboard />} />
                <Route path="transactions" element={<MonthlyTransactionsView />} />
                <Route path="wallets" element={<Wallets />} />
                <Route path="stats" element={<Navigate to="/" replace />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<NotMatch />} />
            </Route>
        </Routes>
    );
}

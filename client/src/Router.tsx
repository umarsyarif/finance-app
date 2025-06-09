import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/app-layout';
import NotMatch from './pages/NotMatch';
import Dashboard from './pages/Dashboard';
import Sample from './pages/Sample';
import ComingSoon from './pages/ComingSoon';
import Login from './pages/Login';
import Register from './pages/Register';
import { MonthlyTransactionsView } from './pages/Transactions';
import { Wallets } from './pages/Wallets';
import Stats from './pages/Stats';
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
            {!user && <Route path="login" element={<Login />} />}
            {!user && <Route path="register" element={<Register />} />}
            {/* Protected routes with AppLayout */}
            <Route element={<ProtectedRoutes><AppLayout /></ProtectedRoutes>}>
                <Route path="" element={<Dashboard />} />
                <Route path="transactions" element={<MonthlyTransactionsView />} />
                <Route path="wallets" element={<Wallets />} />
                <Route path="stats" element={<Stats />} />
                <Route path="pages">
                    <Route path="sample" element={<Sample />} />
                    <Route path="feature" element={<ComingSoon />} />
                </Route>
                <Route path="*" element={<NotMatch />} />
            </Route>
        </Routes>
    );
}

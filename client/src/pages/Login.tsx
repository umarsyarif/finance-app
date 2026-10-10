import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/app-logo';
import { useAuth } from '@/contexts/auth.context';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(formData.email, formData.password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <Card className="w-full max-w-[400px] border-0 bg-transparent shadow-none">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <AppLogo data-testid="app-logo" />
          </div>
          <CardTitle data-testid="card-title" className="text-[32px] font-bold tracking-[-0.02em]">Welcome back</CardTitle>
          <CardDescription data-testid="card-description">Enter your email to sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="rounded-[20px] bg-card p-4 text-sm text-expense">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Input
                data-testid="input-email"
                type="email"
                name="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="h-[52px] rounded-[20px] bg-card px-[18px]"
              />
            </div>
            <div className="space-y-2">
              <Input
                data-testid="input-password"
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
                className="h-[52px] rounded-[20px] bg-card px-[18px]"
              />
            </div>
            
            <Button
              data-testid="submit-button"
              type="submit"
              className="h-[52px] w-full rounded-full text-[15px]"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
            
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
/**
 * Login Page
 * Allows users to sign in with email and password
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Redirect to dashboard on success
      router.push('/dashboard');
    } catch (err: any) {
      console.error('[Login] Error:', err);
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header with logo and theme toggle */}
      <div className="flex justify-between items-center px-6 py-4 border-b">
        <div className="flex items-center gap-4">
          <Image
            src="/logo/Verbio-logo-trans.svg"
            alt="Verbio Logo"
            width={180}
            height={32}
            className="h-8 w-auto dark:hidden"
            priority
          />
          <Image
            src="/logo/Verbio-logo-trans-dark.svg"
            alt="Verbio Logo"
            width={180}
            height={32}
            className="h-8 w-auto hidden dark:block"
            priority
          />
        </div>
        <ThemeToggle />
      </div>

      {/* Main content */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your Verbio Call Assistant account
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-destructive">Sign in failed</h3>
                  <p className="mt-1 text-sm text-destructive/90">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className="h-11"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* Sign up link */}
          <div className="text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t py-6 px-6">
        <p className="text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Verbio. All rights reserved.
        </p>
      </div>
    </div>
  );
}

/**
 * Signup Page
 * Allows new users to create an account
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
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { signUp } = useAuth();
  const router = useRouter();

  // Password validation
  const passwordRequirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[^A-Za-z0-9]/.test(password),
  };

  const passwordValid = Object.values(passwordRequirements).every(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password requirements
    if (!passwordValid) {
      setError('Password does not meet requirements');
      return;
    }

    setLoading(true);

    try {
      const { error: signUpError } = await signUp(email, password, {
        email,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Show success message
      setSuccess(true);
      setLoading(false);
    } catch (err: any) {
      console.error('[Signup] Error:', err);
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  }

  // If signup successful, show confirmation message
  if (success) {
    return (
      <div className="flex min-h-screen flex-col">
        {/* Header */}
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

        {/* Success message */}
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-md space-y-8 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500" />
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight">Check your email</h1>
              <p className="mt-4 text-muted-foreground">
                We've sent a confirmation link to{' '}
                <span className="font-medium text-foreground">{email}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Click the link in the email to activate your account.
              </p>
            </div>

            <div className="space-y-4">
              <Button
                onClick={() => router.push('/login')}
                className="w-full h-11"
                size="lg"
              >
                Go to Sign In
              </Button>

              <p className="text-sm text-muted-foreground">
                Didn't receive an email?{' '}
                <button
                  onClick={() => setSuccess(false)}
                  className="text-primary hover:underline font-medium"
                >
                  Try again
                </button>
              </p>
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
            <h1 className="text-3xl font-bold tracking-tight">Create an account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Get started with Verbio Call Assistant
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-destructive">Sign up failed</h3>
                  <p className="mt-1 text-sm text-destructive/90">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Signup form */}
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  className="h-11"
                />

                {/* Password requirements */}
                {password && (
                  <div className="mt-3 space-y-2 rounded-lg border p-3 text-xs">
                    <p className="font-medium">Password must contain:</p>
                    <ul className="space-y-1">
                      <li className={passwordRequirements.minLength ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'}>
                        {passwordRequirements.minLength ? '✓' : '○'} At least 8 characters
                      </li>
                      <li className={passwordRequirements.hasUpperCase ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'}>
                        {passwordRequirements.hasUpperCase ? '✓' : '○'} One uppercase letter
                      </li>
                      <li className={passwordRequirements.hasLowerCase ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'}>
                        {passwordRequirements.hasLowerCase ? '✓' : '○'} One lowercase letter
                      </li>
                      <li className={passwordRequirements.hasNumber ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'}>
                        {passwordRequirements.hasNumber ? '✓' : '○'} One number
                      </li>
                      <li className={passwordRequirements.hasSpecialChar ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'}>
                        {passwordRequirements.hasSpecialChar ? '✓' : '○'} One special character
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  className="h-11"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !passwordValid}
              className="w-full h-11"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          {/* Sign in link */}
          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
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

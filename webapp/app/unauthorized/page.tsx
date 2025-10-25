/**
 * Unauthorized Page
 * Shown when user doesn't have required permissions or role
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

export default function UnauthorizedPage() {
  const { appUser, signOut } = useAuth();

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
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <ShieldAlert className="h-12 w-12 text-destructive" />
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
            <p className="mt-4 text-muted-foreground">
              You don't have permission to access this resource.
            </p>

            {appUser && (
              <div className="mt-6 rounded-lg border bg-muted/50 p-4 text-left">
                <p className="text-sm text-muted-foreground">Signed in as:</p>
                <p className="mt-1 font-medium">{appUser.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Role: <span className="font-medium text-foreground">{appUser.role}</span>
                </p>
              </div>
            )}

            <p className="mt-6 text-sm text-muted-foreground">
              Contact your administrator if you believe this is a mistake.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/dashboard">
              <Button className="w-full h-11" size="lg">
                Go to Dashboard
              </Button>
            </Link>

            {appUser && (
              <Button
                variant="outline"
                className="w-full h-11"
                size="lg"
                onClick={() => signOut()}
              >
                Sign Out
              </Button>
            )}
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

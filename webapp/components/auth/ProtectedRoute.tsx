/**
 * Protected Route Wrapper
 * Redirects to login if user is not authenticated
 * Optionally checks for specific permissions or roles
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { hasPermission, hasRole } from '@/lib/auth/permissions';

type ProtectedRouteProps = {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRole?: ('owner' | 'admin' | 'member' | 'viewer')[];
  fallback?: React.ReactNode;
};

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredRole,
  fallback,
}: ProtectedRouteProps) {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !appUser) {
      console.log('[ProtectedRoute] Not authenticated, redirecting to login');
      router.push('/login');
      return;
    }

    if (appUser) {
      // Check permission
      if (requiredPermission && !hasPermission(appUser, requiredPermission)) {
        console.log('[ProtectedRoute] Permission denied:', requiredPermission);
        router.push('/unauthorized');
        return;
      }

      // Check role
      if (requiredRole && !hasRole(appUser, requiredRole)) {
        console.log('[ProtectedRoute] Role denied:', requiredRole);
        router.push('/unauthorized');
        return;
      }
    }
  }, [appUser, loading, requiredPermission, requiredRole, router]);

  if (loading) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      )
    );
  }

  if (!appUser) {
    return null;
  }

  return <>{children}</>;
}

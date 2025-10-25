/**
 * Authentication Provider
 * Manages user authentication state and provides auth methods throughout the app
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { AuthenticatedUser } from '@/types/auth';

type AppUserRow = {
  id: string;
  email: string | null;
  tenant_id: string;
  role: string;
  permissions: string[] | null;
  metadata: Record<string, unknown> | null;
  status: string;
};

type AuthContextType = {
  user: User | null;
  appUser: AuthenticatedUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: SupabaseAuthError | null }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: SupabaseAuthError | null }>;
  signOut: () => Promise<{ error: SupabaseAuthError | null }>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AuthenticatedUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[Auth] Initial session loaded:', session ? 'authenticated' : 'not authenticated');
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadAppUser(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth state changed:', event);

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadAppUser(session.user.id);
      } else {
        setAppUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Load application user data from users table
   */
  async function loadAppUser(authUserId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, tenant_id, role, permissions, metadata, status')
        .eq('auth_user_id', authUserId)
        .eq('status', 'active')
        .single<AppUserRow>();

      if (error) {
        console.error('[Auth] Failed to load app user:', error);
        setAppUser(null);
        setLoading(false);
        return;
      }

      if (data) {
        const appUserData: AuthenticatedUser = {
          id: data.id,
          authUserId,
          email: data.email || '',
          tenantId: data.tenant_id,
          role: data.role as any,
          permissions: (data.permissions as string[]) || [],
          metadata: (data.metadata as Record<string, any>) || {},
          status: data.status,
        };

        console.log('[Auth] App user loaded:', appUserData.email, appUserData.role);
        setAppUser(appUserData);
      } else {
        console.warn('[Auth] No app user found for auth user:', authUserId);
        setAppUser(null);
      }
    } catch (error) {
      console.error('[Auth] Exception loading app user:', error);
      setAppUser(null);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Sign in with email and password
   */
  async function signIn(email: string, password: string) {
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Auth] Sign in error:', error);
        return { error };
      }

      console.log('[Auth] Sign in successful');
      return { error: null };
    } catch (error) {
      console.error('[Auth] Sign in exception:', error);
      return { error: error as SupabaseAuthError };
    } finally {
      setLoading(false);
    }
  }

  /**
   * Sign up with email and password
   */
  async function signUp(email: string, password: string, metadata?: any) {
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) {
        console.error('[Auth] Sign up error:', error);
        return { error };
      }

      console.log('[Auth] Sign up successful - check email for confirmation');
      return { error: null };
    } catch (error) {
      console.error('[Auth] Sign up exception:', error);
      return { error: error as SupabaseAuthError };
    } finally {
      setLoading(false);
    }
  }

  /**
   * Sign out
   */
  async function signOut() {
    setLoading(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('[Auth] Sign out error:', error);
        return { error };
      }

      console.log('[Auth] Sign out successful');
      setUser(null);
      setAppUser(null);
      setSession(null);

      return { error: null };
    } catch (error) {
      console.error('[Auth] Sign out exception:', error);
      return { error: error as SupabaseAuthError };
    } finally {
      setLoading(false);
    }
  }

  /**
   * Manually refresh session
   */
  async function refreshSession() {
    const { data: { session } } = await supabase.auth.refreshSession();

    if (session) {
      setSession(session);
      setUser(session.user);
      await loadAppUser(session.user.id);
    }
  }

  const value = {
    user,
    appUser,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

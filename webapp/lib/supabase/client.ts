/**
 * Supabase Client for Browser
 * Used in client components for authentication and data access
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../shared/types/database';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

  return client;
}

/**
 * Get existing client instance or create new one
 */
export function getClient() {
  if (!client) {
    return createClient();
  }
  return client;
}

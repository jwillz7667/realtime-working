import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Database features will be disabled.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for database tables
export interface Call {
  id: string;
  phone_number: string;
  call_sid: string;
  direction: 'inbound' | 'outbound';
  status: string | null;
  duration: number | null;
  recording_url: string | null;
  recording_sid: string | null;
  instructions_used: string | null;
  created_at: string;
  ended_at: string | null;
}

export interface InstructionPrompt {
  id: string;
  name: string;
  instructions: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

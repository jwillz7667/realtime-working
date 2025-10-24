import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase credentials not configured. Database features will be disabled.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Types for database tables
export interface Call {
  id?: string;
  phone_number: string;
  call_sid: string;
  direction: 'inbound' | 'outbound';
  status?: string | null;
  duration?: number | null;
  recording_url?: string | null;
  recording_sid?: string | null;
  instructions_used?: string | null;
  created_at?: string;
  ended_at?: string | null;
}

export interface InstructionPrompt {
  id?: string;
  name: string;
  instructions: string;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

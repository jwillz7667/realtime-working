# Database Setup with Supabase

We'll use Supabase (PostgreSQL) to store call history and instruction prompts.

## Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Name: `realtime-twilio`
4. Database Password: (generate one, save it)
5. Region: Choose closest to you
6. Click **Create new project**

Wait 2-3 minutes for it to provision.

---

## Step 2: Create Database Tables

Go to **SQL Editor** in Supabase dashboard and run this SQL:

```sql
-- Calls table to track all call history
CREATE TABLE calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  call_sid TEXT UNIQUE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT,
  duration INTEGER,
  recording_url TEXT,
  recording_sid TEXT,
  instructions_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Add index for faster queries
CREATE INDEX idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX idx_calls_phone_number ON calls(phone_number);
CREATE INDEX idx_calls_call_sid ON calls(call_sid);

-- Instruction prompts table
CREATE TABLE instruction_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  instructions TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index
CREATE INDEX idx_prompts_name ON instruction_prompts(name);

-- Insert default prompt
INSERT INTO instruction_prompts (name, instructions, is_default)
VALUES (
  'Default Assistant',
  'You are a helpful assistant that keeps responses concise, clear, and warm.',
  TRUE
);

-- Enable Row Level Security (RLS)
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruction_prompts ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - you can restrict later)
CREATE POLICY "Allow all access to calls" ON calls
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to prompts" ON instruction_prompts
  FOR ALL USING (true) WITH CHECK (true);
```

---

## Step 3: Get Your Supabase Credentials

1. Go to **Project Settings** → **API**
2. Copy these values:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon/public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (keep secret!)
```

---

## Step 4: Add Environment Variables

### For Vercel (Frontend):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### For Railway (Backend):

```
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (use service_role key)
```

---

## Step 5: Install Supabase Client

```bash
# In webapp directory
cd webapp
npm install @supabase/supabase-js

# In websocket-server directory
cd websocket-server
npm install @supabase/supabase-js
```

---

## Database Schema

### `calls` table:
- `id` - UUID primary key
- `phone_number` - Phone number called/calling
- `call_sid` - Twilio call SID (unique)
- `direction` - 'inbound' or 'outbound'
- `status` - Call status (queued, ringing, in-progress, completed, etc.)
- `duration` - Call duration in seconds
- `recording_url` - URL to Twilio recording
- `recording_sid` - Twilio recording SID
- `instructions_used` - Instructions/prompt used for this call
- `created_at` - When call was initiated
- `ended_at` - When call ended

### `instruction_prompts` table:
- `id` - UUID primary key
- `name` - Prompt name (unique)
- `instructions` - The actual instruction text
- `is_default` - Whether this is the default prompt
- `created_at` - When created
- `updated_at` - When last updated

---

## Features You'll Get:

1. **Call History Dashboard**
   - View all past calls
   - Filter by date, phone number
   - See duration, status
   - Access recordings

2. **Saved Prompts**
   - Save frequently used instructions
   - Quick-load prompts
   - Set default prompt
   - Edit/delete prompts

3. **Analytics**
   - Total calls made
   - Average call duration
   - Most called numbers
   - Call success rate

---

## Next Steps:

After running the SQL and getting your credentials, I'll create:
1. Supabase client utilities
2. API routes for CRUD operations
3. UI components for call history
4. UI for managing prompts
5. Integration with existing call flow to auto-save calls

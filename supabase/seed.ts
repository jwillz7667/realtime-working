/**
 * Seed Development Data
 * Creates sample tenants, users, and test data for development
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../websocket-server/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seed() {
  console.log('🌱 Seeding development data...\n');

  try {
    // =====================================================
    // CREATE TENANTS
    // =====================================================
    console.log('📦 Creating tenants...');

    const { data: tenant1, error: tenant1Error } = await supabase
      .from('tenants')
      .insert({
        name: 'Demo Company',
        slug: 'demo-company',
        tier: 'pro',
        status: 'active',
        settings: {
          timezone: 'America/New_York',
          language: 'en',
        },
        features: {
          recording: true,
          transcription: true,
          analytics: true,
        },
      })
      .select()
      .single();

    if (tenant1Error) {
      console.error('   ❌ Failed to create tenant 1:', tenant1Error.message);
    } else {
      console.log(`   ✅ Created tenant: ${tenant1.name} (${tenant1.id})`);
    }

    const { data: tenant2, error: tenant2Error } = await supabase
      .from('tenants')
      .insert({
        name: 'Acme Corporation',
        slug: 'acme-corp',
        tier: 'enterprise',
        status: 'active',
        settings: {
          timezone: 'America/Los_Angeles',
          language: 'en',
        },
        features: {
          recording: true,
          transcription: true,
          analytics: true,
          customBranding: true,
          apiAccess: true,
        },
      })
      .select()
      .single();

    if (tenant2Error) {
      console.error('   ❌ Failed to create tenant 2:', tenant2Error.message);
    } else {
      console.log(`   ✅ Created tenant: ${tenant2.name} (${tenant2.id})`);
    }

    if (!tenant1 || !tenant2) {
      console.error('\n❌ Failed to create tenants. Exiting.');
      process.exit(1);
    }

    // =====================================================
    // CREATE USERS
    // =====================================================
    console.log('\n👥 Creating users...');

    const { data: user1, error: user1Error } = await supabase
      .from('users')
      .insert({
        tenant_id: tenant1.id,
        email: 'admin@democompany.com',
        full_name: 'Admin User',
        role: 'admin',
        status: 'active',
      })
      .select()
      .single();

    if (user1Error) {
      console.error('   ❌ Failed to create user 1:', user1Error.message);
    } else {
      console.log(`   ✅ Created user: ${user1.full_name} (${user1.email})`);
    }

    const { data: user2, error: user2Error } = await supabase
      .from('users')
      .insert({
        tenant_id: tenant1.id,
        email: 'support@democompany.com',
        full_name: 'Support Agent',
        role: 'member',
        status: 'active',
      })
      .select()
      .single();

    if (user2Error) {
      console.error('   ❌ Failed to create user 2:', user2Error.message);
    } else {
      console.log(`   ✅ Created user: ${user2.full_name} (${user2.email})`);
    }

    const { data: user3, error: user3Error } = await supabase
      .from('users')
      .insert({
        tenant_id: tenant2.id,
        email: 'owner@acmecorp.com',
        full_name: 'Owner User',
        role: 'owner',
        status: 'active',
      })
      .select()
      .single();

    if (user3Error) {
      console.error('   ❌ Failed to create user 3:', user3Error.message);
    } else {
      console.log(`   ✅ Created user: ${user3.full_name} (${user3.email})`);
    }

    // =====================================================
    // CREATE SAMPLE CALL SESSIONS
    // =====================================================
    console.log('\n📞 Creating sample call sessions...');

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: session1, error: session1Error } = await supabase
      .from('call_sessions')
      .insert({
        tenant_id: tenant1.id,
        user_id: user1?.id,
        call_sid: 'CA' + Math.random().toString(36).substring(2, 15).toUpperCase(),
        direction: 'inbound',
        from_number: '+15551234567',
        to_number: '+15559876543',
        status: 'completed',
        start_time: yesterday.toISOString(),
        answer_time: new Date(yesterday.getTime() + 2000).toISOString(),
        end_time: new Date(yesterday.getTime() + 125000).toISOString(),
        duration_seconds: 123,
        model: 'gpt-realtime-2025-08-28',
        voice: 'marin',
        config: {
          turn_detection: { type: 'semantic_vad', eagerness: 'medium' },
        },
        quality_score: 4.5,
        latency_avg_ms: 450,
      })
      .select()
      .single();

    if (session1Error) {
      console.error('   ❌ Failed to create session 1:', session1Error.message);
    } else {
      console.log(`   ✅ Created call session: ${session1.call_sid}`);
    }

    // =====================================================
    // CREATE SAMPLE TRANSCRIPTS
    // =====================================================
    if (session1) {
      console.log('\n💬 Creating sample transcripts...');

      const transcripts = [
        {
          session_id: session1.id,
          speaker: 'user' as const,
          content: 'Hello, I need help with my account.',
          timestamp: new Date(yesterday.getTime() + 3000).toISOString(),
          sequence_number: 1,
          confidence: 0.95,
        },
        {
          session_id: session1.id,
          speaker: 'assistant' as const,
          content: "Of course! I'd be happy to help you with your account. What specifically do you need assistance with?",
          timestamp: new Date(yesterday.getTime() + 5000).toISOString(),
          sequence_number: 2,
          confidence: 0.98,
        },
        {
          session_id: session1.id,
          speaker: 'user' as const,
          content: "I can't remember my password and need to reset it.",
          timestamp: new Date(yesterday.getTime() + 10000).toISOString(),
          sequence_number: 3,
          confidence: 0.92,
        },
        {
          session_id: session1.id,
          speaker: 'assistant' as const,
          content: "No problem! I can help you reset your password. Let me send a password reset link to your email address.",
          timestamp: new Date(yesterday.getTime() + 12000).toISOString(),
          sequence_number: 4,
          confidence: 0.97,
        },
      ];

      const { data: transcriptsData, error: transcriptsError } = await supabase
        .from('transcripts')
        .insert(transcripts)
        .select();

      if (transcriptsError) {
        console.error('   ❌ Failed to create transcripts:', transcriptsError.message);
      } else {
        console.log(`   ✅ Created ${transcriptsData.length} transcript entries`);
      }
    }

    // =====================================================
    // CREATE USAGE METRICS
    // =====================================================
    console.log('\n📊 Creating usage metrics...');

    const metrics = [
      {
        tenant_id: tenant1.id,
        session_id: session1?.id,
        metric_type: 'audio_input_seconds' as const,
        quantity: 123,
        unit_cost: 0.01,
        total_cost_usd: 1.23,
        timestamp: yesterday.toISOString(),
      },
      {
        tenant_id: tenant1.id,
        session_id: session1?.id,
        metric_type: 'audio_output_seconds' as const,
        quantity: 98,
        unit_cost: 0.01,
        total_cost_usd: 0.98,
        timestamp: yesterday.toISOString(),
      },
      {
        tenant_id: tenant1.id,
        session_id: session1?.id,
        metric_type: 'input_tokens' as const,
        quantity: 1500,
        unit_cost: 0.00002,
        total_cost_usd: 0.03,
        timestamp: yesterday.toISOString(),
      },
      {
        tenant_id: tenant1.id,
        session_id: session1?.id,
        metric_type: 'output_tokens' as const,
        quantity: 2000,
        unit_cost: 0.00002,
        total_cost_usd: 0.04,
        timestamp: yesterday.toISOString(),
      },
    ];

    const { data: metricsData, error: metricsError } = await supabase
      .from('usage_metrics')
      .insert(metrics)
      .select();

    if (metricsError) {
      console.error('   ❌ Failed to create metrics:', metricsError.message);
    } else {
      console.log(`   ✅ Created ${metricsData.length} usage metric entries`);
    }

    // =====================================================
    // CREATE AUDIT LOG
    // =====================================================
    console.log('\n📝 Creating audit log entries...');

    const auditLogs = [
      {
        tenant_id: tenant1.id,
        user_id: user1?.id,
        action: 'tenant.created',
        resource_type: 'tenant',
        resource_id: tenant1.id,
        new_values: { name: tenant1.name, tier: tenant1.tier },
      },
      {
        tenant_id: tenant1.id,
        user_id: user1?.id,
        action: 'user.created',
        resource_type: 'user',
        resource_id: user1?.id,
        new_values: { email: user1?.email, role: user1?.role },
      },
      {
        tenant_id: tenant1.id,
        user_id: user1?.id,
        action: 'call.initiated',
        resource_type: 'call_session',
        resource_id: session1?.id,
        new_values: { call_sid: session1?.call_sid, direction: 'inbound' },
      },
    ];

    const { data: auditData, error: auditError } = await supabase
      .from('audit_logs')
      .insert(auditLogs)
      .select();

    if (auditError) {
      console.error('   ❌ Failed to create audit logs:', auditError.message);
    } else {
      console.log(`   ✅ Created ${auditData.length} audit log entries`);
    }

    // =====================================================
    // SUMMARY
    // =====================================================
    console.log('\n✅ Seed data created successfully!\n');
    console.log('📋 Summary:');
    console.log(`   Tenants: 2`);
    console.log(`   Users: 3`);
    console.log(`   Call Sessions: 1`);
    console.log(`   Transcripts: 4`);
    console.log(`   Usage Metrics: 4`);
    console.log(`   Audit Logs: 3`);
    console.log('\n🔑 Tenant IDs for .env:');
    console.log(`   Demo Company: ${tenant1.id}`);
    console.log(`   Acme Corporation: ${tenant2.id}`);
    console.log('\n👤 User IDs for testing:');
    if (user1) console.log(`   Admin User: ${user1.id}`);
    if (user2) console.log(`   Support Agent: ${user2.id}`);
    if (user3) console.log(`   Owner User: ${user3.id}`);
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

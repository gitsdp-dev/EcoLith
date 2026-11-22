import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://triwyjoaeglrolyutkef.supabase.co';
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const effectiveKey =
  rawServiceKey && rawServiceKey !== 'placeholder-service-role-key'
    ? rawServiceKey
    : process.env.SUPABASE_ANON_KEY || 'sb_publishable_hu0glsh8zIMQhfsXjidbgQ_PXY6xh3G';

if (!rawServiceKey || rawServiceKey === 'placeholder-service-role-key') {
  console.warn(
    'Notice: SUPABASE_SERVICE_ROLE_KEY is not configured; running with authenticated API key fallback.'
  );
}

/**
 * Service-Role Supabase Client.
 * Server-only module. Subject to strict architectural boundaries.
 * Bypasses RLS to call security definer functions and perform admin tasks when service key is present.
 */
export const supabaseAdmin = createClient(supabaseUrl, effectiveKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

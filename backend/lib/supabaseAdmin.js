import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in backend environment variables.');
}

/**
 * Service-Role Supabase Client.
 * Server-only module. Subject to strict architectural boundaries.
 * Bypasses RLS to call security definer functions and perform admin tasks.
 */
export const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceRoleKey || '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

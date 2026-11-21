/**
 * EcoLith Public Client Configuration
 * Only public credentials (SUPABASE_URL and SUPABASE_ANON_KEY) live here.
 * Never place service-role keys or encryption secrets in client code.
 */
export const CONFIG = {
  SUPABASE_URL: window.ECOLITH_SUPABASE_URL || 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: window.ECOLITH_SUPABASE_ANON_KEY || 'your_anon_key',
  API_BASE_URL: window.ECOLITH_API_BASE_URL || 'http://localhost:3000'
};

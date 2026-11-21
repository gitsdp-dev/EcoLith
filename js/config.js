/**
 * EcoLith Public Client Configuration
 * Only public credentials (SUPABASE_URL and SUPABASE_ANON_KEY) live here.
 * Never place service-role keys or encryption secrets in client code.
 */
export const CONFIG = {
  SUPABASE_URL:
    (typeof window !== 'undefined' && window.ECOLITH_SUPABASE_URL) ||
    'https://triwyjoaeglrolyutkef.supabase.co',
  SUPABASE_ANON_KEY:
    (typeof window !== 'undefined' && window.ECOLITH_SUPABASE_ANON_KEY) ||
    'sb_publishable_hu0glsh8zIMQhfsXjidbgQ_PXY6xh3G',
  API_BASE_URL:
    (typeof window !== 'undefined' && window.ECOLITH_API_BASE_URL) || 'http://localhost:3000'
};

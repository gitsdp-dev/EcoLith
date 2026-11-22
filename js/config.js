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
    (typeof window !== 'undefined' && window.ECOLITH_API_BASE_URL) ||
    (typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
      ? ''
      : 'http://localhost:3000'),
  ADMIN_EMAILS:
    (typeof window !== 'undefined' && window.ECOLITH_ADMIN_EMAILS) || [
      'githubsdp2011@gmail.com',
      'EducationPatra2011@outlook.com'
    ]
};

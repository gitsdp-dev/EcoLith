import { CONFIG } from './config.js';

let createClientFn;

// Support module import or script tag loading
if (
  typeof window !== 'undefined' &&
  window.supabase &&
  typeof window.supabase.createClient === 'function'
) {
  createClientFn = window.supabase.createClient;
} else if (typeof window !== 'undefined') {
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm');
    createClientFn = module.createClient;
  } catch (err) {
    console.error('Failed to load Supabase client library:', err);
  }
} else {
  // Node test environment: load from backend dependencies or provide fallback client
  try {
    const module = await import('../backend/node_modules/@supabase/supabase-js/dist/main/index.js');
    createClientFn = module.createClient;
  } catch {
    createClientFn = () => ({
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
          order: () => Promise.resolve({ data: [], error: null })
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'test-uuid' }, error: null })
          })
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: {}, error: null })
            })
          })
        })
      }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: { id: 'test-user-id' } }, error: null })
      }
    });
  }
}

if (!createClientFn) {
  throw new Error('Supabase client could not be initialized.');
}

/**
 * Singleton Supabase client instance for public browser operations.
 * Subject to Row Level Security (RLS) policies.
 */
export const supabase = createClientFn(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

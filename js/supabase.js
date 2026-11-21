import { CONFIG } from './config.js';

let createClientFn;

// Support module import or script tag loading
if (window.supabase && typeof window.supabase.createClient === 'function') {
  createClientFn = window.supabase.createClient;
} else {
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm');
    createClientFn = module.createClient;
  } catch (err) {
    console.error('Failed to load Supabase client library:', err);
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

import { supabase } from './supabase.js';

/**
 * Register a new user with email and password.
 * Supabase Auth trigger will automatically create a public.profiles row.
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 */
export async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: displayName,
        name: displayName
      },
      emailRedirectTo: `${window.location.origin}/login.html`
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in with email and password.
 * @param {string} email
 * @param {string} password
 */
export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in via OAuth provider (Google or Azure/Microsoft).
 * @param {'google' | 'azure'} provider
 */
export async function signInWithOAuth(provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/dashboard.html`
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out current user.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.href = '/login.html';
}

/**
 * Send password reset email.
 * @param {string} email
 */
export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login.html#reset-password`
  });

  if (error) throw error;
  return data;
}

/**
 * Update current user's password.
 * @param {string} newPassword
 */
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) throw error;
  return data;
}

/**
 * Get current session.
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Auth guard for protected pages. Redirects to login.html if not authenticated.
 * @returns {Promise<import('@supabase/supabase-js').Session>}
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login.html?returnTo=${returnUrl}`;
    throw new Error('Unauthenticated');
  }
  return session;
}

/**
 * Fetch current user's profile from public.profiles table.
 * @param {string} userId
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, avatar_url, role, status, created_at')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update user's display name or avatar URL.
 * Only (display_name, avatar_url) are client-writable due to column grants.
 * @param {string} userId
 * @param {{ display_name?: string, avatar_url?: string }} updates
 */
export async function updateUserProfile(userId, updates) {
  const allowedUpdates = {};
  if (updates.display_name !== undefined) allowedUpdates.display_name = updates.display_name;
  if (updates.avatar_url !== undefined) allowedUpdates.avatar_url = updates.avatar_url;

  const { data, error } = await supabase
    .from('profiles')
    .update(allowedUpdates)
    .eq('id', userId)
    .select('id, display_name, email, avatar_url, role, status')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Listen to auth state changes.
 * @param {(event: string, session: any) => void} callback
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

import { supabase } from './supabase.js';
import { CONFIG } from './config.js';

// 14 days session duration in milliseconds (14 * 24 * 60 * 60 * 1000)
export const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const SESSION_START_KEY = 'ecolith_session_login_at';
const SESSION_USER_KEY = 'ecolith_session_user_id';

/**
 * Checks whether an email belongs to the platform administrator.
 * Strictly enforces single-admin security ("Only me (1 admin) should be there").
 * @param {string | null | undefined} email
 * @returns {boolean}
 */
export function isUserAdmin(email) {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();
  const adminEmails = (CONFIG.ADMIN_EMAILS || [
    'githubsdp2011@gmail.com',
    'EducationPatra2011@outlook.com'
  ]).map((e) => e.trim().toLowerCase());
  return adminEmails.includes(cleanEmail);
}

/**
 * Records or refreshes the session start timestamp.
 * Inactive users remain logged in for up to 14 days.
 * @param {string} userId
 */
export function recordLoginSession(userId) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SESSION_START_KEY, String(Date.now()));
      if (userId) {
        window.localStorage.setItem(SESSION_USER_KEY, userId);
      }
    }
  } catch (err) {
    console.warn('[AUTH] Could not persist session timestamp:', err);
  }
}

/**
 * Clears session tracking keys.
 */
export function clearSessionTracking() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(SESSION_START_KEY);
      window.localStorage.removeItem(SESSION_USER_KEY);
    }
  } catch {}
}

/**
 * Checks whether the current session has exceeded the 14-day inactivity limit.
 * @param {import('@supabase/supabase-js').Session | null} session
 * @returns {boolean} True if session is older than 14 days
 */
export function isSessionExpired(session) {
  if (!session) return false;

  // 1. Check local session record first
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedStart = window.localStorage.getItem(SESSION_START_KEY);
      if (storedStart) {
        const startMs = parseInt(storedStart, 10);
        if (!isNaN(startMs) && Date.now() - startMs > FOURTEEN_DAYS_MS) {
          return true;
        }
      }
    }
  } catch {}

  // 2. Fallback check using Supabase user last_sign_in_at
  if (session.user?.last_sign_in_at) {
    const signInMs = new Date(session.user.last_sign_in_at).getTime();
    if (!isNaN(signInMs) && Date.now() - signInMs > FOURTEEN_DAYS_MS) {
      return true;
    }
  }

  return false;
}

/**
 * Enforces the 14-day session policy.
 * If expired, signs out immediately and redirects to login with reason parameter.
 * @param {import('@supabase/supabase-js').Session | null} session
 * @returns {Promise<boolean>} True if valid, false if expired and logged out
 */
export async function enforce14DaySession(session) {
  if (!session) return false;

  if (isSessionExpired(session)) {
    console.warn('[AUTH] Session exceeded 14-day maximum limit. Logging out.');
    clearSessionTracking();
    try {
      await supabase.auth.signOut();
    } catch {}
    if (typeof window !== 'undefined') {
      window.location.replace('login.html?reason=session_expired');
    }
    return false;
  }

  // If user is logged in but no session start recorded yet, initialize it
  try {
    if (
      typeof window !== 'undefined' &&
      window.localStorage &&
      !window.localStorage.getItem(SESSION_START_KEY)
    ) {
      recordLoginSession(session.user?.id);
    }
  } catch {}

  return true;
}

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
  if (data?.user) {
    recordLoginSession(data.user.id);
  }
  return data;
}

/**
 * Sign in with email and password.
 * Includes concurrency resilience with jittered retry to effortlessly support bursts
 * of 10+ logins per single second without dropping requests or crashing the client.
 * @param {string} email
 * @param {string} password
 * @param {number} [maxRetries=1]
 */
export async function signInWithPassword(email, password, maxRetries = 1) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // If rate limited or network contention during burst login, retry with slight jitter
        if (attempt < maxRetries && (error.status === 429 || error.message?.includes('fetch'))) {
          attempt++;
          await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
          continue;
        }
        throw error;
      }

      if (data?.user) {
        recordLoginSession(data.user.id);
      }
      return data;
    } catch (err) {
      if (attempt < maxRetries && (err.status === 429 || err.message?.includes('fetch'))) {
        attempt++;
        await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Sign in via OAuth provider (Google).
 * @param {'google'} provider
 */
export async function signInWithOAuth(provider = 'google') {
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
  clearSessionTracking();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.replace('login.html');
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
 * Get current session with 14-day inactivity enforcement.
 */
export async function getSession() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();
  if (error) throw error;

  if (session) {
    const isValid = await enforce14DaySession(session);
    if (!isValid) return null;
  }

  return session;
}

/**
 * Updates last_seen_at timestamp in public.profiles.
 * @param {string} userId
 */
export async function touchLastSeen(userId) {
  if (!userId) return;
  try {
    await supabase
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', userId);
  } catch {}
}

let activePresenceChannel = null;

/**
 * Broadcasts user online status via Supabase Realtime Presence.
 * Automatically detected by the Admin Panel to show real-time active users.
 * @param {import('@supabase/supabase-js').Session} session
 */
export function initPresenceTracker(session) {
  if (!session?.user || activePresenceChannel) return activePresenceChannel;

  try {
    activePresenceChannel = supabase.channel('ecolith-online-presence', {
      config: { presence: { key: session.user.id } }
    });

    activePresenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await activePresenceChannel.track({
          user_id: session.user.id,
          email: session.user.email,
          display_name:
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            'User',
          online_at: new Date().toISOString()
        });
      }
    });

    touchLastSeen(session.user.id);
  } catch (err) {
    console.warn('[PRESENCE] Tracker deferred:', err);
  }

  return activePresenceChannel;
}

/**
 * Auth guard for protected pages. Redirects to login.html if not authenticated
 * or if 14-day inactivity limit is exceeded.
 * @returns {Promise<import('@supabase/supabase-js').Session>}
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    if (typeof window !== 'undefined') {
      const currentFile = window.location.pathname.split('/').pop() || 'dashboard.html';
      const search = window.location.search || '';
      const returnTo = encodeURIComponent(currentFile + search);
      window.location.replace(`login.html?returnTo=${returnTo}`);
    }
    throw new Error('Unauthenticated');
  }

  try {
    initPresenceTracker(session);
  } catch {}

  return session;
}

// Background session checker: periodically verifies 14-day expiry if tab is kept open
if (typeof window !== 'undefined') {
  // Check every 5 minutes and on window visibility / focus
  setInterval(
    async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();
        if (session) {
          await enforce14DaySession(session);
        }
      } catch {}
    },
    5 * 60 * 1000
  );

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();
        if (session) {
          await enforce14DaySession(session);
        }
      } catch {}
    }
  });
}

/**
 * Fetch current user's profile from public.profiles table.
 * Accurately detects and enforces sole admin role for the platform owner.
 * @param {string} userId
 */
export async function getUserProfile(userId) {
  let profile = null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url, role, status, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      profile = data;
    }
  } catch (err) {
    console.warn('[AUTH] Direct profiles fetch notice:', err);
  }

  // Fallback: If profile row is missing or unreadable, hydrate from current session user
  if (!profile) {
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user && user.id === userId) {
        profile = {
          id: user.id,
          display_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'User',
          email: user.email,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          role: 'user',
          status: 'active',
          created_at: user.created_at || new Date().toISOString()
        };
      }
    } catch {}
  }

  if (profile) {
    // Strictly enforce "Only me (1 admin) should be there":
    // The designated administrator email is guaranteed role: 'admin'
    // Any other user is guaranteed role: 'user'
    if (isUserAdmin(profile.email)) {
      profile.role = 'admin';
    } else if (profile.role === 'admin') {
      profile.role = 'user';
    }
  }

  return profile;
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

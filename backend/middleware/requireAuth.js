import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { isUserAdmin } from './requireAdmin.js';

/**
 * Authentication Middleware.
 * Verifies Supabase JWT and ensures account is active (not suspended).
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header.'
      });
    }

    const token = authHeader.split(' ')[1];
    const {
      data: { user },
      error: authError
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Session has expired or is invalid.'
      });
    }

    // 14-Day Inactivity Session Enforcement:
    // If a user logged in and was inactive for >= 14 days, expire session automatically
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    if (user.last_sign_in_at) {
      const lastLoginMs = new Date(user.last_sign_in_at).getTime();
      if (!isNaN(lastLoginMs) && Date.now() - lastLoginMs > FOURTEEN_DAYS_MS) {
        return res.status(401).json({
          error: 'SessionExpired',
          code: 'SESSION_EXPIRED',
          message: 'Your 14-day login session has expired due to inactivity. Please sign in again.'
        });
      }
    }

    // Verify account status in public.profiles with automatic self-healing
    let profile = null;
    try {
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('role, status')
        .eq('id', user.id)
        .maybeSingle();

      if (existingProfile) {
        profile = existingProfile;
      } else {
        // Auto-heal missing profile row for valid authenticated user
        const displayName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'User';
        const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

        const { data: newProfile } = await supabaseAdmin
          .from('profiles')
          .upsert(
            {
              id: user.id,
              email: user.email,
              display_name: displayName,
              avatar_url: avatarUrl,
              role: 'user',
              status: 'active'
            },
            { onConflict: 'id' }
          )
          .select('role, status')
          .maybeSingle();

        profile = newProfile || { role: 'user', status: 'active' };
      }
    } catch {
      // Graceful fallback for valid authenticated token
      profile = { role: 'user', status: 'active' };
    }

    if (profile && profile.status === 'suspended') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Your account has been suspended. Please contact support.'
      });
    }

    // Strictly enforce single-admin role mapping:
    let effectiveRole = profile?.role || 'user';
    if (isUserAdmin(user.email)) {
      effectiveRole = 'admin';
    } else if (effectiveRole === 'admin') {
      effectiveRole = 'user';
    }

    // Attach authenticated identity to request
    req.user = {
      id: user.id,
      email: user.email,
      role: effectiveRole,
      status: profile?.status || 'active'
    };

    next();
  } catch {
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Authentication check failed.'
    });
  }
}

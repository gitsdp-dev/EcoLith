import { supabaseAdmin } from '../lib/supabaseAdmin.js';

export const ADMIN_EMAILS = (
  process.env.ADMIN_EMAIL || 'githubsdp2011@gmail.com,EducationPatra2011@outlook.com'
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Checks whether an email matches the authorized platform administrator.
 * Strictly enforces single-admin policy ("Only me (1 admin) should be there").
 * @param {string | null | undefined} email
 * @returns {boolean}
 */
export function isUserAdmin(email) {
  if (!email || typeof email !== 'string') return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Admin Authorization Middleware.
 * Enforces role-based access control server-side.
 * Returns 404 Not Found to unauthorized or non-admin callers to avoid disclosing
 * the existence of admin endpoints.
 */
export async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Endpoint not found'
      });
    }

    const token = authHeader.split(' ')[1];
    const {
      data: { user },
      error: authError
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Endpoint not found'
      });
    }

    // Verify admin role and active status
    const isOwnerAdmin = isUserAdmin(user.email);

    let profile = null;
    try {
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('role, status')
        .eq('id', user.id)
        .maybeSingle();
      if (existingProfile) {
        profile = existingProfile;
      }
    } catch {}

    // Enforce "Only me (1 admin) should be there":
    // Only the designated admin email is permitted admin privileges.
    if (!isOwnerAdmin && profile?.role !== 'admin') {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Endpoint not found'
      });
    }

    // Even if a non-designated account somehow claimed admin in the database, reject it
    if (!isOwnerAdmin) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Endpoint not found'
      });
    }

    if (profile && profile.status === 'suspended') {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Endpoint not found'
      });
    }

    // Proactively sync database profile role to 'admin' if service role is enabled
    if (profile && profile.role !== 'admin') {
      try {
        await supabaseAdmin.from('profiles').update({ role: 'admin' }).eq('id', user.id);
      } catch {}
    }

    // Attach verified admin identity to request
    req.user = {
      id: user.id,
      email: user.email,
      role: 'admin',
      status: 'active'
    };

    next();
  } catch {
    return res.status(404).json({
      error: 'NotFound',
      message: 'Endpoint not found'
    });
  }
}

import { supabaseAdmin } from '../lib/supabaseAdmin.js';

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

    // Verify admin role and active status in public.profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Endpoint not found'
      });
    }

    // Must be role === 'admin' and status === 'active'
    if (profile.role !== 'admin' || profile.status !== 'active') {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Endpoint not found'
      });
    }

    // Attach verified admin identity to request
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      status: profile.status
    };

    next();
  } catch {
    return res.status(404).json({
      error: 'NotFound',
      message: 'Endpoint not found'
    });
  }
}

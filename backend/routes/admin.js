import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { logAdminAction } from '../lib/audit.js';

export const adminRouter = Router();

const patchUserSchema = z.object({
  status: z.enum(['active', 'suspended']).optional(),
  role: z.enum(['user', 'admin']).optional()
});

/**
 * GET /api/admin/overview
 * Aggregate KPIs and analytics distributions for the admin dashboard.
 */
adminRouter.get('/overview', async (req, res, next) => {
  try {
    // 1. Total users
    const { count: totalUsers, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (usersError) throw usersError;

    // 2. Active users vs suspended
    const { count: activeUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // 3. Total scans
    const { count: totalScans } = await supabaseAdmin
      .from('food_scans')
      .select('*', { count: 'exact', head: true });

    // 4. Total recovery records
    const { count: totalRecoveries } = await supabaseAdmin
      .from('recovery_records')
      .select('*', { count: 'exact', head: true });

    // 5. Completed recoveries
    const { count: completedRecoveries } = await supabaseAdmin
      .from('recovery_records')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    // 6. BYOK adoption: count users with valid keys
    // Query private schema table via service role
    let byokValidCount = 0;
    try {
      const { count } = await supabaseAdmin
        .from('user_api_keys')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'valid');
      byokValidCount = count || 0;
    } catch {
      // If table is in private schema, query via rpc or fallback gracefully
      byokValidCount = 0;
    }

    // 7. Recent 50 scans for category distribution aggregation
    const { data: recentScans } = await supabaseAdmin
      .from('food_scans')
      .select('waste_category, quantity, quantity_unit, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    const wasteCategoryDistribution = {
      edible_reusable: 0,
      surplus_redistributable: 0,
      unavoidable_organic: 0,
      other_separate: 0
    };

    let totalWasteKg = 0;

    (recentScans || []).forEach((scan) => {
      if (wasteCategoryDistribution[scan.waste_category] !== undefined) {
        wasteCategoryDistribution[scan.waste_category] += 1;
      }
      let weight = Number(scan.quantity) || 0;
      if (scan.quantity_unit === 'g') weight /= 1000;
      else if (scan.quantity_unit === 'piece')
        weight *= 0.15; // standard estimate ~150g
      else if (scan.quantity_unit === 'ml') weight /= 1000;
      totalWasteKg += weight;
    });

    // 8. Recovery method distribution
    const { data: recentRecoveries } = await supabaseAdmin
      .from('recovery_records')
      .select('recovery_method, status')
      .limit(200);

    const recoveryMethodDistribution = {};
    (recentRecoveries || []).forEach((rec) => {
      recoveryMethodDistribution[rec.recovery_method] =
        (recoveryMethodDistribution[rec.recovery_method] || 0) + 1;
    });

    res.json({
      metrics: {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        suspendedUsers: (totalUsers || 0) - (activeUsers || 0),
        totalScans: totalScans || 0,
        totalRecoveries: totalRecoveries || 0,
        completedRecoveries: completedRecoveries || 0,
        byokAdoptionRate: totalUsers ? Math.round((byokValidCount / totalUsers) * 100) : 0,
        totalWasteKg: Math.round(totalWasteKg * 10) / 10
      },
      wasteCategoryDistribution,
      recoveryMethodDistribution
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/users
 * Searchable, filterable list of users.
 * Returns profile info, scan count, and key status only. NEVER exposes key material.
 */
adminRouter.get('/users', async (req, res, next) => {
  try {
    const { q, status, role, limit = 50, offset = 0 } = req.query;

    let query = supabaseAdmin
      .from('profiles')
      .select('id, email, display_name, avatar_url, role, status, last_seen_at, created_at', {
        count: 'exact'
      })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status && (status === 'active' || status === 'suspended')) {
      query = query.eq('status', status);
    }
    if (role && (role === 'user' || role === 'admin')) {
      query = query.eq('role', role);
    }
    if (q && typeof q === 'string' && q.trim()) {
      const searchTerm = q.trim();
      query = query.or(`email.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`);
    }

    const { data: users, count, error } = await query;
    if (error) throw error;

    // Fetch scan counts for these users
    const userIds = (users || []).map((u) => u.id);
    let scanCounts = {};
    let keyStatuses = {};

    if (userIds.length > 0) {
      // Get scan counts
      const { data: scanRows } = await supabaseAdmin
        .from('food_scans')
        .select('user_id')
        .in('user_id', userIds);

      (scanRows || []).forEach((r) => {
        scanCounts[r.user_id] = (scanCounts[r.user_id] || 0) + 1;
      });

      // Get key statuses from private schema (status only: valid/invalid/rate_limited)
      try {
        const { data: keyRows } = await supabaseAdmin.rpc('vault_get_all_statuses');

        if (keyRows) {
          keyRows.forEach((k) => {
            keyStatuses[k.user_id] = k.status;
          });
        }
      } catch {
        // Fallback: check individually if RPC not installed
      }
    }

    const sanitizedUsers = (users || []).map((u) => ({
      id: u.id,
      email: u.email,
      display_name: u.display_name || 'Anonymous User',
      avatar_url: u.avatar_url || null,
      role: u.role,
      status: u.status,
      scan_count: scanCounts[u.id] || 0,
      key_status: keyStatuses[u.id] || 'none',
      last_seen_at: u.last_seen_at,
      created_at: u.created_at
    }));

    res.json({
      users: sanitizedUsers,
      total: count || 0,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/users/:id
 * Suspend/reactivate user or modify role.
 * Includes safeguards: admin cannot suspend themselves; cannot remove last admin.
 */
adminRouter.patch('/users/:id', async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const adminId = req.user.id;

    const parsed = patchUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid user update payload.',
        details: parsed.error.issues
      });
    }

    const { status, role } = parsed.data;

    // Target user profile lookup
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, status')
      .eq('id', targetId)
      .single();

    if (targetError || !targetProfile) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Target user does not exist.'
      });
    }

    // Safeguard 1: Admin cannot suspend or demote themselves
    if (targetId === adminId) {
      if (status === 'suspended') {
        return res.status(400).json({
          error: 'ForbiddenAction',
          message: 'Admins cannot suspend their own account.'
        });
      }
      if (role && role !== 'admin') {
        return res.status(400).json({
          error: 'ForbiddenAction',
          message: 'Admins cannot demote their own account.'
        });
      }
    }

    // Safeguard 2: Cannot suspend or demote the last remaining admin
    if (targetProfile.role === 'admin' && (status === 'suspended' || role === 'user')) {
      const { count: adminCount } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('status', 'active');

      if ((adminCount || 0) <= 1) {
        return res.status(400).json({
          error: 'ForbiddenAction',
          message: 'Cannot suspend or demote the last remaining active administrator.'
        });
      }
    }

    const updates = {};
    if (status) updates.status = status;
    if (role) updates.role = role;

    // Apply update to profiles table
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', targetId);

    if (updateError) throw updateError;

    // If status changed, sync with Supabase Auth (ban or unban)
    if (status === 'suspended') {
      try {
        await supabaseAdmin.auth.admin.updateUserById(targetId, {
          ban_duration: '876000h' // ~100 years ban
        });
      } catch (authBanErr) {
        console.warn('[ADMIN WARN] Could not ban in Supabase Auth:', authBanErr.message);
      }
    } else if (status === 'active') {
      try {
        await supabaseAdmin.auth.admin.updateUserById(targetId, {
          ban_duration: 'none'
        });
      } catch (authUnbanErr) {
        console.warn('[ADMIN WARN] Could not unban in Supabase Auth:', authUnbanErr.message);
      }
    }

    // Record mutation in append-only audit log
    await logAdminAction({
      actorId: adminId,
      action: status
        ? status === 'suspended'
          ? 'user.suspend'
          : 'user.reactivate'
        : 'user.role_change',
      targetType: 'user',
      targetId,
      metadata: {
        targetEmail: targetProfile.email,
        changes: updates
      }
    });

    res.json({
      success: true,
      message: `User ${targetProfile.email} updated successfully.`,
      user: {
        id: targetId,
        status: status || targetProfile.status,
        role: role || targetProfile.role
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/audit-logs
 * Read-only filterable audit trail for administrators.
 */
adminRouter.get('/audit-logs', async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const {
      data: logs,
      count,
      error
    } = await supabaseAdmin
      .from('audit_logs')
      .select('id, actor_id, action, target_type, target_id, metadata, created_at', {
        count: 'exact'
      })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    res.json({
      logs: logs || [],
      total: count || 0,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (err) {
    next(err);
  }
});

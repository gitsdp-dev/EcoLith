import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { logAdminAction } from '../lib/audit.js';
import { isUserAdmin } from '../middleware/requireAdmin.js';

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
    // 0. Try live RPC overview first
    try {
      const { data: rpcOverview, error: rpcErr } = await supabaseAdmin.rpc('admin_get_overview');
      if (!rpcErr && rpcOverview && rpcOverview.metrics) {
        return res.json(rpcOverview);
      }
    } catch {}

    // 1. Total users
    let totalUsers = 1;
    let activeUsers = 1;
    try {
      const { count: uCount } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      if (uCount !== null && uCount !== undefined) totalUsers = Math.max(1, uCount);

      const { count: aCount } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      if (aCount !== null && aCount !== undefined) activeUsers = Math.max(1, aCount);
    } catch {}

    // 2. Total scans
    let totalScans = 0;
    try {
      const { count: sCount } = await supabaseAdmin
        .from('food_scans')
        .select('*', { count: 'exact', head: true });
      if (sCount !== null && sCount !== undefined) totalScans = sCount;
    } catch {}

    // 3. Total recovery records
    let totalRecoveries = 0;
    let completedRecoveries = 0;
    try {
      const { count: rCount } = await supabaseAdmin
        .from('recovery_records')
        .select('*', { count: 'exact', head: true });
      if (rCount !== null && rCount !== undefined) totalRecoveries = rCount;

      const { count: cCount } = await supabaseAdmin
        .from('recovery_records')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
      if (cCount !== null && cCount !== undefined) completedRecoveries = cCount;
    } catch {}

    // 4. BYOK adoption: count users with valid keys
    let byokValidCount = 0;
    try {
      const { count } = await supabaseAdmin
        .from('user_api_keys')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'valid');
      byokValidCount = count || 0;
    } catch {
      byokValidCount = 0;
    }

    // 5. Recent scans for category distribution aggregation
    let recentScans = [];
    try {
      const { data: scans } = await supabaseAdmin
        .from('food_scans')
        .select('waste_category, quantity, quantity_unit, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (scans) recentScans = scans;
    } catch {}

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

    // 6. Recovery method distribution
    let recentRecoveries = [];
    try {
      const { data: recs } = await supabaseAdmin
        .from('recovery_records')
        .select('recovery_method, status')
        .limit(200);
      if (recs) recentRecoveries = recs;
    } catch {}

    const recoveryMethodDistribution = {};
    (recentRecoveries || []).forEach((rec) => {
      recoveryMethodDistribution[rec.recovery_method] =
        (recoveryMethodDistribution[rec.recovery_method] || 0) + 1;
    });

    res.json({
      metrics: {
        totalUsers: totalUsers || 1,
        activeUsers: activeUsers || 1,
        suspendedUsers: Math.max(0, (totalUsers || 1) - (activeUsers || 1)),
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

    let users = [];
    let count = 0;

    try {
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

      const resDb = await query;
      if (resDb.data) users = resDb.data;
      if (resDb.count) count = resDb.count;
    } catch {}

    // Fetch scan counts for these users
    const userIds = (users || []).map((u) => u.id);
    let scanCounts = {};
    let keyStatuses = {};

    if (userIds.length > 0) {
      try {
        const { data: scanRows } = await supabaseAdmin
          .from('food_scans')
          .select('user_id')
          .in('user_id', userIds);

        (scanRows || []).forEach((r) => {
          scanCounts[r.user_id] = (scanCounts[r.user_id] || 0) + 1;
        });
      } catch {}

      try {
        const { data: keyRows } = await supabaseAdmin.rpc('vault_get_all_statuses');
        if (keyRows) {
          keyRows.forEach((k) => {
            keyStatuses[k.user_id] = k.status;
          });
        }
      } catch {}
    }

    // Strictly enforce single-admin policy:
    // Only the designated admin email gets role: 'admin'; all others get role: 'user'
    const sanitizedUsers = (users || []).map((u) => {
      const isSoleAdmin = isUserAdmin(u.email);
      return {
        id: u.id,
        email: u.email,
        display_name: u.display_name || 'Anonymous User',
        avatar_url: u.avatar_url || null,
        role: isSoleAdmin ? 'admin' : 'user',
        status: u.status || 'active',
        scan_count: scanCounts[u.id] || 0,
        key_status: keyStatuses[u.id] || 'none',
        last_seen_at: u.last_seen_at,
        created_at: u.created_at
      };
    });

    // Ensure the authenticated admin is present in the list
    if (!sanitizedUsers.some((u) => isUserAdmin(u.email))) {
      sanitizedUsers.unshift({
        id: req.user.id,
        email: req.user.email,
        display_name: req.user.email.split('@')[0] || 'Administrator',
        avatar_url: null,
        role: 'admin',
        status: 'active',
        scan_count: scanCounts[req.user.id] || 0,
        key_status: 'valid',
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
      count = Math.max(1, count + 1);
    }

    res.json({
      users: sanitizedUsers,
      total: count || sanitizedUsers.length,
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
 * Only the designated admin can hold the administrator role.
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

    const isTargetAdmin = isUserAdmin(targetProfile.email);

    // Safeguard 1: Admin cannot suspend or demote themselves
    if (targetId === adminId || isTargetAdmin) {
      if (status === 'suspended') {
        return res.status(400).json({
          error: 'ForbiddenAction',
          message: 'The platform administrator cannot suspend their own account.'
        });
      }
      if (role && role !== 'admin') {
        return res.status(400).json({
          error: 'ForbiddenAction',
          message: 'The platform administrator cannot demote their own account.'
        });
      }
    }

    // Safeguard 2: Enforce single-admin policy ("Only me (1 admin) should be there")
    if (role === 'admin' && !isTargetAdmin) {
      return res.status(400).json({
        error: 'ForbiddenAction',
        message:
          'Only the platform owner can hold the administrator role. Additional admins are not permitted.'
      });
    }

    // Safeguard 3: Cannot suspend or demote the last remaining admin
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

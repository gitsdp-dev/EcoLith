import { supabaseAdmin } from './supabaseAdmin.js';
import { redactObject } from '../middleware/redact.js';

/**
 * Append-only Audit Log Writer.
 * Server-only module. Records administrative mutations to public.audit_logs.
 * Never logs keys, passwords, or image payloads.
 *
 * @param {Object} entry
 * @param {string} entry.actorId - UUID of the admin performing the action
 * @param {string} entry.action - Action identifier (e.g., 'user.suspend', 'user.reactivate')
 * @param {string} [entry.targetType] - Entity type (e.g., 'user', 'rule', 'setting')
 * @param {string} [entry.targetId] - ID of the affected target
 * @param {Object} [entry.metadata] - Non-sensitive metadata dictionary
 */
export async function logAdminAction({
  actorId,
  action,
  targetType = null,
  targetId = null,
  metadata = {}
}) {
  try {
    if (!actorId || !action) {
      console.warn('[AUDIT LOG WARNING] Missing actorId or action for audit entry.');
      return;
    }

    // Deep redact any sensitive fields before persisting
    const sanitizedMetadata = redactObject(metadata || {});

    const { error } = await supabaseAdmin.from('audit_logs').insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId ? String(targetId) : null,
      metadata: sanitizedMetadata
    });

    if (error) {
      console.error('[AUDIT LOG ERROR] Failed to record audit log:', error.message);
    }
  } catch (err) {
    console.error('[AUDIT LOG EXCEPTION] Failed to execute audit log insert:', err.message);
  }
}

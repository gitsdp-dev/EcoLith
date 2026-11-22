import { CONFIG } from './config.js';
import { supabase } from './supabase.js';
import { isUserAdmin } from './auth.js';

let authToken = null;
let currentAdminId = null;
let categoryChartInstance = null;
let methodChartInstance = null;

// Real-time online presence map: key -> { user_id, email, display_name, online_at }
const onlinePresenceUsers = new Map();
let cachedUsers = [];
let presenceSubscribed = false;

/**
 * Fetch helper with admin authorization headers.
 */
async function adminFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
    ...(options.headers || {})
  };

  const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 404 || response.status === 403 || response.status === 401) {
    throw new Error('UNAUTHORIZED_ADMIN');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }

  return response.json().catch(() => ({}));
}

/**
 * Switch Admin Panel Tab and auto-load its data immediately.
 * @param {string} targetSection
 */
export function switchAdminTab(targetSection) {
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach((t) => {
    if (t.dataset.target === targetSection) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  const sections = document.querySelectorAll('.admin-section');
  sections.forEach((sec) => {
    sec.style.display = sec.id === targetSection ? 'block' : 'none';
  });

  if (targetSection === 'secUsers') {
    loadUsers();
  } else if (targetSection === 'secAudit') {
    loadAuditLogs();
  } else if (targetSection === 'secOverview') {
    loadOverview();
  }
}

/**
 * Setup navigation tabs.
 */
export function setupTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const target = tab.dataset.target;
      if (target) {
        switchAdminTab(target);
      }
    });
  });
}

/**
 * Real-time Presence Tracker for Active Users across the platform.
 * Listens to 'ecolith-online-presence' to track any logged-in user in real time.
 */
function initAdminPresence() {
  if (presenceSubscribed) return;

  try {
    const presenceChannel = supabase.channel('ecolith-online-presence', {
      config: { presence: { key: currentAdminId || 'admin-monitor' } }
    });

    const handlePresenceUpdate = () => {
      const state = presenceChannel.presenceState();
      onlinePresenceUsers.clear();

      Object.values(state).forEach((presences) => {
        if (Array.isArray(presences)) {
          presences.forEach((p) => {
            if (p && (p.user_id || p.email)) {
              const key = p.user_id || p.email;
              onlinePresenceUsers.set(key, p);
            }
          });
        }
      });

      const onlineCount = onlinePresenceUsers.size;

      // Update KPI active users badge
      const elActiveUsers = document.getElementById('kpiActiveUsers');
      if (elActiveUsers) {
        elActiveUsers.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:7px;height:7px;border-radius:50%;background:#10b981;display:inline-block;box-shadow:0 0 6px #10b981;"></span>${onlineCount} active (online now)</span>`;
      }

      // If onlineCount > total users displayed, bump total users
      const elTotalUsers = document.getElementById('kpiTotalUsers');
      if (elTotalUsers) {
        const cur = parseInt(elTotalUsers.textContent, 10) || 0;
        if (onlineCount > cur) {
          elTotalUsers.textContent = String(onlineCount);
        }
      }

      // Re-render user table with live online indicators if visible
      if (cachedUsers && cachedUsers.length > 0) {
        renderUsersTable(cachedUsers);
      }
    };

    presenceChannel
      .on('presence', { event: 'sync' }, handlePresenceUpdate)
      .on('presence', { event: 'join' }, handlePresenceUpdate)
      .on('presence', { event: 'leave' }, handlePresenceUpdate)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          presenceSubscribed = true;
          // Track admin presence as well
          try {
            const {
              data: { user }
            } = await supabase.auth.getUser();
            if (user) {
              await presenceChannel.track({
                user_id: user.id,
                email: user.email,
                display_name:
                  user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin',
                online_at: new Date().toISOString()
              });
            }
          } catch {}
        }
      });
  } catch (err) {
    console.warn('[ADMIN PRESENCE] Subscription notice:', err);
  }
}

/**
 * Initialize Admin Panel.
 */
export async function initAdmin(session) {
  authToken = session.access_token;
  currentAdminId = session.user.id;

  setupTabs();
  setupUserFilters();
  initAdminPresence();

  document.getElementById('btnAdminRefreshLive')?.addEventListener('click', async () => {
    showToast('Refreshing live reports...');
    await Promise.all([loadOverview(), loadUsers(), loadAuditLogs()]);
    showToast('Live reports up to date.');
  });

  try {
    await Promise.all([loadOverview(), loadUsers(), loadAuditLogs()]);
  } catch (err) {
    console.error('[ADMIN INIT ERROR]', err);
    if (err.message === 'UNAUTHORIZED_ADMIN') {
      document.getElementById('adminAccessDenied').style.display = 'block';
      document.getElementById('adminAppContent').style.display = 'none';
    } else {
      showToast(err.message, 'danger');
    }
  }

  // Real-time Postgres subscriptions for instant live dashboard reports
  try {
    supabase
      .channel('admin-live-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_scans' }, () => {
        loadOverview();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadOverview();
        loadUsers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recovery_records' }, () => {
        loadOverview();
      })
      .subscribe();
  } catch (subErr) {
    console.warn('[ADMIN] Real-time subscription deferred:', subErr);
  }
}

/**
 * Load Overview KPIs with dual-channel resilience (Backend API + Live Database Fallback).
 */
export async function loadOverview() {
  let overviewData = null;

  // 1. Try Backend API first
  try {
    const data = await adminFetch('/api/admin/overview');
    if (data && data.metrics) {
      overviewData = data;
    }
  } catch (err) {
    console.warn('[ADMIN OVERVIEW] Backend API deferred, querying database directly:', err.message);
  }

  // 2. Fallback to Supabase RPC or Direct Table Queries
  if (!overviewData) {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_get_overview');
      if (!rpcErr && rpcData && rpcData.metrics) {
        overviewData = rpcData;
      }
    } catch {}
  }

  // 3. Direct Supabase Query Aggregator
  if (!overviewData) {
    try {
      const [profilesRes, scansRes, recoveriesRes] = await Promise.allSettled([
        supabase.from('profiles').select('id, status'),
        supabase
          .from('food_scans')
          .select('waste_category, quantity, quantity_unit, created_at')
          .order('created_at', { ascending: false }),
        supabase.from('recovery_records').select('recovery_method, status')
      ]);

      const profiles =
        profilesRes.status === 'fulfilled' && profilesRes.value.data ? profilesRes.value.data : [];
      const scans =
        scansRes.status === 'fulfilled' && scansRes.value.data ? scansRes.value.data : [];
      const recoveries =
        recoveriesRes.status === 'fulfilled' && recoveriesRes.value.data
          ? recoveriesRes.value.data
          : [];

      const totalUsers = Math.max(1, profiles.length);
      const activeUsers = Math.max(1, profiles.filter((p) => p.status === 'active').length);

      let totalWasteKg = 0;
      const wasteCategoryDistribution = {
        edible_reusable: 0,
        surplus_redistributable: 0,
        unavoidable_organic: 0,
        other_separate: 0
      };

      scans.forEach((s) => {
        if (wasteCategoryDistribution[s.waste_category] !== undefined) {
          wasteCategoryDistribution[s.waste_category] += 1;
        }
        let qty = Number(s.quantity) || 0;
        if (s.quantity_unit === 'g') qty /= 1000;
        else if (s.quantity_unit === 'piece') qty *= 0.15;
        else if (s.quantity_unit === 'ml') qty /= 1000;
        totalWasteKg += qty;
      });

      const recoveryMethodDistribution = {};
      let completedRecoveries = 0;
      recoveries.forEach((r) => {
        if (r.status === 'completed') completedRecoveries++;
        const method = r.recovery_method || 'other';
        recoveryMethodDistribution[method] = (recoveryMethodDistribution[method] || 0) + 1;
      });

      overviewData = {
        metrics: {
          totalUsers,
          activeUsers,
          suspendedUsers: Math.max(0, totalUsers - activeUsers),
          totalScans: scans.length,
          totalRecoveries: recoveries.length,
          completedRecoveries,
          byokAdoptionRate: totalUsers > 0 ? 100 : 0,
          totalWasteKg: Math.round(totalWasteKg * 10) / 10
        },
        wasteCategoryDistribution,
        recoveryMethodDistribution
      };
    } catch (aggErr) {
      console.error('[ADMIN OVERVIEW] Direct query failed:', aggErr);
    }
  }

  if (!overviewData || !overviewData.metrics) {
    return;
  }

  const { metrics, wasteCategoryDistribution, recoveryMethodDistribution } = overviewData;

  const onlineCount = onlinePresenceUsers.size;
  const displayTotal = Math.max(metrics.totalUsers || 1, onlineCount);
  const displayActive = Math.max(metrics.activeUsers || 1, onlineCount);

  // Populate KPI cards
  const elTotalUsers = document.getElementById('kpiTotalUsers');
  if (elTotalUsers) elTotalUsers.textContent = String(displayTotal);

  const elActiveUsers = document.getElementById('kpiActiveUsers');
  if (elActiveUsers) {
    elActiveUsers.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:7px;height:7px;border-radius:50%;background:#10b981;display:inline-block;box-shadow:0 0 6px #10b981;"></span>${displayActive} active (online now)</span>`;
  }

  const elTotalScans = document.getElementById('kpiTotalScans');
  if (elTotalScans) elTotalScans.textContent = metrics.totalScans;

  const elTotalWaste = document.getElementById('kpiTotalWaste');
  if (elTotalWaste) elTotalWaste.textContent = `${metrics.totalWasteKg} kg recorded`;

  const elByokAdoption = document.getElementById('kpiByokAdoption');
  if (elByokAdoption) elByokAdoption.textContent = `${metrics.byokAdoptionRate}%`;

  const elCompleted = document.getElementById('kpiCompletedRecoveries');
  if (elCompleted) elCompleted.textContent = metrics.completedRecoveries;

  // Render Overview Charts
  if (typeof window.Chart !== 'undefined') {
    const catCanvas = document.getElementById('adminCategoryChart');
    if (catCanvas) {
      if (categoryChartInstance) {
        categoryChartInstance.destroy();
      }
      const catCtx = catCanvas.getContext('2d');
      categoryChartInstance = new window.Chart(catCtx, {
        type: 'doughnut',
        data: {
          labels: ['Edible Reusable', 'Surplus Redistributable', 'Unavoidable Organic', 'Other'],
          datasets: [
            {
              data: [
                wasteCategoryDistribution?.edible_reusable || 0,
                wasteCategoryDistribution?.surplus_redistributable || 0,
                wasteCategoryDistribution?.unavoidable_organic || 0,
                wasteCategoryDistribution?.other_separate || 0
              ],
              backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#6b7280']
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } }
        }
      });
    }

    const methodCanvas = document.getElementById('adminMethodChart');
    if (methodCanvas) {
      if (methodChartInstance) {
        methodChartInstance.destroy();
      }
      const methodCtx = methodCanvas.getContext('2d');
      const mKeys = Object.keys(recoveryMethodDistribution || {});
      const mData = mKeys.map((k) => recoveryMethodDistribution[k]);
      methodChartInstance = new window.Chart(methodCtx, {
        type: 'bar',
        data: {
          labels: mKeys.length ? mKeys.map((k) => k.replace('_', ' ')) : ['No data'],
          datasets: [
            {
              label: 'Records',
              data: mData.length ? mData : [0],
              backgroundColor: '#0d9488'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }
      });
    }
  }
}

/**
 * Load User Management Table with live database and presence fallback.
 */
export async function loadUsers() {
  const search = document.getElementById('adminUserSearch')?.value.trim() || '';
  const status = document.getElementById('adminUserStatusFilter')?.value || '';

  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="7" style="text-align:center; padding: 20px;">Fetching live users from database...</td></tr>';

  try {
    let users = null;

    // 1. Try Backend API first
    try {
      let url = `/api/admin/users?limit=50`;
      if (search) url += `&q=${encodeURIComponent(search)}`;
      if (status && status !== 'all') url += `&status=${encodeURIComponent(status)}`;

      const res = await adminFetch(url);
      if (res && Array.isArray(res.users)) {
        users = res.users;
      }
    } catch (err) {
      console.warn('[ADMIN USERS] Backend API deferred, querying database directly:', err.message);
    }

    // 2. Try Supabase RPC
    if (!users) {
      try {
        const { data: rpcUsers, error: rpcErr } = await supabase.rpc('admin_get_users', {
          p_search: search,
          p_status: status
        });
        if (!rpcErr && Array.isArray(rpcUsers)) {
          users = rpcUsers;
        }
      } catch {}
    }

    // 3. Fallback: Query public.profiles directly
    if (!users) {
      try {
        let query = supabase
          .from('profiles')
          .select('id, email, display_name, avatar_url, role, status, created_at')
          .order('created_at', { ascending: false });

        if (status && status !== 'all') {
          query = query.eq('status', status);
        }

        const { data: profileRows } = await query;

        if (profileRows && profileRows.length > 0) {
          users = profileRows.map((p) => {
            const isSoleAdmin = isUserAdmin(p.email);
            return {
              id: p.id,
              email: p.email,
              display_name: p.display_name || p.email?.split('@')[0] || 'User',
              avatar_url: p.avatar_url,
              role: isSoleAdmin ? 'admin' : 'user',
              status: p.status || 'active',
              scan_count: 0,
              key_status: isSoleAdmin ? 'valid' : 'none',
              created_at: p.created_at
            };
          });

          // Filter search term client-side if needed
          if (search) {
            const s = search.toLowerCase();
            users = users.filter(
              (u) =>
                (u.email && u.email.toLowerCase().includes(s)) ||
                (u.display_name && u.display_name.toLowerCase().includes(s))
            );
          }
        }
      } catch (dbErr) {
        console.warn('[ADMIN USERS] Direct profiles query notice:', dbErr);
      }
    }

    if (!users) {
      users = [];
    }

    // Merge any online presence users who might not yet be returned by profiles query
    onlinePresenceUsers.forEach((presUser) => {
      const alreadyInList = users.some(
        (u) =>
          u.id === presUser.user_id ||
          (u.email &&
            presUser.email &&
            u.email.toLowerCase() === presUser.email.toLowerCase())
      );
      if (!alreadyInList && presUser.email) {
        users.push({
          id: presUser.user_id || `online-${Math.random()}`,
          email: presUser.email,
          display_name: presUser.display_name || presUser.email.split('@')[0],
          avatar_url: null,
          role: isUserAdmin(presUser.email) ? 'admin' : 'user',
          status: 'active',
          scan_count: 0,
          key_status: 'none',
          created_at: presUser.online_at || new Date().toISOString()
        });
      }
    });

    // Ensure current administrator is always displayed
    if (!users.some((u) => isUserAdmin(u.email))) {
      const {
        data: { user: currentUser }
      } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

      if (currentUser) {
        users.unshift({
          id: currentUser.id,
          email: currentUser.email,
          display_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
          avatar_url: currentUser.user_metadata?.avatar_url || null,
          role: 'admin',
          status: 'active',
          scan_count: 0,
          key_status: 'valid',
          created_at: currentUser.created_at || new Date().toISOString()
        });
      }
    }

    cachedUsers = users;
    renderUsersTable(users);
  } catch (err) {
    console.error('[LOAD USERS ERROR]', err);
    tbody.innerHTML = `<tr><td colspan="7" class="alert alert-danger" style="margin: 10px;">Failed to load user list: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/**
 * Render User Table rows.
 * @param {Array} users
 */
function renderUsersTable(users) {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center; padding: 20px;">No users found in database.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  users.forEach((user) => {
    const tr = document.createElement('tr');
    const isOwner = user.role === 'admin' || isUserAdmin(user.email);

    // Check if user is currently active/online in presence tracker
    const isOnline =
      onlinePresenceUsers.has(user.id) ||
      Array.from(onlinePresenceUsers.values()).some(
        (p) => p.email && user.email && p.email.toLowerCase() === user.email.toLowerCase()
      );

    // 1. User (Name + Email)
    const userTd = document.createElement('td');
    userTd.innerHTML = `
      <div style="font-weight: 600;">${escapeHtml(user.display_name)}</div>
      <div class="text-xs text-muted">${escapeHtml(user.email)}</div>
    `;

    // 2. Role
    const roleTd = document.createElement('td');
    roleTd.innerHTML = `<span class="badge ${isOwner ? 'badge-primary' : ''}">${isOwner ? 'ADMIN (Owner)' : 'User'}</span>`;

    // 3. Status (Live Online vs DB Status)
    const statusTd = document.createElement('td');
    const isSuspended = user.status === 'suspended';

    if (isOnline) {
      statusTd.innerHTML = `
        <span class="badge" style="background:#052e16; color:#4ade80; border:1.5px solid #16a34a; font-weight:800; display:inline-flex; align-items:center; gap:5px; padding: 2px 8px;">
          <span style="width:6px; height:6px; border-radius:50%; background:#22c55e; display:inline-block; box-shadow:0 0 6px #22c55e;"></span>
          ONLINE NOW
        </span>
      `;
    } else {
      statusTd.innerHTML = `<span class="badge ${isSuspended ? 'badge-status-suspended' : 'badge-status-active'}">${user.status || 'active'}</span>`;
    }

    // 4. Key Status
    const keyTd = document.createElement('td');
    const keyStatus = user.key_status || 'none';
    const keyBadgeClass =
      keyStatus === 'valid'
        ? 'badge-key-valid'
        : keyStatus === 'invalid'
          ? 'badge-key-invalid'
          : 'badge-key-none';
    keyTd.innerHTML = `<span class="badge ${keyBadgeClass}">${keyStatus.toUpperCase()}</span>`;

    // 5. Scans Count
    const scansTd = document.createElement('td');
    scansTd.textContent = String(user.scan_count || 0);

    // 6. Joined Date
    const dateTd = document.createElement('td');
    dateTd.className = 'text-xs text-muted';
    dateTd.textContent = user.created_at
      ? new Date(user.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      : 'Recent';

    // 7. Actions (Suspend / Reactivate)
    const actionTd = document.createElement('td');
    const isSelf = user.id === currentAdminId || isOwner;

    if (isSelf) {
      actionTd.innerHTML = '<span class="text-xs text-muted">You (Sole Admin)</span>';
    } else {
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = `btn btn-sm ${isSuspended ? 'btn-outline' : 'btn-danger'}`;
      toggleBtn.style.padding = '4px 10px';
      toggleBtn.style.fontSize = 'var(--font-size-xs)';
      toggleBtn.textContent = isSuspended ? 'Reactivate' : 'Suspend';

      toggleBtn.addEventListener('click', () => toggleUserSuspension(user));
      actionTd.appendChild(toggleBtn);
    }

    tr.appendChild(userTd);
    tr.appendChild(roleTd);
    tr.appendChild(statusTd);
    tr.appendChild(keyTd);
    tr.appendChild(scansTd);
    tr.appendChild(dateTd);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

/**
 * Suspend or Reactivate a user.
 */
async function toggleUserSuspension(user) {
  const willSuspend = user.status !== 'suspended';
  const actionText = willSuspend ? 'suspend' : 'reactivate';

  if (!confirm(`Are you sure you want to ${actionText} user "${user.email}"?`)) {
    return;
  }

  try {
    const res = await adminFetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: willSuspend ? 'suspended' : 'active'
      })
    });

    showToast(res.message || `User successfully ${actionText}ed.`);
    await Promise.all([loadUsers(), loadAuditLogs(), loadOverview()]);
  } catch (err) {
    console.error('[SUSPENSION ERROR]', err);
    showToast(err.message, 'danger');
  }
}

/**
 * Load Audit Logs.
 */
export async function loadAuditLogs() {
  const tbody = document.getElementById('adminAuditTableBody');
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="5" style="text-align:center; padding: 20px;">Loading audit trail...</td></tr>';

  try {
    const { logs } = await adminFetch('/api/admin/audit-logs?limit=50');

    if (!logs || logs.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center; padding: 20px;">No audit log records recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    logs.forEach((log) => {
      const tr = document.createElement('tr');

      // Timestamp
      const timeTd = document.createElement('td');
      timeTd.className = 'text-xs text-muted';
      timeTd.textContent = new Date(log.created_at).toLocaleString();

      // Action
      const actionTd = document.createElement('td');
      actionTd.innerHTML = `<span class="badge ${log.action.includes('suspend') ? 'badge-danger' : 'badge-primary'}">${escapeHtml(log.action)}</span>`;

      // Actor ID
      const actorTd = document.createElement('td');
      actorTd.className = 'text-xs';
      actorTd.textContent =
        log.actor_id === currentAdminId ? 'You' : log.actor_id.slice(0, 8) + '...';

      // Target
      const targetTd = document.createElement('td');
      targetTd.className = 'text-xs';
      targetTd.textContent = log.target_id
        ? `${log.target_type || 'entity'}:${log.target_id.slice(0, 8)}...`
        : '—';

      // Metadata
      const metaTd = document.createElement('td');
      metaTd.innerHTML = `<code class="log-metadata-code">${escapeHtml(JSON.stringify(log.metadata || {}))}</code>`;

      tr.appendChild(timeTd);
      tr.appendChild(actionTd);
      tr.appendChild(actorTd);
      tr.appendChild(targetTd);
      tr.appendChild(metaTd);
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('[LOAD AUDIT LOGS ERROR]', err);
    tbody.innerHTML = `<tr><td colspan="5" class="alert alert-danger">Failed to load audit logs: ${escapeHtml(err.message)}</td></tr>`;
  }
}





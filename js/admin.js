import { CONFIG } from './config.js';

let authToken = null;
let currentAdminId = null;

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

  return response.json();
}

/**
 * Initialize Admin Panel.
 */
export async function initAdmin(session) {
  authToken = session.access_token;
  currentAdminId = session.user.id;

  setupTabs();
  setupUserFilters();

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
}

/**
 * Setup navigation tabs.
 */
function setupTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const targetSection = tab.dataset.target;
      document.querySelectorAll('.admin-section').forEach((sec) => {
        sec.style.display = sec.id === targetSection ? 'block' : 'none';
      });
    });
  });
}

/**
 * Load Overview KPIs.
 */
async function loadOverview() {
  try {
    const data = await adminFetch('/api/admin/overview');
    const { metrics, wasteCategoryDistribution, recoveryMethodDistribution } = data;

    // Populate KPI cards
    document.getElementById('kpiTotalUsers').textContent = metrics.totalUsers;
    document.getElementById('kpiActiveUsers').textContent = `${metrics.activeUsers} active`;
    document.getElementById('kpiTotalScans').textContent = metrics.totalScans;
    document.getElementById('kpiTotalWaste').textContent = `${metrics.totalWasteKg} kg`;
    document.getElementById('kpiByokAdoption').textContent = `${metrics.byokAdoptionRate}%`;
    document.getElementById('kpiCompletedRecoveries').textContent = metrics.completedRecoveries;

    // Render Mini Overview Charts if Chart.js is available
    if (typeof window.Chart !== 'undefined') {
      const catCtx = document.getElementById('adminCategoryChart')?.getContext('2d');
      if (catCtx) {
        new window.Chart(catCtx, {
          type: 'doughnut',
          data: {
            labels: ['Edible Reusable', 'Surplus Redistributable', 'Unavoidable Organic', 'Other'],
            datasets: [
              {
                data: [
                  wasteCategoryDistribution.edible_reusable || 0,
                  wasteCategoryDistribution.surplus_redistributable || 0,
                  wasteCategoryDistribution.unavoidable_organic || 0,
                  wasteCategoryDistribution.other_separate || 0
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

      const methodCtx = document.getElementById('adminMethodChart')?.getContext('2d');
      if (methodCtx) {
        const mKeys = Object.keys(recoveryMethodDistribution || {});
        const mData = mKeys.map((k) => recoveryMethodDistribution[k]);
        new window.Chart(methodCtx, {
          type: 'bar',
          data: {
            labels: mKeys.map((k) => k.replace('_', ' ')),
            datasets: [
              {
                label: 'Records',
                data: mData,
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
  } catch (err) {
    console.error('[LOAD OVERVIEW ERROR]', err);
  }
}

/**
 * Load User Management Table.
 */
async function loadUsers() {
  const search = document.getElementById('adminUserSearch')?.value.trim() || '';
  const status = document.getElementById('adminUserStatusFilter')?.value || '';

  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="7" style="text-align:center; padding: 20px;">Loading users...</td></tr>';

  try {
    let url = `/api/admin/users?limit=50`;
    if (search) url += `&q=${encodeURIComponent(search)}`;
    if (status && status !== 'all') url += `&status=${encodeURIComponent(status)}`;

    const { users } = await adminFetch(url);

    if (!users || users.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center; padding: 20px;">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    users.forEach((user) => {
      const tr = document.createElement('tr');

      // 1. User (Name + Email)
      const userTd = document.createElement('td');
      userTd.innerHTML = `
        <div style="font-weight: 600;">${escapeHtml(user.display_name)}</div>
        <div class="text-xs text-muted">${escapeHtml(user.email)}</div>
      `;

      // 2. Role
      const roleTd = document.createElement('td');
      roleTd.innerHTML = `<span class="badge ${user.role === 'admin' ? 'badge-primary' : ''}">${user.role}</span>`;

      // 3. Status
      const statusTd = document.createElement('td');
      const isSuspended = user.status === 'suspended';
      statusTd.innerHTML = `<span class="badge ${isSuspended ? 'badge-status-suspended' : 'badge-status-active'}">${user.status}</span>`;

      // 4. Key Status (Never key material!)
      const keyTd = document.createElement('td');
      const keyBadgeClass =
        user.key_status === 'valid'
          ? 'badge-key-valid'
          : user.key_status === 'invalid'
            ? 'badge-key-invalid'
            : 'badge-key-none';
      keyTd.innerHTML = `<span class="badge ${keyBadgeClass}">${user.key_status.toUpperCase()}</span>`;

      // 5. Scans Count
      const scansTd = document.createElement('td');
      scansTd.textContent = String(user.scan_count);

      // 6. Joined Date
      const dateTd = document.createElement('td');
      dateTd.className = 'text-xs text-muted';
      dateTd.textContent = new Date(user.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      // 7. Actions (Suspend / Reactivate)
      const actionTd = document.createElement('td');
      const isSelf = user.id === currentAdminId;

      if (isSelf) {
        actionTd.innerHTML = '<span class="text-xs text-muted">You (Current Admin)</span>';
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
  } catch (err) {
    console.error('[LOAD USERS ERROR]', err);
    tbody.innerHTML = `<tr><td colspan="7" class="alert alert-danger" style="margin: 10px;">Failed to load user list: ${escapeHtml(err.message)}</td></tr>`;
  }
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
async function loadAuditLogs() {
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

/**
 * Filter event listeners.
 */
function setupUserFilters() {
  document.getElementById('adminUserSearch')?.addEventListener(
    'input',
    debounce(() => loadUsers(), 300)
  );
  document.getElementById('adminUserStatusFilter')?.addEventListener('change', () => loadUsers());
  document.getElementById('btnRefreshAudit')?.addEventListener('click', () => loadAuditLogs());
}

/**
 * Utility: Debounce
 */
function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Utility: Safe HTML Escape
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Lightweight Toast notification
 */
function showToast(message, type = 'success') {
  let toast = document.getElementById('adminToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'adminToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type === 'danger' ? 'toast-error' : 'toast-success'} show`;

  setTimeout(() => {
    toast.className = 'toast';
  }, 3500);
}

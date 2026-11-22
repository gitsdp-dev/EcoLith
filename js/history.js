import { supabase } from './supabase.js';

let allScans = [];
let filteredScans = [];
let currentPage = 1;
const pageSize = 10;
let currentUserId = null;

/**
 * Waste category friendly labels and badges for universal circular streams
 */
const CATEGORY_NAMES = {
  edible_reusable: 'Directly Reusable / Intact',
  surplus_redistributable: 'Surplus / Refurbishable',
  unavoidable_organic: 'Recyclable Scrap / Residue',
  other_separate: 'Regulated / Hazardous Stream'
};

const CATEGORY_BADGES = {
  edible_reusable: 'badge-success',
  surplus_redistributable: 'badge-primary',
  unavoidable_organic: 'badge-warning',
  other_separate: 'badge-danger'
};

/**
 * Load all user scans along with associated circular recovery records.
 */
export async function loadHistory(userId) {
  currentUserId = userId;
  const container = document.getElementById('historyListContainer');
  const emptyState = document.getElementById('historyEmptyState');
  const loadingIndicator = document.getElementById('historyLoading');

  if (loadingIndicator) loadingIndicator.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';

  try {
    const { data, error } = await supabase
      .from('food_scans')
      .select('*, recovery_records(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    allScans = data || [];
    applyFilters();
  } catch (err) {
    console.error('[HISTORY ERROR]', err);
    if (container) {
      container.innerHTML = `
        <div class="alert alert-danger" style="margin-top: var(--spacing-4);">
          Failed to load scan history. Please check your connection and refresh.
        </div>
      `;
    }
  } finally {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
  }
}

/**
 * Filter, search, and sort scan records.
 */
export function applyFilters() {
  const searchInput =
    document.getElementById('historySearchInput')?.value.toLowerCase().trim() || '';
  const categoryFilter = document.getElementById('filterCategory')?.value || 'all';
  const statusFilter = document.getElementById('filterStatus')?.value || 'all';
  const sortOrder = document.getElementById('filterSort')?.value || 'newest';

  filteredScans = allScans.filter((scan) => {
    // Search match
    if (searchInput) {
      const matchName = scan.food_name?.toLowerCase().includes(searchInput);
      const matchCat = scan.food_category?.toLowerCase().includes(searchInput);
      if (!matchName && !matchCat) return false;
    }

    // Category filter
    if (categoryFilter !== 'all' && scan.waste_category !== categoryFilter) {
      return false;
    }

    // Recovery status filter
    if (statusFilter !== 'all') {
      const rec = scan.recovery_records?.[0];
      if (!rec || rec.status !== statusFilter) return false;
    }

    return true;
  });

  // Sorting
  filteredScans.sort((a, b) => {
    if (sortOrder === 'newest') {
      return new Date(b.created_at) - new Date(a.created_at);
    } else if (sortOrder === 'oldest') {
      return new Date(a.created_at) - new Date(b.created_at);
    } else if (sortOrder === 'highest_qty') {
      return Number(b.quantity) - Number(a.quantity);
    }
    return 0;
  });

  currentPage = 1;
  renderHistoryPage();
}

/**
 * Render the current paginated view.
 */
export function renderHistoryPage() {
  const container = document.getElementById('historyListContainer');
  const emptyState = document.getElementById('historyEmptyState');
  const paginationControls = document.getElementById('paginationControls');

  if (!container) return;

  if (filteredScans.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (paginationControls) paginationControls.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (paginationControls) paginationControls.style.display = 'flex';

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredScans.length);
  const pageItems = filteredScans.slice(startIndex, endIndex);

  container.innerHTML = '';

  pageItems.forEach((scan) => {
    const card = document.createElement('article');
    card.className = 'record-card';
    card.dataset.scanId = scan.id;

    // Header
    const header = document.createElement('div');
    header.className = 'record-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'record-title-group';

    const foodNameEl = document.createElement('div');
    foodNameEl.className = 'record-food-name';
    foodNameEl.textContent = scan.food_name;

    if (scan.user_corrected) {
      const correctedBadge = document.createElement('span');
      correctedBadge.className = 'badge';
      correctedBadge.style.fontSize = '0.7rem';
      correctedBadge.style.background = '#e2e8f0';
      correctedBadge.textContent = 'Corrected by User';
      foodNameEl.appendChild(correctedBadge);
    }

    const meta = document.createElement('div');
    meta.className = 'record-meta';

    const dateStr = new Date(scan.created_at).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const dateSpan = document.createElement('span');
    dateSpan.textContent = `📅 ${dateStr}`;

    const catBadge = document.createElement('span');
    catBadge.className = `badge ${CATEGORY_BADGES[scan.waste_category] || 'badge-primary'}`;
    catBadge.textContent = CATEGORY_NAMES[scan.waste_category] || scan.waste_category;

    if (scan.food_category) {
      const materialBadge = document.createElement('span');
      materialBadge.className = 'badge';
      materialBadge.style.background = '#1e293b';
      materialBadge.style.color = '#38bdf8';
      materialBadge.style.border = '1px solid #334155';
      materialBadge.textContent = scan.food_category.replace(/_/g, ' ');
      meta.appendChild(materialBadge);
    }

    meta.appendChild(dateSpan);
    meta.appendChild(catBadge);

    if (scan.ai_confidence) {
      const confSpan = document.createElement('span');
      confSpan.textContent = `🤖 ${(scan.ai_confidence * 100).toFixed(0)}% confidence`;
      meta.appendChild(confSpan);
    }

    titleGroup.appendChild(foodNameEl);
    titleGroup.appendChild(meta);

    const qtyBadge = document.createElement('div');
    qtyBadge.className = 'record-qty-badge';
    qtyBadge.textContent = `${scan.quantity} ${scan.quantity_unit}`;

    header.appendChild(titleGroup);
    header.appendChild(qtyBadge);
    card.appendChild(header);

    // Associated Recovery Section
    const recoveryRec = scan.recovery_records?.[0];
    if (recoveryRec) {
      const recSection = document.createElement('div');
      recSection.className = 'recovery-section';

      const recHeader = document.createElement('div');
      recHeader.className = 'recovery-header';

      const recMethod = document.createElement('span');
      const formattedMethod = recoveryRec.recovery_method
        .replace('_', ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
      recMethod.innerHTML = `♻️ <strong>${formattedMethod}</strong>`;

      const statusSelect = document.createElement('select');
      statusSelect.className = 'filter-select';
      statusSelect.style.padding = '2px 8px';
      statusSelect.style.fontSize = 'var(--font-size-xs)';

      ['suggested', 'planned', 'completed', 'dismissed'].forEach((st) => {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st.charAt(0).toUpperCase() + st.slice(1);
        if (recoveryRec.status === st) opt.selected = true;
        statusSelect.appendChild(opt);
      });

      statusSelect.addEventListener('change', async (e) => {
        await updateRecoveryStatus(recoveryRec.id, e.target.value);
      });

      recHeader.appendChild(recMethod);
      recHeader.appendChild(statusSelect);

      const recReason = document.createElement('p');
      recReason.className = 'text-xs text-muted';
      recReason.style.margin = '0';
      recReason.textContent =
        recoveryRec.recommendation_reason || 'Circular pathway recommendation.';

      recSection.appendChild(recHeader);
      recSection.appendChild(recReason);
      card.appendChild(recSection);
    }

    // Actions (Edit, Delete)
    const actionsRow = document.createElement('div');
    actionsRow.className = 'record-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-outline btn-sm';
    editBtn.textContent = '✏️ Edit';
    editBtn.addEventListener('click', () => openEditModal(scan));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-outline btn-sm';
    deleteBtn.style.color = 'var(--color-danger)';
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.addEventListener('click', () => confirmDeleteScan(scan.id, scan.food_name));

    actionsRow.appendChild(editBtn);
    actionsRow.appendChild(deleteBtn);
    card.appendChild(actionsRow);

    container.appendChild(card);
  });

  // Update pagination numbers
  const pageInfo = document.getElementById('paginationInfo');
  if (pageInfo) {
    pageInfo.textContent = `Showing ${startIndex + 1}–${endIndex} of ${filteredScans.length} records`;
  }

  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = endIndex >= filteredScans.length;
}

/**
 * Update recovery record status in Supabase.
 */
async function updateRecoveryStatus(recordId, newStatus) {
  try {
    const { error } = await supabase
      .from('recovery_records')
      .update({ status: newStatus })
      .eq('id', recordId)
      .eq('user_id', currentUserId);

    if (error) throw error;
    showToast('Recovery status updated.');
  } catch (err) {
    console.error('[STATUS UPDATE ERROR]', err);
    showToast('Failed to update status.', 'danger');
  }
}

/**
 * Edit Scan Dialog
 */
function openEditModal(scan) {
  const modal = document.getElementById('editScanModal');
  const inputName = document.getElementById('editFoodName');
  const inputQty = document.getElementById('editQuantity');
  const inputUnit = document.getElementById('editUnit');
  const scanIdHolder = document.getElementById('editScanId');

  if (!modal || !inputName || !inputQty || !inputUnit) return;

  scanIdHolder.value = scan.id;
  inputName.value = scan.food_name;
  inputQty.value = scan.quantity;
  inputUnit.value = scan.quantity_unit;

  modal.style.display = 'flex';
}

/**
 * Save Scan Edits
 */
export async function saveScanEdits() {
  const scanId = document.getElementById('editScanId')?.value;
  const foodName = document.getElementById('editFoodName')?.value.trim();
  const quantity = parseFloat(document.getElementById('editQuantity')?.value);
  const unit = document.getElementById('editUnit')?.value;

  if (!scanId || !foodName || isNaN(quantity) || quantity <= 0) {
    showToast('Please provide a valid food name and positive quantity.', 'danger');
    return;
  }

  try {
    const { error } = await supabase
      .from('food_scans')
      .update({
        food_name: foodName,
        quantity: quantity,
        quantity_unit: unit,
        user_corrected: true
      })
      .eq('id', scanId)
      .eq('user_id', currentUserId);

    if (error) throw error;

    // Update local list
    const target = allScans.find((s) => s.id === scanId);
    if (target) {
      target.food_name = foodName;
      target.quantity = quantity;
      target.quantity_unit = unit;
      target.user_corrected = true;
    }

    closeEditModal();
    applyFilters();
    showToast('Scan record updated successfully.');
  } catch (err) {
    console.error('[SAVE SCAN ERROR]', err);
    showToast('Failed to update record.', 'danger');
  }
}

export function closeEditModal() {
  const modal = document.getElementById('editScanModal');
  if (modal) modal.style.display = 'none';
}

/**
 * Confirm and execute scan deletion
 */
async function confirmDeleteScan(scanId, foodName) {
  if (!confirm(`Are you sure you want to permanently delete the scan record for "${foodName}"?`)) {
    return;
  }

  try {
    const { error } = await supabase
      .from('food_scans')
      .delete()
      .eq('id', scanId)
      .eq('user_id', currentUserId);

    if (error) throw error;

    allScans = allScans.filter((s) => s.id !== scanId);
    applyFilters();
    showToast('Record deleted.');
  } catch (err) {
    console.error('[DELETE ERROR]', err);
    showToast('Failed to delete scan.', 'danger');
  }
}

/**
 * Lightweight Toast notification
 */
function showToast(message, type = 'success') {
  let toast = document.getElementById('historyToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'historyToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type === 'danger' ? 'toast-error' : 'toast-success'} show`;

  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

/**
 * Pagination Navigation Handlers
 */
export function nextPage() {
  if (currentPage * pageSize < filteredScans.length) {
    currentPage += 1;
    renderHistoryPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

export function prevPage() {
  if (currentPage > 1) {
    currentPage -= 1;
    renderHistoryPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

import {
  fetchUserRecoveryRecords,
  updateRecoveryRecordStatus,
  getActiveRecoveryRules,
  RECOVERY_METHOD_METADATA,
  WASTE_CATEGORY_METADATA
} from './recovery.js';

let currentFilter = 'all';
let cachedRecords = [];

// DOM References
const statsTotalEl = document.getElementById('stat-total-records');
const statsPlannedEl = document.getElementById('stat-planned-records');
const statsCompletedEl = document.getElementById('stat-completed-records');
const statsSuggestedEl = document.getElementById('stat-suggested-records');
const recordsContainer = document.getElementById('recovery-records-container');
const emptyStateContainer = document.getElementById('recovery-empty-state');
const loadingIndicator = document.getElementById('recovery-loading-indicator');
const filterTabButtons = document.querySelectorAll('.filter-tab-btn');
const rulesShowcaseContainer = document.getElementById('rules-showcase-container');

/**
 * Updates KPI summary counters from loaded recovery records.
 */
function updateStats(records) {
  const total = records.length;
  const planned = records.filter((r) => r.status === 'planned').length;
  const completed = records.filter((r) => r.status === 'completed').length;
  const suggested = records.filter((r) => r.status === 'suggested').length;

  if (statsTotalEl) statsTotalEl.textContent = total;
  if (statsPlannedEl) statsPlannedEl.textContent = planned;
  if (statsCompletedEl) statsCompletedEl.textContent = completed;
  if (statsSuggestedEl) statsSuggestedEl.textContent = suggested;
}

/**
 * Renders a single recovery record card using safe DOM creation (no innerHTML with user text).
 */
function createRecordCard(record) {
  const card = document.createElement('article');
  card.className = 'recovery-card';
  card.setAttribute('data-id', record.id);

  const scan = record.food_scans || {};
  const methodMeta = RECOVERY_METHOD_METADATA[record.recovery_method] || {
    label: record.recovery_method,
    badgeClass: 'badge-primary',
    icon: '♻️'
  };

  const wasteMeta = WASTE_CATEGORY_METADATA[scan.waste_category] || {
    label: scan.waste_category || 'Organic waste',
    badgeClass: 'badge-muted'
  };

  // 1. Header (Food item name, scan date, method tag)
  const header = document.createElement('div');
  header.className = 'recovery-card-header';

  const titleBlock = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'recovery-card-title';
  title.textContent = scan.food_name || 'Food Resource';

  const metaText = document.createElement('p');
  metaText.className = 'recovery-card-meta';
  const qtyStr = scan.quantity ? `${scan.quantity} ${scan.quantity_unit || ''}` : '';
  const dateStr = record.created_at ? new Date(record.created_at).toLocaleDateString() : '';
  metaText.textContent = [qtyStr, dateStr].filter(Boolean).join(' • ');

  titleBlock.appendChild(title);
  titleBlock.appendChild(metaText);
  header.appendChild(titleBlock);

  const methodBadge = document.createElement('span');
  methodBadge.className = `badge ${methodMeta.badgeClass}`;
  methodBadge.textContent = `${methodMeta.icon} ${methodMeta.label}`;
  header.appendChild(methodBadge);

  card.appendChild(header);

  // 2. Body (Waste category & recommendation details)
  const body = document.createElement('div');
  body.className = 'recovery-card-body';

  const wasteCategoryTag = document.createElement('span');
  wasteCategoryTag.className = `badge ${wasteMeta.badgeClass}`;
  wasteCategoryTag.style.alignSelf = 'flex-start';
  wasteCategoryTag.textContent = wasteMeta.label;
  body.appendChild(wasteCategoryTag);

  const highlightBox = document.createElement('div');
  highlightBox.className = 'pathway-highlight-box';

  const reasonEl = document.createElement('p');
  reasonEl.className = 'pathway-reason-text';
  reasonEl.textContent =
    record.recommendation_reason || 'Identified resource recovery opportunity.';
  highlightBox.appendChild(reasonEl);

  if (record.estimated_resource_value) {
    const valueEl = document.createElement('p');
    valueEl.className = 'pathway-resource-value';
    valueEl.textContent = `Estimated Resource Value: ${record.estimated_resource_value}`;
    highlightBox.appendChild(valueEl);
  }

  body.appendChild(highlightBox);
  card.appendChild(body);

  // 3. Footer / Status & Action Buttons
  const footer = document.createElement('div');
  footer.className = 'recovery-card-actions';

  const statusBadge = document.createElement('span');
  statusBadge.className = `status-badge status-badge-${record.status}`;
  statusBadge.textContent = capitalizeFirstLetter(record.status);
  footer.appendChild(statusBadge);

  const buttonGroup = document.createElement('div');
  buttonGroup.style.display = 'flex';
  buttonGroup.style.gap = 'var(--spacing-2)';

  if (record.status === 'suggested') {
    const planBtn = document.createElement('button');
    planBtn.className = 'btn btn-sm btn-primary';
    planBtn.textContent = 'Plan Action';
    planBtn.addEventListener('click', () => handleStatusChange(record.id, 'planned'));
    buttonGroup.appendChild(planBtn);

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'btn btn-sm btn-secondary';
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.addEventListener('click', () => handleStatusChange(record.id, 'dismissed'));
    buttonGroup.appendChild(dismissBtn);
  } else if (record.status === 'planned') {
    const completeBtn = document.createElement('button');
    completeBtn.className = 'btn btn-sm btn-success';
    completeBtn.textContent = 'Mark Completed';
    completeBtn.addEventListener('click', () => handleStatusChange(record.id, 'completed'));
    buttonGroup.appendChild(completeBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-sm btn-secondary';
    cancelBtn.textContent = 'Revert';
    cancelBtn.addEventListener('click', () => handleStatusChange(record.id, 'suggested'));
    buttonGroup.appendChild(cancelBtn);
  } else if (record.status === 'completed') {
    const reopenBtn = document.createElement('button');
    reopenBtn.className = 'btn btn-sm btn-secondary';
    reopenBtn.textContent = 'Re-open';
    reopenBtn.addEventListener('click', () => handleStatusChange(record.id, 'planned'));
    buttonGroup.appendChild(reopenBtn);
  } else if (record.status === 'dismissed') {
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn btn-sm btn-outline';
    restoreBtn.textContent = 'Restore';
    restoreBtn.addEventListener('click', () => handleStatusChange(record.id, 'suggested'));
    buttonGroup.appendChild(restoreBtn);
  }

  footer.appendChild(buttonGroup);
  card.appendChild(footer);

  return card;
}

/**
 * Handles status change mutation for a recovery record.
 */
async function handleStatusChange(recordId, newStatus) {
  try {
    await updateRecoveryRecordStatus(recordId, newStatus);
    await reloadRecords();
  } catch (err) {
    alert(`Could not update record: ${err.message}`);
  }
}

const rulesSearchInput = document.getElementById('rules-search-input');
const rulesCategoryFilters = document.getElementById('rules-category-filters');
let activeRulesList = [];
let currentRuleGroup = 'all';
let currentRuleSearchQuery = '';

const TIER_METADATA = {
  household: { label: '🏠 Household DIY', badgeClass: 'badge-success' },
  community: { label: '🤝 Community Action', badgeClass: 'badge-primary' },
  industrial: { label: '🏭 Industrial Facility', badgeClass: 'badge-secondary' }
};

/**
 * Renders the circular rules showcase directory with live filtering and search.
 */
async function renderRulesShowcase() {
  if (!rulesShowcaseContainer) return;
  if (activeRulesList.length === 0) {
    activeRulesList = await getActiveRecoveryRules();
  }

  rulesShowcaseContainer.innerHTML = '';

  const searchLower = currentRuleSearchQuery.trim().toLowerCase();

  const filteredRules = activeRulesList.filter((rule) => {
    // 1. Group filter
    if (currentRuleGroup !== 'all') {
      const matchGroup =
        rule.category_group === currentRuleGroup ||
        (rule.material_pattern && rule.material_pattern.includes(currentRuleGroup));
      if (!matchGroup) return false;
    }

    // 2. Text Search
    if (searchLower) {
      const matchesPattern = rule.material_pattern.toLowerCase().includes(searchLower);
      const matchesExplanation = (rule.explanation || '').toLowerCase().includes(searchLower);
      const matchesMethod = rule.recovery_method.toLowerCase().includes(searchLower);
      if (!matchesPattern && !matchesExplanation && !matchesMethod) return false;
    }

    return true;
  });

  if (filteredRules.length === 0) {
    rulesShowcaseContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: var(--spacing-6); color: var(--color-text-muted);">
        <p class="text-sm">No circular recovery pathways found matching "<strong>${escapeHtml(currentRuleSearchQuery)}</strong>".</p>
        <button type="button" id="btn-reset-rules-search" class="btn btn-sm btn-outline" style="margin-top: var(--spacing-2);">Clear Search</button>
      </div>
    `;
    const resetBtn = document.getElementById('btn-reset-rules-search');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (rulesSearchInput) rulesSearchInput.value = '';
        currentRuleSearchQuery = '';
        currentRuleGroup = 'all';
        if (rulesCategoryFilters) {
          rulesCategoryFilters
            .querySelectorAll('.filter-tab-btn')
            .forEach((b) => b.classList.remove('active'));
          rulesCategoryFilters.querySelector('[data-group="all"]')?.classList.add('active');
        }
        renderRulesShowcase();
      });
    }
    return;
  }

  filteredRules.forEach((rule) => {
    const meta = RECOVERY_METHOD_METADATA[rule.recovery_method] || {
      label: rule.recovery_method,
      badgeClass: 'badge-primary',
      icon: '♻️'
    };

    const tierMeta = TIER_METADATA[rule.tier] || TIER_METADATA.household;

    const card = document.createElement('div');
    card.className = 'rule-showcase-card';

    // Top Header: Primary Material Name & Method Badge
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.gap = 'var(--spacing-2)';

    const name = document.createElement('strong');
    name.className = 'text-sm font-semibold';
    name.textContent = rule.material_pattern.split('|')[0].toUpperCase();

    const tag = document.createElement('span');
    tag.className = `badge ${meta.badgeClass}`;
    tag.textContent = `${meta.icon} ${meta.label}`;

    header.appendChild(name);
    header.appendChild(tag);
    card.appendChild(header);

    // Tier Scale Badge
    const tierBadge = document.createElement('span');
    tierBadge.className = `badge ${tierMeta.badgeClass}`;
    tierBadge.style.alignSelf = 'flex-start';
    tierBadge.style.fontSize = '10px';
    tierBadge.textContent = tierMeta.label;
    card.appendChild(tierBadge);

    // Explanation
    const expl = document.createElement('p');
    expl.className = 'text-xs';
    expl.style.lineHeight = 'var(--line-height-normal)';
    expl.textContent = rule.explanation;
    card.appendChild(expl);

    // Resource Value
    if (rule.estimated_resource_value) {
      const val = document.createElement('p');
      val.className = 'text-xs text-primary font-medium';
      val.textContent = `⚡ Resource Potential: ${rule.estimated_resource_value}`;
      card.appendChild(val);
    }

    // Requirements / Conditions
    if (rule.requirements) {
      const req = document.createElement('p');
      req.className = 'text-xs text-muted';
      req.style.fontStyle = 'italic';
      req.style.borderLeft = '2px solid var(--color-warning)';
      req.style.paddingLeft = 'var(--spacing-2)';
      req.textContent = `Conditions: ${rule.requirements}`;
      card.appendChild(req);
    }

    rulesShowcaseContainer.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[tag] || tag
  );
}

/**
 * Fetches and displays user recovery records.
 */
async function reloadRecords() {
  loadingIndicator.classList.remove('is-hidden');
  recordsContainer.innerHTML = '';
  emptyStateContainer.classList.add('is-hidden');

  try {
    // Fetch all records for stats, then filter locally
    cachedRecords = await fetchUserRecoveryRecords('all');
    updateStats(cachedRecords);

    const filtered =
      currentFilter === 'all'
        ? cachedRecords
        : cachedRecords.filter((r) => r.status === currentFilter);

    loadingIndicator.classList.add('is-hidden');

    if (filtered.length === 0) {
      emptyStateContainer.classList.remove('is-hidden');
    } else {
      filtered.forEach((record) => {
        recordsContainer.appendChild(createRecordCard(record));
      });
    }
  } catch (err) {
    loadingIndicator.classList.add('is-hidden');
    console.error('Failed to load recovery records:', err);
    recordsContainer.innerHTML = `<p class="form-error">Failed to load recovery records: ${err.message}</p>`;
  }
}

function capitalizeFirstLetter(string) {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Initializes the circular recovery page.
 */
export async function initRecoveryPage() {
  // Tab filter clicks for user recovery records
  filterTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterTabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      reloadRecords();
    });
  });

  // Category chip filter clicks for circular directory
  if (rulesCategoryFilters) {
    rulesCategoryFilters.querySelectorAll('.filter-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        rulesCategoryFilters
          .querySelectorAll('.filter-tab-btn')
          .forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentRuleGroup = btn.getAttribute('data-group') || 'all';
        renderRulesShowcase();
      });
    });
  }

  // Live text search for circular rules directory
  if (rulesSearchInput) {
    let debounceTimer;
    rulesSearchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentRuleSearchQuery = e.target.value;
        renderRulesShowcase();
      }, 200);
    });
  }

  // Load records and rules showcase
  await Promise.all([reloadRecords(), renderRulesShowcase()]);
}

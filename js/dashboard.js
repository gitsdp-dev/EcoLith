import { supabase } from './supabase.js';

let trendChartInstance = null;
let categoryChartInstance = null;
let methodChartInstance = null;

/**
 * Standard unit normalization to kg.
 * Computes deterministic weights in plain JS.
 */
export function normalizeToKg(quantity, unit) {
  const qty = Number(quantity) || 0;
  switch (unit) {
    case 'g':
      return qty / 1000;
    case 'kg':
      return qty;
    case 'piece':
      return qty * 0.15; // standard average estimate ~150g per piece
    case 'ml':
      return qty / 1000;
    case 'l':
      return qty * 1.0;
    default:
      return qty;
  }
}

/**
 * Deterministic analytics calculation.
 * All figures computed in pure JavaScript.
 */
export function calculateDashboardMetrics(scans = [], recoveries = []) {
  let totalWasteKg = 0;
  let edibleSurplusKg = 0;
  let organicDivertedKg = 0;

  const categoryCounts = {
    edible_reusable: 0,
    surplus_redistributable: 0,
    unavoidable_organic: 0,
    other_separate: 0
  };

  const methodCounts = {};
  let completedRecoveryCount = 0;

  // Process scans
  scans.forEach((scan) => {
    const weightKg = normalizeToKg(scan.quantity, scan.quantity_unit);
    totalWasteKg += weightKg;

    if (categoryCounts[scan.waste_category] !== undefined) {
      categoryCounts[scan.waste_category] += 1;
    }

    if (
      scan.waste_category === 'edible_reusable' ||
      scan.waste_category === 'surplus_redistributable'
    ) {
      edibleSurplusKg += weightKg;
    }

    if (
      scan.waste_category === 'unavoidable_organic' ||
      scan.waste_category === 'edible_reusable' ||
      scan.waste_category === 'surplus_redistributable'
    ) {
      organicDivertedKg += weightKg;
    }
  });

  // Process recoveries
  recoveries.forEach((rec) => {
    methodCounts[rec.recovery_method] = (methodCounts[rec.recovery_method] || 0) + 1;
    if (rec.status === 'completed') {
      completedRecoveryCount += 1;
    }
  });

  const totalScans = scans.length;
  const edibleRedirectRate =
    totalWasteKg > 0 ? Math.round((edibleSurplusKg / totalWasteKg) * 100) : 0;
  const diversionRate = totalWasteKg > 0 ? Math.round((organicDivertedKg / totalWasteKg) * 100) : 0;

  // Estimated environmental impacts (EPA WARM & IPCC factors)
  // 1 kg food waste diverted from landfill saves ~1.9 kg CO2e
  const estimatedCo2SavedKg = Math.round(organicDivertedKg * 1.9 * 10) / 10;
  // 1 kg food waste embodies ~1,500 L of water footprint
  const estimatedWaterSavedLiters = Math.round(organicDivertedKg * 1500);

  return {
    totalScans,
    totalWasteKg: Math.round(totalWasteKg * 100) / 100,
    edibleSurplusKg: Math.round(edibleSurplusKg * 100) / 100,
    edibleRedirectRate,
    organicDivertedKg: Math.round(organicDivertedKg * 100) / 100,
    diversionRate,
    totalRecoveries: recoveries.length,
    completedRecoveryCount,
    categoryCounts,
    methodCounts,
    estimatedCo2SavedKg,
    estimatedWaterSavedLiters
  };
}

/**
 * Generate personalized recommendations based on past records.
 */
export function generateSuggestions(scans = []) {
  const suggestions = [];

  if (scans.length === 0) {
    return [
      {
        icon: '📷',
        title: 'Start by Scanning Food Residue',
        text: 'Take a photo of everyday kitchen scraps (peels, coffee grounds, leftovers) to discover circular pathways.'
      },
      {
        icon: '🔒',
        title: 'Configure Your Key Vault',
        text: 'EcoLith runs on your private Gemini API key with zero platform tracking.'
      }
    ];
  }

  const itemsMap = {};
  scans.forEach((s) => {
    const name = s.food_name.toLowerCase();
    itemsMap[name] = (itemsMap[name] || 0) + 1;
  });

  const names = Object.keys(itemsMap);

  if (
    names.some(
      (n) =>
        n.includes('peel') || n.includes('orange') || n.includes('citrus') || n.includes('lemon')
    )
  ) {
    suggestions.push({
      icon: '🍊',
      title: 'Citrus Residue Valorization',
      text: 'You have logged citrus peels. These contain rich pectin and d-limonene. Consider infusing them into natural eco-cleaners before composting.'
    });
  }

  if (names.some((n) => n.includes('coffee') || n.includes('grounds'))) {
    suggestions.push({
      icon: '☕',
      title: 'Coffee Grounds Soil Amendment',
      text: 'Used coffee grounds add rich nitrogen and organic aeration to garden compost or indoor potted acid-loving plants.'
    });
  }

  if (names.some((n) => n.includes('bread') || n.includes('crust') || n.includes('bakery'))) {
    suggestions.push({
      icon: '🍞',
      title: 'Bakery Upcycling',
      text: 'Surplus or stale bread can be dehydrated for seasoned breadcrumbs or croutons, preventing food spoilage.'
    });
  }

  if (suggestions.length < 2) {
    suggestions.push({
      icon: '🌱',
      title: 'Aerated Micro-Composting',
      text: 'Your organic waste can be diverted from landfills to generate nutrient-rich organic soil conditioning.'
    });
  }

  return suggestions;
}

/**
 * Render Chart.js visual charts.
 */
export function renderCharts(scans = [], metrics) {
  if (typeof window.Chart === 'undefined') {
    console.warn('[DASHBOARD] Chart.js not loaded on page.');
    return;
  }

  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';

  // 1. Trend Chart (Waste logged by day)
  const trendCtx = document.getElementById('trendChart')?.getContext('2d');
  if (trendCtx) {
    if (trendChartInstance) trendChartInstance.destroy();

    // Group scans by date (last 7 recorded days)
    const dailyMap = {};
    const sortedScans = [...scans].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    sortedScans.forEach((scan) => {
      const dateStr = new Date(scan.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
      const kg = normalizeToKg(scan.quantity, scan.quantity_unit);
      dailyMap[dateStr] = (dailyMap[dateStr] || 0) + kg;
    });

    const labels = Object.keys(dailyMap).slice(-7);
    const dataPoints = labels.map((l) => Math.round(dailyMap[l] * 100) / 100);

    trendChartInstance = new window.Chart(trendCtx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [
          {
            label: 'Waste Recorded (kg)',
            data: dataPoints.length > 0 ? dataPoints : [0],
            borderColor: '#000000',
            borderWidth: 3,
            backgroundColor: 'rgba(204, 255, 0, 0.45)',
            fill: true,
            tension: 0, // Sharp brutalist line
            pointBackgroundColor: '#ccff00',
            pointBorderColor: '#000000',
            pointBorderWidth: 2,
            pointRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} kg`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { weight: 'bold', family: 'Space Grotesk' } },
            grid: { color: gridColor }
          },
          y: {
            beginAtZero: true,
            ticks: { color: textColor, font: { weight: 'bold', family: 'Space Grotesk' } },
            grid: { color: gridColor }
          }
        }
      }
    });
  }

  // 2. Category Doughnut Chart
  const categoryCtx = document.getElementById('categoryChart')?.getContext('2d');
  if (categoryCtx) {
    if (categoryChartInstance) categoryChartInstance.destroy();

    const catCounts = metrics.categoryCounts;
    const catLabels = [
      'Edible Reusable',
      'Surplus Redistributable',
      'Unavoidable Organic',
      'Other Separate'
    ];
    const catData = [
      catCounts.edible_reusable,
      catCounts.surplus_redistributable,
      catCounts.unavoidable_organic,
      catCounts.other_separate
    ];

    const hasData = catData.some((v) => v > 0);

    categoryChartInstance = new window.Chart(categoryCtx, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [
          {
            data: hasData ? catData : [1],
            backgroundColor: hasData ? ['#ccff00', '#000000', '#ffe500', '#f4f4f0'] : ['#e0e0dc'],
            borderWidth: 2,
            borderColor: '#000000'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              boxWidth: 12,
              font: { weight: 'bold', family: 'Space Grotesk' }
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  // 3. Recovery Method Split
  const methodCtx = document.getElementById('recoveryMethodChart')?.getContext('2d');
  if (methodCtx) {
    if (methodChartInstance) methodChartInstance.destroy();

    const mKeys = Object.keys(metrics.methodCounts);
    const mData = mKeys.map((k) => metrics.methodCounts[k]);
    const formatMethodName = (m) => m.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const hasMethodData = mData.length > 0;

    methodChartInstance = new window.Chart(methodCtx, {
      type: 'bar',
      data: {
        labels: hasMethodData ? mKeys.map(formatMethodName) : ['No Data'],
        datasets: [
          {
            label: 'Actions Count',
            data: hasMethodData ? mData : [0],
            backgroundColor: '#ccff00',
            borderColor: '#000000',
            borderWidth: 2,
            borderRadius: 0 // Sharp brutalist rectangle bars
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: textColor },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: textColor,
              precision: 0
            },
            grid: { color: gridColor }
          }
        }
      }
    });
  }
}

/**
 * Initialize Dashboard page view.
 */
export async function initDashboard(userId) {
  try {
    // 1. Fetch user's scans
    const { data: scans, error: scansError } = await supabase
      .from('food_scans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (scansError) throw scansError;

    // 2. Fetch user's recovery records
    const { data: recoveries, error: recError } = await supabase
      .from('recovery_records')
      .select('*')
      .eq('user_id', userId);

    if (recError) throw recError;

    // 3. Compute deterministic metrics
    const metrics = calculateDashboardMetrics(scans || [], recoveries || []);

    // 4. Update KPI stat cards
    const totalWasteEl = document.getElementById('valTotalWaste');
    const totalScansEl = document.getElementById('valTotalScans');
    const edibleRedirectEl = document.getElementById('valEdibleRedirect');
    const diversionRateEl = document.getElementById('valDiversionRate');
    const completedRecoveryEl = document.getElementById('valCompletedRecovery');

    if (totalWasteEl) totalWasteEl.textContent = `${metrics.totalWasteKg} kg`;
    if (totalScansEl) totalScansEl.textContent = String(metrics.totalScans);
    if (edibleRedirectEl) edibleRedirectEl.textContent = `${metrics.edibleRedirectRate}%`;
    if (diversionRateEl) diversionRateEl.textContent = `${metrics.diversionRate}%`;
    if (completedRecoveryEl)
      completedRecoveryEl.textContent = String(metrics.completedRecoveryCount);

    // 5. Update Environmental Impact (labeled with ESTIMATED badge)
    const impactCo2El = document.getElementById('valImpactCo2');
    const impactWaterEl = document.getElementById('valImpactWater');
    const impactWasteEl = document.getElementById('valImpactWaste');

    if (impactCo2El) impactCo2El.textContent = `${metrics.estimatedCo2SavedKg} kg`;
    if (impactWaterEl)
      impactWaterEl.textContent = `${metrics.estimatedWaterSavedLiters.toLocaleString()} L`;
    if (impactWasteEl) impactWasteEl.textContent = `${metrics.organicDivertedKg} kg`;

    // 6. Handle Zero Data State
    const emptyState = document.getElementById('dashboardEmptyState');
    const dashboardContent = document.getElementById('dashboardMetricsSection');

    if (metrics.totalScans === 0) {
      if (emptyState) emptyState.style.display = 'block';
      if (dashboardContent) dashboardContent.style.display = 'none';
    } else {
      if (emptyState) emptyState.style.display = 'none';
      if (dashboardContent) dashboardContent.style.display = 'block';
      renderCharts(scans, metrics);
    }

    // 7. Render Personalized Suggestions
    const suggestionsContainer = document.getElementById('suggestionsContainer');
    if (suggestionsContainer) {
      const suggestions = generateSuggestions(scans || []);
      suggestionsContainer.innerHTML = '';
      suggestions.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'suggestion-card';

        const icon = document.createElement('div');
        icon.className = 'suggestion-icon';
        icon.textContent = item.icon;

        const body = document.createElement('div');
        const title = document.createElement('strong');
        title.style.display = 'block';
        title.style.fontSize = 'var(--font-size-sm)';
        title.style.marginBottom = 'var(--spacing-1)';
        title.textContent = item.title;

        const text = document.createElement('p');
        text.className = 'text-xs text-muted';
        text.style.margin = '0';
        text.textContent = item.text;

        body.appendChild(title);
        body.appendChild(text);
        card.appendChild(icon);
        card.appendChild(body);
        suggestionsContainer.appendChild(card);
      });
    }
  } catch (err) {
    console.error('[DASHBOARD ERROR]', err);
    const errBanner = document.getElementById('dashboardErrorBanner');
    if (errBanner) {
      errBanner.style.display = 'block';
      errBanner.textContent = 'Unable to load dashboard metrics. Please refresh.';
    }
  }
}

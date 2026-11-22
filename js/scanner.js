import { CONFIG } from './config.js';
import { supabase } from './supabase.js';
import { analyzeFoodImage } from './gemini.js';
import {
  getRecoveryRecommendations,
  createRecoveryRecord,
  RECOVERY_METHOD_METADATA
} from './recovery.js';

// DOM Elements
const lockedStateSection = document.getElementById('scanner-locked-state');
const activeScannerSection = document.getElementById('scanner-active-section');
const confirmationSection = document.getElementById('scanner-confirmation-section');
const successSection = document.getElementById('scanner-success-section');

// Viewfinder & Video elements
const viewfinderStandby = document.getElementById('viewfinder-standby');
const cameraVideo = document.getElementById('camera-video');
const capturedImagePreview = document.getElementById('captured-image-preview');
const viewfinderOverlay = document.getElementById('viewfinder-overlay');
const viewfinderDetectionOverlay = document.getElementById('viewfinder-detection-overlay');
const analyzingOverlay = document.getElementById('analyzing-overlay');

// Action Buttons
const btnStartCamera = document.getElementById('btn-start-camera');
const btnCapture = document.getElementById('btn-capture');
const btnRetake = document.getElementById('btn-retake');
const btnUpload = document.getElementById('btn-upload');
const btnCancelCamera = document.getElementById('btn-cancel-camera');
const fileInput = document.getElementById('file-input');

// Confirmation Form Elements
const scanThumbnail = document.getElementById('scan-thumbnail');
const detectionBoxesLayer = document.getElementById('detection-boxes-layer');
const aiInspectorCard = document.getElementById('ai-inspector-card');
const detectionCoordsBadge = document.getElementById('detection-coords-badge');
const emptyScanNotice = document.getElementById('empty-scan-notice');
const btnEmptyRetake = document.getElementById('btn-empty-retake');
const confidencePill = document.getElementById('confidence-pill');
const editFoodName = document.getElementById('edit-food-name');
const editFoodCategory = document.getElementById('edit-food-category');
const editCondition = document.getElementById('edit-condition');
const editWasteCategory = document.getElementById('edit-waste-category');
const editQuantity = document.getElementById('edit-quantity');
const editQuantityUnit = document.getElementById('edit-quantity-unit');
const correctionIndicator = document.getElementById('correction-indicator');
const recoveryPreviewList = document.getElementById('recovery-preview-list');
const reusePillsList = document.getElementById('reuse-pills-list');
const btnConfirmScan = document.getElementById('btn-confirm-scan');
const btnDiscardScan = document.getElementById('btn-discard-scan');
const formErrorNotice = document.getElementById('form-error-notice');

// Condition & Safety Assessment Elements
const conditionAssessmentCard = document.getElementById('condition-assessment-card');
const conditionGradeBadge = document.getElementById('condition-grade-badge');
const wasteTypePill = document.getElementById('waste-type-pill');
const reusabilityScoreText = document.getElementById('reusability-score-text');
const reusabilityMeterFill = document.getElementById('reusability-meter-fill');
const conditionDetailsText = document.getElementById('condition-details-text');
const foodSafetyBanner = document.getElementById('food-safety-banner');
const industrialSafetyBanner = document.getElementById('industrial-safety-banner');
const hazardAlertsBanner = document.getElementById('hazard-alerts-banner');
const hazardAlertsList = document.getElementById('hazard-alerts-list');
const reuseTipsHeading = document.getElementById('reuse-tips-heading');

// Success Action Elements
const btnScanAnother = document.getElementById('btn-scan-another');
const successFoodName = document.getElementById('success-food-name');
const successQuantity = document.getElementById('success-quantity');

// State Variables
let mediaStream = null;
let currentImageDataUrl = null;
let currentAiAnalysis = null;
let originalAiItem = null;
let userCorrected = false;

/**
 * Escapes HTML characters to prevent XSS.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/**
 * Downscales an HTML Image or Canvas to max dimensions and returns JPEG base64.
 * Keeps memory low and avoids sending huge payloads.
 */
function downscaleImage(source, maxDimension = 1024, quality = 0.8) {
  const canvas = document.createElement('canvas');
  let width = source.videoWidth || source.naturalWidth || source.width;
  let height = source.videoHeight || source.naturalHeight || source.height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Checks whether the user has a valid Gemini API key registered in the Key Vault.
 */
async function verifyKeyStatus() {
  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) return { hasKey: false, status: null };

    const res = await fetch(`${CONFIG.API_BASE_URL}/api/keys/status`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (!res.ok) {
      return { hasKey: false, status: null };
    }

    return await res.json().catch(() => ({ hasKey: false, status: null }));
  } catch (err) {
    console.warn('Could not verify key status:', err);
    return { hasKey: false, status: null };
  }
}

/**
 * Stops camera stream tracks to turn off the hardware camera light.
 */
function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  if (cameraVideo) {
    cameraVideo.srcObject = null;
    cameraVideo.classList.add('is-hidden');
  }
  if (viewfinderOverlay) viewfinderOverlay.classList.add('is-hidden');
  if (viewfinderDetectionOverlay) {
    viewfinderDetectionOverlay.innerHTML = '';
    viewfinderDetectionOverlay.classList.add('is-hidden');
  }
  if (btnCapture) btnCapture.classList.add('is-hidden');
  if (btnCancelCamera) btnCancelCamera.classList.add('is-hidden');
  if (btnStartCamera) btnStartCamera.classList.remove('is-hidden');
  if (btnUpload) btnUpload.classList.remove('is-hidden');
  if (viewfinderStandby) viewfinderStandby.classList.remove('is-hidden');
}

/**
 * Starts the device camera stream on explicit user action.
 */
async function startCamera() {
  try {
    capturedImagePreview.classList.add('is-hidden');
    viewfinderStandby.classList.add('is-hidden');
    btnRetake.classList.add('is-hidden');
    if (viewfinderDetectionOverlay) {
      viewfinderDetectionOverlay.innerHTML = '';
      viewfinderDetectionOverlay.classList.add('is-hidden');
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    cameraVideo.srcObject = mediaStream;
    cameraVideo.classList.remove('is-hidden');
    await cameraVideo.play();

    viewfinderOverlay.classList.remove('is-hidden');
    btnStartCamera.classList.add('is-hidden');
    btnUpload.classList.add('is-hidden');
    btnCapture.classList.remove('is-hidden');
    btnCancelCamera.classList.remove('is-hidden');
  } catch (err) {
    console.error('Camera access error:', err);
    let errorMsg = 'Could not access camera. Please check permissions or upload a photo directly.';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMsg =
        'Camera permission was denied. You can upload an image or enable camera permissions in browser settings.';
    }
    alert(errorMsg);
    stopCamera();
    fileInput.click();
  }
}

/**
 * Captures the current camera video frame.
 */
function captureFrame() {
  if (!cameraVideo || !mediaStream) return;

  const dataUrl = downscaleImage(cameraVideo, 1024, 0.8);
  stopCamera();

  processCapturedImage(dataUrl);
}

/**
 * Renders an emerald green bounding box overlay with pinned tag and corner brackets.
 *
 * @param {HTMLElement} container - DOM container for overlay
 * @param {number[]} box - [ymin, xmin, ymax, xmax] normalized (0 to 1000)
 * @param {string} label - Name of detected item
 * @param {number} confidence - AI detection confidence (0.0 to 1.0)
 * @param {string} [conditionText] - Optional condition or reusability tag
 */
function drawDetectionBoundingBoxes(container, box, label, confidence, conditionText = '') {
  if (!container) return;
  container.innerHTML = '';
  if (!box || !Array.isArray(box) || box.length !== 4) return;

  const [ymin, xmin, ymax, xmax] = box;
  const top = (ymin / 10).toFixed(2);
  const left = (xmin / 10).toFixed(2);
  const width = Math.max(5, (xmax - xmin) / 10).toFixed(2);
  const height = Math.max(5, (ymax - ymin) / 10).toFixed(2);

  const boxEl = document.createElement('div');
  boxEl.className = 'ai-detected-green-box';
  boxEl.style.top = `${top}%`;
  boxEl.style.left = `${left}%`;
  boxEl.style.width = `${width}%`;
  boxEl.style.height = `${height}%`;

  const tagEl = document.createElement('div');
  tagEl.className = 'ai-box-tag';
  const confText = Math.round((confidence || 0.85) * 100);
  const condBadge = conditionText ? ` • ${escapeHtml(conditionText)}` : '';
  tagEl.innerHTML = `<span>🟩</span> <span>${escapeHtml(label || 'Material')}${condBadge}</span> <span class="ai-box-confidence">${confText}%</span>`;
  boxEl.appendChild(tagEl);

  // Corner brackets
  const tl = document.createElement('span');
  tl.className = 'box-bracket bracket-tl';
  const tr = document.createElement('span');
  tr.className = 'box-bracket bracket-tr';
  const bl = document.createElement('span');
  bl.className = 'box-bracket bracket-bl';
  const br = document.createElement('span');
  br.className = 'box-bracket bracket-br';
  boxEl.appendChild(tl);
  boxEl.appendChild(tr);
  boxEl.appendChild(bl);
  boxEl.appendChild(br);

  container.appendChild(boxEl);
}

/**
 * Handles image processing and sends to backend for universal AI classification.
 * @param {string} dataUrl - Downscaled JPEG base64 data URL
 */
async function processCapturedImage(dataUrl) {
  currentImageDataUrl = dataUrl;

  capturedImagePreview.src = dataUrl;
  capturedImagePreview.classList.remove('is-hidden');
  viewfinderStandby.classList.add('is-hidden');
  btnStartCamera.classList.add('is-hidden');
  btnUpload.classList.add('is-hidden');
  btnCapture.classList.add('is-hidden');
  btnRetake.classList.remove('is-hidden');

  analyzingOverlay.classList.remove('is-hidden');

  try {
    const result = await analyzeFoodImage(dataUrl, 'image/jpeg');
    currentAiAnalysis = result;
    analyzingOverlay.classList.add('is-hidden');

    const firstItem = result.items?.[0];
    if (firstItem && firstItem.bounding_box && viewfinderDetectionOverlay) {
      drawDetectionBoundingBoxes(
        viewfinderDetectionOverlay,
        firstItem.bounding_box,
        firstItem.food_name,
        firstItem.confidence,
        firstItem.condition ? firstItem.condition.replace(/_/g, ' ') : ''
      );
      viewfinderDetectionOverlay.classList.remove('is-hidden');
    }

    showConfirmationScreen(result);
  } catch (err) {
    analyzingOverlay.classList.add('is-hidden');
    console.error('Analysis failed:', err);

    if (err.code === 'NO_API_KEY') {
      alert('You have no Gemini API key registered. Please configure your key in the Key Vault.');
      window.location.href = 'keyvault.html';
      return;
    }
    if (err.code === 'API_KEY_INVALID') {
      alert('Your Gemini API key was rejected by Google. Please check your key in the Key Vault.');
      window.location.href = 'keyvault.html';
      return;
    }
    if (err.code === 'QUOTA_EXCEEDED') {
      alert(
        'Your Google Gemini API quota has been exceeded. Please check your account in Google AI Studio or try again later.'
      );
      return;
    }

    alert(
      `Analysis error: ${err.message || 'Unable to analyze image. Please try again or take another photo.'}`
    );
  }
}

/**
 * Populates and displays the Confirmation & Correction Screen.
 * Handles organic food waste and inorganic industrial, mechanical, and electronic materials.
 * @param {object} analysis - Validated AI output
 */
async function showConfirmationScreen(analysis) {
  const item = analysis.items?.[0];

  scanThumbnail.src = currentImageDataUrl;

  // Case 1: Empty Scan / No item detected
  if (!item || !item.food_name) {
    if (emptyScanNotice) emptyScanNotice.classList.remove('is-hidden');
    if (aiInspectorCard) aiInspectorCard.classList.add('is-hidden');
    if (conditionAssessmentCard) conditionAssessmentCard.classList.add('is-hidden');
    if (detectionBoxesLayer) detectionBoxesLayer.innerHTML = '';

    confidencePill.textContent = '0% Detected';
    confidencePill.style.backgroundColor = '#4b5563';
    confidencePill.style.color = '#ffffff';

    editFoodName.value = '';
    editFoodCategory.value = '';
    editWasteCategory.value = '';
    editQuantity.value = '';
    editQuantityUnit.value = '';
    if (editCondition) editCondition.value = 'reusable_intact';

    correctionIndicator.classList.remove('visible');
    formErrorNotice.classList.add('is-hidden');

    recoveryPreviewList.innerHTML =
      '<p class="text-xs text-muted" style="padding: var(--spacing-2) 0;">No circular recovery pathways (no material identified in image).</p>';
    reusePillsList.innerHTML =
      '<span class="text-xs text-muted">No reuse ideas (no object detected).</span>';

    btnConfirmScan.disabled = true;
    btnConfirmScan.textContent = 'No Material Detected to Save';

    activeScannerSection.classList.add('is-hidden');
    confirmationSection.classList.remove('is-hidden');
    confirmationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // Case 2: Item identified
  if (emptyScanNotice) emptyScanNotice.classList.add('is-hidden');
  if (aiInspectorCard) aiInspectorCard.classList.remove('is-hidden');
  if (conditionAssessmentCard) conditionAssessmentCard.classList.remove('is-hidden');
  btnConfirmScan.disabled = false;
  btnConfirmScan.textContent = 'Confirm & Save Scan';

  originalAiItem = {
    food_name: item.food_name,
    food_category: item.food_category,
    waste_category: item.waste_category,
    condition: item.condition
  };
  userCorrected = false;

  // Confidence pill
  const confidencePercent = Math.round((item.confidence || 0.85) * 100);
  confidencePill.textContent = `${confidencePercent}% AI Confidence`;
  if (confidencePercent >= 80) {
    confidencePill.style.backgroundColor = '#00ff66';
    confidencePill.style.color = '#000000';
  } else if (confidencePercent >= 50) {
    confidencePill.style.backgroundColor = '#eab308';
    confidencePill.style.color = '#000000';
  } else {
    confidencePill.style.backgroundColor = '#ef4444';
    confidencePill.style.color = '#ffffff';
  }

  // Condition Grade & Badging
  const condition = item.condition || 'reusable_intact';
  const conditionMeta = {
    new_surplus: { label: 'New / Unused Surplus', class: 'condition-new' },
    reusable_intact: { label: 'Reusable Intact', class: 'condition-intact' },
    minor_wear_refurbishable: { label: 'Minor Wear (Refurbishable)', class: 'condition-refurb' },
    damaged_repairable: { label: 'Damaged (Repairable)', class: 'condition-repair' },
    scrap_recyclable: { label: 'Scrap Only (Recyclable)', class: 'condition-scrap' },
    hazardous_damaged: { label: 'Hazardous / Damaged', class: 'condition-hazard' },
    degraded_end_of_life: { label: 'Degraded / End of Life', class: 'condition-scrap' }
  }[condition] || { label: condition.replace(/_/g, ' '), class: 'condition-intact' };

  if (conditionGradeBadge) {
    conditionGradeBadge.textContent = conditionMeta.label;
    conditionGradeBadge.className = `condition-badge ${conditionMeta.class}`;
  }

  if (editCondition) {
    editCondition.value = condition;
  }

  // Waste Type Pill (Organic vs Inorganic)
  const isOrganic = item.waste_type === 'organic';
  if (wasteTypePill) {
    wasteTypePill.textContent = isOrganic
      ? '🌱 Organic Residue'
      : '⚙️ Inorganic Hardware / Material';
    wasteTypePill.className = isOrganic ? 'badge badge-success' : 'badge badge-primary';
  }

  // Reusability Score Index Meter
  const score = typeof item.reusability_score === 'number' ? item.reusability_score : 80;
  if (reusabilityScoreText) {
    const scoreTier =
      score >= 80
        ? 'High Reusability'
        : score >= 50
          ? 'Medium Reusability (Servicing Recommended)'
          : 'Low Reusability (Scrap / Raw Material)';
    reusabilityScoreText.textContent = `${score}% (${scoreTier})`;
  }
  if (reusabilityMeterFill) {
    reusabilityMeterFill.style.width = `${score}%`;
  }

  // Condition details inspection text
  if (conditionDetailsText) {
    conditionDetailsText.textContent =
      item.condition_details ||
      (isOrganic
        ? 'Organic biomass assessed for soil composting and bio-refining.'
        : 'Material condition inspected for reusability, tolerances, and component harvesting.');
  }

  // Toggle Context-aware Safety Notices
  if (foodSafetyBanner && industrialSafetyBanner) {
    if (isOrganic) {
      foodSafetyBanner.classList.remove('is-hidden');
      industrialSafetyBanner.classList.add('is-hidden');
    } else {
      foodSafetyBanner.classList.add('is-hidden');
      industrialSafetyBanner.classList.remove('is-hidden');
    }
  }

  // Hazard alerts
  if (hazardAlertsBanner && hazardAlertsList) {
    if (Array.isArray(item.hazard_alerts) && item.hazard_alerts.length > 0) {
      hazardAlertsList.innerHTML = '';
      item.hazard_alerts.forEach((alertMsg) => {
        const li = document.createElement('li');
        li.textContent = alertMsg;
        hazardAlertsList.appendChild(li);
      });
      hazardAlertsBanner.classList.remove('is-hidden');
    } else {
      hazardAlertsBanner.classList.add('is-hidden');
    }
  }

  // Dynamic heading for reuse tips
  if (reuseTipsHeading) {
    reuseTipsHeading.textContent = isOrganic
      ? 'Household & Kitchen Reuse Tips'
      : 'Workshop, Engineering & Component Salvage Ideas';
  }

  // Draw 2D Bounding Box in Inspector
  if (item.bounding_box && detectionBoxesLayer) {
    drawDetectionBoundingBoxes(
      detectionBoxesLayer,
      item.bounding_box,
      item.food_name,
      item.confidence,
      conditionMeta.label
    );
    if (detectionCoordsBadge) {
      detectionCoordsBadge.textContent = `Target: [${item.bounding_box.join(', ')}]`;
    }
  }

  // Populate Form Fields
  editFoodName.value = item.food_name || '';

  // Select matching category option
  const matchedCategory = item.food_category || (isOrganic ? 'vegetable' : 'mechanical_hardware');
  let optionFound = false;
  for (let i = 0; i < editFoodCategory.options.length; i++) {
    if (editFoodCategory.options[i].value === matchedCategory) {
      editFoodCategory.selectedIndex = i;
      optionFound = true;
      break;
    }
  }
  if (!optionFound) {
    editFoodCategory.value = isOrganic ? 'other' : 'mechanical_hardware';
  }

  // Waste category
  editWasteCategory.value = item.waste_category || 'unavoidable_organic';

  // Realistic quantity & unit estimation
  editQuantity.value = String(item.estimated_quantity != null ? item.estimated_quantity : '1');
  editQuantityUnit.value = item.estimated_unit || (isOrganic ? 'g' : 'piece');

  correctionIndicator.classList.remove('visible');
  formErrorNotice.classList.add('is-hidden');

  // Render Reuse Suggestions
  renderReuseSuggestions(item.reuse_suggestions || []);

  // Render Recovery Options
  await renderRecoveryOptions(
    item.food_name,
    item.waste_category,
    item.food_category,
    item.recovery_options
  );

  activeScannerSection.classList.add('is-hidden');
  confirmationSection.classList.remove('is-hidden');
  confirmationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Renders circular recovery pathway cards.
 */
async function renderRecoveryOptions(foodName, wasteCategory, foodCategory, aiOptions = []) {
  recoveryPreviewList.innerHTML = '';

  let optionsToRender = aiOptions;
  if (!optionsToRender || optionsToRender.length === 0) {
    optionsToRender = await getRecoveryRecommendations(foodName, wasteCategory, foodCategory);
  }

  optionsToRender.forEach((opt) => {
    const meta = RECOVERY_METHOD_METADATA[opt.method] || {
      label: opt.method.replace(/_/g, ' '),
      badgeClass: 'badge-primary',
      icon: '♻️'
    };

    const card = document.createElement('div');
    card.className = 'recovery-preview-card';

    const topRow = document.createElement('div');
    topRow.className = 'recovery-card-top';

    const tag = document.createElement('span');
    tag.className = `badge ${meta.badgeClass}`;
    tag.textContent = `${meta.icon} ${meta.label}`;
    topRow.appendChild(tag);

    if (opt.estimatedValue || opt.estimated_value) {
      const valBadge = document.createElement('span');
      valBadge.className = 'text-xs text-muted';
      valBadge.style.fontWeight = 'bold';
      valBadge.textContent = opt.estimatedValue || opt.estimated_value;
      topRow.appendChild(valBadge);
    }

    card.appendChild(topRow);

    const reason = document.createElement('p');
    reason.className = 'recovery-reason';
    reason.textContent = opt.reason;
    card.appendChild(reason);

    if (opt.requirements) {
      const req = document.createElement('p');
      req.className = 'recovery-requirements';
      req.textContent = `Handling & Conditions: ${opt.requirements}`;
      card.appendChild(req);
    }

    recoveryPreviewList.appendChild(card);
  });
}

/**
 * Renders repurposing or salvage suggestions.
 */
function renderReuseSuggestions(suggestions) {
  reusePillsList.innerHTML = '';
  if (!suggestions || suggestions.length === 0) {
    const emptyPill = document.createElement('span');
    emptyPill.className = 'text-xs text-muted';
    emptyPill.textContent = 'No specific repurposing suggestions for this item.';
    reusePillsList.appendChild(emptyPill);
    return;
  }

  suggestions.forEach((tip) => {
    const pill = document.createElement('span');
    pill.className = 'reuse-pill';
    pill.textContent = `💡 ${tip}`;
    reusePillsList.appendChild(pill);
  });
}

/**
 * Checks if user made any edits to the AI-generated classifications.
 */
function checkUserModifications() {
  if (!originalAiItem) return;

  const currentName = editFoodName.value.trim();
  const currentCat = editFoodCategory.value.trim();
  const currentWaste = editWasteCategory.value;
  const currentCond = editCondition ? editCondition.value : '';

  if (
    currentName !== originalAiItem.food_name ||
    currentCat !== originalAiItem.food_category ||
    currentWaste !== originalAiItem.waste_category ||
    (currentCond && currentCond !== originalAiItem.condition)
  ) {
    userCorrected = true;
    correctionIndicator.classList.add('visible');
  } else {
    userCorrected = false;
    correctionIndicator.classList.remove('visible');
  }
}

/**
 * Saves confirmed scan and initial recovery records to Supabase.
 */
async function handleConfirmScan() {
  formErrorNotice.classList.add('is-hidden');

  const foodName = editFoodName.value.trim();
  const foodCategory = editFoodCategory.value.trim() || 'mechanical_hardware';
  const wasteCategory = editWasteCategory.value;
  const quantity = parseFloat(editQuantity.value);
  const quantityUnit = editQuantityUnit.value;

  if (!foodName) {
    formErrorNotice.textContent = 'Please enter a valid item or material name.';
    formErrorNotice.classList.remove('is-hidden');
    editFoodName.focus();
    return;
  }

  if (isNaN(quantity) || quantity <= 0) {
    formErrorNotice.textContent = 'Quantity must be a positive number greater than 0.';
    formErrorNotice.classList.remove('is-hidden');
    editQuantity.focus();
    return;
  }

  btnConfirmScan.disabled = true;
  btnConfirmScan.textContent = 'Saving scan...';

  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User session not found. Please log in again.');
    }

    const aiConfidence = currentAiAnalysis?.items?.[0]?.confidence || 0.85;

    // Database check constraint compatibility mapping for quantity_unit
    let dbQuantityUnit = quantityUnit;
    let dbQuantity = quantity;
    if (quantityUnit === 'unit') {
      dbQuantityUnit = 'piece';
    } else if (quantityUnit === 'ton') {
      dbQuantity = Math.round(quantity * 1000 * 100) / 100;
      dbQuantityUnit = 'kg';
    } else if (quantityUnit === 'm') {
      dbQuantityUnit = 'piece';
    }

    // 1. Insert into public.food_scans
    const { data: scanRow, error: scanInsertError } = await supabase
      .from('food_scans')
      .insert({
        user_id: user.id,
        food_name: foodName,
        food_category: foodCategory,
        waste_category: wasteCategory,
        quantity: dbQuantity,
        quantity_unit: dbQuantityUnit,
        ai_confidence: aiConfidence,
        user_corrected: userCorrected
      })
      .select()
      .single();

    if (scanInsertError) {
      throw scanInsertError;
    }

    // 2. Automatically generate and link circular recovery records
    const recoveryOptions = await getRecoveryRecommendations(
      foodName,
      wasteCategory,
      foodCategory,
      currentAiAnalysis?.items?.[0]?.recovery_options
    );

    if (recoveryOptions && recoveryOptions.length > 0) {
      for (const opt of recoveryOptions) {
        const method =
          opt.method || opt.recovery_method || opt.recoveryMethod || 'material_recovery';
        await createRecoveryRecord({
          scanId: scanRow.id,
          userId: user.id,
          recoveryMethod: method,
          reason: opt.reason || opt.recommendation_reason || 'Circular resource recovery.',
          estimatedValue: opt.estimatedValue || opt.requirements || null,
          status: 'suggested'
        });
      }
    } else {
      await createRecoveryRecord({
        scanId: scanRow.id,
        userId: user.id,
        recoveryMethod: 'material_recovery',
        reason: 'Circular material recovery pathway.',
        estimatedValue: 'Material diversion',
        status: 'suggested'
      });
    }

    // 3. Show Success Screen
    successFoodName.textContent = foodName;
    successQuantity.textContent = `${quantity} ${quantityUnit}`;

    confirmationSection.classList.add('is-hidden');
    successSection.classList.remove('is-hidden');
    successSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (saveErr) {
    console.error('Error saving scan:', saveErr);
    formErrorNotice.textContent = `Failed to save record: ${saveErr.message}`;
    formErrorNotice.classList.remove('is-hidden');
  } finally {
    btnConfirmScan.disabled = false;
    btnConfirmScan.textContent = 'Confirm & Save Scan';
  }
}

/**
 * Resets the scanner to take another photo.
 */
function resetScanner() {
  currentImageDataUrl = null;
  currentAiAnalysis = null;
  originalAiItem = null;
  userCorrected = false;

  stopCamera();
  capturedImagePreview.src = '';
  capturedImagePreview.classList.add('is-hidden');
  if (viewfinderDetectionOverlay) {
    viewfinderDetectionOverlay.innerHTML = '';
    viewfinderDetectionOverlay.classList.add('is-hidden');
  }
  if (detectionBoxesLayer) detectionBoxesLayer.innerHTML = '';

  confirmationSection.classList.add('is-hidden');
  successSection.classList.add('is-hidden');
  activeScannerSection.classList.remove('is-hidden');
  viewfinderStandby.classList.remove('is-hidden');
  btnRetake.classList.add('is-hidden');
  btnCapture.classList.add('is-hidden');
  btnStartCamera.classList.remove('is-hidden');
  btnUpload.classList.remove('is-hidden');
  formErrorNotice.classList.add('is-hidden');
  fileInput.value = '';
}

/**
 * Setup DOM event listeners.
 */
function setupEventListeners() {
  btnStartCamera?.addEventListener('click', startCamera);
  btnCapture?.addEventListener('click', captureFrame);
  btnCancelCamera?.addEventListener('click', stopCamera);
  btnRetake?.addEventListener('click', resetScanner);
  btnScanAnother?.addEventListener('click', resetScanner);
  btnDiscardScan?.addEventListener('click', resetScanner);
  btnEmptyRetake?.addEventListener('click', resetScanner);

  btnUpload?.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Please upload a valid image (JPEG, PNG, or WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const dataUrl = downscaleImage(img, 1024, 0.8);
        processCapturedImage(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  editFoodName?.addEventListener('input', checkUserModifications);
  editFoodCategory?.addEventListener('change', async () => {
    checkUserModifications();
    if (editFoodName.value.trim()) {
      await renderRecoveryOptions(
        editFoodName.value.trim(),
        editWasteCategory.value,
        editFoodCategory.value
      );
    }
  });

  editCondition?.addEventListener('change', () => {
    checkUserModifications();
    const cond = editCondition.value;
    const condMeta = {
      new_surplus: { label: 'New / Unused Surplus', class: 'condition-new' },
      reusable_intact: { label: 'Reusable Intact', class: 'condition-intact' },
      minor_wear_refurbishable: { label: 'Minor Wear (Refurbishable)', class: 'condition-refurb' },
      damaged_repairable: { label: 'Damaged (Repairable)', class: 'condition-repair' },
      scrap_recyclable: { label: 'Scrap Only (Recyclable)', class: 'condition-scrap' },
      hazardous_damaged: { label: 'Hazardous / Damaged', class: 'condition-hazard' },
      degraded_end_of_life: { label: 'Degraded / End of Life', class: 'condition-scrap' }
    }[cond] || { label: cond.replace(/_/g, ' '), class: 'condition-intact' };

    if (conditionGradeBadge) {
      conditionGradeBadge.textContent = condMeta.label;
      conditionGradeBadge.className = `condition-badge ${condMeta.class}`;
    }
  });

  editWasteCategory?.addEventListener('change', async () => {
    checkUserModifications();
    if (editFoodName.value.trim()) {
      await renderRecoveryOptions(
        editFoodName.value.trim(),
        editWasteCategory.value,
        editFoodCategory.value
      );
    }
  });

  btnConfirmScan?.addEventListener('click', handleConfirmScan);
}

/**
 * Initializes the Scanner page.
 */
async function initScanner() {
  const keyInfo = await verifyKeyStatus();

  if (!keyInfo.hasKey || keyInfo.status === 'invalid') {
    lockedStateSection?.classList.remove('is-hidden');
    activeScannerSection?.classList.add('is-hidden');
    return;
  }

  lockedStateSection?.classList.add('is-hidden');
  activeScannerSection?.classList.remove('is-hidden');

  setupEventListeners();
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScanner);
} else {
  initScanner();
}

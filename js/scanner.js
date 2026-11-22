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
const confidencePill = document.getElementById('confidence-pill');
const editFoodName = document.getElementById('edit-food-name');
const editFoodCategory = document.getElementById('edit-food-category');
const editWasteCategory = document.getElementById('edit-waste-category');
const editQuantity = document.getElementById('edit-quantity');
const editQuantityUnit = document.getElementById('edit-quantity-unit');
const correctionIndicator = document.getElementById('correction-indicator');
const recoveryPreviewList = document.getElementById('recovery-preview-list');
const reusePillsList = document.getElementById('reuse-pills-list');
const btnConfirmScan = document.getElementById('btn-confirm-scan');
const btnDiscardScan = document.getElementById('btn-discard-scan');
const formErrorNotice = document.getElementById('form-error-notice');

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
    // Reset any previous capture preview
    capturedImagePreview.classList.add('is-hidden');
    viewfinderStandby.classList.add('is-hidden');
    btnRetake.classList.add('is-hidden');

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
 * Handles image processing and sends to backend for AI classification.
 * @param {string} dataUrl - Downscaled JPEG base64 data URL
 */
async function processCapturedImage(dataUrl) {
  currentImageDataUrl = dataUrl;

  // Show captured image preview in viewfinder
  capturedImagePreview.src = dataUrl;
  capturedImagePreview.classList.remove('is-hidden');
  viewfinderStandby.classList.add('is-hidden');
  btnStartCamera.classList.add('is-hidden');
  btnUpload.classList.add('is-hidden');
  btnCapture.classList.add('is-hidden');
  btnRetake.classList.remove('is-hidden');

  // Show analyzing spinner
  analyzingOverlay.classList.remove('is-hidden');

  try {
    const result = await analyzeFoodImage(dataUrl, 'image/jpeg');
    currentAiAnalysis = result;
    analyzingOverlay.classList.add('is-hidden');

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
 * @param {object} analysis - Validated AI output
 */
async function showConfirmationScreen(analysis) {
  const item = analysis.items?.[0];
  if (!item) {
    alert(
      'No identifiable food waste was detected in the photo. Please retake with better lighting.'
    );
    return;
  }

  originalAiItem = {
    food_name: item.food_name,
    food_category: item.food_category,
    waste_category: item.waste_category
  };
  userCorrected = false;

  // Set thumbnail
  scanThumbnail.src = currentImageDataUrl;

  // Confidence pill
  const pct = Math.round((item.confidence || 0.85) * 100);
  confidencePill.textContent = `${pct}% AI Confidence`;

  // Populate inputs
  editFoodName.value = item.food_name || '';
  editFoodCategory.value = item.food_category || 'organic';
  editWasteCategory.value = item.waste_category || 'unavoidable_organic';
  editQuantity.value = '1.0';
  editQuantityUnit.value = 'kg';

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

  // Transition UI
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
      label: opt.method,
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
    card.appendChild(topRow);

    const reason = document.createElement('p');
    reason.className = 'recovery-reason';
    reason.textContent = opt.reason;
    card.appendChild(reason);

    if (opt.requirements) {
      const req = document.createElement('p');
      req.className = 'recovery-requirements';
      req.textContent = `Conditions: ${opt.requirements}`;
      card.appendChild(req);
    }

    recoveryPreviewList.appendChild(card);
  });
}

/**
 * Renders culinary or home reuse suggestions.
 */
function renderReuseSuggestions(suggestions) {
  reusePillsList.innerHTML = '';
  if (!suggestions || suggestions.length === 0) {
    const emptyPill = document.createElement('span');
    emptyPill.className = 'text-xs text-muted';
    emptyPill.textContent = 'No specific household reuse tips for this item.';
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

  if (
    currentName !== originalAiItem.food_name ||
    currentCat !== originalAiItem.food_category ||
    currentWaste !== originalAiItem.waste_category
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
  const foodCategory = editFoodCategory.value.trim() || 'organic';
  const wasteCategory = editWasteCategory.value;
  const quantity = parseFloat(editQuantity.value);
  const quantityUnit = editQuantityUnit.value;

  if (!foodName) {
    formErrorNotice.textContent = 'Please enter a valid food or material name.';
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

    // 1. Insert into public.food_scans
    const { data: scanRow, error: scanInsertError } = await supabase
      .from('food_scans')
      .insert({
        user_id: user.id,
        food_name: foodName,
        food_category: foodCategory,
        waste_category: wasteCategory,
        quantity: quantity,
        quantity_unit: quantityUnit,
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
        const method = opt.method || opt.recovery_method || opt.recoveryMethod || 'composting';
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
        recoveryMethod: 'composting',
        reason: 'Organic plant material decomposes into beneficial soil compost.',
        estimatedValue: 'Restores organic garden soil fertility',
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
  viewfinderStandby.classList.remove('is-hidden');
  btnRetake.classList.add('is-hidden');
  btnStartCamera.classList.remove('is-hidden');
  btnUpload.classList.remove('is-hidden');

  confirmationSection.classList.add('is-hidden');
  successSection.classList.add('is-hidden');
  activeScannerSection.classList.remove('is-hidden');
}

/**
 * Initializes the scanner module and event listeners.
 */
export async function initScanner() {
  // Check key status first (BYOK rule: No key, no scan)
  const keyInfo = await verifyKeyStatus();

  if (!keyInfo.hasKey || keyInfo.status !== 'valid') {
    lockedStateSection.classList.remove('is-hidden');
    activeScannerSection.classList.add('is-hidden');
    confirmationSection.classList.add('is-hidden');
    successSection.classList.add('is-hidden');
    return;
  }

  // Key is valid -> Show active scanner
  lockedStateSection.classList.add('is-hidden');
  activeScannerSection.classList.remove('is-hidden');

  // Event Listeners
  btnStartCamera.addEventListener('click', startCamera);
  btnCapture.addEventListener('click', captureFrame);
  btnCancelCamera.addEventListener('click', stopCamera);

  btnRetake.addEventListener('click', () => {
    resetScanner();
    startCamera();
  });

  btnUpload.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Please select a JPG, PNG, or WebP image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const downscaled = downscaleImage(img, 1024, 0.8);
        processCapturedImage(downscaled);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    // Reset file input value so same file can be re-selected if needed
    fileInput.value = '';
  });

  // Track user edits
  editFoodName.addEventListener('input', checkUserModifications);
  editFoodCategory.addEventListener('input', checkUserModifications);
  editWasteCategory.addEventListener('change', async () => {
    checkUserModifications();
    await renderRecoveryOptions(
      editFoodName.value,
      editWasteCategory.value,
      editFoodCategory.value
    );
  });

  btnConfirmScan.addEventListener('click', handleConfirmScan);

  btnDiscardScan.addEventListener('click', () => {
    if (confirm('Discard this scan? The photo and classification will not be saved.')) {
      resetScanner();
    }
  });

  btnScanAnother.addEventListener('click', resetScanner);

  // Clean up camera on tab leave / unload
  window.addEventListener('beforeunload', stopCamera);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopCamera();
    }
  });
}

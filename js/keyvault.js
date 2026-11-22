import { requireAuth } from './auth.js';
import { CONFIG } from './config.js';

let currentSession = null;
let currentKeyStatus = null;
let autoMaskTimeout = null;
let inactivityTimer = null;

// UI Containers & Elements
const vaultAlert = document.getElementById('vaultAlert');
const stateEmpty = document.getElementById('stateEmpty');
const stateActive = document.getElementById('stateActive');
const stateReplacing = document.getElementById('stateReplacing');

// Active State Elements
const maskedKeyDisplay = document.getElementById('maskedKeyDisplay');
const keyStatusBadge = document.getElementById('keyStatusBadge');
const keyValidatedAt = document.getElementById('keyValidatedAt');
const btnTestKey = document.getElementById('btnTestKey');
const btnShowReplace = document.getElementById('btnShowReplace');
const btnShowDelete = document.getElementById('btnShowDelete');

// Add/Replace Form Elements
const keyInput = document.getElementById('keyInput');
const btnToggleMask = document.getElementById('btnToggleMask');
const btnSubmitKey = document.getElementById('btnSubmitKey');
const keySubmitSpinner = document.getElementById('keySubmitSpinner');
const btnCancelReplace = document.getElementById('btnCancelReplace');

// Delete Modal Elements
const deleteModal = document.getElementById('deleteModal');
const btnCancelDelete = document.getElementById('btnCancelDelete');
const btnConfirmDelete = document.getElementById('btnConfirmDelete');
const deleteSpinner = document.getElementById('deleteSpinner');

function showAlert(message, type = 'error') {
  vaultAlert.textContent = message;
  vaultAlert.className = `auth-alert auth-alert-${type}`;
  vaultAlert.style.display = 'block';
}

function hideAlert() {
  vaultAlert.textContent = '';
  vaultAlert.style.display = 'none';
}

/**
 * Hardened Inactivity & Background Clearing
 * Wipes sensitive key input if tab is hidden or user is inactive for 2 minutes.
 */
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(
    () => {
      wipeKeyInput();
    },
    2 * 60 * 1000
  ); // 2 minutes
}

function wipeKeyInput() {
  if (keyInput) {
    keyInput.value = '';
    keyInput.type = 'password';
  }
  clearTimeout(autoMaskTimeout);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) wipeKeyInput();
});

window.addEventListener('pagehide', wipeKeyInput);
['mousemove', 'keydown', 'touchstart'].forEach((evt) => {
  window.addEventListener(evt, resetInactivityTimer, { passive: true });
});

/**
 * Show/Hide password toggle with 10-second auto re-mask
 */
btnToggleMask.addEventListener('click', () => {
  if (keyInput.type === 'password') {
    keyInput.type = 'text';
    btnToggleMask.setAttribute('aria-label', 'Mask API Key');
    clearTimeout(autoMaskTimeout);
    autoMaskTimeout = setTimeout(() => {
      keyInput.type = 'password';
      btnToggleMask.setAttribute('aria-label', 'Show API Key');
    }, 10000);
  } else {
    keyInput.type = 'password';
    btnToggleMask.setAttribute('aria-label', 'Show API Key');
    clearTimeout(autoMaskTimeout);
  }
});

/**
 * Safely parses response JSON with fallback to plain text/HTML error detection.
 * Prevents "Unexpected token 'T', "The page c"... is not valid JSON" crashes.
 */
async function safeParseResponse(res) {
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    const text = await res.text().catch(() => '');
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
  }
  return data;
}

/**
 * Fetch Key Status from Backend API
 */
async function fetchKeyStatus() {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/keys/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${currentSession.access_token}`
      }
    });

    const data = await safeParseResponse(res);

    if (!res.ok) {
      throw new Error(
        data?.message ||
          (res.status === 404
            ? 'Key Vault API endpoint not found (404).'
            : `Failed to check key status (${res.status})`)
      );
    }

    currentKeyStatus = data;
    renderState();
  } catch (err) {
    showAlert(err.message || 'Unable to connect to key vault service.');
  }
}

/**
 * Render appropriate UI state
 */
function renderState(forcedMode = null) {
  hideAlert();
  wipeKeyInput();

  if (forcedMode === 'replacing') {
    stateEmpty.style.display = 'none';
    stateActive.style.display = 'none';
    stateReplacing.style.display = 'block';
    btnCancelReplace.style.display = 'inline-flex';
    return;
  }

  btnCancelReplace.style.display = 'none';

  if (!currentKeyStatus || !currentKeyStatus.hasKey) {
    stateEmpty.style.display = 'block';
    stateActive.style.display = 'none';
    stateReplacing.style.display = 'none';
  } else {
    stateEmpty.style.display = 'none';
    stateActive.style.display = 'block';
    stateReplacing.style.display = 'none';

    maskedKeyDisplay.textContent = `•••• •••• •••• ${currentKeyStatus.last4}`;

    if (currentKeyStatus.status === 'valid') {
      keyStatusBadge.textContent = 'Active & Valid';
      keyStatusBadge.className = 'badge badge-success';
    } else if (currentKeyStatus.status === 'rate_limited') {
      keyStatusBadge.textContent = 'Rate Limited / Quota';
      keyStatusBadge.className = 'badge badge-warning';
    } else {
      keyStatusBadge.textContent = 'Invalid / Expired';
      keyStatusBadge.className = 'badge badge-danger';
    }

    if (currentKeyStatus.validatedAt) {
      const dt = new Date(currentKeyStatus.validatedAt).toLocaleString();
      keyValidatedAt.textContent = `Last verified: ${dt}`;
    } else {
      keyValidatedAt.textContent = '';
    }
  }
}

/**
 * Sanitizes and cleans user API key input
 */
function sanitizeKey(input) {
  if (!input || typeof input !== 'string') return '';
  let key = input.trim();
  // Strip enclosing quotes: "...", '...', `...`
  key = key.replace(/^["'`]+|["'`]+$/g, '').trim();
  // Strip common env prefixes
  key = key
    .replace(/^(?:GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_GENAI_API_KEY|API_KEY|key)\s*[:=]\s*/i, '')
    .trim();
  // Strip enclosing quotes again
  key = key.replace(/^["'`]+|["'`]+$/g, '').trim();
  // Remove zero-width spaces, byte order marks, non-breaking spaces, and any other internal whitespace
  key = key.replace(/[\u200B-\u200D\uFEFF\u00A0\s]/g, '').trim();
  return key;
}

/**
 * Submit / Replace API Key
 */
async function submitKey(e) {
  e.preventDefault();
  hideAlert();

  let rawKey = sanitizeKey(keyInput.value);
  if (!rawKey) {
    showAlert('Please paste your Google Gemini API key.');
    return;
  }

  // Soft hint check: both AIza and AQ. are valid Gemini key formats
  if (!rawKey.startsWith('AIza') && !rawKey.startsWith('AQ.') && rawKey.length < 25) {
    showAlert(
      'Warning: Gemini API keys usually start with "AIza" or "AQ.". Please verify your key.'
    );
  }

  btnSubmitKey.disabled = true;
  keySubmitSpinner.classList.remove('sr-only');

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/keys`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify({ apiKey: rawKey })
    });

    const data = await safeParseResponse(res);
    if (!res.ok) {
      throw new Error(
        data?.message ||
          (res.status === 404
            ? 'Key Vault API endpoint not found (404). Please ensure the backend server is deployed and running.'
            : res.status === 502 || res.status === 504
              ? 'Backend service temporarily unavailable. Please try again in a moment.'
              : `Key validation failed with status ${res.status}.`)
      );
    }

    currentKeyStatus = data;
    renderState();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('init') === 'true') {
      showAlert(
        '🎉 Software Initialized Successfully! Your Google Gemini key is active. Redirecting to your dashboard in 2 seconds...',
        'success'
      );
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 2000);
    } else {
      showAlert('Gemini API key successfully verified and securely stored in vault.', 'success');
    }
  } catch (err) {
    showAlert(err.message || 'Failed to submit key.');
  } finally {
    // Critical Security Rule: Instantly discard key from memory & DOM
    rawKey = '';
    wipeKeyInput();
    btnSubmitKey.disabled = false;
    keySubmitSpinner.classList.add('sr-only');
  }
}

/**
 * Re-test Active Key
 */
async function testKey() {
  hideAlert();
  btnTestKey.disabled = true;

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/keys/revalidate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentSession.access_token}`
      }
    });

    const data = await safeParseResponse(res);
    if (!res.ok) {
      throw new Error(
        data?.message ||
          (res.status === 404
            ? 'Key test API endpoint not found (404).'
            : `Validation request failed with status ${res.status}.`)
      );
    }

    currentKeyStatus.status = data.status;
    currentKeyStatus.validatedAt = data.validatedAt;
    renderState();

    if (data.status === 'valid') {
      showAlert('Key test succeeded! Your Gemini key is working properly.', 'success');
    } else if (data.status === 'rate_limited') {
      showAlert(
        'Key is authentic and valid, but currently rate-limited or quota exceeded on Google AI Studio.',
        'warning'
      );
    } else {
      showAlert(`Key validation failed: ${data.error || 'Google rejected the key.'}`, 'error');
    }
  } catch (err) {
    showAlert(err.message || 'Failed to retest key.');
  } finally {
    btnTestKey.disabled = false;
  }
}

/**
 * Delete Key Flow
 */
function openDeleteModal() {
  deleteModal.style.display = 'flex';
}

function closeDeleteModal() {
  deleteModal.style.display = 'none';
}

async function confirmDeleteKey() {
  btnConfirmDelete.disabled = true;
  deleteSpinner.classList.remove('sr-only');

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/keys`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${currentSession.access_token}`
      }
    });

    const data = await safeParseResponse(res);
    if (!res.ok) {
      throw new Error(data?.message || `Failed to delete key with status ${res.status}.`);
    }

    currentKeyStatus = { hasKey: false, last4: null, status: null, validatedAt: null };
    closeDeleteModal();
    renderState();
    showAlert(
      'Your key has been deleted from the vault. AI scanning is now locked until a new key is added.',
      'info'
    );
  } catch (err) {
    showAlert(err.message || 'Failed to remove key.');
  } finally {
    btnConfirmDelete.disabled = false;
    deleteSpinner.classList.add('sr-only');
  }
}

// Event Listeners
document.getElementById('addKeyForm').addEventListener('submit', submitKey);
btnTestKey.addEventListener('click', testKey);
btnShowReplace.addEventListener('click', () => renderState('replacing'));
btnCancelReplace.addEventListener('click', () => renderState());
btnShowDelete.addEventListener('click', openDeleteModal);
btnCancelDelete.addEventListener('click', closeDeleteModal);
btnConfirmDelete.addEventListener('click', confirmDeleteKey);

// Initialization
async function init() {
  try {
    currentSession = await requireAuth();
    resetInactivityTimer();

    const urlParams = new URLSearchParams(window.location.search);
    const initModeBanner = document.getElementById('initModeBanner');
    if (urlParams.get('init') === 'true' && initModeBanner) {
      initModeBanner.style.display = 'block';
    }

    await fetchKeyStatus();
  } catch (err) {
    console.error('Key vault authentication required:', err);
  }
}

init();

import { requireAuth, getUserProfile, updateUserProfile, updatePassword, signOut } from './auth.js';

let currentSession = null;
let currentProfile = null;

const globalAlert = document.getElementById('globalAlert');
const displayProfileName = document.getElementById('displayProfileName');
const displayProfileEmail = document.getElementById('displayProfileEmail');
const displayJoinedDate = document.getElementById('displayJoinedDate');
const badgeRole = document.getElementById('badgeRole');
const badgeStatus = document.getElementById('badgeStatus');
const avatarContainer = document.getElementById('userAvatarContainer');
const avatarInitial = document.getElementById('avatarInitial');

const profileForm = document.getElementById('profileForm');
const inputEmail = document.getElementById('inputEmail');
const inputDisplayName = document.getElementById('inputDisplayName');
const btnSaveProfile = document.getElementById('btnSaveProfile');
const profileSpinner = document.getElementById('profileSpinner');

const passwordForm = document.getElementById('passwordForm');
const inputNewPassword = document.getElementById('inputNewPassword');
const inputConfirmNewPassword = document.getElementById('inputConfirmNewPassword');
const btnSavePassword = document.getElementById('btnSavePassword');
const pwdSpinner = document.getElementById('pwdSpinner');

const btnSignOutTop = document.getElementById('btnSignOutTop');
const btnSignOutBottom = document.getElementById('btnSignOutBottom');

function showAlert(message, type = 'error') {
  globalAlert.textContent = message;
  globalAlert.className = `auth-alert auth-alert-${type}`;
  globalAlert.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideAlert() {
  globalAlert.textContent = '';
  globalAlert.style.display = 'none';
}

async function init() {
  try {
    currentSession = await requireAuth();
    currentProfile = await getUserProfile(currentSession.user.id);
    renderProfile();
  } catch (err) {
    console.error('Profile initialization failed:', err);
  }
}

function renderProfile() {
  if (!currentProfile) return;

  const displayName = currentProfile.display_name || currentSession.user.email.split('@')[0];
  displayProfileName.textContent = displayName;
  displayProfileEmail.textContent = currentProfile.email || currentSession.user.email;
  inputEmail.value = currentProfile.email || currentSession.user.email;
  inputDisplayName.value = currentProfile.display_name || '';

  if (currentProfile.avatar_url) {
    avatarContainer.innerHTML = '';
    const img = document.createElement('img');
    img.src = currentProfile.avatar_url;
    img.alt = displayName;
    img.className = 'avatar-img';
    avatarContainer.appendChild(img);
  } else {
    avatarInitial.textContent = displayName.charAt(0).toUpperCase();
  }

  badgeRole.textContent = currentProfile.role === 'admin' ? 'Administrator' : 'User';
  badgeRole.className = currentProfile.role === 'admin' ? 'badge badge-warning' : 'badge badge-primary';

  badgeStatus.textContent = currentProfile.status === 'suspended' ? 'Suspended' : 'Active';
  badgeStatus.className = currentProfile.status === 'suspended' ? 'badge badge-danger' : 'badge badge-success';

  if (currentProfile.created_at) {
    const joined = new Date(currentProfile.created_at).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    displayJoinedDate.textContent = `Joined ${joined}`;
  }
}

// Update Profile
profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const newName = inputDisplayName.value.trim();
  if (!newName) {
    showAlert('Display name cannot be empty.');
    return;
  }

  btnSaveProfile.disabled = true;
  profileSpinner.classList.remove('sr-only');

  try {
    const updated = await updateUserProfile(currentSession.user.id, {
      display_name: newName
    });
    currentProfile = updated;
    renderProfile();
    showAlert('Profile updated successfully!', 'success');
  } catch (err) {
    showAlert(err.message || 'Failed to update profile.');
  } finally {
    btnSaveProfile.disabled = false;
    profileSpinner.classList.add('sr-only');
  }
});

// Update Password
passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const newPwd = inputNewPassword.value;
  const confirmPwd = inputConfirmNewPassword.value;

  if (newPwd.length < 6) {
    showAlert('Password must be at least 6 characters long.');
    return;
  }

  if (newPwd !== confirmPwd) {
    showAlert('Passwords do not match.');
    return;
  }

  btnSavePassword.disabled = true;
  pwdSpinner.classList.remove('sr-only');

  try {
    await updatePassword(newPwd);
    passwordForm.reset();
    showAlert('Password changed successfully!', 'success');
  } catch (err) {
    showAlert(err.message || 'Failed to change password.');
  } finally {
    btnSavePassword.disabled = false;
    pwdSpinner.classList.add('sr-only');
  }
});

// Sign Out Handlers
if (btnSignOutTop) btnSignOutTop.addEventListener('click', () => signOut());
if (btnSignOutBottom) btnSignOutBottom.addEventListener('click', () => signOut());

init();

// Supabase Configuration
const SUPABASE_URL = 'https://viwyvwopdrxfzvkxboyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpd3l2d29wZHJ4Znp2a3hib3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzIzOTEsImV4cCI6MjA4MDc0ODM5MX0.uksKQ_bbcMhqN1BhaTp75xyo6Y4pNJi6RRsmu7osvyg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let pendingConfirm = null;

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindNavigation();
  bindAccount();
  bindModals();
  bindBuddyActions();
  
  // Check auth state
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadUserProfile();
    showBuddiesContent();
    loadSharedWith();
    loadBuddies();
  } else {
    showLoginPrompt();
  }
  
  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      currentUser = session.user;
      await loadUserProfile();
      showBuddiesContent();
      loadSharedWith();
      loadBuddies();
    } else {
      currentUser = null;
      showLoginPrompt();
    }
    updateAccountButton();
  });
}

function bindNavigation() {
  document.getElementById("menu-btn").addEventListener("click", () => {
    document.getElementById("nav-drawer").classList.remove("hidden");
  });
  document.querySelector(".nav-drawer-backdrop").addEventListener("click", () => {
    document.getElementById("nav-drawer").classList.add("hidden");
  });
}

function bindAccount() {
  document.getElementById("account-btn").addEventListener("click", openAccount);
  document.getElementById("auth-cancel").addEventListener("click", closeAccountModal);
  document.getElementById("auth-submit").addEventListener("click", submitAuth);
  document.getElementById("auth-toggle-btn").addEventListener("click", toggleAuthMode);
  document.getElementById("profile-cancel").addEventListener("click", closeAccountModal);
  document.getElementById("profile-save").addEventListener("click", saveProfile);
  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("upload-avatar-btn").addEventListener("click", () => {
    document.getElementById("avatar-input").click();
  });
  document.getElementById("avatar-input").addEventListener("change", uploadAvatar);
  document.querySelector("#account-modal .modal-backdrop").addEventListener("click", closeAccountModal);
  
  // Login prompt button
  document.getElementById("login-prompt-btn").addEventListener("click", openAccount);
}

function bindModals() {
  document.getElementById("confirm-cancel").addEventListener("click", closeConfirmModal);
  document.getElementById("confirm-ok").addEventListener("click", () => {
    if (pendingConfirm) pendingConfirm();
    closeConfirmModal();
  });
  document.querySelector("#confirm-modal .modal-backdrop").addEventListener("click", closeConfirmModal);
}

function bindBuddyActions() {
  document.getElementById("share-btn").addEventListener("click", shareWithBuddy);
  document.getElementById("share-username").addEventListener("keypress", (e) => {
    if (e.key === "Enter") shareWithBuddy();
  });
}

// UI State
function showLoginPrompt() {
  document.getElementById("login-prompt").classList.remove("hidden");
  document.getElementById("buddies-content").classList.add("hidden");
}

function showBuddiesContent() {
  document.getElementById("login-prompt").classList.add("hidden");
  document.getElementById("buddies-content").classList.remove("hidden");
}

// Share with buddy
async function shareWithBuddy() {
  const usernameInput = document.getElementById("share-username");
  const username = usernameInput.value.trim().toLowerCase();
  
  if (!username) {
    alert("Please enter a username");
    return;
  }
  
  if (!currentUser) {
    alert("You must be logged in");
    return;
  }
  
  // Find user by username
  const { data: buddyProfile, error: findError } = await supabase
    .from("profiles")
    .select("id, name, username, avatar_url")
    .eq("username", username)
    .single();
  
  if (findError || !buddyProfile) {
    alert("User not found. Make sure you entered the correct username.");
    return;
  }
  
  if (buddyProfile.id === currentUser.id) {
    alert("You can't share with yourself!");
    return;
  }
  
  // Check if already shared
  const { data: existing } = await supabase
    .from("buddy_shares")
    .select("id")
    .eq("owner_id", currentUser.id)
    .eq("buddy_id", buddyProfile.id)
    .single();
  
  if (existing) {
    alert("You've already shared with this user");
    return;
  }
  
  // Get default edit permission
  const allowEdit = document.getElementById("allow-edit-default").checked;
  
  // Create share
  const { error: shareError } = await supabase
    .from("buddy_shares")
    .insert({
      owner_id: currentUser.id,
      buddy_id: buddyProfile.id,
      can_edit: allowEdit
    });
  
  if (shareError) {
    console.error("Share error:", shareError);
    alert("Failed to share. Please try again.");
    return;
  }
  
  usernameInput.value = "";
  loadSharedWith();
  alert(`Successfully shared with ${buddyProfile.name || username}!`);
}

// Load people you've shared with
async function loadSharedWith() {
  if (!currentUser) return;
  
  const { data: shares, error } = await supabase
    .from("buddy_shares")
    .select(`
      id,
      can_edit,
      buddy:buddy_id (id, name, username, avatar_url)
    `)
    .eq("owner_id", currentUser.id);
  
  const container = document.getElementById("shared-with-items");
  
  if (error || !shares || shares.length === 0) {
    container.innerHTML = '<p class="empty-state">You haven\'t shared with anyone yet</p>';
    return;
  }
  
  container.innerHTML = shares.map(share => `
    <div class="shared-item" data-share-id="${share.id}">
      <div class="shared-item-info">
        <div class="shared-item-avatar">${share.buddy?.avatar_url ? `<img src="${share.buddy.avatar_url}" alt="">` : '👤'}</div>
        <div class="shared-item-details">
          <div class="shared-item-name">${share.buddy?.name || share.buddy?.username || 'Unknown'}</div>
          <div class="shared-item-username">@${share.buddy?.username || 'unknown'}</div>
        </div>
      </div>
      <div class="shared-item-actions">
        <label class="checkbox-label small">
          <input type="checkbox" class="edit-toggle" data-share-id="${share.id}" ${share.can_edit ? 'checked' : ''} />
          <span>Can edit</span>
        </label>
        <button class="remove-share-btn" data-share-id="${share.id}" title="Remove">✕</button>
      </div>
    </div>
  `).join("");
  
  // Bind edit toggles
  container.querySelectorAll(".edit-toggle").forEach(toggle => {
    toggle.addEventListener("change", async (e) => {
      const shareId = e.target.dataset.shareId;
      const canEdit = e.target.checked;
      await supabase.from("buddy_shares").update({ can_edit: canEdit }).eq("id", shareId);
    });
  });
  
  // Bind remove buttons
  container.querySelectorAll(".remove-share-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const shareId = e.target.dataset.shareId;
      showConfirm("Remove sharing?", "This person will no longer be able to view your data.", async () => {
        await supabase.from("buddy_shares").delete().eq("id", shareId);
        loadSharedWith();
      });
    });
  });
}

// Load buddies who shared with you
async function loadBuddies() {
  if (!currentUser) return;
  
  const { data: shares, error } = await supabase
    .from("buddy_shares")
    .select(`
      id,
      can_edit,
      owner:owner_id (id, name, username, avatar_url)
    `)
    .eq("buddy_id", currentUser.id);
  
  const container = document.getElementById("buddies-list");
  
  if (error || !shares || shares.length === 0) {
    container.innerHTML = '<p class="empty-state">No one has shared their account with you yet</p>';
    return;
  }
  
  container.innerHTML = shares.map(share => `
    <div class="buddy-card" data-owner-id="${share.owner?.id}">
      <div class="buddy-avatar">${share.owner?.avatar_url ? `<img src="${share.owner.avatar_url}" alt="">` : '👤'}</div>
      <div class="buddy-info">
        <div class="buddy-name">${share.owner?.name || share.owner?.username || 'Unknown'}</div>
        <div class="buddy-username">@${share.owner?.username || 'unknown'}</div>
        ${share.can_edit ? '<span class="buddy-edit-badge">Can Edit</span>' : '<span class="buddy-view-badge">View Only</span>'}
      </div>
      <div class="buddy-actions">
        <a href="index.html?buddy=${share.owner?.id}" class="buddy-link">Daily Wins</a>
        <a href="star-jar.html?buddy=${share.owner?.id}" class="buddy-link">Star Jar</a>
        <a href="rewards.html?buddy=${share.owner?.id}" class="buddy-link">Rewards</a>
      </div>
    </div>
  `).join("");
}

// Confirm modal
function showConfirm(title, message, onConfirm) {
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-message").textContent = message;
  document.getElementById("confirm-modal").classList.remove("hidden");
  pendingConfirm = onConfirm;
}

function closeConfirmModal() {
  document.getElementById("confirm-modal").classList.add("hidden");
  pendingConfirm = null;
}

// Account management (copied from other pages for consistency)
let isRegistering = false;
let userProfile = null;

async function loadUserProfile() {
  if (!currentUser) return;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();
  userProfile = data;
  updateAccountButton();
}

function openAccount() {
  if (currentUser) {
    showProfileView();
  } else {
    showAuthView();
  }
  document.getElementById("account-modal").classList.remove("hidden");
}

function closeAccountModal() {
  document.getElementById("account-modal").classList.add("hidden");
}

function showAuthView() {
  document.getElementById("auth-view").classList.remove("hidden");
  document.getElementById("profile-view").classList.add("hidden");
  isRegistering = false;
  document.getElementById("auth-title").textContent = "Login";
  document.getElementById("auth-submit").textContent = "Login";
  document.getElementById("auth-toggle-text").textContent = "Don't have an account?";
  document.getElementById("auth-toggle-btn").textContent = "Register";
}

function showProfileView() {
  document.getElementById("auth-view").classList.add("hidden");
  document.getElementById("profile-view").classList.remove("hidden");
  if (userProfile) {
    document.getElementById("profile-name").value = userProfile.name || "";
    document.getElementById("profile-username").value = userProfile.username || "";
    if (userProfile.avatar_url) {
      document.getElementById("profile-avatar").innerHTML = `<img src="${userProfile.avatar_url}" alt="">`;
    }
  }
}

function toggleAuthMode() {
  isRegistering = !isRegistering;
  if (isRegistering) {
    document.getElementById("auth-title").textContent = "Register";
    document.getElementById("auth-submit").textContent = "Register";
    document.getElementById("auth-toggle-text").textContent = "Already have an account?";
    document.getElementById("auth-toggle-btn").textContent = "Login";
  } else {
    document.getElementById("auth-title").textContent = "Login";
    document.getElementById("auth-submit").textContent = "Login";
    document.getElementById("auth-toggle-text").textContent = "Don't have an account?";
    document.getElementById("auth-toggle-btn").textContent = "Register";
  }
}

async function submitAuth() {
  const username = document.getElementById("auth-username").value.trim().toLowerCase();
  const password = document.getElementById("auth-password").value;
  
  if (!username || !password) {
    alert("Please enter username and password");
    return;
  }
  
  const btn = document.getElementById("auth-submit");
  btn.textContent = "Loading...";
  btn.disabled = true;
  
  try {
    const email = `${username}@dailywins.app`;
    
    if (isRegistering) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } }
      });
      if (error) throw error;
      
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          username,
          name: username,
          updated_at: new Date().toISOString()
        });
      }
      alert("Account created! You can now log in.");
      toggleAuthMode();
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeAccountModal();
    }
  } catch (error) {
    alert(error.message || "Authentication failed");
  } finally {
    btn.textContent = isRegistering ? "Register" : "Login";
    btn.disabled = false;
  }
}

async function saveProfile() {
  if (!currentUser) return;
  const name = document.getElementById("profile-name").value.trim();
  
  const { error } = await supabase
    .from("profiles")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", currentUser.id);
  
  if (error) {
    alert("Failed to save profile");
    return;
  }
  
  userProfile = { ...userProfile, name };
  updateAccountButton();
  closeAccountModal();
}

async function uploadAvatar(e) {
  const file = e.target.files[0];
  if (!file || !currentUser) return;
  
  const fileExt = file.name.split(".").pop();
  const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(fileName, file, { upsert: true });
  
  if (uploadError) {
    alert("Failed to upload avatar");
    return;
  }
  
  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);
  
  await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", currentUser.id);
  
  userProfile = { ...userProfile, avatar_url: publicUrl };
  document.getElementById("profile-avatar").innerHTML = `<img src="${publicUrl}" alt="">`;
  updateAccountButton();
}

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  userProfile = null;
  closeAccountModal();
  showLoginPrompt();
  updateAccountButton();
}

function updateAccountButton() {
  const btn = document.getElementById("account-btn");
  if (userProfile && userProfile.avatar_url) {
    btn.innerHTML = `<img src="${userProfile.avatar_url}" alt="" class="account-avatar">`;
  } else if (userProfile) {
    btn.textContent = userProfile.name?.charAt(0).toUpperCase() || "👤";
  } else {
    btn.textContent = "👤";
  }
}


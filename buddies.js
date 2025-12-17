// Supabase Configuration
const SUPABASE_URL = 'https://viwyvwopdrxfzvkxboyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpd3l2d29wZHJ4Znp2a3hib3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzIzOTEsImV4cCI6MjA4MDc0ODM5MX0.uksKQ_bbcMhqN1BhaTp75xyo6Y4pNJi6RRsmu7osvyg';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  const { data: { session } } = await supabaseClientClient.auth.getSession();
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
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
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

// Load buddies you have access to and display in nav menu
async function loadNavBuddies() {
  const navList = document.getElementById("nav-buddy-list");
  if (!navList) return;
  
  if (!currentUser) {
    navList.innerHTML = '';
    return;
  }
  
  // Get shares where you're the buddy (people who shared with you)
  const { data: shares, error } = await supabaseClient
    .from("buddy_shares")
    .select("owner_id")
    .eq("buddy_id", currentUser.id);
  
  if (error || !shares || shares.length === 0) {
    navList.innerHTML = '';
    return;
  }
  
  // Fetch owner profiles
  const ownerIds = shares.map(s => s.owner_id);
  const { data: profiles } = await supabaseClient
    .from("profiles")
    .select("id, name, username, avatar_url")
    .in("id", ownerIds);
  
  if (!profiles || profiles.length === 0) {
    navList.innerHTML = '';
    return;
  }
  
  navList.innerHTML = profiles.map(buddy => `
    <li>
      <a href="index.html?buddy=${buddy.id}" class="nav-buddy-link">
        <div class="nav-buddy-avatar">${buddy.avatar_url ? `<img src="${buddy.avatar_url}" alt="">` : '👤'}</div>
        <span class="nav-buddy-name">${buddy.name || buddy.username || 'Unknown'}</span>
      </a>
    </li>
  `).join('');
}

function bindAccount() {
  document.getElementById("account-btn").addEventListener("click", openAccount);
  document.getElementById("auth-cancel").addEventListener("click", closeAccountModal);
  document.getElementById("auth-submit").addEventListener("click", submitAuth);
  document.getElementById("auth-toggle").addEventListener("click", toggleAuthMode);
  document.getElementById("auth-password").addEventListener("keypress", (e) => {
    if (e.key === "Enter") submitAuth();
  });
  document.getElementById("profile-close").addEventListener("click", closeAccountModal);
  document.getElementById("profile-save").addEventListener("click", saveProfile);
  document.getElementById("profile-logout").addEventListener("click", logout);
  document.getElementById("profile-image").addEventListener("change", uploadAvatar);
  document.getElementById("change-password-btn").addEventListener("click", changePassword);
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
  const emailInput = document.getElementById("share-username");
  let email = emailInput.value.trim().toLowerCase();
  
  if (!email) {
    alert("Please enter an email address");
    return;
  }
  
  if (!currentUser) {
    alert("You must be logged in");
    return;
  }
  
  // If no @ symbol, assume it's a username and add @dailywins.app
  if (!email.includes("@")) {
    email = `${email}@dailywins.app`;
  }
  
  // Find user by email
  let buddyProfile = null;
  
  console.log("Searching for buddy with email:", email);
  
  // First try to find by email field
  const { data: byEmail, error: emailError } = await supabaseClient
    .from("profiles")
    .select("id, name, username, email, avatar_url")
    .eq("email", email)
    .single();
  
  console.log("Search by email result:", byEmail, "error:", emailError);
  
  if (byEmail) {
    buddyProfile = byEmail;
  } else {
    // Try to find by username field (for backwards compatibility)
    const { data: byUsername, error: usernameError } = await supabaseClient
      .from("profiles")
      .select("id, name, username, email, avatar_url")
      .eq("username", email)
      .single();
    
    console.log("Search by username result:", byUsername, "error:", usernameError);
    
    if (byUsername) {
      buddyProfile = byUsername;
    } else {
      // Try by just the username part
      const usernamePart = email.split("@")[0];
      const { data: byUsernamePart, error: partError } = await supabaseClient
        .from("profiles")
        .select("id, name, username, email, avatar_url")
        .eq("username", usernamePart)
        .single();
      
      console.log("Search by username part result:", byUsernamePart, "error:", partError);
      
      if (byUsernamePart) {
        buddyProfile = byUsernamePart;
      }
    }
  }
  
  if (!buddyProfile) {
    // Let's also fetch all profiles to debug
    const { data: allProfiles } = await supabaseClientClient.from("profiles").select("id, email, username, name");
    console.log("All profiles in database:", allProfiles);
    alert("User not found. Check browser console for debug info. Make sure the buddy has logged in at least once to sync their email.");
    return;
  }
  
  if (buddyProfile.id === currentUser.id) {
    alert("You can't share with yourself!");
    return;
  }
  
  // Check if already shared
  const { data: existing } = await supabaseClient
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
  const { error: shareError } = await supabaseClient
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
  
  emailInput.value = "";
  loadSharedWith();
  alert(`Successfully shared with ${buddyProfile.name || email}!`);
}

// Load people you've shared with
async function loadSharedWith() {
  if (!currentUser) return;
  
  // Get shares without join
  const { data: shares, error } = await supabaseClient
    .from("buddy_shares")
    .select("id, can_edit, buddy_id")
    .eq("owner_id", currentUser.id);
  
  const container = document.getElementById("shared-with-items");
  
  if (error || !shares || shares.length === 0) {
    container.innerHTML = '<p class="empty-state">You haven\'t shared with anyone yet</p>';
    return;
  }
  
  // Fetch buddy profiles separately
  const buddyIds = shares.map(s => s.buddy_id);
  const { data: buddyProfiles } = await supabaseClient
    .from("profiles")
    .select("id, name, username, avatar_url")
    .in("id", buddyIds);
  
  const profileMap = {};
  (buddyProfiles || []).forEach(p => profileMap[p.id] = p);
  
  container.innerHTML = shares.map(share => {
    const buddy = profileMap[share.buddy_id] || {};
    return `
    <div class="shared-item" data-share-id="${share.id}">
      <div class="shared-item-info">
        <div class="shared-item-avatar">${buddy.avatar_url ? `<img src="${buddy.avatar_url}" alt="">` : '👤'}</div>
        <div class="shared-item-details">
          <div class="shared-item-name">${buddy.name || buddy.username || 'Unknown'}</div>
          <div class="shared-item-username">@${buddy.username || 'unknown'}</div>
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
  `}).join("");
  
  // Bind edit toggles
  container.querySelectorAll(".edit-toggle").forEach(toggle => {
    toggle.addEventListener("change", async (e) => {
      const shareId = e.target.dataset.shareId;
      const canEdit = e.target.checked;
      await supabaseClientClient.from("buddy_shares").update({ can_edit: canEdit }).eq("id", shareId);
    });
  });
  
  // Bind remove buttons
  container.querySelectorAll(".remove-share-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const shareId = e.target.dataset.shareId;
      showConfirm("Remove sharing?", "This person will no longer be able to view your data.", async () => {
        await supabaseClientClient.from("buddy_shares").delete().eq("id", shareId);
        loadSharedWith();
      });
    });
  });
}

// Load buddies who shared with you
async function loadBuddies() {
  if (!currentUser) return;
  
  // Get shares without join
  const { data: shares, error } = await supabaseClient
    .from("buddy_shares")
    .select("id, can_edit, owner_id")
    .eq("buddy_id", currentUser.id);
  
  const container = document.getElementById("buddies-list");
  
  if (error || !shares || shares.length === 0) {
    container.innerHTML = '<p class="empty-state">No one has shared their account with you yet</p>';
    return;
  }
  
  // Fetch owner profiles separately
  const ownerIds = shares.map(s => s.owner_id);
  const { data: ownerProfiles } = await supabaseClient
    .from("profiles")
    .select("id, name, username, avatar_url")
    .in("id", ownerIds);
  
  const profileMap = {};
  (ownerProfiles || []).forEach(p => profileMap[p.id] = p);
  
  container.innerHTML = shares.map(share => {
    const owner = profileMap[share.owner_id] || {};
    return `
    <a href="index.html?buddy=${owner.id}" class="buddy-card" data-owner-id="${owner.id}">
      <div class="buddy-avatar">${owner.avatar_url ? `<img src="${owner.avatar_url}" alt="">` : '👤'}</div>
      <div class="buddy-info">
        <div class="buddy-name">${owner.name || owner.username || 'Unknown'}</div>
        <div class="buddy-username">@${owner.username || 'unknown'}</div>
        ${share.can_edit ? '<span class="buddy-edit-badge">Can Edit</span>' : '<span class="buddy-view-badge">View Only</span>'}
      </div>
      <div class="buddy-arrow">→</div>
    </a>
  `}).join("");
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
  
  // First get the profile
  const { data } = await supabaseClientClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();
  
  // If profile exists but email is missing, update it
  if (data && !data.email) {
    await supabaseClientClient.from("profiles")
      .update({ email: currentUser.email, updated_at: new Date().toISOString() })
      .eq("id", currentUser.id);
    data.email = currentUser.email;
  } else if (!data) {
    // Create profile if it doesn't exist
    await supabaseClientClient.from("profiles").insert({
      id: currentUser.id,
      email: currentUser.email,
      username: currentUser.email.split('@')[0],
      name: currentUser.email.split('@')[0],
      updated_at: new Date().toISOString()
    });
  }
  
  userProfile = data;
  updateAccountButton();
  loadNavBuddies();
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
  document.getElementById("auth-toggle").textContent = "Create Account";
  document.getElementById("auth-name-group").classList.add("hidden");
}

function showProfileView() {
  document.getElementById("auth-view").classList.add("hidden");
  document.getElementById("profile-view").classList.remove("hidden");
  if (userProfile) {
    document.getElementById("profile-name").value = userProfile.name || "";
    document.getElementById("profile-username").value = userProfile.username || "";
    if (userProfile.avatar_url) {
      document.getElementById("avatar-preview").innerHTML = `<img src="${userProfile.avatar_url}" alt="">`;
    }
  }
}

function toggleAuthMode() {
  isRegistering = !isRegistering;
  const nameGroup = document.getElementById("auth-name-group");
  if (isRegistering) {
    document.getElementById("auth-title").textContent = "Create Account";
    document.getElementById("auth-submit").textContent = "Register";
    document.getElementById("auth-toggle").textContent = "Already have an account?";
    nameGroup.classList.remove("hidden");
  } else {
    document.getElementById("auth-title").textContent = "Login";
    document.getElementById("auth-submit").textContent = "Login";
    document.getElementById("auth-toggle").textContent = "Create Account";
    nameGroup.classList.add("hidden");
  }
}

async function submitAuth() {
  let email = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;
  const name = document.getElementById("auth-name").value.trim();
  const submitBtn = document.getElementById("auth-submit");
  
  if (!email || !password) {
    showAuthError("Please enter username/email and password");
    return;
  }
  
  // If no @ symbol, treat as username and convert to email format
  if (!email.includes("@")) {
    email = `${email.toLowerCase()}@dailywins.app`;
  }
  
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Loading...";
  submitBtn.disabled = true;
  clearAuthErrors();
  
  try {
    if (isRegistering) {
      const { data, error } = await supabaseClientClient.auth.signUp({
        email,
        password,
        options: { data: { name: name || email.split('@')[0] } }
      });
      if (error) throw error;
      
      if (data.user) {
        await supabaseClientClient.from("profiles").upsert({
          id: data.user.id,
          email: email,
          username: email.split('@')[0],
          name: name || email.split('@')[0],
          updated_at: new Date().toISOString()
        });
        await loadUserProfile();
        showProfileView();
      }
    } else {
      console.log("Attempting login with email:", email);
      const { data, error } = await supabaseClientClient.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("Login error:", error);
        showAuthError(error.message + ` (tried: ${email})`);
        return;
      }
      if (data.user) {
        currentUser = data.user;
        await loadUserProfile();
        showBuddiesContent();
        loadSharedWith();
        loadBuddies();
      }
      closeAccountModal();
    }
    
    document.getElementById("auth-username").value = "";
    document.getElementById("auth-password").value = "";
    document.getElementById("auth-name").value = "";
  } catch (error) {
    showAuthError(error.message || "Authentication failed");
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

function showAuthError(message) {
  const el = document.getElementById("auth-error");
  el.textContent = message;
  el.classList.remove("hidden");
}

function clearAuthErrors() {
  document.getElementById("auth-error").classList.add("hidden");
}

async function saveProfile() {
  if (!currentUser) return;
  const name = document.getElementById("profile-name").value.trim();
  
  const { error } = await supabaseClient
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
  
  const { error: uploadError } = await supabaseClientClient.storage
    .from("avatars")
    .upload(fileName, file, { upsert: true });
  
  if (uploadError) {
    alert("Failed to upload avatar");
    return;
  }
  
  const { data: { publicUrl } } = supabaseClient.storage.from("avatars").getPublicUrl(fileName);
  
  await supabaseClient
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", currentUser.id);
  
  userProfile = { ...userProfile, avatar_url: publicUrl };
  document.getElementById("avatar-preview").innerHTML = `<img src="${publicUrl}" alt="">`;
  updateAccountButton();
}

async function changePassword() {
  const newPassword = prompt("Enter new password (min 6 characters):");
  if (!newPassword || newPassword.length < 6) {
    if (newPassword) alert("Password must be at least 6 characters");
    return;
  }
  
  const { error } = await supabaseClientClient.auth.updateUser({ password: newPassword });
  if (error) {
    alert("Failed to change password: " + error.message);
  } else {
    alert("Password changed successfully!");
  }
}

async function logout() {
  await supabaseClientClient.auth.signOut();
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


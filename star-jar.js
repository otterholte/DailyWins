const STORAGE_KEY = "daily-wins-v3";

// Supabase Configuration (same as app.js)
const SUPABASE_URL = 'https://viwyvwopdrxfzvkxboyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpd3l2d29wZHJ4Znp2a3hib3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzIzOTEsImV4cCI6MjA4MDc0ODM5MX0.uksKQ_bbcMhqN1BhaTp75xyo6Y4pNJi6RRsmu7osvyg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  currentMonth: new Date(),
  starMoments: [],
  account: null,
};

// Buddy viewing state
let viewingBuddy = null;

init();

async function init() {
  loadLocalState();
  bindControls();
  await bindAccount();
  await checkBuddyViewing();
  render();
}

// Check URL for buddy parameter and load their data
async function checkBuddyViewing() {
  const params = new URLSearchParams(window.location.search);
  const buddyId = params.get('buddy');
  
  if (!buddyId) {
    removeBuddyBanner();
    return;
  }
  
  // Get current user
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert("You must be logged in to view a buddy's data");
    window.location.href = "star-jar.html";
    return;
  }
  
  // Check if we have permission to view this buddy
  const { data: share, error } = await supabase
    .from("buddy_shares")
    .select("can_edit, owner_id")
    .eq("owner_id", buddyId)
    .eq("buddy_id", session.user.id)
    .single();
  
  if (error || !share) {
    alert("You don't have permission to view this user's data");
    window.location.href = "star-jar.html";
    return;
  }
  
  // Fetch owner profile
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", buddyId)
    .single();
  
  if (ownerProfile) {
    viewingBuddy = {
      id: buddyId,
      name: ownerProfile.name || ownerProfile.username || "Unknown",
      username: ownerProfile.username,
      avatar_url: ownerProfile.avatar_url,
      canEdit: share.can_edit
    };
    
    // Load buddy's star moments
    state.starMoments = ownerProfile.star_moments || [];
    
    showBuddyBanner();
  }
}

function showBuddyBanner() {
  removeBuddyBanner();
  
  const banner = document.createElement("div");
  banner.id = "buddy-viewing-banner";
  banner.className = "buddy-viewing-banner";
  banner.innerHTML = `
    <div class="buddy-viewing-info">
      <div class="buddy-viewing-avatar">${viewingBuddy.avatar_url ? `<img src="${viewingBuddy.avatar_url}" alt="">` : '👤'}</div>
      <div class="buddy-viewing-text">Viewing <strong>${viewingBuddy.name}</strong>'s Star Jar ${viewingBuddy.canEdit ? '(Can Edit)' : '(View Only)'}</div>
    </div>
    <button class="buddy-viewing-close" onclick="exitBuddyView()">Exit</button>
  `;
  
  const app = document.querySelector(".app");
  app.insertBefore(banner, app.firstChild.nextSibling);
  
  // Update navigation links to preserve buddy context
  updateNavLinksForBuddy();
}

function updateNavLinksForBuddy() {
  if (!viewingBuddy) return;
  
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && !href.includes('buddy=')) {
      const separator = href.includes('?') ? '&' : '?';
      link.setAttribute('href', `${href}${separator}buddy=${viewingBuddy.id}`);
    }
  });
}

function removeBuddyBanner() {
  const existing = document.getElementById("buddy-viewing-banner");
  if (existing) existing.remove();
}

function exitBuddyView() {
  window.location.href = "star-jar.html";
}

function loadLocalState() {
  // Don't load localStorage when viewing a buddy - their data will be loaded separately
  const params = new URLSearchParams(window.location.search);
  if (params.get('buddy')) {
    return;
  }
  
  // Load from localStorage as fallback
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    state.starMoments = parsed.starMoments || [];
  }
}

async function loadUserProfile(user) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error("Failed to load profile:", error);
      return;
    }
    
    state.account = {
      id: user.id,
      email: user.email,
      username: profile.username || user.email,
      name: profile.name || user.email.split('@')[0],
      avatar: profile.avatar_url,
    };
    
    // Only load user's content if NOT viewing a buddy (check URL param directly)
    const params = new URLSearchParams(window.location.search);
    const isViewingBuddy = params.get('buddy') !== null;
    
    if (!isViewingBuddy) {
      state.starMoments = profile.star_moments || [];
    }
    
    updateAccountButton();
    loadNavBuddies();
    render();
    
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
}

function bindControls() {
  // Navigation
  document.getElementById("menu-btn").addEventListener("click", openNav);
  document.querySelector(".nav-drawer-backdrop").addEventListener("click", closeNav);
  
  // Dark mode toggle
  initDarkMode();
  
  // Month navigation
  document.getElementById("prev-btn").addEventListener("click", () => navigateMonth(-1));
  document.getElementById("next-btn").addEventListener("click", () => navigateMonth(1));
}

function openNav() {
  document.getElementById("nav-drawer").classList.remove("hidden");
}

function closeNav() {
  document.getElementById("nav-drawer").classList.add("hidden");
}

function initDarkMode() {
  const toggle = document.getElementById("dark-mode-switch");
  if (!toggle) return;
  
  // Load saved preference
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    toggle.classList.add("active");
  }
  
  toggle.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
      toggle.classList.remove("active");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
      toggle.classList.add("active");
    }
  });
}

// Load buddies you have access to and display in nav menu
async function loadNavBuddies() {
  const navList = document.getElementById("nav-buddy-list");
  if (!navList) return;
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    navList.innerHTML = '';
    return;
  }
  
  // Get shares where you're the buddy (people who shared with you)
  const { data: shares, error } = await supabase
    .from("buddy_shares")
    .select("owner_id")
    .eq("buddy_id", session.user.id);
  
  if (error || !shares || shares.length === 0) {
    navList.innerHTML = '';
    return;
  }
  
  // Fetch owner profiles
  const ownerIds = shares.map(s => s.owner_id);
  const { data: profiles } = await supabase
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

function navigateMonth(delta) {
  state.currentMonth = new Date(
    state.currentMonth.getFullYear(),
    state.currentMonth.getMonth() + delta,
    1
  );
  render();
}

function render() {
  renderMonthLabel();
  renderJar();
  renderMoments();
}

function renderMonthLabel() {
  const label = state.currentMonth.toLocaleDateString("en-US", { 
    month: "long", 
    year: "numeric" 
  });
  document.getElementById("period-label").textContent = label;
}

function renderJar() {
  const moments = getMonthMoments();
  const jarStars = document.getElementById("jar-stars");
  const countEl = document.getElementById("star-count");
  
  countEl.textContent = moments.length;
  
  // Add stars to jar
  jarStars.innerHTML = moments.map(() => 
    `<span class="jar-star">⭐</span>`
  ).join('');
}

function renderMoments() {
  const moments = getMonthMoments();
  const list = document.getElementById("star-moments-list");
  
  if (moments.length === 0) {
    list.innerHTML = `<p class="empty-message">No star moments this month yet.<br>Add some on the Daily Wins page!</p>`;
    return;
  }
  
  // Sort by date descending
  const sorted = [...moments].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  list.innerHTML = sorted.map(moment => `
    <div class="star-moment-card" data-id="${moment.id}">
      <div class="star-moment-date">${formatDate(moment.date)}</div>
      <div class="star-moment-message">${escapeHtml(moment.message)}</div>
      <div class="star-moment-actions">
        <button onclick="deleteMoment('${moment.id}')">🗑️ Delete</button>
      </div>
    </div>
  `).join('');
}

function getMonthMoments() {
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  
  return state.starMoments.filter(m => {
    const d = new Date(m.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { 
    weekday: "long",
    month: "short", 
    day: "numeric",
    year: "numeric"
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function deleteMoment(id) {
  // Prevent deletion when viewing buddy with view-only access
  if (viewingBuddy && !viewingBuddy.canEdit) {
    alert("You have view-only access. You cannot delete star moments for this user.");
    return;
  }
  
  if (!confirm("Delete this star moment?")) return;
  
  state.starMoments = state.starMoments.filter(m => m.id !== id);
  await saveState();
  render();
}

async function saveState() {
  // Never save when viewing a buddy's data - would corrupt user's own data!
  const params = new URLSearchParams(window.location.search);
  if (params.get('buddy')) {
    return;
  }
  
  // Save locally
  const saved = localStorage.getItem(STORAGE_KEY);
  const data = saved ? JSON.parse(saved) : {};
  data.starMoments = state.starMoments;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  
  // Sync to Supabase if logged in
  if (state.account) {
    await syncToServer();
  }
}

async function syncToServer() {
  // NEVER sync when viewing a buddy's data!
  const params = new URLSearchParams(window.location.search);
  if (params.get('buddy')) {
    return;
  }
  
  if (!state.account) return;
  try {
    await supabase
      .from('profiles')
      .update({
        star_moments: state.starMoments,
      })
      .eq('id', state.account.id);
  } catch (err) {
    console.error("Sync failed:", err);
  }
}

// Account functionality with Supabase
async function bindAccount() {
  document.getElementById("account-btn").addEventListener("click", openAccount);
  document.querySelector("#account-modal .modal-backdrop").addEventListener("click", closeAccountModal);
  
  document.getElementById("auth-cancel").addEventListener("click", closeAccountModal);
  document.getElementById("auth-toggle").addEventListener("click", toggleAuthMode);
  document.getElementById("auth-submit").addEventListener("click", submitAuth);
  document.getElementById("auth-password").addEventListener("keypress", (e) => {
    if (e.key === "Enter") submitAuth();
  });
  
  document.getElementById("profile-close").addEventListener("click", closeAccountModal);
  document.getElementById("profile-save").addEventListener("click", saveProfile);
  document.getElementById("profile-logout").addEventListener("click", logout);
  document.getElementById("profile-image").addEventListener("change", uploadAvatar);
  document.getElementById("change-password-btn").addEventListener("click", changePassword);
  
  // Check for existing Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await loadUserProfile(session.user);
  }
  
  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      // Check if we're viewing a buddy - if so, skip full profile load
      const params = new URLSearchParams(window.location.search);
      if (params.get('buddy')) {
        // Just update account info without loading profile data
        state.account = {
          id: session.user.id,
          email: session.user.email,
        };
        updateAccountButton();
        return;
      }
      await loadUserProfile(session.user);
    } else if (event === 'SIGNED_OUT') {
      state.account = null;
      updateAccountButton();
      render();
    }
  });
}

let isRegistering = false;

function openAccount() {
  document.getElementById("account-modal").classList.remove("hidden");
  if (state.account) {
    showProfileView();
  } else {
    showAuthView();
  }
}

function closeAccountModal() {
  document.getElementById("account-modal").classList.add("hidden");
}

function showAuthView() {
  document.getElementById("auth-view").classList.remove("hidden");
  document.getElementById("profile-view").classList.add("hidden");
  isRegistering = false;
  updateAuthUI();
}

function showProfileView() {
  document.getElementById("auth-view").classList.add("hidden");
  document.getElementById("profile-view").classList.remove("hidden");
  
  if (state.account) {
    document.getElementById("profile-display-name").textContent = state.account.name;
    document.getElementById("profile-username").textContent = state.account.email || state.account.username;
    document.getElementById("profile-name").value = state.account.name;
    
    const preview = document.getElementById("avatar-preview");
    if (state.account.avatar) {
      preview.innerHTML = `<img src="${state.account.avatar}" alt="Avatar">`;
    } else {
      preview.innerHTML = "👤";
    }
  }
}

function toggleAuthMode() {
  isRegistering = !isRegistering;
  updateAuthUI();
}

function updateAuthUI() {
  const title = document.getElementById("auth-title");
  const submit = document.getElementById("auth-submit");
  const toggle = document.getElementById("auth-toggle");
  const nameGroup = document.getElementById("auth-name-group");
  
  if (isRegistering) {
    title.textContent = "Create Account";
    submit.textContent = "Register";
    toggle.textContent = "Already have an account?";
    nameGroup.classList.remove("hidden");
  } else {
    title.textContent = "Login";
    submit.textContent = "Login";
    toggle.textContent = "Create Account";
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
  
  // Show loading state
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Loading...";
  submitBtn.disabled = true;
  
  try {
    if (isRegistering) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name || email.split('@')[0] }
        }
      });
      
      if (error) {
        showAuthError(error.message);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        return;
      }
      
      if (data.user) {
        await supabase.from('profiles').update({ 
          name: name || email.split('@')[0],
          username: email 
        }).eq('id', data.user.id);
        
        await loadUserProfile(data.user);
        showProfileView();
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        showAuthError(error.message);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        return;
      }
      
      if (data.user) {
        await loadUserProfile(data.user);
        showProfileView();
      }
    }
    
    // Clear form
    document.getElementById("auth-username").value = "";
    document.getElementById("auth-password").value = "";
    document.getElementById("auth-name").value = "";
    
    render();
    
  } catch (err) {
    showAuthError("Something went wrong. Please try again.");
    console.error(err);
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

function updateAccountButton() {
  const btn = document.getElementById("account-btn");
  if (state.account && state.account.avatar) {
    btn.innerHTML = `<img src="${state.account.avatar}" alt="" class="account-avatar">`;
  } else if (state.account) {
    btn.textContent = state.account.name.charAt(0).toUpperCase();
  } else {
    btn.textContent = "👤";
  }
}

async function saveProfile() {
  if (!state.account) return;
  
  const name = document.getElementById("profile-name").value.trim();
  if (!name) return;
  
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ name })
      .eq('id', state.account.id);
    
    if (error) {
      console.error("Save failed:", error);
      return;
    }
    
    state.account.name = name;
    showProfileView();
    updateAccountButton();
  } catch (err) {
    console.error(err);
  }
}

async function uploadAvatar(e) {
  if (!state.account || !e.target.files[0]) return;
  
  const file = e.target.files[0];
  const fileExt = file.name.split('.').pop();
  const fileName = `${state.account.id}-${Date.now()}.${fileExt}`;
  
  try {
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });
    
    if (uploadError) {
      console.log("Avatar upload skipped - storage not configured");
      return;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', state.account.id);
    
    state.account.avatar = publicUrl;
    showProfileView();
    updateAccountButton();
  } catch (err) {
    console.error("Could not upload avatar:", err);
  }
}

async function changePassword() {
  if (!state.account) return;
  
  const newPass = document.getElementById("new-password").value;
  
  if (!newPass) return;
  
  if (newPass.length < 6) {
    alert("Password must be at least 6 characters");
    return;
  }
  
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPass
    });
    
    if (error) {
      alert(error.message || "Failed to change password");
      return;
    }
    
    document.getElementById("current-password").value = "";
    document.getElementById("new-password").value = "";
    alert("Password changed!");
  } catch (err) {
    console.error(err);
  }
}

async function logout() {
  await supabase.auth.signOut();
  
  state.account = null;
  state.starMoments = [];
  
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    state.starMoments = parsed.starMoments || [];
  }
  
  updateAccountButton();
  closeAccountModal();
  render();
}

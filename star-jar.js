const STORAGE_KEY = "daily-wins-v3";
const API_BASE = window.location.hostname === 'localhost' ? '' : '';

const state = {
  currentMonth: new Date(),
  starMoments: [],
  account: null,
};

init();

function init() {
  loadState();
  bindControls();
  bindAccount();
  render();
}

function loadState() {
  // Check for saved session
  const savedAccountId = localStorage.getItem("daily-wins-account-id");
  if (savedAccountId) {
    loadAccountFromServer(savedAccountId);
  } else {
    // Load from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state.starMoments = parsed.starMoments || [];
    }
  }
}

async function loadAccountFromServer(accountId) {
  try {
    const res = await fetch(API_BASE + "/api/account/" + accountId);
    if (!res.ok) {
      localStorage.removeItem("daily-wins-account-id");
      return;
    }
    
    const account = await res.json();
    state.account = account;
    state.starMoments = account.starMoments || [];
    
    updateAccountButton();
    render();
  } catch (err) {
    console.error("Failed to load account:", err);
  }
}

function bindControls() {
  // Navigation
  document.getElementById("menu-btn").addEventListener("click", openNav);
  document.querySelector(".nav-drawer-backdrop").addEventListener("click", closeNav);
  
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

function deleteMoment(id) {
  if (!confirm("Delete this star moment?")) return;
  
  state.starMoments = state.starMoments.filter(m => m.id !== id);
  saveState();
  render();
}

function saveState() {
  // Save locally
  const saved = localStorage.getItem(STORAGE_KEY);
  const data = saved ? JSON.parse(saved) : {};
  data.starMoments = state.starMoments;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  
  // Sync to server if logged in
  if (state.account) {
    syncToServer();
  }
}

async function syncToServer() {
  if (!state.account) return;
  try {
    await fetch(API_BASE + "/api/account/" + state.account.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        starMoments: state.starMoments,
      }),
    });
  } catch (err) {
    console.error("Sync failed:", err);
  }
}

// Account functionality (simplified version)
function bindAccount() {
  document.getElementById("account-btn").addEventListener("click", openAccount);
  document.querySelector("#account-modal .modal-backdrop").addEventListener("click", closeAccountModal);
  
  document.getElementById("auth-cancel").addEventListener("click", closeAccountModal);
  document.getElementById("auth-toggle").addEventListener("click", toggleAuthMode);
  document.getElementById("auth-submit").addEventListener("click", submitAuth);
  
  document.getElementById("profile-close").addEventListener("click", closeAccountModal);
  document.getElementById("profile-save").addEventListener("click", saveProfile);
  document.getElementById("profile-logout").addEventListener("click", logout);
  document.getElementById("profile-image").addEventListener("change", uploadAvatar);
  document.getElementById("change-password-btn").addEventListener("click", changePassword);
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
    document.getElementById("profile-username").textContent = "@" + state.account.username;
    document.getElementById("profile-name").value = state.account.name;
    
    const preview = document.getElementById("avatar-preview");
    if (state.account.avatar) {
      preview.innerHTML = `<img src="${API_BASE}${state.account.avatar}" alt="Avatar">`;
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
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;
  const name = document.getElementById("auth-name").value.trim();
  
  if (!username || !password) {
    showAuthError("Please enter username and password");
    return;
  }
  
  try {
    const endpoint = isRegistering ? "/api/register" : "/api/login";
    const body = isRegistering 
      ? { username, password, name: name || username }
      : { username, password };
    
    const res = await fetch(API_BASE + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      showAuthError(data.error || "Something went wrong");
      return;
    }
    
    state.account = data.account;
    state.starMoments = data.account.starMoments || [];
    localStorage.setItem("daily-wins-account-id", data.account.id);
    
    document.getElementById("auth-username").value = "";
    document.getElementById("auth-password").value = "";
    document.getElementById("auth-name").value = "";
    
    updateAccountButton();
    showProfileView();
    render();
    
  } catch (err) {
    showAuthError("Could not connect to server");
    console.error(err);
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
    btn.innerHTML = `<img src="${API_BASE}${state.account.avatar}" alt="" class="account-avatar">`;
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
    const res = await fetch(API_BASE + "/api/account/" + state.account.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    
    const data = await res.json();
    if (res.ok) {
      state.account = data.account;
      showProfileView();
      updateAccountButton();
    }
  } catch (err) {
    console.error(err);
  }
}

async function uploadAvatar(e) {
  if (!state.account || !e.target.files[0]) return;
  
  const formData = new FormData();
  formData.append("avatar", e.target.files[0]);
  
  try {
    const res = await fetch(API_BASE + "/api/account/" + state.account.id + "/avatar", {
      method: "POST",
      body: formData,
    });
    
    const data = await res.json();
    if (res.ok) {
      state.account.avatar = data.avatar;
      showProfileView();
      updateAccountButton();
    }
  } catch (err) {
    console.error(err);
  }
}

async function changePassword() {
  if (!state.account) return;
  
  const current = document.getElementById("current-password").value;
  const newPass = document.getElementById("new-password").value;
  
  if (!current || !newPass) return;
  
  try {
    const res = await fetch(API_BASE + "/api/account/" + state.account.id + "/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
    });
    
    if (res.ok) {
      document.getElementById("current-password").value = "";
      document.getElementById("new-password").value = "";
      alert("Password changed!");
    }
  } catch (err) {
    console.error(err);
  }
}

function logout() {
  state.account = null;
  state.starMoments = [];
  localStorage.removeItem("daily-wins-account-id");
  
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    state.starMoments = parsed.starMoments || [];
  }
  
  updateAccountButton();
  closeAccountModal();
  render();
}


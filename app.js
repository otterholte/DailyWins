const STORAGE_KEY = "daily-wins-v3";

// Supabase Configuration
const SUPABASE_URL = 'https://viwyvwopdrxfzvkxboyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpd3l2d29wZHJ4Znp2a3hib3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzIzOTEsImV4cCI6MjA4MDc0ODM5MX0.uksKQ_bbcMhqN1BhaTp75xyo6Y4pNJi6RRsmu7osvyg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const goals = { weekly: 8, monthly: 30, grandTotal: 100 };

const defaultTasks = [
  { id: "work-on-time", label: "Work/School on time", category: "Daily", color: "#ff6b6b" },
  { id: "kindness", label: "Random act of kindness", category: "Daily", color: "#ffa94d" },
  { id: "workout", label: "Workout / class", category: "Daily", color: "#ffd43b" },
  { id: "let-go", label: "Let it go (reframe)", category: "Daily", color: "#a9e34b" },
  { id: "tidy-10", label: "10-min tidy", category: "Daily", color: "#69db7c" },
  { id: "grace", label: "Give yourself grace", category: "Daily", color: "#38d9a9" },
  { id: "brush-2x", label: "Brush teeth 2x", category: "Daily", color: "#3bc9db" },
  { id: "walk-bingo", label: "Walk / move", category: "Daily", color: "#4dabf7" },
  { id: "hw-30", label: "30 mins HW / study", category: "Daily", color: "#748ffc" },
  { id: "play-sport", label: "Play a sport", category: "Daily", color: "#9775fa" },
  { id: "play-game", label: "Play a game", category: "Daily", color: "#da77f2" },
  { id: "laundry", label: "Put laundry away", category: "Daily", color: "#f783ac" },
  { id: "retainer", label: "Wear retainer", category: "Daily", color: "#ff8787" },
  { id: "floss", label: "Floss", category: "Daily", color: "#74c0fc" },
  { id: "skincare", label: "Skincare", category: "Daily", color: "#63e6be" },

  { id: "weekly-workout", label: "2x workout this week", category: "Weekly", color: "#20c997", goal: 2 },
  { id: "hangout", label: "Hang w/ friends or fam", category: "Weekly", color: "#fab005", goal: 1 },
  { id: "dine-out-limit", label: "Dine out ≤1x", category: "Weekly", color: "#f06595", goal: 1 },
  { id: "meal-prep", label: "Meal prep", category: "Weekly", color: "#94d82d", goal: 1 },
  { id: "clean-bath", label: "Clean bathroom", category: "Weekly", color: "#339af0", goal: 1 },
  { id: "weekly-selfcare", label: "3x self care", category: "Weekly", color: "#be4bdb", goal: 3 },

  { id: "attendance", label: "90% attendance", category: "Monthly", color: "#51cf66", goal: 1 },
  { id: "star-moments", label: "8 star moments", category: "Monthly", color: "#fcc419", goal: 8 },
  { id: "tidys-15", label: "15x tidy sessions", category: "Monthly", color: "#22b8cf", goal: 15 },

  { id: "style-hair", label: "Style hair", category: "Self Care", color: "#ff922b" },
  { id: "bath", label: "Bath or long shower", category: "Self Care", color: "#15aabf" },
  { id: "tea", label: "Tea ritual", category: "Self Care", color: "#e599f7" },
  { id: "music", label: "Play music / sing", category: "Self Care", color: "#66d9e8" },
  { id: "stretch", label: "Stretch or yoga", category: "Self Care", color: "#8ce99a" },
  { id: "bedtime", label: "Bed on time", category: "Self Care", color: "#ffa8a8" },
];

const colorPalette = [
  "#ff6b6b", "#ffa94d", "#ffd43b", "#a9e34b", "#69db7c", "#38d9a9",
  "#3bc9db", "#4dabf7", "#748ffc", "#9775fa", "#da77f2", "#f783ac",
  "#ff8787", "#74c0fc", "#63e6be", "#20c997", "#fab005", "#f06595",
  "#94d82d", "#339af0", "#be4bdb", "#51cf66", "#fcc419", "#22b8cf",
];

const categories = ["Daily", "Weekly", "Monthly", "Self Care"];

let tasks = [...defaultTasks];


const state = {
  currentMonth: startOfMonth(new Date()),
  selectedDate: new Date(),
  completions: {},
  view: "week",
  customTasks: null,
  account: null, // logged in account
  starMoments: [], // star jar moments
};

// Buddy viewing state
let viewingBuddy = null; // { id, name, username, avatar_url, canEdit }

// Modal state
let pendingConfirm = null;
let editingTask = null;
let manageCategory = null;
let closingManageOnEdit = false;
let isRegistering = false;
let pendingStarMoment = null; // { date, taskId }

loadState();
init();

async function init() {
  bindControls();
  bindModals();
  bindAccount();
  bindNavigation();
  bindStarModal();
  
  // Check if viewing a buddy's data
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
    window.location.href = "index.html";
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
    console.error("Permission check failed:", error);
    alert("You don't have permission to view this user's data");
    window.location.href = "index.html";
    return;
  }
  
  // Fetch owner profile separately
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("id, name, username, avatar_url")
    .eq("id", buddyId)
    .single();
  
  // Set up buddy viewing
  viewingBuddy = {
    id: buddyId,
    name: ownerProfile?.name || ownerProfile?.username || "Unknown",
    username: ownerProfile?.username,
    avatar_url: ownerProfile?.avatar_url,
    canEdit: share.can_edit
  };
  
  // Load buddy's data
  await loadBuddyData(buddyId);
  
  // Show banner
  showBuddyBanner();
}

async function loadBuddyData(buddyId) {
  // Load buddy's completions
  const { data: completions } = await supabase
    .from("completions")
    .select("*")
    .eq("user_id", buddyId);
  
  if (completions) {
    state.completions = {};
    completions.forEach(c => {
      if (!state.completions[c.date_key]) {
        state.completions[c.date_key] = [];
      }
      state.completions[c.date_key].push({
        id: c.id,
        taskId: c.task_id,
        category: c.category,
        color: c.color,
        label: c.label,
        at: c.created_at,
        isLinked: c.is_linked
      });
    });
  }
  
  // Load buddy's custom tasks
  const { data: customTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", buddyId);
  
  if (customTasks && customTasks.length > 0) {
    tasks = customTasks.map(t => ({
      id: t.task_id,
      label: t.label,
      category: t.category,
      color: t.color,
      goal: t.goal,
      linkedTo: t.linked_to || []
    }));
  } else {
    tasks = [...defaultTasks];
  }
  
  // Load buddy's star moments
  const { data: starMoments } = await supabase
    .from("star_moments")
    .select("*")
    .eq("user_id", buddyId);
  
  if (starMoments) {
    state.starMoments = starMoments.map(s => ({
      id: s.id,
      date: s.date,
      message: s.message,
      taskId: s.task_id
    }));
  }
}

function showBuddyBanner() {
  // Remove existing banner if any
  removeBuddyBanner();
  
  const banner = document.createElement("div");
  banner.id = "buddy-viewing-banner";
  banner.className = "buddy-viewing-banner";
  banner.innerHTML = `
    <div class="buddy-viewing-info">
      <div class="buddy-viewing-avatar">${viewingBuddy.avatar_url ? `<img src="${viewingBuddy.avatar_url}" alt="">` : '👤'}</div>
      <div class="buddy-viewing-text">Viewing <strong>${viewingBuddy.name}</strong>'s data ${viewingBuddy.canEdit ? '(Can Edit)' : '(View Only)'}</div>
    </div>
    <button class="buddy-viewing-close" onclick="exitBuddyView()">Exit</button>
  `;
  
  const app = document.querySelector(".app");
  app.insertBefore(banner, app.firstChild.nextSibling);
}

function removeBuddyBanner() {
  const existing = document.getElementById("buddy-viewing-banner");
  if (existing) existing.remove();
}

function exitBuddyView() {
  window.location.href = "index.html";
}

function isViewingBuddy() {
  return viewingBuddy !== null;
}

function canEditBuddyData() {
  return viewingBuddy && viewingBuddy.canEdit;
}

function bindNavigation() {
  document.getElementById("menu-btn").addEventListener("click", openNav);
  document.querySelector(".nav-drawer-backdrop").addEventListener("click", closeNav);
}

function openNav() {
  document.getElementById("nav-drawer").classList.remove("hidden");
}

function closeNav() {
  document.getElementById("nav-drawer").classList.add("hidden");
}

function bindStarModal() {
  document.getElementById("star-skip").addEventListener("click", skipStarMoment);
  document.getElementById("star-save").addEventListener("click", saveStarMoment);
  document.querySelector("#star-modal .modal-backdrop").addEventListener("click", skipStarMoment);
}

function bindControls() {
  document.getElementById("prev-btn").addEventListener("click", () => navigate(-1));
  document.getElementById("next-btn").addEventListener("click", () => navigate(1));
  document.getElementById("today-btn").addEventListener("click", goToToday);

  document.querySelectorAll(".view-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });
}

async function bindAccount() {
  // Account button
  document.getElementById("account-btn").addEventListener("click", openAccount);
  document.querySelector("#account-modal .modal-backdrop").addEventListener("click", closeAccountModal);
  
  // Auth view
  document.getElementById("auth-cancel").addEventListener("click", closeAccountModal);
  document.getElementById("auth-toggle").addEventListener("click", toggleAuthMode);
  document.getElementById("auth-submit").addEventListener("click", submitAuth);
  document.getElementById("auth-password").addEventListener("keypress", (e) => {
    if (e.key === "Enter") submitAuth();
  });
  
  // Profile view
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
      await loadUserProfile(session.user);
    } else if (event === 'SIGNED_OUT') {
      state.account = null;
      updateAccountButton();
      render();
    }
  });
}

function openAccount() {
  const modal = document.getElementById("account-modal");
  modal.classList.remove("hidden");
  
  if (state.account) {
    showProfileView();
  } else {
    showAuthView();
  }
}

function closeAccountModal() {
  document.getElementById("account-modal").classList.add("hidden");
  clearAuthErrors();
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
  clearAuthErrors();
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

function clearAuthErrors() {
  document.getElementById("auth-error").classList.add("hidden");
  document.getElementById("profile-error").classList.add("hidden");
  document.getElementById("profile-success").classList.add("hidden");
}

function showAuthError(message) {
  const el = document.getElementById("auth-error");
  el.textContent = message;
  el.classList.remove("hidden");
}

function showProfileError(message) {
  const el = document.getElementById("profile-error");
  el.textContent = message;
  el.classList.remove("hidden");
  document.getElementById("profile-success").classList.add("hidden");
}

function showProfileSuccess(message) {
  const el = document.getElementById("profile-success");
  el.textContent = message;
  el.classList.remove("hidden");
  document.getElementById("profile-error").classList.add("hidden");
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
  clearAuthErrors();
  
  try {
    if (isRegistering) {
      // Sign up with Supabase
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
        // Update profile with name
        await supabase.from('profiles').update({ 
          name: name || email.split('@')[0],
          username: email 
        }).eq('id', data.user.id);
        
        await loadUserProfile(data.user);
        showProfileView();
      }
    } else {
      // Sign in with Supabase
      console.log("Attempting login with email:", email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error("Login error:", error);
        showAuthError(error.message + ` (tried: ${email})`);
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

async function loadUserProfile(user) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    // If profile exists but email is missing, update it
    if (profile && !profile.email) {
      await supabase.from('profiles')
        .update({ email: user.email, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      profile.email = user.email;
    }
    
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
      completions: profile.completions || {},
      tasks: profile.tasks,
      starMoments: profile.star_moments || []
    };
    
    state.completions = profile.completions || {};
    state.starMoments = profile.star_moments || [];
    
    if (profile.tasks) {
      tasks = profile.tasks;
      state.customTasks = profile.tasks;
    }
    
    updateAccountButton();
    render();
    
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
}

async function saveProfile() {
  if (!state.account) return;
  
  const name = document.getElementById("profile-name").value.trim();
  if (!name) {
    showProfileError("Name cannot be empty");
    return;
  }
  
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ name })
      .eq('id', state.account.id);
    
    if (error) {
      showProfileError(error.message || "Failed to save");
      return;
    }
    
    state.account.name = name;
    showProfileSuccess("Saved!");
    showProfileView();
    updateAccountButton();
    
  } catch (err) {
    showProfileError("Something went wrong");
    console.error(err);
  }
}

async function uploadAvatar(e) {
  if (!state.account || !e.target.files[0]) return;
  
  const file = e.target.files[0];
  const fileExt = file.name.split('.').pop();
  const fileName = `${state.account.id}-${Date.now()}.${fileExt}`;
  
  try {
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });
    
    if (uploadError) {
      // If storage bucket doesn't exist, just skip avatar for now
      console.log("Avatar upload skipped - storage not configured");
      showProfileError("Avatar upload not available yet");
      return;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    // Update profile
    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', state.account.id);
    
    state.account.avatar = publicUrl;
    showProfileView();
    updateAccountButton();
    showProfileSuccess("Avatar updated!");
    
  } catch (err) {
    showProfileError("Could not upload avatar");
    console.error(err);
  }
}

async function changePassword() {
  if (!state.account) return;
  
  const newPass = document.getElementById("new-password").value;
  
  if (!newPass) {
    showProfileError("Please enter new password");
    return;
  }
  
  if (newPass.length < 6) {
    showProfileError("Password must be at least 6 characters");
    return;
  }
  
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPass
    });
    
    if (error) {
      showProfileError(error.message || "Failed to change password");
      return;
    }
    
    document.getElementById("current-password").value = "";
    document.getElementById("new-password").value = "";
    showProfileSuccess("Password changed!");
    
  } catch (err) {
    showProfileError("Something went wrong");
    console.error(err);
  }
}

async function logout() {
  await supabase.auth.signOut();
  
  state.account = null;
  
  // Reset to local storage mode
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    state.completions = parsed.completions || {};
    if (parsed.tasks) {
      tasks = parsed.tasks;
      state.customTasks = parsed.tasks;
    } else {
      tasks = [...defaultTasks];
      state.customTasks = null;
    }
  } else {
    state.completions = {};
    tasks = [...defaultTasks];
    state.customTasks = null;
  }
  
  updateAccountButton();
  closeAccountModal();
  render();
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

function bindModals() {
  // Confirm modal
  document.getElementById("confirm-cancel").addEventListener("click", closeConfirmModal);
  document.getElementById("confirm-ok").addEventListener("click", () => {
    if (pendingConfirm) pendingConfirm();
    closeConfirmModal();
  });
  document.querySelector("#confirm-modal .modal-backdrop").addEventListener("click", closeConfirmModal);

  // Edit modal
  document.getElementById("edit-cancel").addEventListener("click", closeEditModal);
  document.getElementById("edit-save").addEventListener("click", saveTask);
  
  // Expand link options button
  document.getElementById("expand-links-btn").addEventListener("click", () => {
    const btn = document.getElementById("expand-links-btn");
    const linkOptions = document.getElementById("link-options");
    const isExpanded = linkOptions.classList.toggle("expanded");
    btn.classList.toggle("expanded", isExpanded);
    btn.textContent = isExpanded ? "Collapse ↑" : "Expand ↓";
  });
  document.querySelector("#edit-modal .modal-backdrop").addEventListener("click", closeEditModal);

  // Color picker
  const picker = document.getElementById("color-picker");
  colorPalette.forEach((color) => {
    const opt = document.createElement("div");
    opt.className = "color-option";
    opt.style.background = color;
    opt.dataset.color = color;
    opt.addEventListener("click", () => {
      picker.querySelectorAll(".color-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
    });
    picker.appendChild(opt);
  });

  // Manage modal
  document.getElementById("manage-close").addEventListener("click", closeManageModal);
  document.querySelector("#manage-modal .modal-backdrop").addEventListener("click", closeManageModal);
}

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

function openEditModal(task, category) {
  if (isViewingBuddy() && !canEditBuddyData()) {
    alert("You can only view this buddy's data, not edit it.");
    return;
  }
  
  editingTask = task ? { ...task } : { id: null, label: "", color: colorPalette[0], category, linkedTo: [] };
  if (!editingTask.linkedTo) editingTask.linkedTo = [];
  
  document.getElementById("edit-title").textContent = task ? "Edit Task" : "Add Task";
  document.getElementById("edit-label").value = editingTask.label;
  
  // Reset expand state when opening modal
  document.getElementById("link-options").classList.remove("expanded");
  document.getElementById("expand-links-btn").classList.remove("expanded");
  document.getElementById("expand-links-btn").textContent = "Expand ↓";
  
  // Show/hide goal input based on category
  const goalGroup = document.getElementById("goal-group");
  goalGroup.style.display = (category === "Weekly" || category === "Monthly") ? "block" : "none";
  document.getElementById("edit-goal").value = editingTask.goal || "";
  
  // Update placeholder text based on category
  const goalInput = document.getElementById("edit-goal");
  if (category === "Monthly") {
    goalInput.placeholder = "e.g. 4 for '4 times per month'";
  } else {
    goalInput.placeholder = "e.g. 3 for '3x per week'";
  }

  // Show/hide link options for Daily and Self Care tasks
  const linkGroup = document.getElementById("link-group");
  const isLinkable = category === "Daily" || category === "Self Care";
  linkGroup.style.display = isLinkable ? "block" : "none";
  
  if (isLinkable) {
    renderLinkOptions();
  }

  // Select color
  const picker = document.getElementById("color-picker");
  picker.querySelectorAll(".color-option").forEach((o) => {
    o.classList.toggle("selected", o.dataset.color === editingTask.color);
  });

  document.getElementById("edit-modal").classList.remove("hidden");
}

function renderLinkOptions() {
  const container = document.getElementById("link-options");
  const linkableTasks = tasks.filter(t => 
    (t.category === "Weekly" || t.category === "Monthly") && t.goal
  );
  
  if (linkableTasks.length === 0) {
    container.innerHTML = '<p class="form-hint">No weekly/monthly goals with targets available to link.</p>';
    return;
  }
  
  container.innerHTML = linkableTasks.map(t => `
    <label class="link-option">
      <input type="checkbox" value="${t.id}" ${editingTask.linkedTo?.includes(t.id) ? "checked" : ""}>
      <span class="link-dot" style="background: ${t.color}"></span>
      <span class="link-label">${t.label}</span>
      <span class="link-category">${t.category}</span>
    </label>
  `).join("");
}

function closeEditModal() {
  document.getElementById("edit-modal").classList.add("hidden");
  editingTask = null;
}

function openManageModal(category) {
  manageCategory = category;
  document.getElementById("manage-title").textContent = `${category} tasks`;
  renderManageList();
  document.getElementById("manage-modal").classList.remove("hidden");
}

function closeManageModal() {
  manageCategory = null;
  document.getElementById("manage-modal").classList.add("hidden");
}

function renderManageList() {
  if (!manageCategory) return;
  const listEl = document.getElementById("manage-list");
  listEl.innerHTML = "";
  const items = tasks.filter((t) => t.category === manageCategory);

  items.forEach((task, idx) => {
    const row = document.createElement("div");
    row.className = "manage-row";
    row.dataset.taskId = task.id;
    row.dataset.index = idx;
    row.innerHTML = `
      <span class="drag-handle">☰</span>
      <span class="dot" style="background:${task.color}"></span>
      <div class="task-info">
        <div class="label">${task.label}</div>
        ${task.goal ? `<div class="meta">Goal: ${task.goal}</div>` : ""}
      </div>
      <div class="spacer"></div>
      <button class="btn btn-edit" data-edit="edit">✎</button>
      <button class="btn btn-delete" data-edit="delete">🗑</button>
    `;

    // Initialize drag and drop
    initDragDrop(row);

    row.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.edit === "edit") {
          openEditModal(task, manageCategory);
        } else if (btn.dataset.edit === "delete") {
          showConfirm(
            `Delete "${task.label}"?`,
            "This task will be removed. Any stickers you've added for it will remain in your history.",
            () => {
              deleteTask(task.id);
              renderManageList();
              render();
            }
          );
        }
      });
    });

    listEl.appendChild(row);
  });
}

// Drag and drop state
let dragState = {
  active: false,
  element: null,
  taskId: null,
  clone: null,
  placeholder: null,
  startY: 0,
  startIndex: 0,
  currentIndex: 0,
  items: [],
  listEl: null,
  itemHeight: 0,
  scrollInterval: null,
};

function initDragDrop(row) {
  // Mouse events
  row.addEventListener("mousedown", startDrag);
  
  // Touch events
  row.addEventListener("touchstart", startDrag, { passive: false });
}

function startDrag(e) {
  // Only start drag from the drag handle icon
  if (!e.target.closest(".drag-handle")) return;
  
  e.preventDefault();
  
  const row = e.currentTarget;
  const listEl = document.getElementById("manage-list");
  const allRows = Array.from(listEl.querySelectorAll(".manage-row"));
  const rect = row.getBoundingClientRect();
  const listRect = listEl.getBoundingClientRect();
  
  // Get starting position
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  
  // Store initial state
  dragState.active = true;
  dragState.element = row;
  dragState.taskId = row.dataset.taskId;
  dragState.startY = clientY;
  dragState.startIndex = parseInt(row.dataset.index);
  dragState.currentIndex = dragState.startIndex;
  dragState.items = allRows;
  dragState.listEl = listEl;
  dragState.itemHeight = rect.height + 8; // Include gap
  
  // Create clone that follows cursor
  dragState.clone = row.cloneNode(true);
  dragState.clone.classList.add("drag-clone");
  dragState.clone.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    z-index: 10000;
    pointer-events: none;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    opacity: 0.95;
    transform: scale(1.02);
    background: white;
    border-radius: 10px;
  `;
  document.body.appendChild(dragState.clone);
  
  // Create placeholder
  dragState.placeholder = document.createElement("div");
  dragState.placeholder.className = "drag-placeholder";
  dragState.placeholder.style.cssText = `
    height: ${rect.height}px;
    background: rgba(0, 122, 255, 0.1);
    border: 2px dashed rgba(0, 122, 255, 0.3);
    border-radius: 10px;
    margin-bottom: 8px;
  `;
  
  // Hide original and insert placeholder
  row.style.opacity = "0";
  row.style.height = "0";
  row.style.padding = "0";
  row.style.margin = "0";
  row.style.overflow = "hidden";
  listEl.insertBefore(dragState.placeholder, allRows[dragState.startIndex]);
  
  // Add move listeners
  if (e.touches) {
    document.addEventListener("touchmove", moveDrag, { passive: false });
    document.addEventListener("touchend", endDrag);
    document.addEventListener("touchcancel", endDrag);
  } else {
    document.addEventListener("mousemove", moveDrag);
    document.addEventListener("mouseup", endDrag);
  }
}

function moveDrag(e) {
  if (!dragState.active) return;
  e.preventDefault();
  
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const deltaY = clientY - dragState.startY;
  
  // Move the clone
  const startRect = dragState.element.getBoundingClientRect();
  const originalTop = startRect.top + startRect.height / 2;
  dragState.clone.style.top = (clientY - dragState.itemHeight / 2) + "px";
  
  // Calculate new index based on position
  const listRect = dragState.listEl.getBoundingClientRect();
  const relativeY = clientY - listRect.top + dragState.listEl.scrollTop;
  let newIndex = Math.floor(relativeY / dragState.itemHeight);
  newIndex = Math.max(0, Math.min(newIndex, dragState.items.length - 1));
  
  // Move placeholder if index changed
  if (newIndex !== dragState.currentIndex) {
    dragState.currentIndex = newIndex;
    
    // Remove placeholder
    dragState.placeholder.remove();
    
    // Find the target position
    const visibleItems = Array.from(dragState.listEl.querySelectorAll(".manage-row:not([style*='height: 0'])"));
    
    if (newIndex >= visibleItems.length) {
      dragState.listEl.appendChild(dragState.placeholder);
    } else {
      const targetRow = visibleItems[newIndex];
      if (targetRow) {
        dragState.listEl.insertBefore(dragState.placeholder, targetRow);
      }
    }
  }
  
  // Auto-scroll if near edges
  const modalContent = dragState.listEl.closest(".modal-content");
  if (modalContent) {
    const modalRect = modalContent.getBoundingClientRect();
    const scrollThreshold = 50;
    
    if (clientY < modalRect.top + scrollThreshold) {
      modalContent.scrollTop -= 5;
    } else if (clientY > modalRect.bottom - scrollThreshold) {
      modalContent.scrollTop += 5;
    }
  }
}

function endDrag(e) {
  if (!dragState.active) return;
  
  // Remove listeners
  document.removeEventListener("mousemove", moveDrag);
  document.removeEventListener("mouseup", endDrag);
  document.removeEventListener("touchmove", moveDrag);
  document.removeEventListener("touchend", endDrag);
  document.removeEventListener("touchcancel", endDrag);
  
  // Calculate final position
  const finalIndex = dragState.currentIndex;
  const startIndex = dragState.startIndex;
  
  // Clean up
  if (dragState.clone) {
    dragState.clone.remove();
  }
  if (dragState.placeholder) {
    dragState.placeholder.remove();
  }
  
  // Restore original element
  dragState.element.style.opacity = "";
  dragState.element.style.height = "";
  dragState.element.style.padding = "";
  dragState.element.style.margin = "";
  dragState.element.style.overflow = "";
  
  // Apply reorder if position changed
  if (finalIndex !== startIndex) {
    reorderTasksByIndex(dragState.taskId, startIndex, finalIndex);
  }
  
  // Reset state
  dragState.active = false;
  dragState.element = null;
  dragState.taskId = null;
  dragState.clone = null;
  dragState.placeholder = null;
  
  renderManageList();
  render();
}

function reorderTasksByIndex(taskId, fromIdx, toIdx) {
  // Get only tasks in current category
  const categoryTasks = tasks.filter(t => t.category === manageCategory);
  const otherTasks = tasks.filter(t => t.category !== manageCategory);
  
  // Reorder within category
  const [movedTask] = categoryTasks.splice(fromIdx, 1);
  categoryTasks.splice(toIdx, 0, movedTask);
  
  // Rebuild tasks array maintaining category order
  tasks = [];
  categories.forEach(cat => {
    if (cat === manageCategory) {
      tasks.push(...categoryTasks);
    } else {
      tasks.push(...otherTasks.filter(t => t.category === cat));
    }
  });
  
  saveTasks();
}

function moveTask(taskId, dir) {
  const indices = tasks.map((t, i) => ({ t, i })).filter(({ t }) => t.category === manageCategory);
  const pos = indices.findIndex(({ t }) => t.id === taskId);
  if (pos < 0) return;
  const target = pos + dir;
  if (target < 0 || target >= indices.length) return;
  const currentIdx = indices[pos].i;
  const targetIdx = indices[target].i;
  const temp = tasks[currentIdx];
  tasks[currentIdx] = tasks[targetIdx];
  tasks[targetIdx] = temp;
  saveTasks();
}

// ===== SWIPE GESTURES FOR TASKS =====
let swipeState = {
  active: false,
  container: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  threshold: 60,
  maxSwipe: 88,
};

let taskDragState = {
  active: false,
  container: null,
  category: null,
  clone: null,
  placeholder: null,
  startY: 0,
  currentY: 0,
  listEl: null,
};

function initSwipeHandlers(container, category) {
  container.addEventListener("touchstart", handleSwipeStart, { passive: true });
  container.addEventListener("touchmove", handleSwipeMove, { passive: false });
  container.addEventListener("touchend", handleSwipeEnd);
  
  // Also support mouse for desktop
  container.addEventListener("mousedown", handleSwipeStart);
  
  // Drag handle click
  const dragHandle = container.querySelector(".drag-handle-btn");
  dragHandle.addEventListener("touchstart", (e) => startTaskDrag(e, container, category), { passive: false });
  dragHandle.addEventListener("mousedown", (e) => startTaskDrag(e, container, category));
}

function handleSwipeStart(e) {
  // Don't start swipe if clicking on a button
  if (e.target.closest("button")) return;
  
  const container = e.currentTarget;
  const touch = e.touches ? e.touches[0] : e;
  
  swipeState.active = true;
  swipeState.container = container;
  swipeState.startX = touch.clientX;
  swipeState.startY = touch.clientY;
  swipeState.currentX = 0;
  
  container.classList.add("swiping");
  
  if (!e.touches) {
    document.addEventListener("mousemove", handleSwipeMove);
    document.addEventListener("mouseup", handleSwipeEnd);
  }
}

function handleSwipeMove(e) {
  if (!swipeState.active) return;
  
  const touch = e.touches ? e.touches[0] : e;
  const deltaX = touch.clientX - swipeState.startX;
  const deltaY = touch.clientY - swipeState.startY;
  
  // If vertical scroll is dominant, cancel swipe
  if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
    resetSwipeState(swipeState.container);
    return;
  }
  
  // Prevent page scroll during horizontal swipe
  if (Math.abs(deltaX) > 10) {
    e.preventDefault();
  }
  
  swipeState.currentX = deltaX;
  
  const wasSwipedLeft = swipeState.container.classList.contains("swiped-left");
  const wasSwipedRight = swipeState.container.classList.contains("swiped-right");
  
  const wrapper = swipeState.container.querySelector(".task-swipe-wrapper");
  const leftActions = swipeState.container.querySelector(".task-actions-left");
  const rightActions = swipeState.container.querySelector(".task-actions-right");
  
  // If already swiped left (edit/delete showing), handle closing or further opening
  if (wasSwipedLeft) {
    // Calculate width: start at 120, decrease as user swipes right
    let revealWidth = 120 + (-deltaX); // deltaX positive = swipe right = close
    revealWidth = Math.max(0, Math.min(120, revealWidth));
    
    wrapper.style.transform = "";
    leftActions.style.transform = "translateX(-100%)";
    rightActions.style.width = `${revealWidth}px`;
  }
  // If already swiped right (drag handle showing), handle closing or further opening
  else if (wasSwipedRight) {
    let offset = 56 + deltaX; // deltaX negative = swipe left = close
    offset = Math.max(0, Math.min(56, offset));
    
    wrapper.style.transform = `translateX(${offset}px)`;
    leftActions.style.transform = `translateX(${offset - 56}px)`;
    rightActions.style.width = "0";
  }
  // Fresh swipe RIGHT (show drag handle) - content slides
  else if (deltaX > 0) {
    let offset = Math.max(0, Math.min(56, deltaX));
    
    wrapper.style.transform = `translateX(${offset}px)`;
    leftActions.style.transform = `translateX(${offset - 56}px)`;
    rightActions.style.width = "0";
  }
  // Fresh swipe LEFT (show edit/delete) - content stays, buttons slide in
  else if (deltaX < 0) {
    let revealWidth = Math.max(0, Math.min(120, -deltaX));
    
    wrapper.style.transform = "";
    leftActions.style.transform = "translateX(-100%)";
    rightActions.style.width = `${revealWidth}px`;
  }
}

function handleSwipeEnd(e) {
  if (!swipeState.active) return;
  
  const container = swipeState.container;
  container.classList.remove("swiping");
  
  // Reset inline styles - let CSS handle the transition
  const wrapper = container.querySelector(".task-swipe-wrapper");
  const leftActions = container.querySelector(".task-actions-left");
  const rightActions = container.querySelector(".task-actions-right");
  
  wrapper.style.transform = "";
  leftActions.style.transform = "";
  rightActions.style.width = "";
  
  const deltaX = swipeState.currentX;
  const wasSwipedLeft = container.classList.contains("swiped-left");
  const wasSwipedRight = container.classList.contains("swiped-right");
  
  // Determine new state
  if (wasSwipedLeft) {
    if (deltaX > 40) {
      // Swiping right to close
      container.classList.remove("swiped-left");
      closeOtherSwipes(null);
    }
  } else if (wasSwipedRight) {
    if (deltaX < -40) {
      // Swiping left to close
      container.classList.remove("swiped-right");
      closeOtherSwipes(null);
    }
  } else {
    if (deltaX < -swipeState.threshold) {
      // Swipe left to show edit/delete
      closeOtherSwipes(container);
      container.classList.add("swiped-left");
    } else if (deltaX > swipeState.threshold) {
      // Swipe right to show drag handle
      closeOtherSwipes(container);
      container.classList.add("swiped-right");
    }
  }
  
  swipeState.active = false;
  swipeState.container = null;
  
  document.removeEventListener("mousemove", handleSwipeMove);
  document.removeEventListener("mouseup", handleSwipeEnd);
}

function resetSwipeState(container) {
  if (!container) return;
  container.classList.remove("swiping", "swiped-left", "swiped-right");
  const wrapper = container.querySelector(".task-swipe-wrapper");
  const leftActions = container.querySelector(".task-actions-left");
  const rightActions = container.querySelector(".task-actions-right");
  if (wrapper) wrapper.style.transform = "";
  if (leftActions) leftActions.style.transform = "";
  if (rightActions) rightActions.style.width = "";
}

function closeOtherSwipes(exceptContainer) {
  document.querySelectorAll(".task-swipe-container").forEach(c => {
    if (c !== exceptContainer) {
      resetSwipeState(c);
    }
  });
}

// ===== DRAG AND DROP FOR MAIN TASK LIST =====
function startTaskDrag(e, container, category) {
  e.preventDefault();
  e.stopPropagation();
  
  const listEl = container.closest(".task-list");
  const allContainers = Array.from(listEl.querySelectorAll(".task-swipe-container"));
  const rect = container.getBoundingClientRect();
  const listRect = listEl.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  
  // Close swipe state first
  resetSwipeState(container);
  
  // Create clone for dragging
  const clone = container.cloneNode(true);
  clone.classList.add("dragging-clone");
  clone.style.position = "fixed";
  clone.style.width = `${rect.width}px`;
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  document.body.appendChild(clone);
  
  // Mark original as being dragged
  container.classList.add("dragging-original");
  
  // Create placeholder at original position
  const placeholder = document.createElement("div");
  placeholder.className = "task-drag-placeholder";
  placeholder.style.height = `${rect.height}px`;
  listEl.insertBefore(placeholder, container);
  
  const startIndex = allContainers.indexOf(container);
  
  taskDragState = {
    active: true,
    container,
    category,
    clone,
    placeholder,
    startY: touch.clientY,
    offsetY: touch.clientY - rect.top,
    listEl,
    listRect,
    startIndex,
    currentIndex: startIndex,
    itemHeight: rect.height,
    items: allContainers.filter(c => c !== container),
  };
  
  document.addEventListener("touchmove", moveTaskDrag, { passive: false });
  document.addEventListener("touchend", endTaskDrag);
  document.addEventListener("mousemove", moveTaskDrag);
  document.addEventListener("mouseup", endTaskDrag);
}

function moveTaskDrag(e) {
  if (!taskDragState.active) return;
  e.preventDefault();
  
  const touch = e.touches ? e.touches[0] : e;
  
  // Move clone to follow cursor/finger
  const newTop = touch.clientY - taskDragState.offsetY;
  taskDragState.clone.style.top = `${newTop}px`;
  
  // Get all visible items (excluding the dragged one)
  const items = Array.from(taskDragState.listEl.querySelectorAll(".task-swipe-container:not(.dragging-original)"));
  
  // Find where the placeholder should go based on cursor position
  let newIndex = items.length; // Default to end
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemRect = item.getBoundingClientRect();
    const itemMidY = itemRect.top + itemRect.height / 2;
    
    if (touch.clientY < itemMidY) {
      newIndex = i;
      break;
    }
  }
  
  // Move placeholder if position changed
  if (newIndex !== taskDragState.currentIndex) {
    taskDragState.currentIndex = newIndex;
    
    // Remove placeholder from current position
    taskDragState.placeholder.remove();
    
    // Insert at new position
    if (newIndex >= items.length) {
      taskDragState.listEl.appendChild(taskDragState.placeholder);
    } else {
      taskDragState.listEl.insertBefore(taskDragState.placeholder, items[newIndex]);
    }
  }
}

function endTaskDrag() {
  if (!taskDragState.active) return;
  
  document.removeEventListener("touchmove", moveTaskDrag);
  document.removeEventListener("touchend", endTaskDrag);
  document.removeEventListener("mousemove", moveTaskDrag);
  document.removeEventListener("mouseup", endTaskDrag);
  
  const finalIndex = taskDragState.currentIndex;
  const startIndex = taskDragState.startIndex;
  
  // Remove clone
  if (taskDragState.clone) taskDragState.clone.remove();
  
  // Move the actual element to the placeholder position
  taskDragState.listEl.insertBefore(taskDragState.container, taskDragState.placeholder);
  
  // Remove placeholder
  if (taskDragState.placeholder) taskDragState.placeholder.remove();
  
  // Restore original element
  taskDragState.container.classList.remove("dragging-original");
  
  // Apply reorder to data if changed
  // Account for the fact that when moving down, the final index is relative to the filtered list
  let adjustedFinalIndex = finalIndex;
  if (finalIndex > startIndex) {
    adjustedFinalIndex = finalIndex; // Already correct - placeholder was placed after items
  }
  
  if (adjustedFinalIndex !== startIndex) {
    reorderTaskInList(taskDragState.container.dataset.taskId, taskDragState.category, startIndex, adjustedFinalIndex);
  }
  
  taskDragState.active = false;
  saveTasks();
}

function reorderTaskInList(taskId, category, fromIdx, toIdx) {
  const categoryTasks = tasks.filter(t => t.category === category);
  const otherTasks = tasks.filter(t => t.category !== category);
  
  const [movedTask] = categoryTasks.splice(fromIdx, 1);
  categoryTasks.splice(toIdx, 0, movedTask);
  
  // Rebuild tasks array
  tasks = [];
  categories.forEach(cat => {
    if (cat === category) {
      tasks.push(...categoryTasks);
    } else {
      tasks.push(...otherTasks.filter(t => t.category === cat));
    }
  });
}

function saveTask() {
  const label = document.getElementById("edit-label").value.trim();
  if (!label) return;

  const selectedColor = document.querySelector("#color-picker .color-option.selected");
  const color = selectedColor ? selectedColor.dataset.color : colorPalette[0];
  const goalInput = document.getElementById("edit-goal").value;
  const goal = goalInput ? parseInt(goalInput, 10) : undefined;
  
  // Get linked tasks (for Daily/Self Care tasks)
  const linkedTo = [];
  document.querySelectorAll("#link-options input[type='checkbox']:checked").forEach(cb => {
    linkedTo.push(cb.value);
  });

  if (editingTask.id) {
    // Update existing task
    const idx = tasks.findIndex((t) => t.id === editingTask.id);
    if (idx >= 0) {
      tasks[idx] = { ...tasks[idx], label, color, goal, linkedTo };
    }
  } else {
    // Add new task
    const newTask = {
      id: "custom-" + randomId(),
      label,
      color,
      category: editingTask.category,
    };
    if (goal) newTask.goal = goal;
    if (linkedTo.length > 0) newTask.linkedTo = linkedTo;
    tasks.push(newTask);
  }

  saveTasks();
  closeEditModal();
  render();
}

function deleteTask(taskId) {
  tasks = tasks.filter((t) => t.id !== taskId);
  saveTasks();
  render();
}

function saveTasks() {
  state.customTasks = tasks;
  saveState();
}

function loadTasks() {
  if (state.customTasks && state.customTasks.length > 0) {
    tasks = state.customTasks;
  }
}

function navigate(dir) {
  if (state.view === "month") {
    state.currentMonth = addMonths(state.currentMonth, dir);
  } else if (state.view === "week") {
    state.selectedDate = addDays(state.selectedDate, dir * 7);
    state.currentMonth = startOfMonth(state.selectedDate);
  } else {
    state.selectedDate = addDays(state.selectedDate, dir);
    state.currentMonth = startOfMonth(state.selectedDate);
  }
  render();
}

function goToToday() {
  state.currentMonth = startOfMonth(new Date());
  state.selectedDate = new Date();
  render();
}

function resetData() {
  if (confirm("Clear all your wins? This cannot be undone.")) {
    localStorage.removeItem(STORAGE_KEY);
    state.completions = {};
    render();
  }
}

function setView(view) {
  state.view = view;
  saveState();
  render();
}

function render() {
  updatePeriodLabel();
  updateViewToggle();
  renderStats();
  renderGrandProgress();
  renderProgress();
  renderCalendar();
  renderTasks();
  renderSelectedDateLabel();
}

// Lighter update that doesn't rebuild tasks
function renderQuick() {
  renderStats();
  renderGrandProgress();
  renderCalendar();
  updateTasksInPlace();
}

function renderGrandProgress() {
  const row = document.getElementById("progress-row");
  const total = monthCount();
  const goal = goals.grandTotal;
  const percent = Math.min((total / goal) * 100, 100);
  const isComplete = total >= goal;

  const grandHtml = `
    <div class="grand-progress ${isComplete ? 'complete' : ''}">
      <div class="grand-progress-header">
        <div class="grand-progress-title">
          <span class="grand-progress-icon">${isComplete ? '🏆' : '⭐'}</span>
          <span class="grand-progress-label">Total Daily Wins This Month</span>
        </div>
        <span class="grand-progress-count">${total} / ${goal}</span>
      </div>
      <div class="grand-progress-bar">
        <div class="grand-progress-fill" style="width: ${percent}%"></div>
      </div>
    </div>
  `;

  // Insert before the regular progress row
  let grandEl = document.querySelector('.grand-progress');
  if (!grandEl) {
    row.insertAdjacentHTML('beforebegin', grandHtml);
  } else {
    grandEl.outerHTML = grandHtml;
  }
}

function updatePeriodLabel() {
  const label = document.getElementById("period-label");
  if (state.view === "week") {
    const { start, end } = weekRange(state.selectedDate);
    const opts = { month: "short", day: "numeric" };
    label.textContent = `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
  } else if (state.view === "day") {
    label.textContent = state.selectedDate.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } else {
    label.textContent = state.currentMonth.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }
}

function updateViewToggle() {
  document.querySelectorAll(".view-toggle button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === state.view);
  });
}

function renderStats() {
  const row = document.getElementById("stats-row");
  row.innerHTML = "";

  const streak = currentStreak();
  const mostInDay = mostWinsInDayThisMonth();
  const selfCareTotal = selfCareMonthCount();

  row.innerHTML = `
    <div class="stat-card streak">
      <div class="stat-icon">🔥</div>
      <div class="stat-value">${streak}</div>
      <div class="stat-label">Days in a row</div>
    </div>
    <div class="stat-card record">
      <div class="stat-icon">🏆</div>
      <div class="stat-value">${mostInDay}</div>
      <div class="stat-label">Most wins in a day</div>
    </div>
    <div class="stat-card total">
      <div class="stat-icon">💚</div>
      <div class="stat-value">${selfCareTotal}</div>
      <div class="stat-label">Self care this month</div>
    </div>
  `;
}

function renderProgress() {
  // Progress row is now empty - we removed the weekly/monthly goal cards
  // Individual task progress bars are shown inline with each task
  const row = document.getElementById("progress-row");
  row.innerHTML = "";
}

function renderCalendar() {
  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";
  grid.className = `calendar-grid view-${state.view}`;

  if (state.view === "month") {
    renderMonthView(grid);
  } else if (state.view === "week") {
    renderWeekView(grid);
  } else {
    renderDayView(grid);
  }
}

function renderMonthView(grid) {
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "day inactive";
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const cell = createDayCell(date);
    grid.appendChild(cell);
  }
}

function renderWeekView(grid) {
  const { start } = weekRange(state.selectedDate);
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const cell = createDayCell(date, true);
    grid.appendChild(cell);
  }
}

function renderDayView(grid) {
  const key = toKey(state.selectedDate);
  const wins = state.completions[key] || [];

  const detail = document.createElement("div");
  detail.className = "day-detail";

  const header = document.createElement("div");
  header.className = "day-detail-header";
  header.innerHTML = `
    <div class="day-detail-date">${state.selectedDate.getDate()}</div>
    <div class="day-detail-weekday">${state.selectedDate.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
    })}</div>
  `;
  detail.appendChild(header);

  // Only show non-linked wins in day view (linked ones are counted internally)
  const visibleWins = wins.filter(win => !win.isLinked);
  
  if (visibleWins.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No wins yet. Add one from the panel →";
    detail.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "win-list";
    visibleWins.forEach((win) => {
      const item = document.createElement("div");
      item.className = "win-item";
      item.innerHTML = `
        <span class="win-dot" style="background: ${win.color}"></span>
        <span class="win-label">${win.label}</span>
        <span class="win-category">${win.category}</span>
      `;
      item.addEventListener("click", () => {
        removeWin(key, win.id);
      });
      list.appendChild(item);
    });
    detail.appendChild(list);
  }

  grid.appendChild(detail);
}

function createDayCell(date, showWeekday = false) {
  const key = toKey(date);
  const wins = state.completions[key] || [];
  const isToday = isSameDay(date, new Date());
  const isSelected = isSameDay(date, state.selectedDate);

  const cell = document.createElement("div");
  cell.className = "day";
  if (isToday) cell.classList.add("today");
  if (isSelected) cell.classList.add("selected");

  const dateEl = document.createElement("div");
  dateEl.className = "date";

  if (showWeekday) {
    const weekday = document.createElement("div");
    weekday.className = "weekday";
    weekday.textContent = date.toLocaleDateString(undefined, { weekday: "short" });
    cell.appendChild(weekday);
    dateEl.textContent = date.getDate();
  } else {
    dateEl.textContent = date.getDate();
  }

  cell.appendChild(dateEl);

  const stickers = document.createElement("div");
  stickers.className = "stickers";
  // Only show stickers for non-linked completions (linked ones share parent's sticker)
  wins.filter(win => !win.isLinked).forEach((win) => {
    const dot = document.createElement("span");
    dot.className = "sticker";
    dot.style.background = win.color;
    dot.title = win.label;
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      removeWin(key, win.id);
    });
    stickers.appendChild(dot);
  });
  cell.appendChild(stickers);

  cell.addEventListener("click", () => {
    state.selectedDate = new Date(date);
    render();
  });

  return cell;
}

function renderTasks() {
  const container = document.getElementById("task-sections");
  container.innerHTML = "";

  categories.forEach((category) => {
    const section = document.createElement("div");
    section.className = "task-section";

    const headerRow = document.createElement("div");
    headerRow.className = "section-header";
    const header = document.createElement("h3");
    header.textContent = category;
    headerRow.appendChild(header);

    const sectionActions = document.createElement("div");
    sectionActions.className = "section-actions";
    const addBtnTop = document.createElement("button");
    addBtnTop.className = "secondary";
    addBtnTop.textContent = "+";
    addBtnTop.title = "Add task";
    addBtnTop.addEventListener("click", () => openEditModal(null, category));
    sectionActions.append(addBtnTop);
    headerRow.appendChild(sectionActions);

    section.appendChild(headerRow);

    const list = document.createElement("div");
    list.className = "task-list";

    tasks
      .filter((t) => t.category === category)
      .forEach((task) => {
        const container = document.createElement("div");
        container.className = "task-swipe-container";
        container.dataset.taskId = task.id;
        container.dataset.category = category;

        const count = countFor(task.id);
        const hasProgress = task.goal !== undefined;
        
        let taskContent = "";
        if (hasProgress) {
          const periodCount = getTaskPeriodCount(task);
          const goal = task.goal;
          const percent = Math.min((periodCount / goal) * 100, 100);
          const isComplete = periodCount >= goal;
          
          taskContent = `
            <div class="task-top">
              <span class="dot" style="background: ${task.color}"></span>
              <div class="info">
                <div class="label">${task.label}</div>
                <div class="count" data-count>${count > 0 ? `${count} today` : ""}</div>
              </div>
              <div class="actions">
                <button class="action-minus">−</button>
                <button class="action-plus">+</button>
              </div>
            </div>
            <div class="task-progress">
              <div class="task-progress-bar">
                <div class="task-progress-fill ${isComplete ? 'complete' : ''}" data-progress-fill style="background: ${task.color}; width: ${percent}%"></div>
              </div>
              <span class="task-progress-text" data-progress-text>${periodCount}/${goal}</span>
            </div>
          `;
        } else {
          taskContent = `
            <span class="dot" style="background: ${task.color}"></span>
            <div class="info">
              <div class="label">${task.label}</div>
              <div class="count" data-count>${count > 0 ? `${count} today` : ""}</div>
            </div>
            <div class="actions">
              <button class="action-minus">−</button>
              <button class="action-plus">+</button>
            </div>
          `;
        }

        container.innerHTML = `
          <div class="task-actions-left">
            <button class="drag-handle-btn" title="Drag to reorder">☰</button>
          </div>
          <div class="task-swipe-wrapper">
            <div class="task ${hasProgress ? 'has-progress' : ''}" data-task-id="${task.id}">
              ${taskContent}
            </div>
          </div>
          <div class="task-actions-right">
            <button class="edit-btn" title="Edit">✎</button>
            <button class="delete-btn" title="Delete">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        `;

        // Bind action buttons
        const removeBtn = container.querySelector(".action-minus");
        const addBtn = container.querySelector(".action-plus");
        addBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          addWin(task);
        });
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeWinForTask(task.id);
        });

        // Bind edit/delete buttons
        container.querySelector(".edit-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          resetSwipeState(container);
          openEditModal(task, category);
        });
        container.querySelector(".delete-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          resetSwipeState(container);
          showConfirm(
            `Delete "${task.label}"?`,
            "This task will be removed. Any stickers you've added for it will remain in your history.",
            () => {
              deleteTask(task.id);
              render();
            }
          );
        });

        // Initialize swipe and drag handlers
        initSwipeHandlers(container, category);

        list.appendChild(container);
      });

    section.appendChild(list);
    container.appendChild(section);
  });
}

// Update only the dynamic parts of tasks without rebuilding DOM
function updateTasksInPlace() {
  tasks.forEach((task) => {
    // Look for the task element inside the swipe container
    const container = document.querySelector(`.task-swipe-container[data-task-id="${task.id}"]`);
    const row = container ? container.querySelector(".task") : document.querySelector(`[data-task-id="${task.id}"]`);
    if (!row) return;
    
    const count = countFor(task.id);
    const countEl = row.querySelector("[data-count]");
    if (countEl) {
      countEl.textContent = count > 0 ? `${count} today` : "";
    }
    
    if (task.goal !== undefined) {
      const periodCount = getTaskPeriodCount(task);
      const goal = task.goal;
      const percent = Math.min((periodCount / goal) * 100, 100);
      const isComplete = periodCount >= goal;
      
      const fillEl = row.querySelector("[data-progress-fill]");
      const textEl = row.querySelector("[data-progress-text]");
      
      if (fillEl) {
        fillEl.style.width = `${percent}%`;
        fillEl.classList.toggle("complete", isComplete);
      }
      if (textEl) {
        textEl.textContent = `${periodCount}/${goal}`;
      }
    }
  });
}

function renderSelectedDateLabel() {
  const label = document.getElementById("selected-date-label");
  label.textContent = state.selectedDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function addWin(task) {
  // Check if we can edit
  if (isViewingBuddy() && !canEditBuddyData()) {
    alert("You can only view this buddy's data, not edit it.");
    return;
  }
  
  const key = toKey(state.selectedDate);
  if (!state.completions[key]) state.completions[key] = [];

  const entry = {
    id: randomId(),
    taskId: task.id,
    category: task.category,
    color: task.color,
    label: task.label,
    at: Date.now(),
    isLinked: false, // Not a linked completion
  };

  state.completions[key].push(entry);
  
  // If this task has linked goals, also increment those
  if (task.linkedTo && task.linkedTo.length > 0) {
    task.linkedTo.forEach(linkedTaskId => {
      const linkedTask = tasks.find(t => t.id === linkedTaskId);
      if (linkedTask) {
        // Add a linked completion (won't count toward daily total)
        // Use the PARENT task's color so they appear as one sticker
        const linkedEntry = {
          id: randomId(),
          taskId: linkedTask.id,
          category: linkedTask.category,
          color: task.color, // Use parent task's color for visual grouping
          label: linkedTask.label,
          at: Date.now(),
          isLinked: true, // Mark as linked so it doesn't double count
          linkedFrom: task.id,
          linkedFromEntry: entry.id, // Link to the parent entry
        };
        state.completions[key].push(linkedEntry);
      }
    });
  }
  
  saveState();

  const total = countDailyWins(key);
  if (total === 5 || total === 10) {
    celebrate();
  }

  // Check if this is a star moments task - show star modal
  if (isStarMomentTask(task)) {
    showStarModal(state.selectedDate, task.id);
  }

  renderQuick();
}

// Count daily wins excluding linked completions (to avoid double counting)
function countDailyWins(dateKey) {
  const completions = state.completions[dateKey] || [];
  return completions.filter(c => !c.isLinked).length;
}

function removeWin(dateKey, id) {
  if (isViewingBuddy() && !canEditBuddyData()) {
    alert("You can only view this buddy's data, not edit it.");
    return;
  }
  const items = state.completions[dateKey] || [];
  state.completions[dateKey] = items.filter((i) => i.id !== id);
  saveState();
  renderQuick();
}

function removeWinForTask(taskId) {
  if (isViewingBuddy() && !canEditBuddyData()) {
    alert("You can only view this buddy's data, not edit it.");
    return;
  }
  const key = toKey(state.selectedDate);
  const items = state.completions[key] || [];
  const idx = items.map((i) => i.taskId).lastIndexOf(taskId);
  if (idx >= 0) {
    items.splice(idx, 1);
    state.completions[key] = items;
    saveState();
    renderQuick();
  }
}

function countFor(taskId) {
  const key = toKey(state.selectedDate);
  return (state.completions[key] || []).filter((w) => w.taskId === taskId).length;
}

function getTaskPeriodCount(task) {
  const range = task.category === "Weekly" 
    ? weekRange(state.selectedDate) 
    : monthRange(state.currentMonth);
  
  let total = 0;
  Object.entries(state.completions).forEach(([key, list]) => {
    const date = fromKey(key);
    if (date >= range.start && date <= range.end) {
      total += list.filter((w) => w.taskId === task.id).length;
    }
  });
  return total;
}

function monthCount() {
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  let total = 0;
  Object.entries(state.completions).forEach(([key, list]) => {
    const date = fromKey(key);
    if (date.getFullYear() === year && date.getMonth() === month) {
      // Only count non-linked completions to avoid double counting
      total += list.filter(c => !c.isLinked).length;
    }
  });
  return total;
}

function selfCareMonthCount() {
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  const selfCareTasks = tasks.filter(t => t.category === "Self Care").map(t => t.id);
  let total = 0;
  Object.entries(state.completions).forEach(([key, list]) => {
    const date = fromKey(key);
    if (date.getFullYear() === year && date.getMonth() === month) {
      total += list.filter(c => selfCareTasks.includes(c.taskId)).length;
    }
  });
  return total;
}

function currentStreak() {
  let streak = 0;
  let day = new Date();
  
  // If today has wins, count from today
  // If today has NO wins yet, give grace period - count from yesterday
  if (hasWins(day)) {
    // Today has wins, count normally
    while (hasWins(day)) {
      streak++;
      day = addDays(day, -1);
    }
  } else {
    // Today has no wins yet - check yesterday to preserve streak
    day = addDays(day, -1); // Start from yesterday
    while (hasWins(day)) {
      streak++;
      day = addDays(day, -1);
    }
  }
  
  return streak;
}

function longestStreak() {
  const dates = Object.keys(state.completions).sort();
  let best = 0;
  let current = 0;
  let prev = null;
  dates.forEach((d) => {
    if (prev && daysBetween(prev, d) === 1) {
      current++;
    } else {
      current = 1;
    }
    best = Math.max(best, current);
    prev = d;
  });
  return best;
}

function mostWinsInDayThisMonth() {
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  let best = 0;
  Object.entries(state.completions).forEach(([key, list]) => {
    const date = fromKey(key);
    if (date.getFullYear() === year && date.getMonth() === month) {
      // Only count non-linked completions
      const nonLinked = list.filter(c => !c.isLinked).length;
      best = Math.max(best, nonLinked);
    }
  });
  return best;
}

function countRange(category, range) {
  let total = 0;
  Object.entries(state.completions).forEach(([key, list]) => {
    const date = fromKey(key);
    if (date >= range.start && date <= range.end) {
      total += list.filter((w) => w.category === category).length;
    }
  });
  return total;
}

function celebrate() {
  const container = document.getElementById("confetti");
  const colors = ["#ff6b6b", "#ffd43b", "#69db7c", "#4dabf7", "#da77f2", "#ffa94d"];
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.left = `${15 + Math.random() * 70}%`;
    piece.style.top = "0";
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 1500);
  }
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      if (saved.completions) state.completions = saved.completions;
      if (saved.view) state.view = saved.view;
      if (saved.customTasks) {
        state.customTasks = saved.customTasks;
        tasks = saved.customTasks;
      }
      if (saved.starMoments) state.starMoments = saved.starMoments;
    }
  } catch (e) {
    console.error("Load failed", e);
  }
}

function saveState() {
  // Always save locally
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      completions: state.completions,
      view: state.view,
      customTasks: tasks,
      starMoments: state.starMoments,
    })
  );
  
  // Also sync to server if logged in
  if (state.account) {
    syncToServer();
  }
}

// Debounce server sync to avoid too many requests
let syncTimeout = null;
function syncToServer() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    if (!state.account) return;
    try {
      await supabase
        .from('profiles')
        .update({
          completions: state.completions,
          tasks: tasks,
          star_moments: state.starMoments,
        })
        .eq('id', state.account.id);
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }, 1000);
}

// Star Moments Functions
function isStarMomentTask(task) {
  const label = task.label.toLowerCase();
  return label.includes("star") && label.includes("moment");
}

function showStarModal(date, taskId) {
  pendingStarMoment = { date: new Date(date), taskId };
  document.getElementById("star-message").value = "";
  document.getElementById("star-modal").classList.remove("hidden");
}

function closeStarModal() {
  document.getElementById("star-modal").classList.add("hidden");
  pendingStarMoment = null;
}

function skipStarMoment() {
  closeStarModal();
}

function saveStarMoment() {
  const message = document.getElementById("star-message").value.trim();
  
  if (!message) {
    // If no message, just close
    closeStarModal();
    return;
  }
  
  if (pendingStarMoment) {
    const moment = {
      id: randomId(),
      date: pendingStarMoment.date.toISOString(),
      message: message,
      taskId: pendingStarMoment.taskId,
      createdAt: new Date().toISOString(),
    };
    
    state.starMoments.push(moment);
    saveState();
  }
  
  closeStarModal();
}

// Helpers
function toKey(date) {
  return date.toISOString().slice(0, 10);
}

function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function weekRange(date) {
  const d = new Date(date);
  const diff = d.getDay();
  const start = addDays(d, -diff);
  const end = addDays(start, 6);
  return { start, end };
}

function monthRange(date) {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function daysBetween(prevKey, currentKey) {
  const prev = fromKey(prevKey);
  const curr = fromKey(currentKey);
  return Math.round((curr - prev) / (1000 * 60 * 60 * 24));
}

function hasWins(date) {
  const completions = state.completions[toKey(date)] || [];
  return completions.filter(c => !c.isLinked).length > 0;
}

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

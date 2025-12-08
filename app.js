const STORAGE_KEY = "daily-wins-v3";

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

const API_BASE = window.location.port === '3000' ? '' : 'http://localhost:3000';

const state = {
  currentMonth: startOfMonth(new Date()),
  selectedDate: new Date(),
  completions: {},
  view: "day",
  customTasks: null,
  account: null, // logged in account
};

// Modal state
let pendingConfirm = null;
let editingTask = null;
let manageCategory = null;
let closingManageOnEdit = false;
let isRegistering = false;

loadState();
init();

function init() {
  bindControls();
  bindModals();
  bindAccount();
  render();
}

function bindControls() {
  document.getElementById("prev-btn").addEventListener("click", () => navigate(-1));
  document.getElementById("next-btn").addEventListener("click", () => navigate(1));
  document.getElementById("today-btn").addEventListener("click", goToToday);

  document.querySelectorAll(".view-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });
}

function bindAccount() {
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
  
  // Check for saved session
  const savedAccountId = localStorage.getItem("daily-wins-account-id");
  if (savedAccountId) {
    loadAccountFromServer(savedAccountId);
  }
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
    
    // Success - save account
    state.account = data.account;
    localStorage.setItem("daily-wins-account-id", data.account.id);
    
    // Load account data
    state.completions = data.account.completions || {};
    if (data.account.tasks) {
      tasks = data.account.tasks;
      state.customTasks = data.account.tasks;
    }
    
    // Clear form
    document.getElementById("auth-username").value = "";
    document.getElementById("auth-password").value = "";
    document.getElementById("auth-name").value = "";
    
    updateAccountButton();
    showProfileView();
    render();
    
  } catch (err) {
    showAuthError("Could not connect to server. Make sure the server is running.");
    console.error(err);
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
    state.completions = account.completions || {};
    
    if (account.tasks) {
      tasks = account.tasks;
      state.customTasks = account.tasks;
    }
    
    updateAccountButton();
    render();
    
  } catch (err) {
    console.error("Failed to load account:", err);
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
    const res = await fetch(API_BASE + "/api/account/" + state.account.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      showProfileError(data.error || "Failed to save");
      return;
    }
    
    state.account = data.account;
    showProfileSuccess("Saved!");
    showProfileView();
    updateAccountButton();
    
  } catch (err) {
    showProfileError("Could not connect to server");
    console.error(err);
  }
}

async function uploadAvatar(e) {
  if (!state.account || !e.target.files[0]) return;
  
  const file = e.target.files[0];
  const formData = new FormData();
  formData.append("avatar", file);
  
  try {
    const res = await fetch(API_BASE + "/api/account/" + state.account.id + "/avatar", {
      method: "POST",
      body: formData,
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      showProfileError(data.error || "Failed to upload");
      return;
    }
    
    state.account.avatar = data.avatar;
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
  
  const current = document.getElementById("current-password").value;
  const newPass = document.getElementById("new-password").value;
  
  if (!current || !newPass) {
    showProfileError("Please enter both passwords");
    return;
  }
  
  if (newPass.length < 4) {
    showProfileError("New password must be at least 4 characters");
    return;
  }
  
  try {
    const res = await fetch(API_BASE + "/api/account/" + state.account.id + "/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      showProfileError(data.error || "Failed to change password");
      return;
    }
    
    document.getElementById("current-password").value = "";
    document.getElementById("new-password").value = "";
    showProfileSuccess("Password changed!");
    
  } catch (err) {
    showProfileError("Could not connect to server");
    console.error(err);
  }
}

function logout() {
  state.account = null;
  localStorage.removeItem("daily-wins-account-id");
  
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
    btn.innerHTML = `<img src="${API_BASE}${state.account.avatar}" alt="" class="account-avatar">`;
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
  document.getElementById("edit-delete").addEventListener("click", () => {
    if (editingTask && editingTask.id) {
      showConfirm(
        `Delete "${editingTask.label}"?`,
        "This task will be removed. Any stickers you've added for it will remain in your history.",
        () => {
          deleteTask(editingTask.id);
          closeEditModal();
        }
      );
    }
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
  editingTask = task ? { ...task } : { id: null, label: "", color: colorPalette[0], category };
  
  document.getElementById("edit-title").textContent = task ? "Edit Task" : "Add Task";
  document.getElementById("edit-label").value = editingTask.label;
  document.getElementById("edit-delete").style.display = task ? "block" : "none";
  
  // Show/hide goal input based on category
  const goalGroup = document.getElementById("goal-group");
  goalGroup.style.display = (category === "Weekly" || category === "Monthly") ? "block" : "none";
  document.getElementById("edit-goal").value = editingTask.goal || "";

  // Select color
  const picker = document.getElementById("color-picker");
  picker.querySelectorAll(".color-option").forEach((o) => {
    o.classList.toggle("selected", o.dataset.color === editingTask.color);
  });

  document.getElementById("edit-modal").classList.remove("hidden");
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
    row.innerHTML = `
      <span class="dot" style="background:${task.color}"></span>
      <div>
        <div class="label">${task.label}</div>
        ${task.goal ? `<div class="meta">Goal: ${task.goal}</div>` : ""}
      </div>
      <div class="spacer"></div>
      <button class="btn btn-move" data-move="up" ${idx === 0 ? "disabled" : ""}>↑</button>
      <button class="btn btn-move" data-move="down" ${idx === items.length - 1 ? "disabled" : ""}>↓</button>
      <button class="btn btn-edit" data-edit="edit">✎</button>
      <button class="btn btn-delete" data-edit="delete">🗑</button>
    `;

    row.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.move) {
          moveTask(task.id, btn.dataset.move === "up" ? -1 : 1);
          renderManageList();
          render();
        } else if (btn.dataset.edit === "edit") {
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

function saveTask() {
  const label = document.getElementById("edit-label").value.trim();
  if (!label) return;

  const selectedColor = document.querySelector("#color-picker .color-option.selected");
  const color = selectedColor ? selectedColor.dataset.color : colorPalette[0];
  const goalInput = document.getElementById("edit-goal").value;
  const goal = goalInput ? parseInt(goalInput, 10) : undefined;

  if (editingTask.id) {
    // Update existing task
    const idx = tasks.findIndex((t) => t.id === editingTask.id);
    if (idx >= 0) {
      tasks[idx] = { ...tasks[idx], label, color, goal };
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
  const monthTotal = monthCount();

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
      <div class="stat-icon">✨</div>
      <div class="stat-value">${monthTotal}</div>
      <div class="stat-label">Total wins this month</div>
    </div>
  `;
}

function renderProgress() {
  const row = document.getElementById("progress-row");
  row.innerHTML = "";

  const weekly = countRange("Weekly", weekRange(state.selectedDate));
  const monthly = countRange("Monthly", monthRange(state.currentMonth));

  row.innerHTML = `
    <div class="progress-card weekly ${weekly >= goals.weekly ? "complete" : ""}">
      <div class="progress-header">
        <div class="progress-label">
          <span class="progress-icon">📅</span>
          <span class="progress-title">Weekly Goal</span>
        </div>
        <span class="progress-count">${weekly} / ${goals.weekly}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${Math.min((weekly / goals.weekly) * 100, 100)}%"></div>
      </div>
    </div>
    <div class="progress-card monthly ${monthly >= goals.monthly ? "complete" : ""}">
      <div class="progress-header">
        <div class="progress-label">
          <span class="progress-icon">📆</span>
          <span class="progress-title">Monthly Goal</span>
        </div>
        <span class="progress-count">${monthly} / ${goals.monthly}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${Math.min((monthly / goals.monthly) * 100, 100)}%"></div>
      </div>
    </div>
  `;
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

  if (wins.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No wins yet. Add one from the panel →";
    detail.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "win-list";
    wins.forEach((win) => {
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
  wins.forEach((win) => {
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
    const manageBtn = document.createElement("button");
    manageBtn.className = "secondary";
    manageBtn.textContent = "⚙";
    manageBtn.title = "Manage tasks";
    manageBtn.addEventListener("click", () => openManageModal(category));
    const addBtnTop = document.createElement("button");
    addBtnTop.className = "secondary";
    addBtnTop.textContent = "+";
    addBtnTop.title = "Add task";
    addBtnTop.addEventListener("click", () => openEditModal(null, category));
    sectionActions.append(manageBtn, addBtnTop);
    headerRow.appendChild(sectionActions);

    section.appendChild(headerRow);

    const list = document.createElement("div");
    list.className = "task-list";

    tasks
      .filter((t) => t.category === category)
      .forEach((task) => {
        const row = document.createElement("div");
        const hasProgress = task.goal !== undefined;
        row.className = hasProgress ? "task has-progress" : "task";

        const count = countFor(task.id);
        
        if (hasProgress) {
          const periodCount = getTaskPeriodCount(task);
          const goal = task.goal;
          const percent = Math.min((periodCount / goal) * 100, 100);
          const isComplete = periodCount >= goal;
          
          row.innerHTML = `
            <div class="task-top">
              <span class="dot" style="background: ${task.color}"></span>
              <div class="info">
                <div class="label">${task.label}</div>
                ${count > 0 ? `<div class="count">${count} today</div>` : ""}
              </div>
              <div class="actions">
                <button>+</button>
                <button>−</button>
              </div>
            </div>
            <div class="task-progress">
              <div class="task-progress-bar">
                <div class="task-progress-fill ${isComplete ? 'complete' : ''}" style="background: ${task.color}; width: ${percent}%"></div>
              </div>
              <span class="task-progress-text">${periodCount}/${goal}</span>
            </div>
          `;
        } else {
          row.innerHTML = `
            <span class="dot" style="background: ${task.color}"></span>
            <div class="info">
              <div class="label">${task.label}</div>
              ${count > 0 ? `<div class="count">${count} today</div>` : ""}
            </div>
            <div class="actions">
              <button>+</button>
              <button>−</button>
            </div>
          `;
        }

        const [addBtn, removeBtn] = row.querySelectorAll("button");
        addBtn.addEventListener("click", () => addWin(task));
        removeBtn.addEventListener("click", () => removeWinForTask(task.id));

        list.appendChild(row);
      });

    section.appendChild(list);
    container.appendChild(section);
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
  const key = toKey(state.selectedDate);
  if (!state.completions[key]) state.completions[key] = [];

  const entry = {
    id: randomId(),
    taskId: task.id,
    category: task.category,
    color: task.color,
    label: task.label,
    at: Date.now(),
  };

  state.completions[key].push(entry);
  saveState();

  const total = state.completions[key].length;
  if (total === 5 || total === 10) {
    celebrate();
  }

  render();
}

function removeWin(dateKey, id) {
  const items = state.completions[dateKey] || [];
  state.completions[dateKey] = items.filter((i) => i.id !== id);
  saveState();
  render();
}

function removeWinForTask(taskId) {
  const key = toKey(state.selectedDate);
  const items = state.completions[key] || [];
  const idx = items.map((i) => i.taskId).lastIndexOf(taskId);
  if (idx >= 0) {
    items.splice(idx, 1);
    state.completions[key] = items;
    saveState();
    render();
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
      total += list.length;
    }
  });
  return total;
}

function currentStreak() {
  let streak = 0;
  let day = new Date();
  while (hasWins(day)) {
    streak++;
    day = addDays(day, -1);
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
      best = Math.max(best, list.length);
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
      await fetch(API_BASE + "/api/account/" + state.account.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completions: state.completions,
          tasks: tasks,
        }),
      });
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }, 1000);
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
  return (state.completions[toKey(date)] || []).length > 0;
}

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

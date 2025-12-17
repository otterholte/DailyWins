const STORAGE_KEY = "daily-wins-v3";

// Supabase Configuration
const SUPABASE_URL = 'https://viwyvwopdrxfzvkxboyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpd3l2d29wZHJ4Znp2a3hib3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzIzOTEsImV4cCI6MjA4MDc0ODM5MX0.uksKQ_bbcMhqN1BhaTp75xyo6Y4pNJi6RRsmu7osvyg';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Default rewards
const defaultWeeklyRewards = [
  { id: "w1", type: "money", amount: 5, emoji: "☕" },
  { id: "w2", type: "money", amount: 10, emoji: "🍕" },
  { id: "w3", type: "custom", text: "Watch a movie", emoji: "🎬" },
];

const defaultMonthlyRewards = [
  { id: "m1", type: "money", amount: 25, emoji: "🛍️" },
  { id: "m2", type: "money", amount: 50, emoji: "💰" },
  { id: "m3", type: "custom", text: "Nice dinner out", emoji: "🍽️" },
  { id: "m4", type: "custom", text: "Buy something special", emoji: "🎁" },
];

const emojiOptions = [
  "🎁", "💰", "💵", "🛍️", "☕", "🍕", "🍔", "🍦", "🍰", "🧁",
  "🎬", "🎮", "🎵", "🎧", "📚", "🛁", "💅", "💄", "👗", "👟",
  "🌸", "🌺", "🌴", "🏖️", "✈️", "🚗", "🎢", "🎡", "🎪", "🎨",
  "🏆", "⭐", "🌟", "✨", "💎", "👑", "🎯", "🎲", "🃏", "🎰",
  "🍿", "🥤", "🍩", "🧋", "🍫", "🍪", "🥐", "🌮", "🍣", "🍱",
  "💆", "🧘", "🏃", "🚴", "⛷️", "🏄", "🎾", "⚽", "🏀", "🎳"
];

const state = {
  weeklyRewards: [...defaultWeeklyRewards],
  monthlyRewards: [...defaultMonthlyRewards],
  completions: {},
  tasks: [],
  redeemedGoals: [], // Track redeemed goals: { goalId, rewardId, note, date, monthKey }
  account: null,
};

let editingReward = null;
let editingCategory = null;
let redeemingGoal = null;

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
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    alert("You must be logged in to view a buddy's data");
    window.location.href = "rewards.html";
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
    window.location.href = "rewards.html";
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
    
    // Load buddy's rewards data
    if (ownerProfile.weekly_rewards) state.weeklyRewards = ownerProfile.weekly_rewards;
    if (ownerProfile.monthly_rewards) state.monthlyRewards = ownerProfile.monthly_rewards;
    if (ownerProfile.completions) state.completions = ownerProfile.completions;
    if (ownerProfile.tasks) state.tasks = ownerProfile.tasks;
    if (ownerProfile.redeemed_goals) state.redeemedGoals = ownerProfile.redeemed_goals;
    
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
      <div class="buddy-viewing-text">Viewing <strong>${viewingBuddy.name}</strong>'s Rewards ${viewingBuddy.canEdit ? '(Can Edit)' : '(View Only)'}</div>
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
  window.location.href = "rewards.html";
}

function loadLocalState() {
  // Don't load localStorage when viewing a buddy - their data will be loaded separately
  const params = new URLSearchParams(window.location.search);
  if (params.get('buddy')) {
    return;
  }
  
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.weeklyRewards) state.weeklyRewards = parsed.weeklyRewards;
    if (parsed.monthlyRewards) state.monthlyRewards = parsed.monthlyRewards;
    if (parsed.completions) state.completions = parsed.completions;
    if (parsed.customTasks) state.tasks = parsed.customTasks;
    if (parsed.redeemedGoals) state.redeemedGoals = parsed.redeemedGoals;
  }
}

function saveState() {
  // Never save when viewing a buddy's data - would corrupt user's own data!
  const params = new URLSearchParams(window.location.search);
  if (params.get('buddy')) {
    return;
  }
  
  const saved = localStorage.getItem(STORAGE_KEY);
  const data = saved ? JSON.parse(saved) : {};
  data.weeklyRewards = state.weeklyRewards;
  data.monthlyRewards = state.monthlyRewards;
  data.redeemedGoals = state.redeemedGoals;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  
  if (state.account) {
    syncToServer();
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
        weekly_rewards: state.weeklyRewards,
        monthly_rewards: state.monthlyRewards,
        redeemed_goals: state.redeemedGoals,
      })
      .eq('id', state.account.id);
  } catch (err) {
    console.error("Sync failed:", err);
  }
}

function bindControls() {
  // Navigation
  document.getElementById("menu-btn").addEventListener("click", openNav);
  document.querySelector(".nav-drawer-backdrop").addEventListener("click", closeNav);
  
  // Add reward buttons
  document.getElementById("add-weekly-reward").addEventListener("click", () => openRewardModal(null, "weekly"));
  document.getElementById("add-monthly-reward").addEventListener("click", () => openRewardModal(null, "monthly"));
  
  // Modal controls
  document.getElementById("reward-cancel").addEventListener("click", closeRewardModal);
  document.getElementById("reward-save").addEventListener("click", saveReward);
  document.getElementById("reward-delete").addEventListener("click", deleteReward);
  document.querySelector("#reward-modal .modal-backdrop").addEventListener("click", closeRewardModal);
  
  // Reward type toggle
  document.querySelectorAll(".reward-type-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".reward-type-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      const type = btn.dataset.type;
      document.getElementById("money-input-group").classList.toggle("hidden", type !== "money");
      document.getElementById("custom-input-group").classList.toggle("hidden", type !== "custom");
    });
  });
  
  // Emoji picker
  initEmojiPicker();
  
  // Redeem modal
  document.getElementById("redeem-cancel").addEventListener("click", closeRedeemModal);
  document.getElementById("redeem-save").addEventListener("click", saveRedemption);
  document.querySelector("#redeem-modal .modal-backdrop").addEventListener("click", closeRedeemModal);
}

function initEmojiPicker() {
  const pickerBtn = document.getElementById("emoji-picker-btn");
  const popup = document.getElementById("emoji-picker-popup");
  const grid = document.getElementById("emoji-grid");
  const input = document.getElementById("reward-emoji");
  
  // Populate emoji grid
  grid.innerHTML = emojiOptions.map(emoji => 
    `<button type="button" class="emoji-option" data-emoji="${emoji}">${emoji}</button>`
  ).join("");
  
  // Toggle popup
  pickerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    popup.classList.toggle("hidden");
  });
  
  // Select emoji
  grid.addEventListener("click", (e) => {
    if (e.target.classList.contains("emoji-option")) {
      input.value = e.target.dataset.emoji;
      pickerBtn.textContent = e.target.dataset.emoji;
      popup.classList.add("hidden");
    }
  });
  
  // Close popup when clicking outside
  document.addEventListener("click", (e) => {
    if (!popup.contains(e.target) && e.target !== pickerBtn) {
      popup.classList.add("hidden");
    }
  });
}

function openNav() {
  document.getElementById("nav-drawer").classList.remove("hidden");
}

function closeNav() {
  document.getElementById("nav-drawer").classList.add("hidden");
}

// Load buddies you have access to and display in nav menu
async function loadNavBuddies() {
  const navList = document.getElementById("nav-buddy-list");
  if (!navList) return;
  
  const { data: { session } } = await supabaseClient.auth.getSession();
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

function render() {
  renderRewardsList("weekly", state.weeklyRewards);
  renderRewardsList("monthly", state.monthlyRewards);
  renderCompletedWins();
}

function renderRewardsList(category, rewards) {
  const listEl = document.getElementById(`${category}-rewards-list`);
  
  if (rewards.length === 0) {
    listEl.innerHTML = `<p class="empty-rewards">No rewards yet. Add some!</p>`;
    return;
  }
  
  listEl.innerHTML = rewards.map(reward => `
    <div class="reward-card" data-id="${reward.id}">
      <div class="reward-emoji">${reward.emoji || "🎁"}</div>
      <div class="reward-text">${formatReward(reward)}</div>
      <button class="reward-edit-btn" onclick="openRewardModal('${reward.id}', '${category}')">✎</button>
    </div>
  `).join("");
}

function formatReward(reward) {
  if (reward.type === "money") {
    return `$${reward.amount} spending money`;
  }
  return reward.text;
}

function openRewardModal(rewardId, category) {
  // Prevent editing/adding rewards when viewing buddy with view-only access
  if (viewingBuddy && !viewingBuddy.canEdit) {
    alert("You have view-only access. You cannot add or edit rewards for this user.");
    return;
  }
  
  editingCategory = category;
  const modal = document.getElementById("reward-modal");
  const title = document.getElementById("reward-modal-title");
  const deleteBtn = document.getElementById("reward-delete");
  const emojiBtn = document.getElementById("emoji-picker-btn");
  const emojiPopup = document.getElementById("emoji-picker-popup");
  
  // Reset form
  document.getElementById("reward-amount").value = "";
  document.getElementById("reward-custom").value = "";
  document.getElementById("reward-emoji").value = "";
  document.getElementById("reward-error").classList.add("hidden");
  emojiBtn.textContent = "😀";
  emojiPopup.classList.add("hidden");
  
  // Set type toggle to money by default
  document.querySelectorAll(".reward-type-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('.reward-type-btn[data-type="money"]').classList.add("active");
  document.getElementById("money-input-group").classList.remove("hidden");
  document.getElementById("custom-input-group").classList.add("hidden");
  
  if (rewardId) {
    // Editing existing reward
    const rewards = category === "weekly" ? state.weeklyRewards : state.monthlyRewards;
    editingReward = rewards.find(r => r.id === rewardId);
    
    if (editingReward) {
      title.textContent = "Edit Reward";
      deleteBtn.classList.remove("hidden");
      
      if (editingReward.type === "money") {
        document.getElementById("reward-amount").value = editingReward.amount;
      } else {
        document.querySelectorAll(".reward-type-btn").forEach(b => b.classList.remove("active"));
        document.querySelector('.reward-type-btn[data-type="custom"]').classList.add("active");
        document.getElementById("money-input-group").classList.add("hidden");
        document.getElementById("custom-input-group").classList.remove("hidden");
        document.getElementById("reward-custom").value = editingReward.text || "";
      }
      document.getElementById("reward-emoji").value = editingReward.emoji || "";
      emojiBtn.textContent = editingReward.emoji || "😀";
    }
  } else {
    // Adding new reward
    editingReward = null;
    title.textContent = "Add Reward";
    deleteBtn.classList.add("hidden");
  }
  
  modal.classList.remove("hidden");
}

function closeRewardModal() {
  document.getElementById("reward-modal").classList.add("hidden");
  editingReward = null;
  editingCategory = null;
}

function saveReward() {
  // Prevent saving when viewing buddy with view-only access
  if (viewingBuddy && !viewingBuddy.canEdit) {
    alert("You have view-only access. You cannot save rewards for this user.");
    closeRewardModal();
    return;
  }
  
  const isMoneyType = document.querySelector('.reward-type-btn[data-type="money"]').classList.contains("active");
  const emoji = document.getElementById("reward-emoji").value.trim() || "🎁";
  
  let reward;
  
  if (isMoneyType) {
    const amount = parseFloat(document.getElementById("reward-amount").value);
    if (!amount || amount <= 0) {
      showRewardError("Please enter a valid amount");
      return;
    }
    reward = { type: "money", amount, emoji };
  } else {
    const text = document.getElementById("reward-custom").value.trim();
    if (!text) {
      showRewardError("Please enter a reward description");
      return;
    }
    reward = { type: "custom", text, emoji };
  }
  
  const rewards = editingCategory === "weekly" ? state.weeklyRewards : state.monthlyRewards;
  
  if (editingReward) {
    // Update existing
    reward.id = editingReward.id;
    const index = rewards.findIndex(r => r.id === editingReward.id);
    if (index !== -1) {
      rewards[index] = reward;
    }
  } else {
    // Add new
    reward.id = generateId();
    rewards.push(reward);
  }
  
  saveState();
  closeRewardModal();
  render();
}

function deleteReward() {
  if (!editingReward || !editingCategory) return;
  
  // Prevent deleting when viewing buddy with view-only access
  if (viewingBuddy && !viewingBuddy.canEdit) {
    alert("You have view-only access. You cannot delete rewards for this user.");
    closeRewardModal();
    return;
  }
  
  if (!confirm("Delete this reward?")) return;
  
  const rewards = editingCategory === "weekly" ? state.weeklyRewards : state.monthlyRewards;
  const index = rewards.findIndex(r => r.id === editingReward.id);
  if (index !== -1) {
    rewards.splice(index, 1);
  }
  
  saveState();
  closeRewardModal();
  render();
}

function showRewardError(message) {
  const el = document.getElementById("reward-error");
  el.textContent = message;
  el.classList.remove("hidden");
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// ============ Completed Wins Section ============

function renderCompletedWins() {
  const section = document.getElementById("completed-wins-section");
  const grid = document.getElementById("completed-wins-grid");
  
  const completedGoals = getCompletedGoalsThisMonth();
  
  if (completedGoals.length === 0) {
    grid.innerHTML = `
      <div class="no-completed-wins">
        <div class="emoji">🎯</div>
        <p>No completed goals this month yet.<br>Keep working on your weekly and monthly wins!</p>
      </div>
    `;
    return;
  }
  
  const monthKey = getMonthKey();
  
  grid.innerHTML = completedGoals.map((goal, index) => {
    const redemption = getRedemptionForGoal(goal.id, monthKey);
    const isRedeemed = !!redemption;
    const rewardText = redemption ? getRewardText(redemption.rewardId) : '';
    
    return `
      <div class="completed-win-card ${isRedeemed ? 'redeemed' : ''}" data-id="${goal.id}" style="animation-delay: ${index * 0.1}s">
        <div class="completed-win-emoji">${goal.emoji || "🏆"}</div>
        <div class="completed-win-label">${goal.label}</div>
        <button class="completed-win-badge ${isRedeemed ? 'redeemed' : ''}" data-goal-id="${goal.id}" data-goal-type="${goal.type}">
          ${isRedeemed ? 'Redeemed ✓' : (goal.type === "Weekly" ? "Weekly Win ✓" : "Monthly Win ✓")}
        </button>
        ${isRedeemed ? `<div class="redeemed-info">${rewardText}${redemption.note ? ` - "${redemption.note}"` : ''}</div>` : ''}
      </div>
    `;
  }).join("");
  
  // Add click handlers to badges
  grid.querySelectorAll(".completed-win-badge").forEach(badge => {
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      const goalId = badge.dataset.goalId;
      const goalType = badge.dataset.goalType;
      const goal = completedGoals.find(g => g.id === goalId);
      
      if (badge.classList.contains("redeemed")) {
        // Unredeem - confirm first
        if (confirm("Remove this redemption?")) {
          unredeemGoal(goalId);
        }
      } else {
        // Open redeem modal
        openRedeemModal(goal);
      }
    });
  });
}

function unredeemGoal(goalId) {
  // Prevent un-redeeming when viewing buddy with view-only access
  if (viewingBuddy && !viewingBuddy.canEdit) {
    alert("You have view-only access. You cannot modify redemptions for this user.");
    return;
  }
  
  const monthKey = getMonthKey();
  state.redeemedGoals = state.redeemedGoals.filter(
    r => !(r.goalId === goalId && r.monthKey === monthKey)
  );
  saveState();
  render();
}

function getMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
}

function getRedemptionForGoal(goalId, monthKey) {
  return state.redeemedGoals.find(r => r.goalId === goalId && r.monthKey === monthKey);
}

function getRewardText(rewardId) {
  const allRewards = [...state.weeklyRewards, ...state.monthlyRewards];
  const reward = allRewards.find(r => r.id === rewardId);
  if (!reward) return '';
  return reward.type === 'money' ? `$${reward.amount}` : reward.text;
}

function openRedeemModal(goal) {
  // Prevent redeeming when viewing buddy with view-only access
  if (viewingBuddy && !viewingBuddy.canEdit) {
    alert("You have view-only access. You cannot redeem rewards for this user.");
    return;
  }
  
  redeemingGoal = goal;
  
  document.getElementById("redeem-goal-name").textContent = `${goal.emoji || "🏆"} ${goal.label}`;
  
  // Populate reward select
  const select = document.getElementById("redeem-reward-select");
  const rewards = goal.type === "Weekly" ? state.weeklyRewards : state.monthlyRewards;
  
  select.innerHTML = rewards.map(r => `
    <option value="${r.id}">${r.emoji || "🎁"} ${r.type === "money" ? `$${r.amount} spending money` : r.text}</option>
  `).join("");
  
  document.getElementById("redeem-note").value = "";
  document.getElementById("redeem-modal").classList.remove("hidden");
}

function closeRedeemModal() {
  document.getElementById("redeem-modal").classList.add("hidden");
  redeemingGoal = null;
}

function saveRedemption() {
  if (!redeemingGoal) return;
  
  // Prevent saving redemption when viewing buddy with view-only access
  if (viewingBuddy && !viewingBuddy.canEdit) {
    alert("You have view-only access. You cannot redeem rewards for this user.");
    closeRedeemModal();
    return;
  }
  
  const rewardId = document.getElementById("redeem-reward-select").value;
  const note = document.getElementById("redeem-note").value.trim();
  const monthKey = getMonthKey();
  
  // Add redemption
  state.redeemedGoals.push({
    goalId: redeemingGoal.id,
    rewardId,
    note,
    date: new Date().toISOString(),
    monthKey
  });
  
  saveState();
  closeRedeemModal();
  render();
}

function getCompletedGoalsThisMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const completedGoals = [];
  
  // Get tasks with goals (weekly and monthly)
  const goalsWithTargets = state.tasks.filter(t => 
    (t.category === "Weekly" || t.category === "Monthly") && t.goal
  );
  
  goalsWithTargets.forEach(task => {
    const count = getTaskPeriodCount(task, year, month);
    if (count >= task.goal) {
      completedGoals.push({
        id: task.id,
        label: task.label,
        type: task.category,
        emoji: getCategoryEmoji(task.category),
        color: task.color
      });
    }
  });
  
  return completedGoals;
}

function getTaskPeriodCount(task, year, month) {
  let total = 0;
  
  if (task.category === "Weekly") {
    // Get current week range
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    Object.entries(state.completions).forEach(([key, list]) => {
      const date = fromKey(key);
      if (date >= startOfWeek && date <= endOfWeek) {
        total += list.filter(c => c.taskId === task.id).length;
      }
    });
  } else {
    // Monthly - count all completions this month
    Object.entries(state.completions).forEach(([key, list]) => {
      const date = fromKey(key);
      if (date.getFullYear() === year && date.getMonth() === month) {
        total += list.filter(c => c.taskId === task.id).length;
      }
    });
  }
  
  return total;
}

function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getCategoryEmoji(category) {
  const emojis = {
    "Weekly": "📅",
    "Monthly": "📆"
  };
  return emojis[category] || "🏆";
}

// ============ Account Functions (same as other pages) ============

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
  
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    await loadUserProfile(session.user);
  }
  
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
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
      if (profile.weekly_rewards) state.weeklyRewards = profile.weekly_rewards;
      if (profile.monthly_rewards) state.monthlyRewards = profile.monthly_rewards;
      if (profile.completions) state.completions = profile.completions;
      if (profile.tasks) state.tasks = profile.tasks;
      if (profile.redeemed_goals) state.redeemedGoals = profile.redeemed_goals;
    }
    
    updateAccountButton();
    loadNavBuddies();
    render();
    
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
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
  
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Loading...";
  submitBtn.disabled = true;
  
  try {
    if (isRegistering) {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { name: name || email.split('@')[0] } }
      });
      
      if (error) {
        showAuthError(error.message);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        return;
      }
      
      if (data.user) {
        await supabaseClient.from('profiles').update({ 
          name: name || email.split('@')[0],
          username: email 
        }).eq('id', data.user.id);
        
        await loadUserProfile(data.user);
        showProfileView();
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      
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
    const { error: uploadError } = await supabaseClient.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });
    
    if (uploadError) {
      console.log("Avatar upload skipped - storage not configured");
      return;
    }
    
    const { data: { publicUrl } } = supabaseClient.storage
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
  
  if (!newPass || newPass.length < 6) {
    alert("Password must be at least 6 characters");
    return;
  }
  
  try {
    const { error } = await supabaseClient.auth.updateUser({ password: newPass });
    
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
  await supabaseClient.auth.signOut();
  
  state.account = null;
  state.weeklyRewards = [...defaultWeeklyRewards];
  state.monthlyRewards = [...defaultMonthlyRewards];
  
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.weeklyRewards) state.weeklyRewards = parsed.weeklyRewards;
    if (parsed.monthlyRewards) state.monthlyRewards = parsed.monthlyRewards;
  }
  
  updateAccountButton();
  closeAccountModal();
  render();
}


const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'accounts.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure directories exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Initialize accounts file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ accounts: [] }, null, 2));
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${Date.now()}${ext}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});

// Helper functions
function loadAccounts() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { accounts: [] };
  }
}

function saveAccounts(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Routes

// Register new account
app.post('/api/register', async (req, res) => {
  const { username, password, name } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  
  const data = loadAccounts();
  
  // No user limit!
  
  if (data.accounts.find(a => a.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  // Hash the password before storing
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const newAccount = {
    id: Date.now().toString(),
    username,
    password: hashedPassword, // Stored as hash, not plain text!
    name: name || username,
    avatar: null,
    completions: {},
    tasks: null, // null means use defaults
    createdAt: new Date().toISOString()
  };
  
  data.accounts.push(newAccount);
  saveAccounts(data);
  
  const { password: _, ...safeAccount } = newAccount;
  res.json({ success: true, account: safeAccount });
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  const data = loadAccounts();
  const account = data.accounts.find(
    a => a.username.toLowerCase() === username.toLowerCase()
  );
  
  if (!account) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Compare password with stored hash
  const passwordMatch = await bcrypt.compare(password, account.password);
  
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  
  const { password: _, ...safeAccount } = account;
  res.json({ success: true, account: safeAccount });
});

// Get account data
app.get('/api/account/:id', (req, res) => {
  const data = loadAccounts();
  const account = data.accounts.find(a => a.id === req.params.id);
  
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  const { password: _, ...safeAccount } = account;
  res.json(safeAccount);
});

// Update account (name, completions, tasks)
app.put('/api/account/:id', (req, res) => {
  const { name, completions, tasks } = req.body;
  const data = loadAccounts();
  const index = data.accounts.findIndex(a => a.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  if (name !== undefined) data.accounts[index].name = name;
  if (completions !== undefined) data.accounts[index].completions = completions;
  if (tasks !== undefined) data.accounts[index].tasks = tasks;
  
  saveAccounts(data);
  
  const { password: _, ...safeAccount } = data.accounts[index];
  res.json({ success: true, account: safeAccount });
});

// Upload avatar
app.post('/api/account/:id/avatar', upload.single('avatar'), (req, res) => {
  const data = loadAccounts();
  const index = data.accounts.findIndex(a => a.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  // Delete old avatar if exists
  if (data.accounts[index].avatar) {
    const oldPath = path.join(__dirname, data.accounts[index].avatar);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }
  
  data.accounts[index].avatar = `/uploads/${req.file.filename}`;
  saveAccounts(data);
  
  res.json({ success: true, avatar: data.accounts[index].avatar });
});

// Change password
app.put('/api/account/:id/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const data = loadAccounts();
  const index = data.accounts.findIndex(a => a.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Account not found' });
  }

  // Compare current password with stored hash
  const passwordMatch = await bcrypt.compare(currentPassword, data.accounts[index].password);
  
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Hash the new password
  data.accounts[index].password = await bcrypt.hash(newPassword, 10);
  saveAccounts(data);
  
  res.json({ success: true });
});

// Delete account
app.delete('/api/account/:id', async (req, res) => {
  const { password } = req.body;
  const data = loadAccounts();
  const index = data.accounts.findIndex(a => a.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Account not found' });
  }

  // Compare password with stored hash
  const passwordMatch = await bcrypt.compare(password, data.accounts[index].password);
  
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Password incorrect' });
  }
  
  // Delete avatar if exists
  if (data.accounts[index].avatar) {
    const avatarPath = path.join(__dirname, data.accounts[index].avatar);
    if (fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
    }
  }
  
  data.accounts.splice(index, 1);
  saveAccounts(data);
  
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Daily Wins server running at http://localhost:${PORT}`);
});

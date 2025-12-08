const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const DATA_FILE = path.join(__dirname, 'data', 'accounts.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Track if we're using MongoDB or file storage
let useMongoDb = false;

// MongoDB Schema
const AccountSchema = new mongoose.Schema({
  odba: { type: String, unique: true }, // username
  password: String,
  name: String,
  avatar: String,
  completions: { type: mongoose.Schema.Types.Mixed, default: {} },
  tasks: { type: mongoose.Schema.Types.Mixed, default: null },
  starMoments: { type: [mongoose.Schema.Types.Mixed], default: [] },
  createdAt: { type: Date, default: Date.now }
});

let Account;

// Connect to MongoDB if URI is provided
async function connectDatabase() {
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      Account = mongoose.model('Account', AccountSchema);
      useMongoDb = true;
      console.log('Connected to MongoDB Atlas');
    } catch (err) {
      console.error('MongoDB connection failed:', err.message);
      console.log('Falling back to file storage');
      setupFileStorage();
    }
  } else {
    console.log('No MONGODB_URI provided, using file storage');
    setupFileStorage();
  }
}

function setupFileStorage() {
  // Ensure directories exist
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ accounts: [] }, null, 2));
  }
}

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});

// File storage helper functions
function loadAccountsFromFile() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { accounts: [] };
  }
}

function saveAccountsToFile(data) {
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

  const hashedPassword = await bcrypt.hash(password, 10);

  if (useMongoDb) {
    try {
      // Check if username exists
      const existing = await Account.findOne({ username: username.toLowerCase() });
      if (existing) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      const newAccount = new Account({
        username: username.toLowerCase(),
        password: hashedPassword,
        name: name || username,
        avatar: null,
        completions: {},
        tasks: null,
        starMoments: []
      });
      
      await newAccount.save();
      
      const safeAccount = {
        id: newAccount._id.toString(),
        username: newAccount.username,
        name: newAccount.name,
        avatar: newAccount.avatar,
        completions: newAccount.completions,
        tasks: newAccount.tasks,
        starMoments: newAccount.starMoments
      };
      
      res.json({ success: true, account: safeAccount });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    // File storage
    const data = loadAccountsFromFile();
    
    if (data.accounts.find(a => a.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const newAccount = {
      id: Date.now().toString(),
      username,
      password: hashedPassword,
      name: name || username,
      avatar: null,
      completions: {},
      tasks: null,
      starMoments: [],
      createdAt: new Date().toISOString()
    };
    
    data.accounts.push(newAccount);
    saveAccountsToFile(data);
    
    const { password: _, ...safeAccount } = newAccount;
    res.json({ success: true, account: safeAccount });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (useMongoDb) {
    try {
      const account = await Account.findOne({ username: username.toLowerCase() });
      
      if (!account) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const passwordMatch = await bcrypt.compare(password, account.password);
      
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      const safeAccount = {
        id: account._id.toString(),
        username: account.username,
        name: account.name,
        avatar: account.avatar,
        completions: account.completions,
        tasks: account.tasks,
        starMoments: account.starMoments
      };
      
      res.json({ success: true, account: safeAccount });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    // File storage
    const data = loadAccountsFromFile();
    const account = data.accounts.find(
      a => a.username.toLowerCase() === username.toLowerCase()
    );
    
    if (!account) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const passwordMatch = await bcrypt.compare(password, account.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const { password: _, ...safeAccount } = account;
    res.json({ success: true, account: safeAccount });
  }
});

// Get account data
app.get('/api/account/:id', async (req, res) => {
  if (useMongoDb) {
    try {
      const account = await Account.findById(req.params.id);
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      
      const safeAccount = {
        id: account._id.toString(),
        username: account.username,
        name: account.name,
        avatar: account.avatar,
        completions: account.completions,
        tasks: account.tasks,
        starMoments: account.starMoments
      };
      
      res.json(safeAccount);
    } catch (err) {
      console.error('Get account error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    // File storage
    const data = loadAccountsFromFile();
    const account = data.accounts.find(a => a.id === req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const { password: _, ...safeAccount } = account;
    res.json(safeAccount);
  }
});

// Update account
app.put('/api/account/:id', async (req, res) => {
  const { name, completions, tasks, starMoments } = req.body;

  if (useMongoDb) {
    try {
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (completions !== undefined) updateData.completions = completions;
      if (tasks !== undefined) updateData.tasks = tasks;
      if (starMoments !== undefined) updateData.starMoments = starMoments;

      const account = await Account.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      
      const safeAccount = {
        id: account._id.toString(),
        username: account.username,
        name: account.name,
        avatar: account.avatar,
        completions: account.completions,
        tasks: account.tasks,
        starMoments: account.starMoments
      };
      
      res.json({ success: true, account: safeAccount });
    } catch (err) {
      console.error('Update account error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    // File storage
    const data = loadAccountsFromFile();
    const index = data.accounts.findIndex(a => a.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    if (name !== undefined) data.accounts[index].name = name;
    if (completions !== undefined) data.accounts[index].completions = completions;
    if (tasks !== undefined) data.accounts[index].tasks = tasks;
    if (starMoments !== undefined) data.accounts[index].starMoments = starMoments;
    
    saveAccountsToFile(data);
    
    const { password: _, ...safeAccount } = data.accounts[index];
    res.json({ success: true, account: safeAccount });
  }
});

// Upload avatar
app.post('/api/account/:id/avatar', upload.single('avatar'), async (req, res) => {
  const avatarPath = `/uploads/${req.file.filename}`;

  if (useMongoDb) {
    try {
      const account = await Account.findByIdAndUpdate(
        req.params.id,
        { avatar: avatarPath },
        { new: true }
      );
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      
      res.json({ success: true, avatar: avatarPath });
    } catch (err) {
      console.error('Avatar upload error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    // File storage
    const data = loadAccountsFromFile();
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
    
    data.accounts[index].avatar = avatarPath;
    saveAccountsToFile(data);
    
    res.json({ success: true, avatar: avatarPath });
  }
});

// Change password
app.put('/api/account/:id/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (useMongoDb) {
    try {
      const account = await Account.findById(req.params.id);
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const passwordMatch = await bcrypt.compare(currentPassword, account.password);
      
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      account.password = await bcrypt.hash(newPassword, 10);
      await account.save();
      
      res.json({ success: true });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    // File storage
    const data = loadAccountsFromFile();
    const index = data.accounts.findIndex(a => a.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, data.accounts[index].password);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    data.accounts[index].password = await bcrypt.hash(newPassword, 10);
    saveAccountsToFile(data);
    
    res.json({ success: true });
  }
});

// Delete account
app.delete('/api/account/:id', async (req, res) => {
  const { password } = req.body;

  if (useMongoDb) {
    try {
      const account = await Account.findById(req.params.id);
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const passwordMatch = await bcrypt.compare(password, account.password);
      
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Password incorrect' });
      }

      // Delete avatar if exists
      if (account.avatar) {
        const avatarPath = path.join(__dirname, account.avatar);
        if (fs.existsSync(avatarPath)) {
          fs.unlinkSync(avatarPath);
        }
      }

      await Account.findByIdAndDelete(req.params.id);
      
      res.json({ success: true });
    } catch (err) {
      console.error('Delete account error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    // File storage
    const data = loadAccountsFromFile();
    const index = data.accounts.findIndex(a => a.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Account not found' });
    }

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
    saveAccountsToFile(data);
    
    res.json({ success: true });
  }
});

// Start server
connectDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Daily Wins server running at http://localhost:${PORT}`);
    console.log(`Database: ${useMongoDb ? 'MongoDB Atlas' : 'Local file storage'}`);
  });
});

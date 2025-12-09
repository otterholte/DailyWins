# ⭐ Daily Wins

A beautiful, gamified habit tracker that celebrates your daily accomplishments with stars, streaks, and progress bars.

![Daily Wins](https://img.shields.io/badge/Status-Live-brightgreen) ![Made with Love](https://img.shields.io/badge/Made%20with-❤️-red)

## 🎯 What Is This?

**Daily Wins** is a personal achievement tracker that helps you:
- ✅ Track daily habits and accomplishments
- 📅 View your progress by day, week, or month
- 🔥 Build streaks for consecutive days of wins
- ⭐ Capture special "Star Moments" to remember later
- 🎨 Enjoy colorful, satisfying animations when you complete tasks

**Think of it as a digital sticker chart for adults** — every time you complete a task, you get a colorful sticker on your calendar!

---

## 🚀 How It Works

### For Users

1. **Go to the app** at your deployed URL (or run locally)
2. **Check off wins** as you complete tasks throughout the day
3. **Watch progress bars fill up** for weekly and monthly goals
4. **Create an account** (optional) to sync across devices

### Categories
- **Daily Wins**: Tasks to complete each day (workout, brush teeth, etc.)
- **Weekly Goals**: Bigger goals tracked over the week
- **Monthly Goals**: Long-term habits to build
- **Self Care**: Reminders to take care of yourself

### Special Features
- **🔗 Linked Tasks**: Connect daily wins to weekly/monthly goals so they count together
- **⭐ Star Moments**: Special achievements you can write notes about
- **📊 Progress Bars**: Visual feedback showing how close you are to goals
- **🎉 Animations**: Fun celebrations when you complete tasks!
- **👥 Accountability Buddies**: Share your progress with friends and view theirs

---

## 🛠️ Tech Stack (For Developers)

| Technology | What It Does |
|------------|--------------|
| **HTML/CSS/JavaScript** | The frontend - what you see and interact with |
| **Node.js + Express** | A simple web server that serves the files |
| **Supabase** | Cloud database and authentication (handles user accounts and data storage) |
| **Render** | Cloud hosting platform (keeps the app running 24/7) |

### How The Pieces Fit Together

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your Phone/   │────▶│     Render      │────▶│    Supabase     │
│    Browser      │     │  (Web Server)   │     │   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     You use           Serves the app           Stores your data
     the app           files to you             in the cloud
```

### File Structure

```
DailyWins/
├── index.html      # Main page structure
├── star-jar.html   # Star moments page
├── rewards.html    # Rewards management page
├── buddies.html    # Accountability buddies page
├── style.css       # All the styling and animations
├── app.js          # Main app logic (tracking wins, progress, etc.)
├── star-jar.js     # Star jar page logic
├── rewards.js      # Rewards page logic
├── buddies.js      # Buddies page logic
├── manifest.json   # PWA manifest for home screen
└── icons/          # App icons for home screen
```

---

## 💻 Running Locally

### Prerequisites
- [Node.js](https://nodejs.org/) installed (v14 or higher)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/DailyWins.git
   cd DailyWins
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

---

## 📱 Add to Home Screen (Mobile)

### Android (Chrome)
1. Open the app in Chrome
2. Tap the 3-dot menu (⋮)
3. Tap "Add to Home screen"
4. You'll see a nice app icon!

### iPhone (Safari)
1. Open the app in Safari
2. Tap the Share button (📤)
3. Tap "Add to Home Screen"

---

## 🔐 Account System

- **Without account**: Your data saves locally on your device
- **With account**: Your data syncs to the cloud and works across all your devices

Accounts use **Supabase Authentication** which:
- Securely stores passwords (hashed, never plain text)
- Handles login/logout automatically
- Syncs data in real-time

---

## 🎨 Customization

You can customize tasks through the app:
1. Click the ⚙️ icon next to any category
2. Drag to reorder, ✏️ to edit, 🗑️ to delete
3. Click ➕ to add new tasks
4. Set goals and link related tasks together

---

## 🗄️ Supabase Setup (For Developers)

If you're setting up your own instance, you'll need these Supabase tables:

### buddy_shares table
```sql
CREATE TABLE buddy_shares (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  buddy_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  can_edit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(owner_id, buddy_id)
);

-- RLS Policies
ALTER TABLE buddy_shares ENABLE ROW LEVEL SECURITY;

-- Users can view shares they own or are buddies in
CREATE POLICY "Users can view their shares" ON buddy_shares
  FOR SELECT USING (auth.uid() = owner_id OR auth.uid() = buddy_id);

-- Users can insert shares where they are the owner
CREATE POLICY "Users can create shares" ON buddy_shares
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Users can update shares they own
CREATE POLICY "Users can update their shares" ON buddy_shares
  FOR UPDATE USING (auth.uid() = owner_id);

-- Users can delete shares they own
CREATE POLICY "Users can delete their shares" ON buddy_shares
  FOR DELETE USING (auth.uid() = owner_id);
```

---

## 📄 License

This project is for personal use. Feel free to fork and customize for yourself!

---

Made with ⭐ for tracking daily wins


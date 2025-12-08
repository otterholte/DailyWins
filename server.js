const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// All auth and data is handled by Supabase on the frontend
// This server just serves static files

app.listen(PORT, () => {
  console.log(`Daily Wins server running at http://localhost:${PORT}`);
});

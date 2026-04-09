const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// DEBUG: Check DATABASE_URL
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET (value hidden)' : 'NOT SET');


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'prosoft-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport config
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return done(null, false);
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return done(null, false);
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    return done(null, user);
  } catch (err) { return done(err); }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query(
      'SELECT id, username, is_admin, runs_remaining, runs_total FROM users WHERE id = $1', [id]
    );
    done(null, result.rows[0]);
  } catch (err) { done(err); }
});

// Auth middleware
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login.html');
}

function requireAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.is_admin) return next();
  res.status(403).json({ error: 'Access denied' });
}

// API Routes

// Get current user info
app.get('/api/user', (req, res) => {
  if (!req.user) return res.json({ loggedIn: false });
  res.json({
    loggedIn: true,
    id: req.user.id,
    username: req.user.username,
    is_admin: req.user.is_admin,
    runs_remaining: req.user.runs_remaining,
    runs_total: req.user.runs_total
  });
});

// Login
app.post('/api/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    req.logIn(user, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, redirect: '/dashboard.html' });
    });
  })(req, res, next);
});

// Logout
app.get('/api/logout', (req, res) => {
  req.logout(() => res.redirect('/login.html'));
});

// Register (admin only)
app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, runs } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password, runs_remaining, runs_total) VALUES ($1, $2, $3, $3)',
      [username, hash, runs || 20]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users (admin only)
app.get('/api/users', requireAdmin, async (req, res) => {
  const result = await pool.query(
    'SELECT id, username, is_admin, runs_remaining, runs_total, created_at, last_login FROM users ORDER BY created_at DESC'
  );
  res.json(result.rows);
});

// Delete user (admin only)
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1 AND is_admin = false', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user runs (admin only)
app.put('/api/users/:id/runs', requireAdmin, async (req, res) => {
  try {
    const { runs, runs_total } = req.body;
    if (runs !== undefined) {
      await pool.query('UPDATE users SET runs_remaining = $1 WHERE id = $2', [runs, req.params.id]);
    }
    if (runs_total !== undefined) {
      await pool.query('UPDATE users SET runs_total = $1 WHERE id = $2', [runs_total, req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Use software (deduct run)
app.post('/api/use-software', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.runs_remaining <= 0) {
      return res.status(403).json({ error: 'No runs remaining', runs_remaining: 0 });
    }
    const newRuns = user.runs_remaining - 1;
    await pool.query(
      'UPDATE users SET runs_remaining = $1, last_login = NOW() WHERE id = $2',
      [newRuns, user.id]
    );
    res.json({ success: true, runs_remaining: newRuns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload software (admin only)
app.post('/api/upload-software', requireAdmin, (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const file = req.files.file;
  if (!file.name.endsWith('.html')) {
    return res.status(400).json({ error: 'Only HTML files allowed' });
  }
  const uploadPath = path.join(__dirname, 'public', 'software', file.name);
  file.mv(uploadPath, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, filename: file.name });
  });
});

// Get software list
app.get('/api/software', requireAuth, (req, res) => {
  const softwareDir = path.join(__dirname, 'public', 'software');
  if (!fs.existsSync(softwareDir)) return res.json([]);
  const files = fs.readdirSync(softwareDir).filter(f => f.endsWith('.html'));
  res.json(files);
});

// Get usage stats (admin)
app.get('/api/stats', requireAdmin, async (req, res) => {
  const users = await pool.query('SELECT COUNT(*) as total FROM users WHERE NOT is_admin');
  const usage = await pool.query(`
    SELECT SUM(runs_total - runs_remaining) as total_runs_used,
           SUM(runs_remaining) as total_runs_remaining
    FROM users WHERE NOT is_admin
  `);
  res.json({
    total_users: users.rows[0].total,
    total_runs_used: usage.rows[0].total_runs_used || 0,
    total_runs_remaining: usage.rows[0].total_runs_remaining || 0
  });
});

// Initialize database
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT false,
      runs_remaining INTEGER DEFAULT 20,
      runs_total INTEGER DEFAULT 20,
      created_at TIMESTAMP DEFAULT NOW(),
      last_login TIMESTAMP
    )
  `);
  
  // Create admin if not exists
  const adminExists = await pool.query('SELECT id FROM users WHERE is_admin = true');
  if (adminExists.rows.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      'INSERT INTO users (username, password, is_admin, runs_remaining, runs_total) VALUES ($1, $2, true, 999999, 999999)',
      ['admin', hash]
    );
    console.log('Admin created: admin / admin123');
  }
}

const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ProSoft running on port \${PORT}`);
  });
});

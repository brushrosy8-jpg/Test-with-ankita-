const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const multer = require('multer');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
const HTML_TESTS_DIR = path.join(ROOT_DIR, 'public', 'html-tests');

for (const dir of [DATA_DIR, UPLOAD_DIR, HTML_TESTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

// Database
const dbPath = path.join(DATA_DIR, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Connected to SQLite database:', dbPath);
});

db.run('PRAGMA foreign_keys = ON');

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT DEFAULT 'गणित',
    duration INTEGER DEFAULT 20,
    marks_correct INTEGER DEFAULT 2,
    marks_incorrect INTEGER DEFAULT 1,
    published BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    FOREIGN KEY(test_id) REFERENCES tests(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    student_name TEXT,
    test_id INTEGER,
    subject TEXT,
    score INTEGER,
    correct_count INTEGER,
    incorrect_count INTEGER,
    unanswered_count INTEGER,
    percentage REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id)
  )`);
});

// Middleware
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Session: SESSION_SECRET should be configured in Render Environment
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: DATA_DIR
  }),
  secret: process.env.SESSION_SECRET ||
    'test-with-ankita-secret-key-2026-change-this',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

function requireStudent(req, res, next) {
  if (req.session && req.session.studentId) {
    return next();
  }

  return res.status(401).json({
    error: 'लॉगिन आवश्यक है। कृपया लॉगिन करें।'
  });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }

  return res.status(401).json({
    error: 'एडमिन लॉगिन आवश्यक है।'
  });
}

function saveSession(req, res, payload) {
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);

      return res.status(500).json({
        error: 'लॉगिन सेशन सेव नहीं हो पाया। कृपया दोबारा प्रयास करें।'
      });
    }

    res.json(payload);
  });
}

// Frontend files
app.use(express.static(path.join(ROOT_DIR, 'public')));

app.get('/', (req, res) =>
  res.sendFile(path.join(ROOT_DIR, 'index.html'))
);

app.get('/index.html', (req, res) =>
  res.sendFile(path.join(ROOT_DIR, 'index.html'))
);

app.get('/app.js', (req, res) =>
  res.send

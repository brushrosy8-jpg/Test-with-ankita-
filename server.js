const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR =
  process.env.DATA_DIR || path.join(__dirname, 'data');

const DB_FILE = path.join(DATA_DIR, 'exam-saathi.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const HTML_TESTS_DIR = path.join(PUBLIC_DIR, 'html-tests');

// ---------- Database setup ----------
fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      { students: [], tests: [], results: [] },
      null,
      2
    )
  );
}

function readDB() {
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

    return {
      students: Array.isArray(db.students) ? db.students : [],
      tests: Array.isArray(db.tests) ? db.tests : [],
      results: Array.isArray(db.results) ? db.results : []
    };
  } catch (error) {
    console.error('Database read error:', error.message);
    return { students: [], tests: [], results: [] };
  }
}

function writeDB(db) {
  const tmp = DB_FILE + '.tmp';

  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const id = () => crypto.randomUUID();

const adminUser = process.env.ADMIN_USERNAME || 'admin';
const adminPass = process.env.ADMIN_PASSWORD || '';

function safeTest(t) {
  return {
    id: t.id,
    title: t.title,
    description: t.description || '',
    subject: t.subject || 'General',
    duration: t.duration,
    published: !!t.published,
    mode: t.mode || 'mock',
    questionCount: (t.questions || []).length,
    createdAt: t.createdAt
  };
}

// ---------- Middleware ----------
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'development-only-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

const studentOnly = (req, res, next) => {
  if (req.session.studentId) return next();
  return res.status(401).json({ error: 'Please log in as a student.' });
};

const adminOnly = (req, res, next) => {
  if (req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Admin login required.' });
};

// ---------- Static website ----------
app.use(express.static(PUBLIC_DIR));

// ---------- Session ----------
app.get('/api/session', (req, res) => {
  const db = readDB();
  const student = db.students.find(
    s => s.id === req.session.studentId
  );

  res.json({
    student: student
      ? {
          id: student.id,
          name: student.name,
          username: student.username
        }
      : null,
    admin: !!req.session.isAdmin
  });
});

// ---------- Student registration ----------
app.post('/api/student/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (name.length < 2 || username.length < 3 || password.length < 8) {
    return res.status(400).json({
      error: 'Name, username (3+ characters), and password (8+ characters) are required.'
    });
  }

  const db = readDB();

  if (db.students.some(s => s.username === username)) {
    return res.status(409).json({ error: 'Username already exists.' });
  }

  const student = {
    id: id(),
    name,
    username,
    passwordHash: await bcrypt.hash(password, 12),
    createdAt: new Date().toISOString()
  };

  db.students.push(student);
  writeDB(db);
  req.session.studentId = student.id;

  res.json({
    id: student.id,
    name: student.name,
    username: student.username
  });
});

// ---------- Student login ----------
app.post('/api/student/login', async (req, res) => {
  const db = readDB();
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const student = db.students.find(s => s.username === username);

  if (
    !student ||
    !(await bcrypt.compare(password, student.passwordHash))
  ) {
    return res.status(401).json({
      error: 'Username or password is incorrect.'
    });
  }

  req.session.studentId = student.id;

  res.json({
    id: student.id,
    name: student.name,
    username: student.username
  });
});

// ---------- Admin login ----------
app.post('/api/admin/login', (req, res) => {
  if (!adminPass) {
    return res.status(503).json({
      error: 'Set ADMIN_PASSWORD in environment variables before using admin login.'
    });
  }

  if (
    String(req.body.username || '') !== adminUser ||
    String(req.body.password || '') !== adminPass
  ) {
    return res.status(401).json({
      error: 'Incorrect admin credentials.'
    });
  }

  req.session.isAdmin = true;
  res.json({ ok: true });
});

// ---------- Logout ----------
app.post('/api/logout', (req, res) => {
  req.session.destroy(error => {
    if (error) {
      return res.status(500).json({ error: 'Could not log out.' });
    }

    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// ---------- Published tests ----------
app.get('/api/tests', (req, res) => {
  const db = readDB();
  res.json(db.tests.filter(t => t.published).map(safeTest));
});

app.get('/api/tests/:testId', (req, res) => {
  const db = readDB();
  const test = db.tests.find(
    t => t.id === req.params.testId && t.published
  );

  if (!test) {
    return res.status(404).json({ error: 'Test not found.' });
  }

  res.json({
    ...safeTest(test),
    questions: (test.questions || []).map((q, i) => ({
      id: q.id,
      text: q.text,
      options: q.options,
      explanation: q.explanation || '',
      number: i + 1
    }))
  });
});

// ---------- Submit test ----------
app.post('/api/tests/:testId/submit', studentOnly, (req, res) => {
  const db = readDB();
  const test = db.tests.find(
    t => t.id === req.params.testId && t.published
  );

  if (!test) {
    return res.status(404).json({ error: 'Test not found.' });
  }

  const attemptKey = String(req.body.attemptKey || '');

  if (!attemptKey) {
    return res.status(400).json({ error: 'Attempt key is required.' });
  }

  if (
    db.results.some(
      r =>
        r.testId === test.id &&
        r.studentId === req.session.studentId &&
        r.attemptKey === attemptKey
    )
  ) {
    return res.status(409).json({
      error: 'This attempt has already been submitted.'
    });
  }

  const answers = req.body.answers || {};

  const details = (test.questions || []).map(q => {
    const selected = Number.isInteger(answers[q.id])
      ? answers[q.id]
      : null;

    return {
      questionId: q.id,
      text: q.text,
      selectedIndex: selected,
      correctIndex: q.correctIndex,
      correct: selected === q.correctIndex,
      explanation: q.explanation || ''
    };
  });

  const score = details.filter(q => q.correct).length;

  const result = {
    id: id(),
    testId: test.id,
    testTitle: test.title,
    studentId: req.session.studentId,
    answers: details,
    score,
    total: details.length,
    percentage: details.length
      ? Math.round((score / details.length) * 100)
      : 0,
    submittedAt: new Date().toISOString(),
    attemptKey
  };

  db.results.push(result);
  writeDB(db);

  const rank =
    1 +
    db.results.filter(
      r =>
        r.testId === test.id &&
        (r.score > score ||
          (r.score === score &&
            r.submittedAt < result.submittedAt))
    ).length;

  res.json({ ...result, rank });
});

// ---------- Student profile and results ----------
app.get('/api/student/me', studentOnly, (req, res) => {
  const db = readDB();
  const student = db.students.find(
    s => s.id === req.session.studentId
  );

  res.json({
    student: student
      ? {
          id: student.id,
          name: student.name,
          username: student.username
        }
      : null,
    results: db.results
      .filter(r => r.studentId === req.session.studentId)
      .map(r => ({
        id: r.id,
        testId: r.testId,
        testTitle: r.testTitle,
        score: r.score,
        total: r.total,
        percentage: r.percentage,
        submittedAt: r.submittedAt
      }))
  });
});

// ---------- Leaderboard ----------
app.get('/api/tests/:testId/leaderboard', (req, res) => {
  const db = readDB();
  const test = db.tests.find(
    t => t.id === req.params.testId && t.published
  );

  if (!test) {
    return res.status(404).json({ error: 'Test not found.' });
  }

  const top = db.results
    .filter(r => r.testId === test.id)
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(a.submittedAt) - new Date(b.submittedAt)
    )
    .slice(0, 10)
    .map((r, i) => ({
      rank: i + 1,
      name:
        db.students.find(s => s.id === r.studentId)?.name || 'Student',
      score: r.score,
      total: r.total,
      percentage: r.percentage
    }));

  res.json(top);
});

// ---------- Admin: tests ----------
app.get('/api/admin/tests', adminOnly, (req, res) => {
  const db = readDB();

  res.json(
    db.tests.map(t => ({
      ...safeTest(t),
      questions: (t.questions || []).map(q => ({ ...q }))
    }))
  );
});

app.post('/api/admin/tests', adminOnly, (req, res) => {
  const title = String(req.body.title || '').trim();
  const duration = Number(req.body.duration);

  if (
    !title ||
    !Number.isFinite(duration) ||
    duration < 1 ||
    duration > 600
  ) {
    return res.status(400).json({
      error: 'Title and duration (1–600 minutes) are required.'
    });
  }

  const db = readDB();

  const test = {
    id: id(),
    title,
    description: String(req.body.description || ''),
    subject: String(req.body.subject || 'General'),
    duration,
    published: false,
    mode: req.body.mode === 'practice' ? 'practice' : 'mock',
    questions: [],
    createdAt: new Date().toISOString()
  };

  db.tests.push(test);
  writeDB(db);

  res.json(safeTest(test));
});

app.put('/api/admin/tests/:testId', adminOnly, (req, res) => {
  const db = readDB();
  const test = db.tests.find(t => t.id === req.params.testId);

  if (!test) {
    return res.status(404).json({ error: 'Test not found.' });
  }

  for (const key of ['title', 'description', 'subject']) {
    if (req.body[key] !== undefined) {
      test[key] = String(req.body[key]).trim();
    }
  }

  if (req.body.duration !== undefined) {
    const duration = Number(req.body.duration);

    if (
      !Number.isFinite(duration) ||
      duration < 1 ||
      duration > 600
    ) {
      return res.status(400).json({
        error: 'Duration must be 1–600 minutes.'
      });
    }

    test.duration = duration;
  }

  if (req.body.mode !== undefined) {
    test.mode = req.body.mode === 'practice' ? 'practice' : 'mock';
  }

  writeDB(db);
  res.json(safeTest(test));
});

// ---------- Admin: add question ----------
app.post(
  '/api/admin/tests/:testId/questions',
  adminOnly,
  (req, res) => {
    const db = readDB();
    const test = db.tests.find(t => t.id === req.params.testId);

    if (!test) {
      return res.status(404).json({ error: 'Test not found.' });
    }

    const text = String(req.body.text || '').trim();
    const options = Array.isArray(req.body.options)
      ? req.body.options.map(x => String(x).trim())
      : [];
    const correctIndex = Number(req.body.correctIndex);

    if (
      !text ||
      options.length < 2 ||
      options.some(x => !x) ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= options.length
    ) {
      return res.status(400).json({
        error: 'Question, at least 2 options, and a valid correct answer are required.'
      });
    }

    if (!Array.isArray(test.questions)) test.questions = [];

    test.questions.push({
      id: id(),
      text,
      options,
      correctIndex,
      explanation: String(req.body.explanation || '')
    });

    writeDB(db);
    res.json(safeTest(test));
  }
);

/* ---------- Admin: edit existing question ---------- */
app.put(
  '/api/admin/tests/:testId/questions/:questionId',
  adminOnly,
  (req, res) => {
    const db = readDB();

    const test = db.tests.find(
      t => t.id === req.params.testId
    );

    if (!test) {
      return res.status(404).json({
        error: 'Test not found.'
      });
    }

    const question = (test.questions || []).find(
      q => q.id === req.params.questionId
    );

    if (!question) {
      return res.status(404).json({
        error: 'Question not found.'
      });
    }

    const text = String(req.body.text || '').trim();
    const options = Array.isArray(req.body.options)
      ? req.body.options.map(option => String(option).trim())
      : [];
    const correctIndex = Number(req.body.correctIndex);
    const explanation = String(
      req.body.explanation || ''
    ).trim();

    if (
      !text ||
      options.length < 2 ||
      options.some(option => !option) ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= options.length
    ) {
      return res.status(400).json({
        error: 'Enter a question, at least two options, and a valid correct answer.'
      });
    }

    question.text = text;
    question.options = options;
    question.correctIndex = correctIndex;
    question.explanation = explanation;

    writeDB(db);

    return res.json({
      ok: true,
      message: 'Question updated successfully.'
    });
  }
);

// ---------- Admin: delete question ----------
app.delete(
  '/api/admin/tests/:testId/questions/:questionId',
  adminOnly,
  (req, res) => {
    const db = readDB();
    const test = db.tests.find(t => t.id === req.params.testId);

    if (!test) {
      return res.status(404).json({ error: 'Test not found.' });
    }

    test.questions = (test.questions || []).filter(
      q => q.id !== req.params.questionId
    );

    writeDB(db);
    res.json(safeTest(test));
  }
);

// ---------- Admin: publish/unpublish ----------
app.post(
  '/api/admin/tests/:testId/publish',
  adminOnly,
  (req, res) => {
    const db = readDB();
    const test = db.tests.find(t => t.id === req.params.testId);

    if (!test) {
      return res.status(404).json({ error: 'Test not found.' });
    }

    if (req.body.published && !(test.questions || []).length) {
      return res.status(400).json({
        error: 'Add at least one question before publishing.'
      });
    }

    test.published = !!req.body.published;
    writeDB(db);

    res.json(safeTest(test));
  }
);

// ---------- Admin: delete test ----------
app.delete('/api/admin/tests/:testId', adminOnly, (req, res) => {
  const db = readDB();
  db.tests = db.tests.filter(t => t.id !== req.params.testId);

  writeDB(db);
  res.json({ ok: true });
});

// ---------- Admin: results ----------
app.get('/api/admin/results', adminOnly, (req, res) => {
  const db = readDB();

  res.json(
    db.results.map(r => ({
      ...r,
      studentName:
        db.students.find(s => s.id === r.studentId)?.name || 'Unknown'
    }))
  );
});

// ---------- Admin: export results as CSV ----------
app.get('/api/admin/results.csv', adminOnly, (req, res) => {
  const db = readDB();

  const rows = [
    ['Student', 'Test', 'Score', 'Total', 'Percentage', 'Submitted'],
    ...db.results.map(r => [
      db.students.find(s => s.id === r.studentId)?.name || 'Unknown',
      r.testTitle,
      r.score,
      r.total,
      r.percentage,
      r.submittedAt
    ])
  ];

  const csv = rows
    .map(row =>
      row
        .map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"')
        .join(',')
    )
    .join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="exam-saathi-results.csv"'
  );

  res.send('\uFEFF' + csv);
});

// ---------- Standalone HTML tests ----------
// This route only reads the folder. It does NOT create it.
// Ensure public/html-tests/ exists in your repository and contains .html files.
app.get('/api/html-tests', (req, res) => {
  try {
    if (
      !fs.existsSync(HTML_TESTS_DIR) ||
      !fs.statSync(HTML_TESTS_DIR).isDirectory()
    ) {
      return res.json([]);
    }

    const files = fs
      .readdirSync(HTML_TESTS_DIR, { withFileTypes: true })
      .filter(
        entry =>
          entry.isFile() &&
          entry.name.toLowerCase().endsWith('.html')
      )
      .map(entry => entry.name);

    res.json(
      files.map(file => ({
        title: file
          .replace(/\.html$/i, '')
          .replace(/[-_]/g, ' '),
        url: '/html-tests/' + encodeURIComponent(file)
      }))
    );
  } catch (error) {
    console.error('HTML tests listing error:', error);
    res.status(500).json({ error: 'Could not load standalone tests.' });
  }
});

// ---------- Health check ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'Exam Saathi' });
});

// ---------- Homepage fallback ----------
// Keep this after all API routes.
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`Exam Saathi running on port ${PORT}`);
});

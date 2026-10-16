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
  res.sendFile(path.join(ROOT_DIR, 'app.js'))
);

app.get('/admin.html', (req, res) =>
  res.sendFile(path.join(ROOT_DIR, 'admin.html'))
);

app.get('/admin-login.html', (req, res) =>
  res.sendFile(path.join(ROOT_DIR, 'admin-login.html'))
);

app.get('/test1.html', (req, res) =>
  res.sendFile(path.join(ROOT_DIR, 'test1.html'))
);

app.get('/styles.css', (req, res) => {
  const cssPath = path.join(ROOT_DIR, 'styles.css');

  if (fs.existsSync(cssPath)) {
    return res.sendFile(cssPath);
  }

  res.type('text/css').send('');
});

// Student registration
app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const password = String(req.body.password || '');

  if (!name || !password) {
    return res.status(400).json({
      error: 'नाम और पासवर्ड आवश्यक हैं।'
    });
  }

  if (name.length > 80) {
    return res.status(400).json({
      error: 'नाम 80 अक्षरों से छोटा रखें।'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: 'पासवर्ड कम-से-कम 6 अक्षरों का रखें।'
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO students (name, password) VALUES (?, ?)',
      [name, hashedPassword],
      function (err) {
        if (err) {
          if (err.message && err.message.includes('UNIQUE')) {
            return res.status(409).json({
              error: 'यह नाम पहले से रजिस्टर्ड है। लॉगिन विकल्प चुनें।'
            });
          }

          console.error('Register DB error:', err.message);

          return res.status(500).json({
            error: 'डेटाबेस त्रुटि।'
          });
        }

        req.session.studentId = this.lastID;
        req.session.studentName = name;
        req.session.isAdmin = false;

        return saveSession(req, res, {
          success: true,
          user: {
            id: this.lastID,
            name
          }
        });
      }
    );
  } catch (err) {
    console.error('Register error:', err);

    res.status(500).json({
      error: 'सर्वर त्रुटि।'
    });
  }
});

// Student login
app.post('/api/auth/login', (req, res) => {
  const name = String(req.body.name || '').trim();
  const password = String(req.body.password || '');

  if (!name || !password) {
    return res.status(400).json({
      error: 'नाम और पासवर्ड आवश्यक हैं।'
    });
  }

  db.get(
    'SELECT * FROM students WHERE name = ?',
    [name],
    async (err, student) => {
      if (err) {
        console.error('Login DB error:', err.message);

        return res.status(500).json({
          error: 'डेटाबेस त्रुटि।'
        });
      }

      if (!student) {
        return res.status(400).json({
          error: 'अमान्य नाम या पासवर्ड।'
        });
      }

      try {
        const match = await bcrypt.compare(
          password,
          student.password
        );

        if (!match) {
          return res.status(400).json({
            error: 'अमान्य नाम या पासवर्ड।'
          });
        }

        req.session.regenerate((sessionErr) => {
          if (sessionErr) {
            return res.status(500).json({
              error: 'सेशन शुरू नहीं हो पाया।'
            });
          }

          req.session.studentId = student.id;
          req.session.studentName = student.name;
          req.session.isAdmin = false;

          return saveSession(req, res, {
            success: true,
            user: {
              id: student.id,
              name: student.name
            }
          });
        });
      } catch (compareErr) {
        console.error('Password compare error:', compareErr);

        res.status(500).json({
          error: 'लॉगिन में सर्वर त्रुटि।'
        });
      }
    }
  );
});

// Student logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        error: 'लॉगआउट नहीं हो पाया।'
      });
    }

    res.clearCookie('connect.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    res.json({ success: true });
  });
});

// Current student
app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.studentId) {
    return res.json({
      user: {
        id: req.session.studentId,
        name: req.session.studentName
      }
    });
  }

  res.status(401).json({
    error: 'लॉगिन आवश्यक है।'
  });
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const username = String(req.body.username || '');
  const password = String(req.body.password || '');

  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

  if (username !== adminUser || password !== adminPass) {
    return res.status(401).json({
      error: 'अमान्य एडमिन यूज़रनेम या पासवर्ड।'
    });
  }

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({
        error: 'एडमिन सेशन शुरू नहीं हो पाया।'
      });
    }

    req.session.isAdmin = true;
    req.session.studentId = null;

    saveSession(req, res, { success: true });
  });
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  if (!req.session) {
    return res.json({ success: true });
  }

  req.session.isAdmin = false;

  req.session.save((err) => {
    if (err) {
      return res.status(500).json({
        error: 'लॉगआउट नहीं हो पाया।'
      });
    }

    res.json({ success: true });
  });
});

// List HTML tests for the student's existing Tests section
app.get('/api/html-tests', requireStudent, (req, res) => {
  fs.readdir(HTML_TESTS_DIR, (err, files) => {
    if (err) {
      console.error('HTML test list error:', err.message);
      return res.json([]);
    }

    const htmlFiles = files
      .filter((file) => {
        if (path.extname(file).toLowerCase() !== '.html') {
          return false;
        }

        try {
          return fs.statSync(
            path.join(HTML_TESTS_DIR, file)
          ).isFile();
        } catch {
          return false;
        }
      })
      .sort((a, b) => a.localeCompare(b))
      
.map((file) => {
  const match = file.match(/^(math|hindi|reasoning)__(.+)\.html$/i);

  const subjectMap = {
    math: 'गणित',
    hindi: 'हिंदी',
    reasoning: 'रीजनिंग'
  };

  const subject = match ? subjectMap[match[1].toLowerCase()] : 'all';
  const displayName = match ? match[2] : file.replace(/\.html$/i, '');

  return {
    name: displayName
      .replace(/[-_]+/g, ' ')
      .trim(),
    filename: file,
    subject,
    url: `/html-tests/${encodeURIComponent(file)}`
  };
});

    res.json(htmlFiles);
  });
});

// Upload individual HTML tests directly
const htmlUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, HTML_TESTS_DIR);
    },

    filename: (req, file, cb) => {
      const original = path.basename(
        file.originalname || 'test.html'
      );

      const base = path.basename(
        original,
        path.extname(original)
      )
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'test';

      cb(null, `${base}-${Date.now()}.html`);
    }
  }),

  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1
  },

  fileFilter: (req, file, cb) => {
    if (
      path.extname(file.originalname || '').toLowerCase() !== '.html'
    ) {
      return cb(new Error('केवल .html फ़ाइल अपलोड करें।'));
    }

    cb(null, true);
  }
});

app.post('/api/admin/upload-html', requireAdmin, (req, res) => {
  htmlUpload.single('htmlTest')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        error: err.message || 'HTML फ़ाइल अपलोड नहीं हो पाई।'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'कृपया .html फ़ाइल चुनें।'
      });
    }

    
const allowedSubjects = ['गणित', 'हिंदी', 'रीजनिंग'];
const subject = allowedSubjects.includes(req.body.subject)
  ? req.body.subject
  : 'गणित';

const prefix = {
  'गणित': 'math',
  'हिंदी': 'hindi',
  'रीजनिंग': 'reasoning'
}[subject];

const newFilename = `${prefix}__${req.file.filename}`;
const newPath = path.join(HTML_TESTS_DIR, newFilename);



    
fs.rename(req.file.path, newPath, (renameErr) => {
  if (renameErr) {
    console.error(renameErr);
    return res.status(500).json({
      error: 'फ़ाइल सेव नहीं हो पाई।'
    });
  }

  fs.readFile(newPath, 'utf8', (readErr, html) => {
    if (readErr) {
      return res.status(500).json({
        error: 'HTML टेस्ट पढ़ा नहीं जा सका।'
      });
    }

    const reportScript = `
<script>
(function () {
  const originalFetch = window.fetch.bind(window);

  function saveHtmlTestResult(score, maxScore) {
    if (window.__examSaathiSaved) return;
    window.__examSaathiSaved = true;

    originalFetch('/api/html-tests/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        score: score,
        maxScore: maxScore,
        subject: ${JSON.stringify(subject)}
      })
    }).catch(function () {
      window.__examSaathiSaved = false;
    });
  }

  function inspectResult() {
    const box = document.getElementById('result-box');
    if (!box || box.hidden || box.style.display === 'none') return;

    const text = box.innerText || box.textContent || '';
    const match = text.match(/स्कोर\\s*:\\s*(-?\\d+)\\s*\\/\\s*(\\d+)/i);

    if (match) {
      saveHtmlTestResult(Number(match[1]), Number(match[2]));
    }
  }

  new MutationObserver(inspectResult).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true
  });

  document.addEventListener('click', function () {
    setTimeout(inspectResult, 300);
  });
})();
</script>`;

    const updatedHtml = /<\/body\s*>/i.test(html)
  ? html.replace(/<\/body\s*>/i, reportScript + '</body>')
      : html + reportScript;

    fs.writeFile(newPath, updatedHtml, 'utf8', (writeErr) => {
      if (writeErr) {
        return res.status(500).json({
          error: 'HTML टेस्ट अपडेट नहीं हो पाया।'
        });
      }

      res.json({
        success: true,
        message: 'HTML टेस्ट अपलोड हो गया।',
        filename: newFilename,
        subject,
        url: '/html-tests/' + encodeURIComponent(newFilename)
          });
  });
});
  });
});
 }); 
});

// Published database tests
app.get('/api/tests', requireStudent, (req, res) => {
  db.all(
    `SELECT id, title, subject, duration, marks_correct, marks_incorrect
     FROM tests
     WHERE published = 1
     ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: 'डेटाबेस त्रुटि।'
        });
      }

      res.json(rows || []);
    }
  );
});


// Published database tests
app.get('/api/tests', requireStudent, (req, res) => {
  db.all(
    `SELECT id, title, subject, duration, marks_correct, marks_incorrect
     FROM tests
     WHERE published = 1
     ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: 'डेटाबेस त्रुटि।'
        });
      }

      res.json(rows || []);
    }
  );
});

// Questions for one published test
app.get('/api/tests/:id', requireStudent, (req, res) => {
  db.get(
    'SELECT * FROM tests WHERE id = ? AND published = 1',
    [req.params.id],
    (err, test) => {
      if (err || !test) {
        return res.status(404).json({
          error: 'टेस्ट नहीं मिला।'
        });
      }

      db.all(
        `SELECT id, question, option_a, option_b, option_c, option_d
         FROM questions WHERE test_id = ?`,
        [req.params.id],
        (qErr, questions) => {
          if (qErr) {
            return res.status(500).json({
              error: 'डेटाबेस त्रुटि।'
            });
          }

          res.json({
            test,
            questions: questions || []
          });
        }
      );
    }
  );
});

// Submit database test and save result
app.post('/api/tests/submit', requireStudent, (req, res) => {
  const testId = Number(req.body.test_id);

  const answers =
    req.body.answers && typeof req.body.answers === 'object'
      ? req.body.answers
      : {};

  if (!Number.isInteger(testId) || testId < 1) {
    return res.status(400).json({
      error: 'अमान्य टेस्ट।'
    });
  }

  db.get(
    'SELECT * FROM tests WHERE id = ? AND published = 1',
    [testId],
    (err, test) => {
      if (err || !test) {
        return res.status(404).json({
          error: 'अमान्य टेस्ट।'
        });
      }

      db.all(
        'SELECT * FROM questions WHERE test_id = ?',
        [testId],
        (qErr, questions) => {
          if (qErr) {
            return res.status(500).json({
              error: 'डेटाबेस त्रुटि।'
            });
          }

          let score = 0;
          let correctCount = 0;
          let incorrectCount = 0;
          let unansweredCount = 0;

          const plus = Number(test.marks_correct) || 2;
          const minus = Number(test.marks_incorrect) || 1;

          (questions || []).forEach((q) => {
            const userAns = answers[q.id];

            if (!userAns) {
              unansweredCount++;
            } else if (
              String(userAns).toUpperCase() ===
              String(q.correct_answer).toUpperCase()
            ) {
              score += plus;
              correctCount++;
            } else {
              score -= minus;
              incorrectCount++;
            }
          });

          const maxScore = (questions || []).length * plus;

          const percentage = maxScore > 0
            ? Number(((score / maxScore) * 100).toFixed(1))
            : 0;

          db.run(
            `INSERT INTO results
             (student_id, student_name, test_id, subject, score,
              correct_count, incorrect_count, unanswered_count, percentage)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              req.session.studentId,
              req.session.studentName,
              testId,
              test.subject,
              score,
              correctCount,
              incorrectCount,
              unansweredCount,
              percentage
            ],
            function (saveErr) {
              if (saveErr) {
                console.error('Result save error:', saveErr.message);

                return res.status(500).json({
                  error: 'रिज़ल्ट सेव नहीं हो पाया।'
                });
              }

              res.json({
                success: true,
                score,
                maxScore,
                percentage,
                correct_count: correctCount,
                incorrect_count: incorrectCount,
                unanswered_count: unansweredCount
              });
            }
          );
        }
      );
    }
  );
});
// Save uploaded HTML test result
app.post('/api/html-tests/submit', requireStudent, (req, res) => {
  const score = Number(req.body.score);
  const maxScore = Number(req.body.maxScore);
  const subject = String(req.body.subject || 'सामान्य ज्ञान');

  if (
    !Number.isFinite(score) ||
    !Number.isFinite(maxScore) ||
    maxScore <= 0 ||
    score < 0 ||
    score > maxScore
  ) {
    return res.status(400).json({
      error: 'स्कोर सही नहीं है।'
    });
  }

  const percentage = Math.round((score / maxScore) * 100);

  db.run(
    `INSERT INTO results
    (student_id, student_name, test_id, subject, score,
     correct_count, incorrect_count, unanswered_count, percentage)
    VALUES (?, ?, NULL, ?, ?, 0, 0, 0, ?)`,
    [
      req.session.studentId,
      req.session.studentName || 'विद्यार्थी',
      subject,
      score,
      percentage
    ],
    function (err) {
      if (err) {
        return res.status(500).json({
          error: 'परिणाम सेव नहीं हुआ।'
        });
      }

      res.json({
        success: true,
        resultId: this.lastID
      });
    }
  );
});
// Student's results
app.get('/api/my-results', requireStudent, (req, res) => {
  db.all(
    'SELECT * FROM results WHERE student_id = ? ORDER BY created_at DESC',
    [req.session.studentId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: 'डेटाबेस त्रुटि।'
        });
      }

      res.json(rows || []);
    }
  );
});

// Leaderboard
app.get('/api/leaderboard', requireStudent, (req, res) => {
  const type = req.query.type || 'overall';

  const query = type === 'overall'
    ? `SELECT student_name, SUM(score) AS total_score,
       COUNT(*) AS attempts
       FROM results GROUP BY student_name
       ORDER BY total_score DESC LIMIT 50`
    : `SELECT student_name, SUM(score) AS total_score,
       COUNT(*) AS attempts
       FROM results WHERE subject = ?
       GROUP BY student_name
       ORDER BY total_score DESC LIMIT 50`;

  db.all(
    query,
    type === 'overall' ? [] : [type],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: 'डेटाबेस त्रुटि।'
        });
      }

      res.json(rows || []);
    }
  );
});

// Admin dashboard data
app.get('/api/admin/data', requireAdmin, (req, res) => {
  db.get(
    'SELECT COUNT(*) AS count FROM students',
    [],
    (sErr, studentRow) => {
      if (sErr) {
        return res.status(500).json({
          error: 'डेटाबेस त्रुटि।'
        });
      }

      db.all(
        'SELECT * FROM tests ORDER BY created_at DESC',
        [],
        (tErr, tests) => {
          if (tErr) {
            return res.status(500).json({
              error: 'डेटाबेस त्रुटि।'
            });
          }

          db.all(
            'SELECT * FROM results ORDER BY created_at DESC',
            [],
            (rErr, results) => {
              if (rErr) {
                return res.status(500).json({
                  error: 'डेटाबेस त्रुटि।'
                });
              }

              res.json({
                studentCount: studentRow ? studentRow.count : 0,
                tests: tests || [],
                results: results || []
              });
            }
          );
        }
      );
    }
  );
});

// Create a database-based test
app.post('/api/admin/tests', requireAdmin, (req, res) => {
  const title = String(req.body.title || '').trim();
  const subject = String(req.body.subject || 'गणित').trim();
  const duration = Math.max(
    1,
    Math.min(300, Number(req.body.duration) || 20)
  );

  if (!title) {
    return res.status(400).json({
      error: 'टेस्ट का नाम आवश्यक है।'
    });
  }

  db.run(
    'INSERT INTO tests (title, subject, duration, published) VALUES (?, ?, ?, 0)',
    [title, subject, duration],
    function (err) {
      if (err) {
        return res.status(500).json({
          error: 'टेस्ट नहीं बन पाया।'
        });
      }

      res.json({
        success: true,
        id: this.lastID
      });
    }
  );
});

// Publish/unpublish test
app.put('/api/admin/tests/:id/publish', requireAdmin, (req, res) => {
  db.run(
    'UPDATE tests SET published = ? WHERE id = ?',
    [req.body.published ? 1 : 0, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({
          error: 'टेस्ट अपडेट नहीं हुआ।'
        });
      }

      if (!this.changes) {
        return res.status(404).json({
          error: 'टेस्ट नहीं मिला।'
        });
      }

      res.json({ success: true });
    }
  );
});

// Delete database test and its questions
app.delete('/api/admin/tests/:id', requireAdmin, (req, res) => {
  db.serialize(() => {
    db.run(
      'DELETE FROM questions WHERE test_id = ?',
      [req.params.id]
    );

    db.run(
      'DELETE FROM tests WHERE id = ?',
      [req.params.id],
      function (err) {
        if (err) {
          return res.status(500).json({
            error: 'टेस्ट हटाया नहीं जा सका।'
          });
        }

        if (!this.changes) {
          return res.status(404).json({
            error: 'टेस्ट नहीं मिला।'
          });
        }

        res.json({ success: true });
      }
    );
  });
});

// Add a question
app.post('/api/admin/questions', requireAdmin, (req, res) => {
  const {
    test_id,
    question,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_answer,
    explanation
  } = req.body;

  if (
    !test_id ||
    !question ||
    !option_a ||
    !option_b ||
    !option_c ||
    !option_d ||
    !['A', 'B', 'C', 'D'].includes(
      String(correct_answer).toUpperCase()
    )
  ) {
    return res.status(400).json({
      error: 'सभी प्रश्न विकल्प और सही उत्तर भरें।'
    });
  }

  db.run(
    `INSERT INTO questions
     (test_id, question, option_a, option_b, option_c, option_d,
      correct_answer, explanation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      test_id,
      question,
      option_a,
      option_b,
      option_c,
      option_d,
      String(correct_answer).toUpperCase(),
      explanation || ''
    ],
    (err) => {
      if (err) {
        return res.status(500).json({
          error: 'प्रश्न सेव नहीं हुआ।'
        });
      }

      res.json({ success: true });
    }
  );
});

// ZIP upload (kept for compatibility with the existing admin page)
const zipUpload = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname || '').toLowerCase() !== '.zip') {
      return cb(new Error('केवल ZIP फ़ाइल अपलोड करें।'));
    }

    cb(null, true);
  }
}).single('testZip');

app.post('/api/admin/upload-zip', requireAdmin, (req, res) => {
  zipUpload(req, res, (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({
        error: uploadErr.message || 'ZIP अपलोड नहीं हो पाई।'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'कोई ZIP फ़ाइल अपलोड नहीं की गई।'
      });
    }

    const tempPath = req.file.path;
    const subject = String(req.body.subject || 'गणित');
    const duration = Math.max(
      1,
      Math.min(300, Number(req.body.duration) || 20)
    );

    try {
      const zip = new AdmZip(tempPath);
      let questionsData = null;

      for (const entry of zip.getEntries()) {
        if (path.posix.basename(entry.entryName) === 'questions.json') {
          questionsData = JSON.parse(
            entry.getData().toString('utf8')
          );
          break;
        }
      }

      if (!Array.isArray(questionsData) || !questionsData.length) {
        fs.unlink(tempPath, () => {});

        return res.status(400).json({
          error: 'ZIP में वैध questions.json नहीं मिला।'
        });
      }

      const valid = questionsData.every((q) =>
        q &&
        q.question &&
        q.option_a &&
        q.option_b &&
        q.option_c &&
        q.option_d &&
        ['A', 'B', 'C', 'D'].includes(
          String(q.correct_answer || 'A').toUpperCase()
        )
      );

      if (!valid) {
        fs.unlink(tempPath, () => {});

        return res.status(400).json({
          error: 'questions.json में कुछ प्रश्न या विकल्प अधूरे हैं।'
        });
      }

      const title = 'इम्पोर्टेड मॉक टेस्ट - ' +
        Date.now().toString().slice(-6);

      db.run(
        'INSERT INTO tests (title, subject, duration, published) VALUES (?, ?, ?, 0)',
        [title, subject, duration],
        function (err) {
          if (err) {
            fs.unlink(tempPath, () => {});

            return res.status(500).json({
              error: 'टेस्ट बनाने में डेटाबेस त्रुटि।'
            });
          }

          const testId = this.lastID;

          db.serialize(() => {
            const stmt = db.prepare(
              `INSERT INTO questions
               (test_id, question, option_a, option_b, option_c,
                option_d, correct_answer, explanation)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            );

            let failed = false;

            questionsData.forEach((q) => {
              stmt.run(
                [
                  testId,
                  q.question,
                  q.option_a,
                  q.option_b,
                  q.option_c,
                  q.option_d,
                  String(q.correct_answer || 'A').toUpperCase(),
                  q.explanation || ''
                ],
                (insertErr) => {
                  if (insertErr) failed = true;
                }
              );
            });

            stmt.finalize((finalErr) => {
              fs.unlink(tempPath, () => {});

              if (failed || finalErr) {
                return res.status(500).json({
                  error: 'प्रश्न सेव करने में त्रुटि।'
                });
              }

              res.json({
                success: true,
                testId,
                title
              });
            });
          });
        }
      );
    } catch (err) {
      fs.unlink(tempPath, () => {});
      console.error('ZIP import error:', err);

      res.status(400).json({
        error: 'ZIP प्रोसेसिंग त्रुटि। सही ZIP फ़ाइल चुनें।'
      });
    }
  });
});

// Export results as CSV
app.get('/api/admin/results/csv', requireAdmin, (req, res) => {
  db.all(
    'SELECT * FROM results ORDER BY created_at DESC',
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).send('Database error');
      }

      const quote = (value) =>
        `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;

      let csv =
        'ID,Student Name,Test ID,Subject,Score,Correct,Incorrect,Unanswered,Percentage,Date\n';

      (rows || []).forEach((r) => {
        csv += [
          r.id,
          quote(r.student_name),
          r.test_id,
          quote(r.subject || 'गणित'),
          r.score,
          r.correct_count,
          r.incorrect_count,
          r.unanswered_count,
          `${r.percentage}%`,
          quote(r.created_at)
        ].join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="test-with-ankita-results.csv"'
      );

      res.send('\uFEFF' + csv);
    }
  );
});

// Final error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);

  if (res.headersSent) return next(err);

  res.status(500).json({
    error: 'सर्वर में समस्या आई। कृपया बाद में प्रयास करें।'
  });
});

app.listen(PORT, () => {
  console.log(`Test with Ankita server running on port ${PORT}`);
});

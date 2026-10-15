
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const AdmZip = require('adm-zip');

constconst upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    }
}); app = express();
const PORT = process.env.PORT || 3000;

// Database Setup
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to SQLite database.');
});

// Initialize Tables
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
        duration INTEGER DEFAULT 20,
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
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', dir: './data' }),
    secret: process.env.SESSION_SECRET || 'test-with-ankita-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, secure: false }
}));

// Auth Middleware
function requireStudent(req, res, next) {
    if (req.session && req.session.studentId) {
        next();
    } else {
        res.status(401).json({ error: 'लॉगिन आवश्यक है (Unauthorized)' });
    }
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ error: 'एडमिन लॉगिन आवश्यक है' });
    }
}

// ----------------- API ROUTES ----------------- //

// Student Auth
app.post('/api/auth/register', async (req, res) => {
    const { name, password } = req.body;
    if (!name || !password) {
        return res.status(400).json({ error: 'नाम और पासवर्ड आवश्यक हैं' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO students (name, password) VALUES (?, ?)`, [name, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'यह नाम पहले से रजिस्टर्ड है। कृपया दूसरा नाम चुनें।' });
                }
                return res.status(500).json({ error: 'डेटाबेस त्रुटि' });
            }
            req.session.studentId = this.lastID;
            req.session.studentName = name;
            res.json({ success: true, user: { id: this.lastID, name } });
        });
    } catch(e) {
        res.status(500).json({ error: 'सर्वर त्रुटि' });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { name, password } = req.body;
    db.get(`SELECT * FROM students WHERE name = ?`, [name], async (err, student) => {
        if (err || !student) {
            return res.status(400).json({ error: 'अमान्य नाम या पासवर्ड' });
        }
        const match = await bcrypt.compare(password, student.password);
        if (match) {
            req.session.studentId = student.id;
            req.session.studentName = student.name;
            res.json({ success: true, user: { id: student.id, name: student.name } });
        } else {
            res.status(400).json({ error: 'अमान्य नाम या पासवर्ड' });
        }
    });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.studentId) {
        res.json({ user: { id: req.session.studentId, name: req.session.studentName } });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Admin Auth
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === adminUser && password === adminPass) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'अमान्य एडमिन क्रेडेंशियल्स' });
    }
});

app.post('/api/admin/logout', (req, res) => {
    req.session.isAdmin = false;
    res.json({ success: true });
});

// HTML Tests API (Requirement 5)
// Admin HTML Test Upload
app.post('/api/admin/html-tests', requireAdmin, (req, res) => {
    const { title, filename, html } = req.body || {};

    if (!title || !filename || typeof html !== 'string') {
        return res.status(400).json({ error: 'टेस्ट का नाम और HTML फ़ाइल आवश्यक है।' });
    }

    if (!filename.toLowerCase().endsWith('.html')) {
        return res.status(400).json({ error: 'केवल HTML फ़ाइल स्वीकार है।' });
    }

    if (Buffer.byteLength(html, 'utf8') > 1500000) {
        return res.status(413).json({ error: 'फ़ाइल बहुत बड़ी है। छोटी HTML फ़ाइल चुनें।' });
    }

    const safeName = filename
        .replace(/\.html$/i, '')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 60) || 'test';

    const htmlTestsDir = path.join(__dirname, 'html-tests');

    fs.mkdir(htmlTestsDir, { recursive: true }, (dirErr) => {
        if (dirErr) {
            return res.status(500).json({ error: 'फ़ोल्डर नहीं बन पाया।' });
        }

        const filePath = path.join(
            htmlTestsDir,
            `${Date.now()}-${safeName}.html`
        );

        fs.writeFile(filePath, html, 'utf8', (err) => {
            if (err) {
                return res.status(500).json({ error: 'फ़ाइल सेव नहीं हुई।' });
            }

            res.json({
                success: true,
                message: 'HTML फ़ाइल सेव हो गई।',
                title
            });
        });
    });
});
app.get('/api/html-tests', (req, res) => {
    const htmlTestsDir = path.join(__dirname, 'html-tests');
    fs.readdir(htmlTestsDir, (err, files) => {
        if (err) {
            return res.json([]);
        }
        const htmlFiles = files
            .filter(file => file.endsWith('.html'))
            .map(file => ({
                name: file.replace('.html', '').replace(/[-_]/g, ' ').toUpperCase(),
                filename: file,
                url: `/html-tests/${file}`
            }));
        res.json(htmlFiles);
    });
});

// Published Tests (Student)
app.get('/api/tests', requireStudent, (req, res) => {
    db.all(`SELECT id, title, duration FROM tests WHERE published = 1`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(rows);
    });
});

// Get Test Details & Questions
app.get('/api/tests/:id', requireStudent, (req, res) => {
    const testId = req.params.id;
    db.get(`SELECT * FROM tests WHERE id = ? AND published = 1`, [testId], (err, test) => {
        if (err || !test) return res.status(404).json({ error: 'टेस्ट नहीं मिला' });
        db.all(`SELECT id, question, option_a, option_b, option_c, option_d FROM questions WHERE test_id = ?`, [testId], (err, questions) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ test, questions });
        });
    });
});

// Submit Test & Calculate Score securely (+2, -1, 0)
app.post('/api/tests/submit', requireStudent, (req, res) => {
    const { test_id, answers } = req.body;
    const studentId = req.session.studentId;
    const studentName = req.session.studentName;

    db.get(`SELECT * FROM tests WHERE id = ? AND published = 1`, [test_id], (err, test) => {
        if (err || !test) return res.status(404).json({ error: 'अमान्य टेस्ट' });

        db.all(`SELECT * FROM questions WHERE test_id = ?`, [test_id], (err, questions) => {
            if (err) return res.status(500).json({ error: 'DB error' });

            let score = 0;
            let correctCount = 0;
            let incorrectCount = 0;
            let unansweredCount = 0;
            const detailedResults = [];

            questions.forEach(q => {
                const userAns = answers[q.id];
                const correctAnswer = q.correct_answer;
                let isCorrect = false;

                if (!userAns) {
                    unansweredCount++;
                } else if (userAns === correctAnswer) {
                    score += 2;
                    correctCount++;
                    isCorrect = true;
                } else {
                    score -= 1;
                    incorrectCount++;
                }

                detailedResults.push({
                    question: q.question,
                    userAnswer: userAns,
                    correctAnswer: correctAnswer,
                    isCorrect: isCorrect,
                    explanation: q.explanation
                });
            });

            const maxScore = questions.length * 2;
            const percentage = maxScore > 0 ? ((score / maxScore) * 100).toFixed(1) : 0;

            db.run(
                `INSERT INTO results (student_id, student_name, test_id, score, correct_count, incorrect_count, unanswered_count, percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [studentId, studentName, test_id, score, correctCount, incorrectCount, unansweredCount, percentage],
                function(err) {
                    if (err) console.error(err);
                    res.json({
                        success: true,
                        score,
                        maxScore,
                        percentage,
                        correct_count: correctCount,
                        incorrect_count: incorrectCount,
                        unanswered_count: unansweredCount,
                        detailedResults
                    });
                }
            );
        });
    });
});

// Student Results History
app.get('/api/my-results', requireStudent, (req, res) => {
    const studentId = req.session.studentId;
    db.all(`SELECT * FROM results WHERE student_id = ? ORDER BY created_at DESC`, [studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(rows);
    });
});

// ----------------- ADMIN API ROUTES ----------------- //

app.get('/api/admin/data', requireAdmin, (req, res) => {
    db.get(`SELECT COUNT(*) as count FROM students`, [], (err, studentRow) => {
        db.all(`SELECT * FROM tests ORDER BY created_at DESC`, [], (err, tests) => {
            db.all(`SELECT * FROM results ORDER BY created_at DESC`, [], (err, results) => {
                res.json({
                    studentCount: studentRow ? studentRow.count : 0,
                    tests,
                    results
                });
            });
        });
    });
});

app.post('/api/admin/tests', requireAdmin, (req, res) => {
    const { title, duration } = req.body;
    db.run(`INSERT INTO tests (title, duration, published) VALUES (?, ?, 0)`, [title, duration || 20], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/admin/tests/:id/publish', requireAdmin, (req, res) => {
    const testId = req.params.id;
    const { published } = req.body;
    db.run(`UPDATE tests SET published = ? WHERE id = ?`, [published ? 1 : 0, testId], (err) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json({ success: true });
    });
});

app.delete('/api/admin/tests/:id', requireAdmin, (req, res) => {
    const testId = req.params.id;
    db.run(`DELETE FROM tests WHERE id = ?`, [testId], (err) => {
        db.run(`DELETE FROM questions WHERE test_id = ?`, [testId], () => {
            res.json({ success: true });
        });
    });
});

app.post('/api/admin/questions', requireAdmin, (req, res) => {
    const { test_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation } = req.body;
    db.run(
        `INSERT INTO questions (test_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [test_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation],
        (err) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ success: true });
        }
    );
});

// CSV Export for Results
app.get('/api/admin/results/csv', requireAdmin, (req, res) => {
    db.all(`SELECT * FROM results ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).send('DB error');
        let csv = 'ID,Student Name,Test ID,Score,Correct,Incorrect,Unanswered,Percentage,Date\n';
        rows.forEach(r => {
            csv += `${r.id},"${r.student_name}",${r.test_id},${r.score},${r.correct_count},${r.incorrect_count},${r.unanswered_count},${r.percentage}%,"${r.created_at}"\n`;
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="test-with-ankita-results.csv"');
        res.send(csv);
    });
});

app.listen(PORT, () => {
    console.log(`Exam Saathi server running on port ${PORT}`);
});

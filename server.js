const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'exam-saathi.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ students: [], tests: [], results: [] }, null, 2));
function readDB() { try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return { students: [], tests: [], results: [] }; } }
function writeDB(db) { const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, DB_FILE); }
const adminUser = process.env.ADMIN_USERNAME || 'admin';
const adminPass = process.env.ADMIN_PASSWORD || '';
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(session({ secret: process.env.SESSION_SECRET || 'development-only-change-me', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 } }));
app.use(express.static(path.join(__dirname, 'public')));
const id = () => require('crypto').randomUUID();
const safeTest = t => ({ id: t.id, title: t.title, description: t.description || '', subject: t.subject || 'General', duration: t.duration, published: !!t.published, mode: t.mode || 'mock', questionCount: (t.questions || []).length, createdAt: t.createdAt });
const studentOnly = (req, res, next) => req.session.studentId ? next() : res.status(401).json({ error: 'Please log in as a student.' });
const adminOnly = (req, res, next) => req.session.isAdmin ? next() : res.status(401).json({ error: 'Admin login required.' });

app.get('/api/session', (req, res) => res.json({ student: req.session.studentId ? readDB().students.find(s => s.id === req.session.studentId) && (({ id, name, username }) => ({ id, name, username }))(readDB().students.find(s => s.id === req.session.studentId)) : null, admin: !!req.session.isAdmin }));
app.post('/api/student/register', async (req, res) => {
  const name = String(req.body.name || '').trim(), username = String(req.body.username || '').trim().toLowerCase(), password = String(req.body.password || '');
  if (name.length < 2 || username.length < 3 || password.length < 8) return res.status(400).json({ error: 'Name, username (3+ characters), and password (8+ characters) are required.' });
  const db = readDB(); if (db.students.some(s => s.username === username)) return res.status(409).json({ error: 'Username already exists.' });
  const student = { id: id(), name, username, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString() }; db.students.push(student); writeDB(db); req.session.studentId = student.id;
  res.json({ id: student.id, name, username });
});
app.post('/api/student/login', async (req, res) => {
  const db = readDB(), username = String(req.body.username || '').trim().toLowerCase(), password = String(req.body.password || '');
  const s = db.students.find(x => x.username === username); if (!s || !(await bcrypt.compare(password, s.passwordHash))) return res.status(401).json({ error: 'Username or password is incorrect.' });
  req.session.studentId = s.id; res.json({ id: s.id, name: s.name, username: s.username });
});
app.post('/api/admin/login', (req, res) => {
  if (!adminPass) return res.status(503).json({ error: 'Set ADMIN_PASSWORD in environment variables before using admin login.' });
  if (String(req.body.username || '') !== adminUser || String(req.body.password || '') !== adminPass) return res.status(401).json({ error: 'Incorrect admin credentials.' });
  req.session.isAdmin = true; res.json({ ok: true });
});
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/tests', (req, res) => { const db = readDB(); res.json(db.tests.filter(t => t.published).map(safeTest)); });
app.get('/api/tests/:testId', (req, res) => { const t = readDB().tests.find(x => x.id === req.params.testId && x.published); if (!t) return res.status(404).json({ error: 'Test not found.' }); res.json({ ...safeTest(t), questions: t.questions.map((q, i) => ({ id: q.id, text: q.text, options: q.options, explanation: q.explanation || '', number: i + 1 })) }); });
app.post('/api/tests/:testId/submit', studentOnly, (req, res) => {
  const db = readDB(), t = db.tests.find(x => x.id === req.params.testId && x.published); if (!t) return res.status(404).json({ error: 'Test not found.' });
  if (db.results.some(r => r.testId === t.id && r.studentId === req.session.studentId && r.attemptKey === req.body.attemptKey)) return res.status(409).json({ error: 'This attempt has already been submitted.' });
  const answers = req.body.answers || {}, details = t.questions.map(q => { const selected = Number.isInteger(answers[q.id]) ? answers[q.id] : null; const correct = selected === q.correctIndex; return { questionId: q.id, text: q.text, selectedIndex: selected, correctIndex: q.correctIndex, correct, explanation: q.explanation || '' }; });
  const score = details.filter(x => x.correct).length, result = { id: id(), testId: t.id, testTitle: t.title, studentId: req.session.studentId, answers: details, score, total: t.questions.length, percentage: t.questions.length ? Math.round(score / t.questions.length * 100) : 0, submittedAt: new Date().toISOString(), attemptKey: String(req.body.attemptKey || id()) };
  db.results.push(result); writeDB(db); res.json({ ...result, rank: 1 + db.results.filter(r => r.testId === t.id && (r.score > score || (r.score === score && r.submittedAt < result.submittedAt))).length });
});
app.get('/api/student/me', studentOnly, (req, res) => { const db = readDB(), student = db.students.find(s => s.id === req.session.studentId); res.json({ student: student && { id: student.id, name: student.name, username: student.username }, results: db.results.filter(r => r.studentId === req.session.studentId).map(r => ({ id: r.id, testId: r.testId, testTitle: r.testTitle, score: r.score, total: r.total, percentage: r.percentage, submittedAt: r.submittedAt })) }); });
app.get('/api/tests/:testId/leaderboard', (req, res) => { const db = readDB(), t = db.tests.find(x => x.id === req.params.testId && x.published); if (!t) return res.status(404).json({ error: 'Test not found.' }); const top = db.results.filter(r => r.testId === t.id).sort((a,b) => b.score-a.score || new Date(a.submittedAt)-new Date(b.submittedAt)).slice(0,10).map((r,i) => ({ rank:i+1, name: db.students.find(s=>s.id===r.studentId)?.name || 'Student', score:r.score, total:r.total, percentage:r.percentage })); res.json(top); });
app.get('/api/admin/tests', adminOnly, (req,res) => res.json(readDB().tests.map(t => ({...safeTest(t), questions:t.questions.map(q=>({...q}))}))));
app.post('/api/admin/tests', adminOnly, (req,res) => { const title=String(req.body.title||'').trim(), duration=Number(req.body.duration); if (!title || !Number.isFinite(duration) || duration < 1 || duration > 600) return res.status(400).json({error:'Title and duration (1–600 minutes) are required.'}); const db=readDB(), t={id:id(), title, description:String(req.body.description||''), subject:String(req.body.subject||'General'), duration, published:false, mode:req.body.mode==='practice'?'practice':'mock', questions:[], createdAt:new Date().toISOString()}; db.tests.push(t); writeDB(db); res.json(safeTest(t)); });
app.put('/api/admin/tests/:testId', adminOnly, (req,res) => { const db=readDB(), t=db.tests.find(x=>x.id===req.params.testId); if(!t) return res.status(404).json({error:'Test not found.'}); for(const k of ['title','description','subject']) if(req.body[k]!==undefined) t[k]=String(req.body[k]).trim(); if(req.body.duration!==undefined){const d=Number(req.body.duration); if(!Number.isFinite(d)||d<1||d>600)return res.status(400).json({error:'Duration must be 1–600 minutes.'}); t.duration=d;} if(req.body.mode!==undefined)t.mode=req.body.mode==='practice'?'practice':'mock'; writeDB(db); res.json(safeTest(t)); });
app.post('/api/admin/tests/:testId/questions', adminOnly, (req,res) => { const db=readDB(), t=db.tests.find(x=>x.id===req.params.testId); if(!t)return res.status(404).json({error:'Test not found.'}); const text=String(req.body.text||'').trim(), options=Array.isArray(req.body.options)?req.body.options.map(x=>String(x).trim()):[], correctIndex=Number(req.body.correctIndex); if(!text||options.length<2||options.some(x=>!x)||!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>=options.length)return res.status(400).json({error:'Question, at least 2 options, and a valid correct answer are required.'}); t.questions.push({id:id(),text,options,correctIndex,explanation:String(req.body.explanation||'')}); writeDB(db); res.json(safeTest(t)); });
app.delete('/api/admin/tests/:testId/questions/:questionId', adminOnly, (req,res)=>{const db=readDB(),t=db.tests.find(x=>x.id===req.params.testId);if(!t)return res.status(404).json({error:'Test not found.'});t.questions=t.questions.filter(q=>q.id!==req.params.questionId);writeDB(db);res.json(safeTest(t));});
app.post('/api/admin/tests/:testId/publish', adminOnly, (req,res)=>{const db=readDB(),t=db.tests.find(x=>x.id===req.params.testId);if(!t)return res.status(404).json({error:'Test not found.'});if(req.body.published && !t.questions.length)return res.status(400).json({error:'Add at least one question before publishing.'});t.published=!!req.body.published;writeDB(db);res.json(safeTest(t));});
app.delete('/api/admin/tests/:testId', adminOnly, (req,res)=>{const db=readDB();db.tests=db.tests.filter(t=>t.id!==req.params.testId);writeDB(db);res.json({ok:true});});
app.get('/api/admin/results', adminOnly, (req,res)=>{const db=readDB();res.json(db.results.map(r=>({...r,studentName:db.students.find(s=>s.id===r.studentId)?.name||'Unknown'})));});
app.get('/api/admin/results.csv', adminOnly, (req,res)=>{const db=readDB(), rows=[['Student','Test','Score','Total','Percentage','Submitted'],...db.results.map(r=>[db.students.find(s=>s.id===r.studentId)?.name||'Unknown',r.testTitle,r.score,r.total,r.percentage,r.submittedAt])];const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="exam-saathi-results.csv"');res.send('\uFEFF'+csv);});
// Admin can publish standalone HTML test files placed in public/html-tests/.
app.get('/api/html-tests', (req,res)=>{const dir=path.join(__dirname,'public','html-tests');fs.mkdirSync(dir,{recursive:true});res.json(fs.readdirSync(dir).filter(f=>f.toLowerCase().endsWith('.html')).map(f=>({title:f.replace(/\.html$/i,'').replace(/[-_]/g,' '),url:'/html-tests/'+encodeURIComponent(f)})));});
app.get('/api/health', (req,res)=>res.json({ok:true,service:'Exam Saathi'}));
app.get('*', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, ()=>console.log(`Exam Saathi running on ${PORT}`));

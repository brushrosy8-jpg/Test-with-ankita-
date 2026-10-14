const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
let currentStudent=null, isAdmin=false, authMode='login', activeFilter='all', allTests=[], activeTest=null, answers={}, questionIndex=0, timerId=null, endAt=0, attemptKey='';
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url, opts={}) { const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts}); let d={};try{d=await r.json()}catch{} if(!r.ok) throw new Error(d.error||`Request failed (${r.status})`); return d; }
function openModal(id){$('#'+id).classList.remove('hidden')} function closeModal(id){$('#'+id).classList.add('hidden')}
$$('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close)); $$('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));
$('#year').textContent=new Date().getFullYear(); $('#loginOpen').onclick=()=>{authMode='login';updateAuthMode();openModal('authModal')}; $('#adminOpen').onclick=()=>openModal('adminModal'); $('#logoutBtn').onclick=async()=>{await api('/api/logout',{method:'POST'});currentStudent=null;isAdmin=false;$('#studentArea').classList.add('hidden');$('#logoutBtn').classList.add('hidden');$('#loginOpen').classList.remove('hidden');await refreshTests();};
$$('[data-auth]').forEach(b=>b.onclick=()=>{authMode=b.dataset.auth;updateAuthMode()}); function updateAuthMode(){ $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.auth===authMode)); $('#nameLabel').classList.toggle('hidden',authMode!=='register'); $('#nameLabel input').required=authMode==='register'; $('#studentSubmit').textContent=authMode==='register'?'Create account':'Login'; $('#studentMessage').textContent=''; }
$('#studentForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{currentStudent=await api('/api/student/'+(authMode==='register'?'register':'login'),{method:'POST',body:JSON.stringify(Object.fromEntries(f))});closeModal('authModal');updateStudentArea();}catch(err){$('#studentMessage').textContent=err.message}};
$('#adminForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});isAdmin=true;closeModal('adminModal');openModal('adminPanel');loadAdminTests();}catch(err){$('#adminMessage').textContent=err.message}};
async function init(){try{const s=await api('/api/session');currentStudent=s.student;isAdmin=s.admin;if(currentStudent)updateStudentArea();}catch{}await refreshTests();await loadHtmlTests();}
async function refreshTests(){try{allTests=await api('/api/tests');renderTests();$('#statTests').textContent=allTests.length;$('#leaderboardSelect').innerHTML='<option value="">Choose a test</option>'+allTests.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('');}catch{$('#testGrid').innerHTML='<div class="empty-state">Could not load tests. Please refresh the page.</div>';}}
function renderTests(){
const q = $('#testSearch').value.toLowerCase();

const regular = allTests.filter(t =>
(activeFilter === 'all' || (t.mode || 'mock') === activeFilter) &&
"${t.title} ${t.subject} ${t.description || ''}".toLowerCase().includes(q)
);

const html = (htmlTests || []).filter(t =>
activeFilter === 'all' &&
"${t.title} HTML practice standalone".toLowerCase().includes(q)
);

const regularCards = regular.map(t => "<article class="test-card"> <div class="card-top"> <span class="subject-pill">${esc(t.subject)}</span> <span class="mode-pill">${t.mode === 'practice' ? 'PRACTICE' : 'MOCK TEST'}</span> </div> <h3>${esc(t.title)}</h3> <p>${esc(t.description || 'Build confidence with focused practice and instant feedback.')}</p> <div class="test-meta"> <span>◷ ${t.duration} min</span> <span>☷ ${t.questionCount} questions</span> </div> <button class="btn primary full" onclick="startTest('${t.id}')"> Start test → </button> </article>");

const htmlCards = html.map(t => "<article class="test-card"> <div class="card-top"> <span class="subject-pill">HTML PRACTICE</span> <span class="mode-pill">QUICK TEST</span> </div> <h3>${esc(t.title)}</h3> <p>Standalone practice test hosted with Exam Saathi.</p> <div class="test-meta"> <span>HTML file</span> <span>Opens separately</span> </div> <a class="btn outline full" target="_blank" rel="noopener" href="${esc(t.url)}">Open test ↗</a> </article>");

const items = [...regularCards, ...htmlCards];

$('#testGrid').innerHTML = items.length
? items.join('')
: '<div class="empty-state">No published tests match this search yet.</div>';
}
$('#testSearch').oninput=renderTests; $$('.filter').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;$$('.filter').forEach(x=>x.classList.toggle('active',x===b));renderTests()}); $('#practiceNow').onclick=()=>$('#tests').scrollIntoView({behavior:'smooth'});
async function loadHtmlTests(){try{const list=await api('/api/html-tests');$('#htmlGrid').innerHTML=list.length?list.map(t=>`<article class="test-card"><div class="card-top"><span class="subject-pill">HTML PRACTICE</span><span class="mode-pill">QUICK TEST</span></div><h3>${esc(t.title)}</h3><p>Standalone practice test hosted with Exam Saathi.</p><div class="test-meta"><span>↗ Opens in new tab</span><span>HTML file</span></div><a class="btn outline full" target="_blank" rel="noopener" href="${esc(t.url)}">Open test ↗</a></article>`).join(''):'<div class="empty-state">No standalone HTML tests added yet. Admin: add .html files to <code>public/html-tests/</code> and redeploy.</div>';}catch{$('#htmlGrid').innerHTML='<div class="empty-state">Standalone tests are temporarily unavailable.</div>';}}
window.startTest=async testId=>{if(!currentStudent){closeModal('testModal');openModal('authModal');$('#studentMessage').textContent='Login or create a student account to save your results.';return;}try{activeTest=await api('/api/tests/'+testId);answers={};questionIndex=0;attemptKey=crypto.randomUUID();endAt=Date.now()+activeTest.duration*60000;renderQuestion();openModal('testModal');startTimer();}catch(err){alert(err.message)}};
function startTimer(){clearInterval(timerId);const tick=()=>{const left=Math.max(0,Math.ceil((endAt-Date.now())/1000));const el=$('#examTimer');if(el)el.textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;if(left<=0){clearInterval(timerId);submitTest(true)}};tick();timerId=setInterval(tick,1000)}
function renderQuestion(){const q=activeTest.questions[questionIndex];$('#testStage').innerHTML=`<div class="exam-top"><div><span class="eyebrow">${esc(activeTest.subject)}</span><h2>${esc(activeTest.title)}</h2></div><div class="timer-box"><small>TIME LEFT</small><strong id="examTimer">--:--</strong></div></div><div class="exam-progress"><span>Question ${questionIndex+1} of ${activeTest.questions.length}</span><div><i style="width:${(questionIndex+1)/activeTest.questions.length*100}%"></i></div></div><div class="exam-layout"><section class="question-area"><div class="question-label">QUESTION ${questionIndex+1}</div><h3>${esc(q.text)}</h3><div class="option-list">${q.options.map((o,i)=>`<button class="option ${answers[q.id]===i?'selected':''}" onclick="selectAnswer(${i})"><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${esc(o)}</span><span class="option-check">${answers[q.id]===i?'✓':''}</span></button>`).join('')}</div><div class="question-actions"><button class="btn outline" onclick="clearAnswer()">Clear response</button><button class="btn outline" onclick="markReview()">⚑ Mark for review</button></div><div class="exam-bottom"><button class="btn outline" ${questionIndex===0?'disabled':''} onclick="moveQuestion(-1)">← Previous</button><button class="btn primary" onclick="${questionIndex===activeTest.questions.length-1?'confirmSubmit()':'moveQuestion(1)'}">${questionIndex===activeTest.questions.length-1?'Submit test':'Save & next →'}</button></div></section><aside class="question-palette"><h4>Question palette</h4><p>${Object.keys(answers).length} answered · ${activeTest.questions.length-Object.keys(answers).length} unanswered</p><div class="palette-grid">${activeTest.questions.map((x,i)=>`<button class="palette ${i===questionIndex?'current':''} ${answers[x.id]!==undefined?'answered':''} ${x.review?'review':''}" onclick="goQuestion(${i})">${i+1}</button>`).join('')}</div><div class="palette-legend"><span><i class="legend-answered"></i> Answered</span><span><i class="legend-review"></i> Review</span><span><i class="legend-empty"></i> Unanswered</span></div><button class="btn danger full" onclick="confirmSubmit()">Submit test</button></aside></div>`;}
window.selectAnswer=i=>{answers[activeTest.questions[questionIndex].id]=i;renderQuestion()};window.clearAnswer=()=>{delete answers[activeTest.questions[questionIndex].id];renderQuestion()};window.moveQuestion=d=>{questionIndex=Math.max(0,Math.min(activeTest.questions.length-1,questionIndex+d));renderQuestion()};window.goQuestion=i=>{questionIndex=i;renderQuestion()};window.markReview=()=>{activeTest.questions[questionIndex].review=!activeTest.questions[questionIndex].review;renderQuestion()};window.confirmSubmit=()=>{if(confirm(`Submit this test? You answered ${Object.keys(answers).length} of ${activeTest.questions.length} questions.`))submitTest(false)};
async function submitTest(auto){clearInterval(timerId);try{const result=await api(`/api/tests/${activeTest.id}/submit`,{method:'POST',body:JSON.stringify({answers,attemptKey})});closeModal('testModal');renderResult(result);openModal('resultModal');refreshTests();loadStudentHistory();}catch(err){alert(err.message);if(!auto)startTimer()}}
function renderResult(r){$('#resultStage').innerHTML=`<div class="result-hero"><div class="result-icon">${r.percentage>=70?'🏆':r.percentage>=40?'✦':'↗'}</div><span class="eyebrow">TEST COMPLETED</span><h2>${r.percentage>=70?'Excellent effort!':r.percentage>=40?'Good progress!':'Every attempt helps you grow.'}</h2><p>${esc(r.testTitle)}</p><div class="score-circle"><strong>${r.percentage}%</strong><span>${r.score} / ${r.total} correct</span></div><div class="result-stats"><div><b>${r.score}</b><span>Correct</span></div><div><b>${r.total-r.score}</b><span>Incorrect / skipped</span></div><div><b>#${r.rank||'—'}</b><span>Your rank</span></div></div></div><h3 class="subheading">Review your answers</h3><div class="answer-review">${r.answers.map((a,i)=>`<article class="answer-item"><span class="review-status ${a.correct?'good':'bad'}">${a.correct?'✓':'×'}</span><div><b>Q${i+1}. ${esc(a.text)}</b><p>Your answer: ${a.selectedIndex===null?'Not answered':String.fromCharCode(65+a.selectedIndex)}</p><p>Correct answer: ${String.fromCharCode(65+a.correctIndex)}</p>${a.explanation?`<p class="explanation">${esc(a.explanation)}</p>`:''}</div></article>`).join('')}</div><button class="btn primary full" onclick="closeModal('resultModal')">Back to homepage</button>`}
$('#leaderboardSelect').onchange=async e=>{if(!e.target.value)return $('#leaderboardContent').innerHTML='<div class="empty-state">Choose a test to view its top 10 scores.</div>';try{const rows=await api('/api/tests/'+e.target.value+'/leaderboard');$('#leaderboardContent').innerHTML=rows.length?`<div class="leaderboard-title"><span>RANK</span><span>STUDENT</span><span>SCORE</span></div>`+rows.map(r=>`<div class="leaderboard-row"><b class="rank rank-${r.rank}">${r.rank<=3?['🥇','🥈','🥉'][r.rank-1]:r.rank}</b><span>${esc(r.name)}</span><strong>${r.score}/${r.total} <small>(${r.percentage}%)</small></strong></div>`).join(''):'<div class="empty-state">No submissions yet. Be the first!</div>'}catch(err){$('#leaderboardContent').textContent=err.message}};
function updateStudentArea(){if(!currentStudent)return;$('#studentArea').classList.remove('hidden');$('#studentWelcome').textContent='Welcome, '+currentStudent.name+'!';$('#loginOpen').classList.add('hidden');$('#logoutBtn').classList.remove('hidden');loadStudentHistory()}
async function loadStudentHistory(){if(!currentStudent)return;try{const d=await api('/api/student/me');$('#studentSummary').innerHTML=`<div><strong>${d.results.length}</strong><span>Tests completed</span></div><div><strong>${d.results.length?Math.round(d.results.reduce((s,r)=>s+r.percentage,0)/d.results.length):0}%</strong><span>Average score</span></div><div><strong>${d.results.length?Math.max(...d.results.map(r=>r.percentage)):0}%</strong><span>Personal best</span></div>`;$('#historyGrid').innerHTML=d.results.length?d.results.slice().reverse().map(r=>`<article class="history-item"><div><b>${esc(r.testTitle)}</b><small>${new Date(r.submittedAt).toLocaleString()}</small></div><strong>${r.score}/${r.total} <small>${r.percentage}%</small></strong></article>`).join(''):'<div class="empty-state">Your completed tests will appear here.</div>'}catch{}}
async function loadAdminTests(){try{const tests=await api('/api/admin/tests');$('#adminTestList').innerHTML=tests.length?tests.map(t=>`<article class="admin-test"><div class="admin-test-top"><div><b>${esc(t.title)}</b><p>${esc(t.subject)} · ${t.duration} min · ${t.questionCount} questions</p></div><span class="status ${t.published?'published':''}">${t.published?'Published':'Draft'}</span></div><div class="admin-test-actions"><button class="btn small outline" onclick="showQuestionForm('${t.id}')">Manage questions</button><button class="btn small ${t.published?'outline':'primary'}" onclick="togglePublish('${t.id}',${!t.published})">${t.published?'Unpublish':'Publish'}</button><button class="btn small danger-outline" onclick="deleteTest('${t.id}')">Delete</button></div><div id="questionForm-${t.id}" class="question-editor hidden"></div></article>`).join(''):'<div class="empty-state">No tests yet. Create your first test above.</div>'}catch(err){$('#adminTestList').textContent=err.message}}
$('#createTestForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/tests',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();e.target.duration.value=30;$('#createMessage').textContent='Test created as a draft.';loadAdminTests();refreshTests()}catch(err){$('#createMessage').textContent=err.message}};
window.showQuestionForm=async tid=>{const el=$('#questionForm-'+tid);el.classList.toggle('hidden');if(el.dataset.loaded)return;el.dataset.loaded='1';el.innerHTML=`<h4>Add a question</h4><form class="question-form" onsubmit="addQuestion(event,'${tid}')"><label>Question<textarea name="text" required rows="2"></textarea></label><label>Option A<input name="a" required></label><label>Option B<input name="b" required></label><label>Option C<input name="c"></label><label>Option D<input name="d"></label><label>Correct option<select name="correctIndex"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></label><label>Explanation (optional)<textarea name="explanation" rows="2"></textarea></label><button class="btn primary" type="submit">Save question</button></form><div class="question-list" id="questionList-${tid}"></div>`;loadQuestionList(tid)};
window.addQuestion=async(e,tid)=>{e.preventDefault();const f=new FormData(e.target), options=['a','b','c','d'].map(k=>String(f.get(k)||'').trim()).filter(Boolean);let correctIndex=Number(f.get('correctIndex'));const original=['a','b','c','d'].indexOf(['a','b','c','d'].filter(k=>f.get(k))[correctIndex]);try{await api(`/api/admin/tests/${tid}/questions`,{method:'POST',body:JSON.stringify({text:f.get('text'),options,correctIndex:original,explanation:f.get('explanation')})});e.target.reset();$('#questionForm-'+tid).dataset.loaded='';loadAdminTests()}catch(err){alert(err.message)}};

async function loadQuestionList(tid) {
  try {
    const tests = await api('/api/admin/tests');
    const test = tests.find(item => item.id === tid);
    if (!test) return;

    const el = $('#questionList-' + tid);

    el.innerHTML = (test.questions || []).map((q, i) => `
      <div class="question-list-row">
        <span>${i + 1}. ${esc(q.text)}</span>
        <button class="btn small outline"
          onclick="editQuestion('${tid}','${q.id}')">
          Edit
        </button>
        <button class="btn small danger-outline"
          onclick="deleteQuestion('${tid}','${q.id}')">
          Remove
        </button>
      </div>
    `).join('') || '<p>No questions added yet.</p>';
  } catch (error) {
    console.error('Could not load questions:', error);
  }
}

window.editQuestion = async (tid, qid) => {
  try {
    const tests = await api('/api/admin/tests');
    const test = tests.find(item => item.id === tid);
    const q = test?.questions?.find(item => item.id === qid);

    if (!q) throw new Error('Question not found.');

    const text = prompt('Question:', q.text);
    if (text === null) return;

    const optionsText = prompt(
      'Enter each option on a new line:',
      q.options.join('\n')
    );
    if (optionsText === null) return;

    const options = optionsText
      .split('\n')
      .map(option => option.trim())
      .filter(Boolean);

    if (options.length < 2) {
      alert('At least two options are required.');
      return;
    }

    const oldAnswer = q.correctIndex + 1;
    const answerText = prompt(
      `Correct option number (1-${options.length}):`,
      String(Math.min(oldAnswer, options.length))
    );

    if (answerText === null) return;

    const correctIndex = Number(answerText) - 1;

    if (
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= options.length
    ) {
      alert('Invalid correct option number.');
      return;
    }

    const explanation = prompt(
      'Explanation:',
      q.explanation || ''
    );
    if (explanation === null) return;

    await api(
      `/api/admin/tests/${tid}/questions/${qid}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          text,
          options,
          correctIndex,
          explanation
        })
      }
    );

    alert('Question updated successfully.');
    await loadAdminTests();
  } catch (error) {
    alert('Could not update question: ' + error.message);
  }
};

window.deleteQuestion=async(tid,qid)=>{if(!confirm('Remove this question?'))return;await api(`/api/admin/tests/${tid}/questions/${qid}`,{method:'DELETE'});loadAdminTests()};window.togglePublish=async(tid,published)=>{try{await api(`/api/admin/tests/${tid}/publish`,{method:'POST',body:JSON.stringify({published})});loadAdminTests();refreshTests()}catch(err){alert(err.message)}};window.deleteTest=async tid=>{if(!confirm('Delete this test? Existing result history is retained.'))return;await api('/api/admin/tests/'+tid,{method:'DELETE'});loadAdminTests();refreshTests()};
$$('[data-admin-tab]').forEach(b=>b.onclick=()=>{$$('[data-admin-tab]').forEach(x=>x.classList.toggle('active',x===b));$('#adminManage').classList.toggle('hidden',b.dataset.adminTab!=='manage');$('#adminResults').classList.toggle('hidden',b.dataset.adminTab!=='results');if(b.dataset.adminTab==='results')loadAdminResults()});
async function loadAdminResults(){try{const rows=await api('/api/admin/results');$('#adminResultsList').innerHTML=rows.length?`<div class="result-table"><div class="result-table-head"><span>Student</span><span>Test</span><span>Score</span><span>Submitted</span></div>${rows.slice().reverse().map(r=>`<div class="result-table-row"><span>${esc(r.studentName)}</span><span>${esc(r.testTitle)}</span><b>${r.score}/${r.total} (${r.percentage}%)</b><small>${new Date(r.submittedAt).toLocaleString()}</small></div>`).join('')}</div>`:'<div class="empty-state">No student results yet.</div>'}catch(err){$('#adminResultsList').textContent=err.message}}
$('#downloadResults').onclick=async()=>{try{const r=await fetch('/api/admin/results.csv',{credentials:'same-origin'});if(!r.ok)throw new Error('Unable to export results');const blob=await r.blob(),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='exam-saathi-results.csv';a.click();URL.revokeObjectURL(a.href)}catch(e){alert(e.message)}};
init();

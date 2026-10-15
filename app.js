
let currentUser = null;
let currentLang = 'hi'; // 'hi' or 'en'

const translations = {
    hi: {
        welcome: "Test with Ankita में आपका स्वागत है",
        loginTab: "लॉगिन",
        registerTab: "रजिस्टर",
        namePlaceholder: "अपना यूनीक नाम दर्ज करें",
        passPlaceholder: "पासवर्ड दर्ज करें",
        loginBtn: "लॉगिन करें",
        registerBtn: "रजिस्टर करें",
        allTests: "सभी टेस्ट (All Tests)",
        myResults: "मेरे परिणाम",
        startTest: "टेस्ट शुरू करें",
        logout: "लॉग आउट",
        timeRemaining: "शेष समय",
        submitTest: "टेस्ट सबमिट करें",
        review: "समीक्षा के लिए चिह्नित (Mark for Review)",
        clear: "उत्तर साफ़ करें (Clear)",
        correct: "सही",
        incorrect: "गलत",
        unanswered: "अनुत्तरित"
    },
    en: {
        welcome: "Welcome to Test with Ankita",
        loginTab: "Login",
        registerTab: "Register",
        namePlaceholder: "Enter unique name",
        passPlaceholder: "Enter password",
        loginBtn: "Login",
        registerBtn: "Register",
        allTests: "All Tests",
        myResults: "My Results",
        startTest: "Start Test",
        logout: "Logout",
        timeRemaining: "Time Remaining",
        submitTest: "Submit Test",
        review: "Mark for Review",
        clear: "Clear Answer",
        correct: "Correct",
        incorrect: "Incorrect",
        unanswered: "Unanswered"
    }
};

function toggleLanguage() {
    currentLang = currentLang === 'hi' ? 'en' : 'hi';
    checkAuth();
}

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        currentUser = data.user;
        renderApp();
    } catch(e) {
        currentUser = null;
        renderApp();
    }
}

async function renderApp() {
    const navDiv = document.getElementById('auth-nav');
    const contentDiv = document.getElementById('app-content');
    const t = translations[currentLang];

    if (currentUser) {
        navDiv.innerHTML = `
            <span class="text-sm font-medium">👤 ${currentUser.name}</span>
            <button onclick="logout()" class="px-3 py-1 bg-indigo-700 hover:bg-indigo-800 rounded text-sm">${t.logout}</button>
        `;
        // Render Dashboard
        contentDiv.innerHTML = `
            <div class="space-y-6">
                <div class="bg-white rounded-2xl shadow-md p-6 flex flex-col sm:flex-row justify-between items-center">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-800">${t.welcome}, ${currentUser.name}!</h2>
                        <p class="text-slate-500 text-sm mt-1">अपने मॉक टेस्ट चुनें और परीक्षा की तैयारी शुरू करें।</p>
                    </div>
                    <div class="mt-4 sm:mt-0 flex space-x-2">
                        <button onclick="switchTab('tests')" id="tab-tests-btn" class="px-4 py-2 rounded-xl font-medium bg-indigo-600 text-white shadow">${t.allTests}</button>
                        <button onclick="switchTab('results')" id="tab-results-btn" class="px-4 py-2 rounded-xl font-medium bg-gray-200 text-gray-700">${t.myResults}</button>
                    </div>
                </div>
                <div id="tab-content"></div>
            </div>
        `;
        loadTestsView();
    } else {
        navDiv.innerHTML = '';
        contentDiv.innerHTML = `
            <div class="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 mt-10">
                <div class="text-center mb-6">
                    <span class="text-4xl">📚</span>
                    <h2 class="text-2xl font-bold text-slate-800 mt-2">Test with Ankita</h2>
                    <p class="text-slate-500 text-sm">ऑनलाइन परीक्षा एवं प्रैक्टिस पोर्टल</p>
                </div>
                <div class="flex border-b mb-6">
                    <button onclick="switchAuthMode('login')" id="auth-tab-login" class="flex-1 pb-2 font-semibold text-indigo-600 border-b-2 border-indigo-600">${t.loginTab}</button>
                    <button onclick="switchAuthMode('register')" id="auth-tab-register" class="flex-1 pb-2 font-semibold text-gray-400">${t.registerTab}</button>
                </div>
                <form id="auth-form" onsubmit="handleAuthSubmit(event)" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">यूज़रनेम (Name)</label>
                        <input type="text" id="auth-name" required placeholder="${t.namePlaceholder}" class="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">पासवर्ड (Password)</label>
                        <input type="password" id="auth-password" required placeholder="${t.passPlaceholder}" class="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <button type="submit" id="auth-submit-btn" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow transition">${t.loginBtn}</button>
                    <div id="auth-error" class="text-red-500 text-sm text-center font-medium hidden"></div>
                </form>
            </div>
        `;
    }
}

let authMode = 'login';
function switchAuthMode(mode) {
    authMode = mode;
    const t = translations[currentLang];
    const loginBtn = document.getElementById('auth-tab-login');
    const regBtn = document.getElementById('auth-tab-register');
    const submitBtn = document.getElementById('auth-submit-btn');
    if(mode === 'login') {
        loginBtn.className = "flex-1 pb-2 font-semibold text-indigo-600 border-b-2 border-indigo-600";
        regBtn.className = "flex-1 pb-2 font-semibold text-gray-400";
        submitBtn.textContent = t.loginBtn;
    } else {
        regBtn.className = "flex-1 pb-2 font-semibold text-indigo-600 border-b-2 border-indigo-600";
        loginBtn.className = "flex-1 pb-2 font-semibold text-gray-400";
        submitBtn.textContent = t.registerBtn;
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('auth-name').value;
    const password = document.getElementById('auth-password').value;
    const errDiv = document.getElementById('auth-error');
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, password })
        });
        const data = await res.json();
        if(res.ok) {
            checkAuth();
        } else {
            errDiv.textContent = data.error || 'त्रुटि हुई';
            errDiv.classList.remove('hidden');
        }
    } catch(e) {
        errDiv.textContent = 'कनेक्शन त्रुटि';
        errDiv.classList.remove('hidden');
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    checkAuth();
}

function switchTab(tab) {
    const testsBtn = document.getElementById('tab-tests-btn');
    const resultsBtn = document.getElementById('tab-results-btn');
    if(tab === 'tests') {
        testsBtn.className = "px-4 py-2 rounded-xl font-medium bg-indigo-600 text-white shadow";
        resultsBtn.className = "px-4 py-2 rounded-xl font-medium bg-gray-200 text-gray-700";
        loadTestsView();
    } else {
        resultsBtn.className = "px-4 py-2 rounded-xl font-medium bg-indigo-600 text-white shadow";
        testsBtn.className = "px-4 py-2 rounded-xl font-medium bg-gray-200 text-gray-700";
        loadResultsView();
    }
}

let allTestsCache = [];
let htmlTestsCache = [];

async function loadTestsView() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex flex-col sm:flex-row justify-between gap-4">
                <input type="text" id="test-search" oninput="filterTests()" placeholder="टेस्ट खोजें..." class="px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-72">
                <div class="flex space-x-2">
                    <button onclick="setTestFilter('all')" id="filter-all" class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium">सभी</button>
                    <button onclick="setTestFilter('server')" id="filter-server" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-medium">मॉक टेस्ट</button>
                    <button onclick="setTestFilter('html')" id="filter-html" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-medium">HTML टेस्ट</button>
                </div>
            </div>
            <div id="tests-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"></div>
        </div>
    `;

    try {
        const [testsRes, htmlRes] = await Promise.all([
            fetch('/api/tests'),
            fetch('/api/html-tests')
        ]);
        allTestsCache = await testsRes.json();
        htmlTestsCache = await htmlRes.json();
        renderTests(allTestsCache, htmlTestsCache);
    } catch(e) {
        console.error(e);
    }
}

let currentFilter = 'all';
function setTestFilter(filter) {
    currentFilter = filter;
    ['all', 'server', 'html'].forEach(f => {
        const btn = document.getElementById(`filter-${f}`);
        if(f === filter) {
            btn.className = "px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium";
        } else {
            btn.className = "px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-medium";
        }
    });
    renderTests(allTestsCache, htmlTestsCache);
}

function filterTests() {
    renderTests(allTestsCache, htmlTestsCache);
}

function renderTests(serverTests, htmlTests) {
    const grid = document.getElementById('tests-grid');
    const query = (document.getElementById('test-search')?.value || '').toLowerCase();

    let filteredServer = serverTests.filter(t => t.title.toLowerCase().includes(query));
    let filteredHtml = htmlTests.filter(t => t.name.toLowerCase().includes(query));

    let htmlOutput = '';

    if (currentFilter === 'all' || currentFilter === 'server') {
        filteredServer.forEach(t => {
            htmlOutput += `
                <div class="bg-white rounded-2xl shadow-md p-6 border flex flex-col justify-between space-y-4">
                    <div>
                        <span class="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-semibold">मॉक टेस्ट</span>
                        <h3 class="font-bold text-lg text-slate-800 mt-2">${t.title}</h3>
                        <p class="text-sm text-slate-500 mt-1">अवधि: ${t.duration} मिनट | अंक योजना: +2 / -1</p>
                    </div>
                    <button onclick="startServerTest(${t.id})" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow transition">टेस्ट शुरू करें</button>
                </div>
            `;
        });
    }

    if (currentFilter === 'all' || currentFilter === 'html') {
        filteredHtml.forEach(h => {
            htmlOutput += `
                <div class="bg-white rounded-2xl shadow-md p-6 border flex flex-col justify-between space-y-4">
                    <div>
                        <span class="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold">HTML टेस्ट</span>
                        <h3 class="font-bold text-lg text-slate-800 mt-2">${h.name}</h3>
                        <p class="text-sm text-slate-500 mt-1">स्टेटिक प्रैक्टिस टेस्ट फ़ाइल</p>
                    </div>
                    <a href="${h.url}" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-center font-semibold rounded-xl shadow transition block">ओपन टेस्ट (Open)</a>
                </div>
            `;
        });
    }

    grid.innerHTML = htmlOutput || '<p class="text-slate-500 col-span-full text-center py-10">कोई टेस्ट नहीं मिला।</p>';
}

async function loadResultsView() {
    const container = document.getElementById('tab-content');
    container.innerHTML = '<p class="text-gray-500">परिणाम लोड हो रहे हैं...</p>';
    try {
        const res = await fetch('/api/my-results');
        const results = await res.json();
        container.innerHTML = `
            <div class="bg-white rounded-2xl shadow-md p-6">
                <h3 class="text-lg font-bold text-slate-800 mb-4">मेरे पिछले टेस्ट परिणाम</h3>
                <div class="space-y-4">
                    ${results.map(r => `
                        <div class="p-4 border rounded-xl bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <h4 class="font-bold text-slate-800">टेस्ट ID: ${r.test_id}</h4>
                                <p class="text-xs text-gray-500">${new Date(r.created_at).toLocaleString()}</p>
                            </div>
                            <div class="flex items-center space-x-4">
                                <div class="text-right">
                                    <p class="text-xl font-bold text-indigo-600">${r.score} अंक (${r.percentage}%)</p>
                                    <p class="text-xs text-gray-500">सही: ${r.correct_count} | गलत: ${r.incorrect_count} | अनुत्तरित: ${r.unanswered_count}</p>
                                </div>
                            </div>
                        </div>
                    `).join('') || '<p class="text-slate-500">आपने अभी तक कोई टेस्ट नहीं दिया है।</p>'}
                </div>
            </div>
        `;
    } catch(e) {
        container.innerHTML = '<p class="text-red-500">परिणाम लोड करने में विफल।</p>';
    }
}

// Test Taking Engine
let activeTest = null;
let currentQuestionIndex = 0;
let userAnswers = {};
let markedForReview = {};
let timerInterval = null;
let timeRemainingSeconds = 0;

async function startServerTest(testId) {
    try {
        const res = await fetch(`/api/tests/${testId}`);
        const data = await res.json();
        if(!data.test || !data.questions || data.questions.length === 0) {
            alert('इस टेस्ट में कोई प्रश्न उपलब्ध नहीं है।');
            return;
        }
        activeTest = data;
        currentQuestionIndex = 0;
        userAnswers = {};
        markedForReview = {};
        timeRemainingSeconds = (activeTest.test.duration || 20) * 60;

        renderTestScreen();
        startTestTimer();
    } catch(e) {
        alert('टेस्ट लोड करने में त्रुटि');
    }
}

function startTestTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeRemainingSeconds--;
        const min = Math.floor(timeRemainingSeconds / 60);
        const sec = timeRemainingSeconds % 60;
        const timerEl = document.getElementById('test-timer');
        if(timerEl) {
            timerEl.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        }
        if(timeRemainingSeconds <= 0) {
            clearInterval(timerInterval);
            alert('समय समाप्त हो गया है! आपका टेस्ट स्वतः सबमिट किया जा रहा है।');
            submitActiveTest(true);
        }
    }, 1000);
}

function renderTestScreen() {
    const contentDiv = document.getElementById('app-content');
    const q = activeTest.questions[currentQuestionIndex];
    const totalQ = activeTest.questions.length;

    const min = Math.floor(timeRemainingSeconds / 60);
    const sec = timeRemainingSeconds % 60;

    contentDiv.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl p-6 space-y-6 max-w-4xl mx-auto">
            <div class="flex justify-between items-center border-b pb-4">
                <h2 class="text-xl font-bold text-slate-800">${activeTest.test.title}</h2>
                <div class="flex items-center space-x-4">
                    <span class="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg font-bold text-sm" id="test-timer">${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}</span>
                    <button onclick="confirmSubmitTest()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold">टेस्ट सबमिट करें</button>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <!-- Question Area -->
                <div class="lg:col-span-3 space-y-4">
                    <div class="flex justify-between text-sm text-gray-500">
                        <span>प्रश्न ${currentQuestionIndex + 1} / ${totalQ}</span>
                        <span>अंक योजना: +2 / -1</span>
                    </div>
                    <h3 class="text-lg font-semibold text-slate-800">${q.question}</h3>
                    <div class="space-y-3">
                        ${['A', 'B', 'C', 'D'].map(opt => `
                            <label class="flex items-center p-3 border rounded-xl cursor-pointer hover:bg-indigo-50 transition ${userAnswers[q.id] === opt ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}">
                                <input type="radio" name="q_option" value="${opt}" ${userAnswers[q.id] === opt ? 'checked' : ''} onchange="selectAnswer(${q.id}, '${opt}')" class="mr-3">
                                <span class="font-medium text-slate-700">${opt}. ${q['option_' + opt.toLowerCase()]}</span>
                            </label>
                        `).join('')}
                    </div>
                    <div class="flex justify-between pt-4 border-t">
                        <div class="space-x-2">
                            <button onclick="clearAnswer(${q.id})" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-sm font-medium">उत्तर साफ़ करें</button>
                            <button onclick="toggleReview(${q.id})" class="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-sm font-medium">समीक्षा के लिए चिह्नित करें</button>
                        </div>
                        <div class="space-x-2">
                            <button onclick="prevQuestion()" ${currentQuestionIndex === 0 ? 'disabled' : ''} class="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-xl text-sm font-medium">पिछला</button>
                            <button onclick="nextQuestion()" ${currentQuestionIndex === totalQ - 1 ? 'disabled' : ''} class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium">अगला</button>
                        </div>
                    </div>
                </div>

                <!-- Question Palette -->
                <div class="border-l pl-0 lg:pl-6 space-y-4">
                    <h4 class="font-bold text-slate-700 text-sm">प्रश्न पट्टिका (Palette)</h4>
                    <div class="grid grid-cols-5 gap-2">
                        ${activeTest.questions.map((item, idx) => {
                            let btnBg = "bg-gray-100 text-gray-700 border";
                            if(userAnswers[item.id]) btnBg = "bg-green-600 text-white font-bold";
                            if(markedForReview[item.id]) btnBg = "bg-amber-500 text-white font-bold";
                            if(idx === currentQuestionIndex) btnBg += " ring-2 ring-indigo-600";
                            return `<button onclick="goToQuestion(${idx})" class="w-10 h-10 rounded-lg text-sm ${btnBg}">${idx + 1}</button>`;
                        }).join('')}
                    </div>
                    <div class="text-xs space-y-1 pt-4 border-t text-gray-500">
                        <p class="flex items-center"><span class="w-3 h-3 bg-green-600 rounded-full inline-block mr-2"></span> उत्तर दिया गया</p>
                        <p class="flex items-center"><span class="w-3 h-3 bg-amber-500 rounded-full inline-block mr-2"></span> समीक्षा के लिए चिह्नित</p>
                        <p class="flex items-center"><span class="w-3 h-3 bg-gray-200 rounded-full inline-block mr-2"></span> अनुत्तरित</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function selectAnswer(qid, opt) {
    userAnswers[qid] = opt;
    renderTestScreen();
}

function clearAnswer(qid) {
    delete userAnswers[qid];
    renderTestScreen();
}

function toggleReview(qid) {
    if(markedForReview[qid]) {
        delete markedForReview[qid];
    } else {
        markedForReview[qid] = true;
    }
    renderTestScreen();
}

function prevQuestion() {
    if(currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderTestScreen();
    }
}

function nextQuestion() {
    if(currentQuestionIndex < activeTest.questions.length - 1) {
        currentQuestionIndex++;
        renderTestScreen();
    }
}

function goToQuestion(idx) {
    currentQuestionIndex = idx;
    renderTestScreen();
}

function confirmSubmitTest() {
    if(confirm('क्या आप वाकई अपना टेस्ट सबमिट करना चाहते हैं?')) {
        submitActiveTest(false);
    }
}

async function submitActiveTest(isAuto = false) {
    clearInterval(timerInterval);
    try {
        const res = await fetch('/api/tests/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                test_id: activeTest.test.id,
                answers: userAnswers
            })
        });
        const result = await res.json();
        if(res.ok) {
            renderResultScreen(result);
        } else {
            alert(result.error || 'सबमिशन में त्रुटि');
            checkAuth();
        }
    } catch(e) {
        alert('नेटवर्क त्रुटि');
    }
}

function renderResultScreen(res) {
    const contentDiv = document.getElementById('app-content');
    contentDiv.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl p-8 max-w-3xl mx-auto space-y-6 text-center">
            <span class="text-5xl">🎉</span>
            <h2 class="text-2xl font-bold text-slate-800">टेस्ट सफलतापर्वूक संपन्न हुआ!</h2>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl">
                <div>
                    <p class="text-xs text-gray-500">कुल स्कोर</p>
                    <p class="text-2xl font-bold text-indigo-600">${res.score} अंक</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">प्रतिशत</p>
                    <p class="text-2xl font-bold text-emerald-600">${res.percentage}%</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">सही उत्तर</p>
                    <p class="text-2xl font-bold text-green-600">${res.correct_count}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">गलत उत्तर</p>
                    <p class="text-2xl font-bold text-red-600">${res.incorrect_count}</p>
                </div>
            </div>

            <div class="text-left space-y-4 pt-4 border-t">
                <h3 class="font-bold text-lg text-slate-800">उत्तर और स्पष्टीकरण</h3>
                ${res.detailedResults.map((d, i) => `
                    <div class="p-4 border rounded-xl ${d.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} space-y-2">
                        <p class="font-semibold text-slate-800">प्र. ${i+1}: ${d.question}</p>
                        <p class="text-sm">आपका उत्तर: <span class="font-bold">${d.userAnswer || 'अनुत्तरित'}</span> | सही उत्तर: <span class="font-bold text-green-700">${d.correctAnswer}</span></p>
                        ${d.explanation ? `<p class="text-xs text-gray-600 bg-white p-2 rounded border">स्पष्टीकरण: ${d.explanation}</p>` : ''}
                    </div>
                `).join('')}
            </div>

            <button onclick="checkAuth()" class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow">डैशबोर्ड पर लौटें</button>
        </div>
    `;
}

checkAuth();

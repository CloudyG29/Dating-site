let state = {
    step: 1,
    tagSelections: {},
    user: {}
};

function showNotif(msg, type='success') {
    const n = document.getElementById('notif');
    if(!n) return;
    n.textContent = msg;
    n.className = 'notif show ' + type;
    setTimeout(() => n.classList.remove('show'), 3200);
}

// Form Handlers
function toggleTag(el, group) {
    el.classList.toggle('active');
    if (!state.tagSelections[group]) state.tagSelections[group] = [];
    const val = el.textContent;
    const idx = state.tagSelections[group].indexOf(val);
    if (idx > -1) state.tagSelections[group].splice(idx, 1);
    else state.tagSelections[group].push(val);
}

function toggleTagSingle(el, group) {
    const parent = el.parentElement;
    parent.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    state.tagSelections[group] = [el.textContent];
}

function showRegStep(n) {
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById('reg-step-'+i);
        if(stepEl) stepEl.style.display = i === n ? 'block' : 'none';
    }
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById('sd'+i);
        if(dot) {
            dot.className = 'step-dot ' + (i < n ? 'done' : i === n ? 'active' : 'pending');
            dot.textContent = i < n ? '✓' : i;
        }
    }
    for (let i = 1; i <= 3; i++) {
        const line = document.getElementById('sl'+i);
        if (line) line.className = 'step-line' + (i < n ? ' done' : '');
    }
    state.step = n;
}

// Flow Processing
function regStep1() {
    state.user.handle = document.getElementById('r-username').value.trim();
    state.user.email = document.getElementById('r-email').value.trim();
    state.user.phone = document.getElementById('r-phone').value.trim();
    state.user.password = document.getElementById('r-password').value;
    state.user.gender = document.getElementById('r-gender').value;
    state.user.age = parseInt(document.getElementById('r-age').value);
    state.user.location = document.getElementById('r-location').value.trim();
    showRegStep(2);
}

function regStep2() {
    state.user.bio = document.getElementById('r-bio').value.trim();
    state.user.values = state.tagSelections.values || [];
    state.user.lifestyle = state.tagSelections.lifestyle || [];
    state.user.goal = (state.tagSelections.goal || [])[0] || '';
    showRegStep(3);
}

// Save directly to Backend (/api/auth/profile)
async function submitProfileToBackend() {
    state.user.seeking = document.getElementById('r-seeking').value;
    state.user.ageMin = parseInt(document.getElementById('r-age-min').value);
    state.user.ageMax = parseInt(document.getElementById('r-age-max').value);

    try {
        const res = await fetch('/api/auth/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.user)
        });
        
        if (!res.ok) throw new Error('Failed to save profile');
        const data = await res.json();
        
        if(data.success) {
            showRegStep(4);
        }
    } catch (err) {
        showNotif(err.message, 'error');
        // Fallback for UI testing if server is off:
        showRegStep(4);
    }
}

// Process Payment
async function processRealPayment() {
    const name = document.getElementById('pay-name').value.trim();
    if (!name) return showNotif('Please enter your name', 'error');

    try {
        const res = await fetch('/payment/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: 'test_uid', email: state.user.email, name: name })
        });
        const { pfUrl, data } = await res.json();

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = pfUrl;

        for (const key in data) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = data[key];
            form.appendChild(input);
        }

        document.body.appendChild(form);
        form.submit();
    } catch (err) {
        showNotif('Payment initiation failed. Directing to dashboard for demo.', 'error');
        // Fallback demo redirect
        setTimeout(() => window.location.href = 'dashboard.html', 1500);
    }
}
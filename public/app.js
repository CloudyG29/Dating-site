import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, getIdToken, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBV4ztQm7sxiEFyAFsvCWLclitY-6cq4T8",
  authDomain: "linkup-7880e.firebaseapp.com",
  projectId: "linkup-7880e",
  storageBucket: "linkup-7880e.firebasestorage.app",
  messagingSenderId: "1029218787471",
  appId: "1:1029218787471:web:12b1ecd53626beb7f6d0fa",
  measurementId: "G-VW5F5YZGND"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

// Update your state to hold the Firebase Token
let state = {
    step: 1,
    tagSelections: {},
    user: {},
    authToken: null // New property to securely talk to your backend
};

// Listen for authentication changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        state.authToken = await getIdToken(user);
        
        if (window.location.pathname.includes('profile.html')) {
            fetchUserProfile();
        }
        // ADD THIS: Check for preferences page
        if (window.location.pathname.includes('preferences.html')) {
            fetchUserPreferences();
        }
    } else {
        state.authToken = null;
        if (window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('profile.html') || window.location.pathname.includes('preferences.html')) {
            window.location.href = 'login.html';
        }
    }
});

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
        // 1. Create the user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
            auth, 
            state.user.email, 
            state.user.password
        );
        
        // 2. Get their secure access token
        const token = await getIdToken(userCredential.user);

        // 3. Send the profile data to your Render Backend, attaching the token!
        const res = await fetch('/api/auth/profile', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // This unlocks the gatekeeper middleware
            },
            body: JSON.stringify(state.user)
        });
        
        if (!res.ok) throw new Error('Failed to save profile');
        const data = await res.json();
        
        if(data.success) {
            showRegStep(4); // Move to payment screen
        }
    } catch (err) {
        // Handle issues like "Email already in use" or "Weak password"
        showNotif(err.message, 'error');
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

// --- LOGIN PAGE LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent page reload
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const btn = loginForm.querySelector('button');
            const originalText = btn.innerText;
            
            btn.innerText = 'Signing in...';

            try {
                // Securely log in via Firebase
                await signInWithEmailAndPassword(auth, email, password);
                
                // On success, redirect to the dashboard
                window.location.href = 'dashboard.html';
            } catch (error) {
                console.error("Login Error:", error);
                // The showNotif function assumes you have it defined in your app.js from previous steps
                showNotif('Invalid email or password. Please try again.', 'error');
                btn.innerText = originalText;
            }
        });
    }
});

// --- FORGOT PASSWORD LOGIC ---
const forgotBtn = document.getElementById('forgot-password');
if (forgotBtn) {
    forgotBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('login-email').value.trim();
        
        if (!emailInput) {
            showNotif('Please enter your email address first, then click Forgot.', 'error');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, emailInput);
            showNotif('Password reset email sent! Check your inbox.', 'success');
        } catch (error) {
            console.error("Reset Error:", error);
            showNotif('Failed to send reset email. Make sure the email is correct.', 'error');
        }
    });
}

// --- PROFILE PAGE LOGIC ---

// 1. Fetch user data and populate the form
async function fetchUserProfile() {
    try {
        const res = await fetch('/api/auth/profile', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${state.authToken}`
            }
        });
        
        if (!res.ok) throw new Error('Could not fetch profile');
        const data = await res.json();
        
        // Populate the form fields with the database values
        document.getElementById('p-username').value = data.handle || '';
        document.getElementById('p-phone').value = data.phone || '';
        document.getElementById('p-age').value = data.age || '';
        document.getElementById('p-location').value = data.location || '';
        document.getElementById('p-gender').value = data.gender || 'A woman';
        document.getElementById('p-bio').value = data.bio || '';
        document.getElementById('p-seeking').value = data.seeking || 'Any gender';

        // Hide loading text and show the form
        document.getElementById('profile-loading').style.display = 'none';
        document.getElementById('edit-profile-form').style.display = 'block';

        // Keep a copy of their existing tags/preferences so we don't overwrite them with empties
        state.user = data; 
    } catch (error) {
        showNotif('Failed to load profile. Please refresh.', 'error');
    }
}

// 2. Handle the Save Changes button
document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('edit-profile-form');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('p-save-btn');
            btn.innerText = 'Saving...';

            // Gather updated data
            const updatedProfile = {
                ...state.user, // Spread existing data so we don't lose tags/matches
                handle: document.getElementById('p-username').value,
                phone: document.getElementById('p-phone').value,
                age: parseInt(document.getElementById('p-age').value),
                location: document.getElementById('p-location').value,
                gender: document.getElementById('p-gender').value,
                bio: document.getElementById('p-bio').value,
                seeking: document.getElementById('p-seeking').value
            };

            try {
                // Send back to the same backend endpoint (your auth.js route uses `{ merge: true }` so it handles updates natively!)
                const res = await fetch('/api/auth/profile', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.authToken}`
                    },
                    body: JSON.stringify(updatedProfile)
                });

                if (!res.ok) throw new Error('Failed to update profile');
                
                showNotif('Profile updated successfully! ✨', 'success');
                btn.innerText = 'Save Changes';
            } catch (error) {
                showNotif('Could not save profile changes.', 'error');
                btn.innerText = 'Save Changes';
            }
        });
    }
});
// --- PREFERENCES PAGE LOGIC ---

async function fetchUserPreferences() {
    try {
        const res = await fetch('/api/auth/profile', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${state.authToken}` }
        });
        
        if (!res.ok) throw new Error('Could not fetch preferences');
        const data = await res.json();
        state.user = data; // Store the base profile

        // Pre-fill the state tag selections from the database
        state.tagSelections.values = data.values || [];
        state.tagSelections.lifestyle = data.lifestyle || [];
        state.tagSelections.goal = data.goal ? [data.goal] : [];

        // Highlight the selected tags in the UI
        document.querySelectorAll('.tag').forEach(tagEl => {
            const group = tagEl.closest('.tags').id.replace('pref-', ''); // e.g. "values", "lifestyle", "goal"
            const tagValue = tagEl.textContent;
            
            if (state.tagSelections[group] && state.tagSelections[group].includes(tagValue)) {
                tagEl.classList.add('active');
            }
        });

        // Show the form
        document.getElementById('pref-loading').style.display = 'none';
        document.getElementById('edit-pref-form').style.display = 'block';
    } catch (error) {
        showNotif('Failed to load preferences. Please refresh.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const prefForm = document.getElementById('edit-pref-form');
    if (prefForm) {
        prefForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('pref-save-btn');
            btn.innerText = 'Updating Engine...';

            // Merge new tags with existing user data
            const updatedProfile = {
                ...state.user,
                values: state.tagSelections.values || [],
                lifestyle: state.tagSelections.lifestyle || [],
                goal: (state.tagSelections.goal || [])[0] || ''
            };

            try {
                const res = await fetch('/api/auth/profile', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.authToken}`
                    },
                    body: JSON.stringify(updatedProfile)
                });

                if (!res.ok) throw new Error('Failed to update preferences');
                
                showNotif('Algorithm recalibrated! ✨', 'success');
                btn.innerText = 'Update Algorithm';
            } catch (error) {
                showNotif('Could not update preferences.', 'error');
                btn.innerText = 'Update Algorithm';
            }
        });
    }
});

// --- EXPOSE FUNCTIONS TO HTML ---
// Because this script is a module, inline onclick="" handlers in HTML can't see these functions automatically.
window.showNotif = showNotif;
window.toggleTag = toggleTag;
window.toggleTagSingle = toggleTagSingle;
window.showRegStep = showRegStep;
window.regStep1 = regStep1;
window.regStep2 = regStep2;
window.submitProfileToBackend = submitProfileToBackend;
window.processRealPayment = processRealPayment;
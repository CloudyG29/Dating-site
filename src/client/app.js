import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  getIdToken,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBV4ztQm7sxiEFyAFsvCWLclitY-6cq4T8",
  authDomain: "linkup-7880e.firebaseapp.com",
  projectId: "linkup-7880e",
  storageBucket: "linkup-7880e.firebasestorage.app",
  messagingSenderId: "1029218787471",
  appId: "1:1029218787471:web:12b1ecd53626beb7f6d0fa",
  measurementId: "G-VW5F5YZGND",
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

let state = {
  step: 1,
  tagSelections: {},
  user: {},
  authToken: null,
};

// ─── Auth State ───────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    state.authToken = await getIdToken(user, true);

    const onRegisterPage = window.location.pathname.includes("register.html");

    if (!onRegisterPage) {
      await fetch("/api/auth/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${state.authToken}` },
      });
    }

    const profileRes = await fetch("/api/auth/profile", {
      headers: { Authorization: `Bearer ${state.authToken}` },
    });

    if (onRegisterPage) {
      if (profileRes.status === 404) {
        state.user.email = user.email;
        showRegStep(2);
      } else {
        window.location.href = "dashboard.html";
      }
      return;
    }

    if (profileRes.status === 404) {
      window.location.href = "register.html";
      return;
    }

    if (window.location.pathname.includes("dashboard.html")) fetchDashboard();
    if (window.location.pathname.includes("profile.html")) fetchUserProfile();
    if (window.location.pathname.includes("preferences.html"))
      fetchUserPreferences();
  } else {
    state.authToken = null;
    const protectedPages = [
      "dashboard.html",
      "profile.html",
      "preferences.html",
    ];
    if (protectedPages.some((p) => window.location.pathname.includes(p))) {
      window.location.href = "login.html";
    }
  }
});
function renderMatchCard(m) {
  let actionSection;

  if (m.status === "REVEALED") {
    actionSection = `<p style="color:var(--ink-3);font-size:0.9rem">You matched! Messaging coming soon.</p>`;
  } else if (m.consent === "PENDING") {
    actionSection = `
      <div style="display:flex;gap:1rem;justify-content:center;margin-top:0.5rem">
        <button onclick="handleConsent('${m.matchId}','ACCEPTED')" class="btn btn-gold">Accept Match</button>
        <button onclick="handlePass('${m.matchId}')" class="btn btn-ghost">Pass</button>
      </div>`;
  } else {
    actionSection = `<p style="color:var(--ink-3);font-size:0.9rem">Waiting for their response...</p>`;
  }

  return `
    <div style="font-size:3rem;margin-bottom:1rem">💫</div>
    <h2 style="font-family:var(--serif);font-size:2rem;margin-bottom:0.5rem;color:var(--ink)">Your match is ready</h2>
    <p style="color:var(--gold-dark);font-weight:500;margin-bottom:1.5rem;font-size:1.1rem">${m.alias}</p>
    <p style="color:var(--ink-3);line-height:1.7;max-width:450px;margin:0 auto 2rem;font-size:0.95rem">${m.bio || "This person prefers to let the conversation speak for itself."}</p>
    <div style="background:var(--cream);padding:1rem 1.5rem;border-radius:var(--r);display:inline-block;border:1px solid var(--cream-2);margin-bottom:1.5rem">
      <span style="font-size:0.85rem;color:var(--ink-2)">Compatibility Score: <strong>${Math.round(m.score)}%</strong></span>
    </div>
    <br>
    ${actionSection}`;
}

async function fetchDashboard() {
  try {
    const [profileRes, matchRes] = await Promise.all([
      fetch("/api/auth/profile", {
        headers: { Authorization: `Bearer ${state.authToken}` },
      }),
      fetch("/api/matches", {
        headers: { Authorization: `Bearer ${state.authToken}` },
      }),
    ]);

    const profile = await profileRes.json();
    const { matches } = await matchRes.json();

    const greeting = document.getElementById("dash-greeting");
    if (greeting) {
      greeting.textContent = `Welcome back, ${profile.displayAlias || "stranger"}.`;
    }

    const matchSection = document.getElementById("match-section");
    if (!matchSection) return;

    if (!matches || matches.length === 0) {
      //if there are no matches, show a message indicating that the algorithm is curating a match for the user.
      matchSection.innerHTML = `
        <div class="pulse-icon" style="font-size:4rem;margin-bottom:1.5rem">✨</div>
        <h2 style="font-family:var(--serif);font-size:2rem;margin-bottom:1rem;color:var(--ink)">Curating your match</h2>
        <p style="color:var(--ink-3);line-height:1.7;max-width:450px;margin:0 auto 2.5rem;font-size:1.05rem">
          Our algorithm is quietly exploring compatibility networks to find someone whose values, lifestyle, and intentions align deeply with yours.
        </p>
        <div style="background:var(--cream);padding:1.2rem;border-radius:var(--r);display:inline-block;margin:0 auto;border:1px solid var(--cream-2)">
          <span style="font-size:0.9rem;color:var(--ink-2);font-weight:500">Estimated Time to Match: 1–3 days</span>
        </div>`;
    } else {
      matchSection.innerHTML = renderMatchCard(matches[0]); //render the match using helper function.
    }
  } catch (err) {
    console.error(err);
  }
}
async function handlePass(matchId) {
  try {
    const res = await fetch(`/api/matches/pass`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.authToken}`,
      },
      body: JSON.stringify({ matchId }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotif(data.error || "Failed to pass match");
      return;
    }
    const matchSection = document.getElementById("match-section");
    if (data.result) {
      matchSection.innerHTML = renderMatchCard(data.result);
    } else {
      matchSection.innerHTML = `
        <div class="pulse-icon" style="font-size:4rem;margin-bottom:1.5rem">✨</div>
        <h2 style="font-family:var(--serif);font-size:2rem;margin-bottom:1rem;color:var(--ink)">Curating your match</h2>
        <p style="color:var(--ink-3);line-height:1.7;max-width:450px;margin:0 auto 2.5rem;font-size:1.05rem">
          Our algorithm is quietly exploring compatibility networks to find someone whose values, lifestyle, and intentions align deeply with yours.
        </p>
        <div style="background:var(--cream);padding:1.2rem;border-radius:var(--r);display:inline-block;margin:0 auto;border:1px solid var(--cream-2)">
          <span style="font-size:0.9rem;color:var(--ink-2);font-weight:500">Estimated Time to Match: 1–3 days</span>
        </div>`;
    }
  } catch (err) {
    console.error(err);
  }
}
window.handlePass = handlePass;

async function handleConsent(matchId, decision) {
  try {
    await fetch(`/api/matches/${matchId}/consent`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.authToken}`,
      },

      body: JSON.stringify({ decision }),
    });
    fetchDashboard(); // refresh
  } catch (err) {
    showNotif("Could not update decision.", "error");
  }
}

window.handleConsent = handleConsent;

// ─── Helpers ──────────────────────────────────────────────
function showNotif(msg, type = "success") {
  const n = document.getElementById("notif");
  if (!n) return;
  n.textContent = msg;
  n.className = "notif show " + type;
  setTimeout(() => n.classList.remove("show"), 3200);
}

function toggleTag(el, group) {
  el.classList.toggle("active");
  if (!state.tagSelections[group]) state.tagSelections[group] = [];
  const val = el.textContent;
  const idx = state.tagSelections[group].indexOf(val);
  if (idx > -1) state.tagSelections[group].splice(idx, 1);
  else state.tagSelections[group].push(val);
}

function toggleTagSingle(el, group) {
  el.parentElement
    .querySelectorAll(".tag")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  state.tagSelections[group] = [el.textContent];
}

function showRegStep(n) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById("reg-step-" + i);
    if (el) el.style.display = i === n ? "block" : "none";
  }
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById("sd" + i);
    if (dot) {
      dot.className =
        "step-dot " + (i < n ? "done" : i === n ? "active" : "pending");
      dot.textContent = i < n ? "✓" : i;
    }
  }
  for (let i = 1; i <= 3; i++) {
    const line = document.getElementById("sl" + i);
    if (line) line.className = "step-line" + (i < n ? " done" : "");
  }
  state.step = n;
}

// ─── Registration ─────────────────────────────────────────
async function regStep1() {
  const email = document.getElementById("r-email").value.trim();
  const password = document.getElementById("r-password").value;
  const continue_btn = document.getElementById("reg-step1-btn");

  if (password.length < 8) {
    showNotif("Password must be at least 8 characters.", "error");
    return;
  }

  continue_btn.disabled = true;
  continue_btn.innerText = "Checking...";

  try {
    const userCredential = await createUserWithEmailAndPassword(
      //creates a user in firebase auth and returns a userCredential object.
      auth,
      email,
      password,
    );
    state.authToken = await getIdToken(userCredential.user);
    await fetch("/api/auth/sync", {
      //syncs the user with the backend database, immidiately after creating the user in firebase auth.
      method: "POST",
      headers: { Authorization: `Bearer ${state.authToken}` },
    });
    state.user.email = email;

    state.user.phone = document.getElementById("r-phone").value.trim();
    state.authToken = await getIdToken(userCredential.user);
    showRegStep(2);
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      showNotif("That email is already registered.", "error");
    } else if (err.code === "auth/weak-password") {
      showNotif("Password is too weak.", "error");
    } else if (err.code === "auth/invalid-email") {
      showNotif("Enter a valid email address.", "error");
    } else {
      showNotif("Could not create account. Try again.", "error");
    }
  } finally {
    //if there is an error , user remains on the same step and the continue button is re-enabled for retrying.
    continue_btn.disabled = false;
    continue_btn.innerText = "Continue";
  }
}

function regStep2() {
  state.user.age = parseInt(document.getElementById("r-age").value);
  state.user.bio = document.getElementById("r-bio").value.trim();
  state.user.displayAlias = document.getElementById("r-username").value.trim();
  state.user.values = state.tagSelections.values || [];
  state.user.lifestyleTags = state.tagSelections.lifestyle || [];
  state.user.goals = state.tagSelections.goal || [];
  showRegStep(3);
}

async function submitProfileToBackend() {
  state.user.dealbreakers = [];
  try {
    const res = await fetch("/api/auth/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.authToken}`,
      },
      body: JSON.stringify({
        phone: state.user.phone,
        displayAlias: state.user.displayAlias,
        bio: state.user.bio,
        values: state.user.values,
        goals: state.user.goals,
        age: state.user.age,
        lifestyleTags: state.user.lifestyleTags,
        dealbreakers: state.user.dealbreakers,
      }),
    });
    if (!res.ok) throw new Error("Failed to save profile");
    window.location.href = "dashboard.html";
  } catch (err) {
    showNotif(err.message, "error");
  }
}
// ─── Login ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;
      const btn = loginForm.querySelector("button");
      btn.innerText = "Signing in...";

      try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = "dashboard.html";
      } catch (error) {
        showNotif("Invalid email or password.", "error");
        btn.innerText = "Sign In";
      }
    });
  }
});

// ─── Forgot Password ──────────────────────────────────────
const forgotBtn = document.getElementById("forgot-password");
if (forgotBtn) {
  forgotBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    if (!email) return showNotif("Enter your email first.", "error");
    try {
      await sendPasswordResetEmail(auth, email);
      showNotif("Password reset email sent!", "success");
    } catch {
      showNotif("Failed to send reset email.", "error");
    }
  });
}

// ─── Profile Page ─────────────────────────────────────────
async function fetchUserProfile() {
  try {
    const res = await fetch("/api/auth/profile", {
      headers: { Authorization: `Bearer ${state.authToken}` },
    });
    if (!res.ok) throw new Error();
    const data = await res.json();

    document.getElementById("p-username").value = data.displayAlias || "";
    document.getElementById("p-phone").value = data.phone || "";
    document.getElementById("p-bio").value = data.bio || "";

    document.getElementById("profile-loading").style.display = "none";
    document.getElementById("edit-profile-form").style.display = "block";
    state.user = data;
  } catch {
    showNotif("Failed to load profile.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const editForm = document.getElementById("edit-profile-form");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("p-save-btn");
      btn.innerText = "Saving...";

      try {
        const res = await fetch("/api/auth/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${state.authToken}`,
          },
          body: JSON.stringify({
            ...state.user,
            displayAlias: document.getElementById("p-username").value,
            phone: document.getElementById("p-phone").value,
            bio: document.getElementById("p-bio").value,
          }),
        });
        if (!res.ok) throw new Error();
        showNotif("Profile updated! ✨", "success");
      } catch {
        showNotif("Could not save changes.", "error");
      } finally {
        btn.innerText = "Save Changes";
      }
    });
  }
});

// ─── Preferences Page ─────────────────────────────────────
async function fetchUserPreferences() {
  try {
    const res = await fetch("/api/auth/profile", {
      headers: { Authorization: `Bearer ${state.authToken}` },
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    state.user = data;

    state.tagSelections.values = JSON.parse(data.values || "[]");
    state.tagSelections.lifestyle = JSON.parse(data.lifestyleTags || "[]");
    state.tagSelections.goal = JSON.parse(data.goals || "[]");

    document.querySelectorAll(".tag").forEach((tagEl) => {
      const groupEl = tagEl.closest(".tags");
      if (!groupEl) return;
      const group = groupEl.id.replace("pref-", "");
      if (state.tagSelections[group]?.includes(tagEl.textContent)) {
        tagEl.classList.add("active");
      }
    });

    document.getElementById("pref-loading").style.display = "none";
    document.getElementById("edit-pref-form").style.display = "block";
  } catch {
    showNotif("Failed to load preferences.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const prefForm = document.getElementById("edit-pref-form");
  if (prefForm) {
    prefForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("pref-save-btn");
      btn.innerText = "Updating...";

      try {
        const res = await fetch("/api/auth/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${state.authToken}`,
          },
          body: JSON.stringify({
            ...state.user,
            values: state.tagSelections.values || [],
            lifestyleTags: state.tagSelections.lifestyle || [],
            goals: state.tagSelections.goal || [],
          }),
        });
        if (!res.ok) throw new Error();
        showNotif("Algorithm recalibrated! ✨", "success");
      } catch {
        showNotif("Could not update preferences.", "error");
      } finally {
        btn.innerText = "Update Algorithm";
      }
    });
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const signOutBtn = document.getElementById("sign-out-btn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await signOut(auth);
      window.location.href = "index.html";
    });
  }
});

// ─── Expose to HTML ───────────────────────────────────────
window.showNotif = showNotif;
window.toggleTag = toggleTag;
window.toggleTagSingle = toggleTagSingle;
window.showRegStep = showRegStep;
window.regStep1 = regStep1;
window.regStep2 = regStep2;
window.submitProfileToBackend = submitProfileToBackend;

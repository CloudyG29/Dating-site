import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
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
    state.authToken = await getIdToken(user);

    // Only sync on pages that aren't mid-registration
    // submitProfileToBackend handles sync itself during registration
    if (!window.location.pathname.includes("register.html")) {
      await fetch("/api/auth/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${state.authToken}` },
      });
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

async function fetchDashboard() {
  try {
    const res = await fetch("/api/auth/profile", {
      headers: { Authorization: `Bearer ${state.authToken}` },
    });
    if (!res.ok) throw new Error();
    const data = await res.json();

    const greeting = document.getElementById("dash-greeting");
    if (greeting)
      greeting.textContent = `Welcome back, ${data.displayAlias || "stranger"}.`;

    const goalEl = document.querySelector(
      ".snapshot-item:nth-child(2) .snapshot-value",
    );
    if (goalEl)
      goalEl.textContent = data.goals ? JSON.parse(data.goals)[0] || "—" : "—";
  } catch {
    showNotif("Could not load dashboard.", "error");
  }
}

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
function regStep1() {
  state.user.displayAlias = document.getElementById("r-username").value.trim();
  state.user.email = document.getElementById("r-email").value.trim();
  state.user.phone = document.getElementById("r-phone").value.trim();
  state.user.password = document.getElementById("r-password").value;
  showRegStep(2);
}

function regStep2() {
  state.user.bio = document.getElementById("r-bio").value.trim();
  state.user.values = state.tagSelections.values || [];
  state.user.lifestyleTags = state.tagSelections.lifestyle || [];
  state.user.goals = state.tagSelections.goal || [];
  showRegStep(3);
}

async function submitProfileToBackend() {
  state.user.dealbreakers = [];

  try {
    // 1. Create Firebase user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      state.user.email,
      state.user.password,
    );
    const token = await getIdToken(userCredential.user);

    // 2. Sync to DB
    await fetch("/api/auth/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    // 3. Save profile
    const res = await fetch("/api/auth/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        phone: state.user.phone,
        displayAlias: state.user.displayAlias,
        bio: state.user.bio,
        values: state.user.values,
        goals: state.user.goals,
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

// ─── Expose to HTML ───────────────────────────────────────
window.showNotif = showNotif;
window.toggleTag = toggleTag;
window.toggleTagSingle = toggleTagSingle;
window.showRegStep = showRegStep;
window.regStep1 = regStep1;
window.regStep2 = regStep2;
window.submitProfileToBackend = submitProfileToBackend;

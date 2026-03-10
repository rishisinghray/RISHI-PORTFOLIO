// ╔════════════════════════════════════════════════════╗
// ║  auth.js  —  Email OTP + Google + Session Manager  ║
// ╚════════════════════════════════════════════════════╝

import { auth, db, googleProvider } from "./firebase-config.js";
import {
  signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Admin ──────────────────────────────────────────
export const ADMIN_EMAIL = "rishisinghray@gmail.com";
export const ADMIN_UID   = "kpFakxL3WjfaQE2KeCepDaO8rHO2";

export function checkAdmin(uid, email) {
  return email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || uid === ADMIN_UID;
}

// ── EmailJS config ─────────────────────────────────
const EJS_SERVICE  = "service_portfolio";
const EJS_TEMPLATE = "template_2esmohl";
const EJS_KEY      = "-CSqRUJJOnStE5syH2";

// ── In-memory OTP store ────────────────────────────
const _store = {};

// ── OTP: Send ─────────────────────────────────────
export async function sendOTP(email) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  _store[email] = { code, exp: Date.now() + 10 * 60 * 1000 };

  // Load EmailJS if not already loaded
  if (!window.emailjs) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
      s.onload = () => { setTimeout(resolve, 150); };
      s.onerror = () => reject(new Error("EmailJS SDK load failed"));
      document.head.appendChild(s);
    });
  }

  // Init emailjs
  try { emailjs.init({ publicKey: EJS_KEY }); } catch(e) {}

  // Send email
  const result = await emailjs.send(EJS_SERVICE, EJS_TEMPLATE, {
    to_email: email,
    otp_code: code,
  });

  if (result.status !== 200) {
    throw new Error("Send failed, status: " + result.status);
  }

  return true;
}

// ── OTP: Verify ────────────────────────────────────
export function verifyOTP(email, input) {
  const entry = _store[email];
  if (!entry) return { ok: false, msg: "No OTP found. Request a new one." };
  if (Date.now() > entry.exp) {
    delete _store[email];
    return { ok: false, msg: "OTP expired. Request a new one." };
  }
  if (input.trim() !== entry.code) return { ok: false, msg: "Incorrect code. Try again." };
  delete _store[email];
  return { ok: true };
}

// ── Firestore: Save user ───────────────────────────
export async function saveUser(uid, email, name = "", photo = "", method = "email") {
  const ref  = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const admin = checkAdmin(uid, email);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid, email,
      displayName: name || email.split("@")[0],
      photoURL: photo,
      loginMethod: method,
      isAdmin: admin,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    });
  } else {
    await setDoc(ref, { lastLogin: serverTimestamp() }, { merge: true });
  }
}

// ── Google login ───────────────────────────────────
export async function googleLogin() {
  const res = await signInWithPopup(auth, googleProvider);
  const u   = res.user;
  await saveUser(u.uid, u.email, u.displayName, u.photoURL, "google");
  return u;
}

// ── Session ────────────────────────────────────────
const SK = "rishi_sess";

export function setSession(data) {
  localStorage.setItem(SK, JSON.stringify({ ...data, _ts: Date.now() }));
}
export function getSession() {
  try {
    const raw = localStorage.getItem(SK);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (Date.now() - d._ts > 7 * 86400000) { clearSession(); return null; }
    return d;
  } catch { return null; }
}
export function clearSession() { localStorage.removeItem(SK); }
export function watchAuth(cb)  { return onAuthStateChanged(auth, cb); }

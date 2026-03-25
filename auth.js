// auth.js — Fixed for custom domain (rishisingh.indevs.in)
// Uses signInWithPopup ONLY — no redirect, no malformed URLs

import { app, db } from "./firebase-config.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Auth & Provider init ───────────────────────────
const auth           = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export { auth };

// ── Admin ──────────────────────────────────────────
export const ADMIN_EMAIL = "rishisinghray@gmail.com";
export const ADMIN_UID   = "kpFakxL3WjfaQE2KeCepDaO8rHO2";

export function checkAdmin(uid, email) {
  return email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || uid === ADMIN_UID;
}

// ── EmailJS OTP ────────────────────────────────────
const EJS_SERVICE  = "service_8250";
const EJS_TEMPLATE = "template_8250rishi";
const EJS_KEY      = "d37HyAQ53w40TM5w0";
const _store       = {};

export async function sendOTP(email) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  _store[email] = { code, exp: Date.now() + 10 * 60 * 1000 };
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EJS_SERVICE,
      template_id: EJS_TEMPLATE,
      user_id: EJS_KEY,
      template_params: { to_email: email, otp_code: code },
    }),
  });
  if (!res.ok) throw new Error("Email send failed: " + await res.text());
  return true;
}

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

// ── Save user to Firestore ─────────────────────────
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

// ── Google Login — signInWithPopup ONLY ───────────
// NEVER use signInWithRedirect on custom domains
// Popup does NOT generate any redirectUrl
export async function googleLogin() {
  const result = await signInWithPopup(auth, googleProvider);
  const u = result.user;
  await saveUser(u.uid, u.email, u.displayName, u.photoURL, "google");
  return u;
}

// ── Session helpers ────────────────────────────────
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

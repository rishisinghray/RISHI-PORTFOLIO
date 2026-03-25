// firebase-config.js — exports app, db only
// auth is initialized inside auth.js to avoid domain issues

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDULGyjqXeAHm2i6ba3dBzDqJtXojQ-Oro",
  authDomain:        "rishi-0.firebaseapp.com",
  databaseURL:       "https://rishi-0-default-rtdb.firebaseio.com",
  projectId:         "rishi-0",
  storageBucket:     "rishi-0.firebasestorage.app",
  messagingSenderId: "876178991741",
  appId:             "1:876178991741:web:42a0afa29ea9cb5b241f14",
  measurementId:     "G-Q23CBP1LS6"
};

export const app     = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// Firebase web config — identical to the ATLAS userscript (Pal's public
// client config; safe to commit, access is governed by Firestore rules).
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD29s2Jku_DZ42keIQAETgKg7HWt__QEwY",
  authDomain: "rgleaderboard.firebaseapp.com",
  projectId: "rgleaderboard",
  storageBucket: "rgleaderboard.firebasestorage.app",
  messagingSenderId: "247848634543",
  appId: "1:247848634543:web:6a7e506d60544d46cc6c5a",
  measurementId: "G-JW3Q972P9T",
};

// Firestore locations the page reads. Writes stay in ATLAS.
export const COLLECTIONS = {
  clans: "clans",
  eventDoc: ["events", "current"],
};

// Firebase JS SDK version — kept in lockstep with ATLAS so both clients
// exercise the same SDK behavior against the same rules.
export const SDK = "10.12.0";

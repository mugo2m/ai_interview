// firebase/client.ts
"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics"; // optional

const firebaseConfig = {
  apiKey: "AIzaSyCMPMb_UB8-Gg6tIvvuU2ZCe3ZFTi2A2Rg",
  authDomain: "aagi-683bf.firebaseapp.com",
  projectId: "aagi-683bf",
  storageBucket: "aagi-683bf.firebasestorage.app",
  messagingSenderId: "165390005164",
  appId: "1:165390005164:web:00fdf60dc3c7a0fd7f0009",
  measurementId: "G-YT5RHF0LM1",
};

// ✅ Correct initialization (Next.js safe)
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

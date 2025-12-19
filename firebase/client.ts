// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCvmPHp2kHbLQbSqW73TxS9NmSCARDqhfM",
  authDomain: "mugoai-3c70b.firebaseapp.com",
  projectId: "mugoai-3c70b",
  storageBucket: "mugoai-3c70b.firebasestorage.app",
  messagingSenderId: "1044600296070",
  appId: "1:1044600296070:web:558fde4ad9da314f2d3707",
  measurementId: "G-PTTHK4M8KR"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);


// Initialize Firebase
//const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAWJE_JnFT6NYw7Tcb4I07exQ7-Nc76pGY",
  authDomain: "employee-activity-tracki-fc516.firebaseapp.com",
  projectId: "employee-activity-tracki-fc516",
  storageBucket: "employee-activity-tracki-fc516.firebasestorage.app",
  messagingSenderId: "273246091359",
  appId: "1:273246091359:web:d8913c571103fe65ae03ea",
  measurementId: "G-LH98RHZV9Y"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

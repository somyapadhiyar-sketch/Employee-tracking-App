// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAR_iJWr2zgXvP_ifCaEFQX3-DbOcaG-UY",
  authDomain: "employee-activity-tracki-c60b1.firebaseapp.com",
  projectId: "employee-activity-tracki-c60b1",
  storageBucket: "employee-activity-tracki-c60b1.firebasestorage.app",
  messagingSenderId: "918548792743",
  appId: "1:918548792743:web:f417e5f9c8f27b0380a282",
  measurementId: "G-8T16HWNP48"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

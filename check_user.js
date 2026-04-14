import { doc, getDoc } from "firebase/firestore";
import { db } from "./src/firebase.js";

async function checkUser() {
  const email = "mansidarji6429@gmail.com";
  // We don't have the UID easily, but we can query by email.
  const { collection, query, where, getDocs } = await import("firebase/firestore");
  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  if (!snap.empty) {
    console.log("User Data:", snap.docs[0].data());
  } else {
    console.log("User not found");
  }
}
checkUser();

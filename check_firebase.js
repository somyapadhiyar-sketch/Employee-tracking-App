
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "./src/firebase.js";

async function checkData() {
  try {
    const q = query(collection(db, "employee_analytics"), limit(5));
    const snap = await getDocs(q);
    if (snap.empty) {
      console.log("No data in employee_analytics");
      return;
    }
    snap.forEach(doc => {
      console.log(doc.id, doc.data());
    });
  } catch (e) {
    console.error(e);
  }
}

checkData();

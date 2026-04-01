
import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { db } from "./src/firebase.js";

async function cleanupAdminData() {
  const emailToRemove = "mansidarji6429@gmail.com";
  console.log(`🧹 Starting cleanup for: ${emailToRemove}`);
  
  try {
    const q = query(collection(db, "employee_analytics"), where("employee_email", "==", emailToRemove));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      console.log("No records found for this user in employee_analytics.");
    } else {
      console.log(`Found ${snap.size} records. Deleting...`);
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, "employee_analytics", d.id)));
      await Promise.all(deletePromises);
      console.log("✅ Cleanup successful. All Mansi Darji analytics records removed.");
    }
  } catch (e) {
    console.error("❌ Error during cleanup:", e);
  }
}

cleanupAdminData();

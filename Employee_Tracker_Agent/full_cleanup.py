
import firebase_admin
from firebase_admin import credentials, firestore

# --- FIREBASE SETUP ---
cred = credentials.Certificate("firebase-key.json")
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

def delete_mansi_data():
    email_to_remove = "mansidarji6429@gmail.com"
    print(f"🧹 Starting targeted cleanup for: {email_to_remove}")
    
    coll_ref = db.collection("employee_analytics")
    # Query all results since email might be in different case or we might want to match by name too
    docs = coll_ref.stream()
    deleted = 0

    for doc in docs:
        data = doc.to_dict()
        email = data.get("employee_email", "").lower()
        name = data.get("user_name", "").lower()
        
        if email == email_to_remove or "mansi" in name:
            print(f"Deleting doc {doc.id} (User: {data.get('user_name')})")
            doc.reference.delete()
            deleted += 1
    
    print(f"✅ Cleanup finished. Total {deleted} 'Mansi' records removed.")

print("✨ Running Mansi Darji specific cleanup...")
delete_mansi_data()

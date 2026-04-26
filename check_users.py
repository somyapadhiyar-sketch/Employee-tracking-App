import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate("firebase-key.json")
try:
    firebase_admin.initialize_app(cred)
except ValueError:
    pass

db = firestore.client()
users = db.collection("users").get()
for u in users:
    d = u.to_dict()
    print(f"ID: {u.id} | Name: {d.get('firstName')} {d.get('lastName')} | Role: {d.get('role')}")

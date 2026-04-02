import time
import pygetwindow as gw
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import ctypes
import uiautomation as auto
import os
import json
from urllib.parse import urlparse

# --- FIREBASE SETUP ---
cred = credentials.Certificate("firebase-key.json")
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()
# ----------------------

PRODUCTIVE_KEYWORDS = [
    "tutorial",
    "course",
    "study",
    "react",
    "python",
    "learn",
    "code",
    "programming",
    "project",
    "n8n",
]
SOCIAL_MEDIA = [
    "whatsapp",
    "facebook",
    "instagram",
    "twitter",
    "netflix",
    "prime video",
]


def get_idle_time():
    class LASTINPUTINFO(ctypes.Structure):
        _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
    ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii))
    millis = ctypes.windll.kernel32.GetTickCount() - lii.dwTime
    return millis / 1000.0


def get_browser_url(window_title):
    url = "N/A"
    try:
        if "chrome" in window_title.lower() or "edge" in window_title.lower():
            window = auto.GetForegroundControl()
            address_bar = window.EditControl(Name="Address and search bar")
            if address_bar.Exists(0, 0):
                url = address_bar.GetValuePattern().Value
    except Exception:
        pass
    return url


def start_tracking():
    print("🚀 Auto-Detect Smart Tracking Agent Started...")
    print("📡 Waiting for ANY user to Clock-In from React Dashboard...\n")

    # Identity Config: Prioritize specifically who is using this machine
    AGENT_EMAIL = None
    STICKY_AGENT_EMAIL = None # Persistent identity from last seen dashboard
    config_path = os.path.join(os.path.dirname(__file__), "agent_config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                AGENT_EMAIL = json.load(f).get("email")
            print(f"🆔  Tracking Identity: {AGENT_EMAIL} (from config)\n")
        except Exception:
            pass

    while True:
        try:
            active_window = gw.getActiveWindow()
            title = active_window.title if active_window else ""
            
            # --- IDENTITY DETECTION (NEW: Scan Title for [Name]) ---
            detected_name_in_title = None
            if "[" in title and "]" in title:
                start = title.find("[") + 1
                end = title.find("]")
                detected_name_in_title = title[start:end].strip().lower() # e.g. "rahul gohel"

            # 1. AUTO-DETECT WHO IS CLOCKED IN
            temp_users_query = db.collection("users").where(filter=FieldFilter("clockedIn", "==", True)).get()
            # 1. ATTEMPT IDENTITY DETECTION (Scan Title for [Name])
            all_users = db.collection("users").get()
            active_user_doc = None

            if detected_name_in_title:
                for doc_item in all_users:
                    u = doc_item.to_dict()
                    fullname = f"{u.get('firstName', '')} {u.get('lastName', '')}".strip().lower()
                    if detected_name_in_title in fullname:
                        STICKY_AGENT_EMAIL = u.get("email")
                        if u.get("clockedIn") == True:
                            active_user_doc = doc_item
                        break

            # 2. FALLBACK TO CLOCKED-IN USERS
            if not active_user_doc:
                temp_users_query = [d for d in all_users if d.to_dict().get("clockedIn") == True]
                
                if STICKY_AGENT_EMAIL:
                    for doc_item in temp_users_query:
                        if doc_item.to_dict().get("email") == STICKY_AGENT_EMAIL:
                            active_user_doc = doc_item
                            break

                if not active_user_doc and AGENT_EMAIL:
                    for doc_item in temp_users_query:
                        if doc_item.to_dict().get("email") == AGENT_EMAIL:
                            active_user_doc = doc_item
                            break
                
                if not active_user_doc and temp_users_query:
                    active_user_doc = temp_users_query[0]
                
                if not active_user_doc:
                    # Final safety: If no one is clocked in, we can't track anyone
                    print(f"[{datetime.now().strftime('%I:%M:%S %p')}] ⚠️  No clocked-in users found. Waiting for someone to clock-in...")
                    time.sleep(10)
                    continue

            USER_DOC_ID = active_user_doc.id
            active_user = active_user_doc.to_dict()
            
            # --- SKIP ADMIN TRACKING ---
            if active_user.get("role") == "admin":
                print(f"[{datetime.now().strftime('%I:%M:%S %p')}] 🛡️  {active_user.get('firstName')} (Admin) detected. Tracking is disabled for Admins.")
                time.sleep(15)
                continue

            EMPLOYEE_EMAIL = active_user.get("email", "unknown@gmail.com")
            USER_NAME = f"{active_user.get('firstName', '')} {active_user.get('lastName', '')}".strip()

            # 2. GET CURRENT APP/WEBSITE INFO
            now = datetime.now()
            current_date = now.strftime("%Y-%m-%d")
            current_timestamp = now.strftime("%Y-%m-%d %H:%M:%S")

            is_on_break = active_user.get("isOnBreak", False)

            if is_on_break:
                # PRIVACY MODE: Do not track actual windows during break
                activity_name = "Break Mode (Away)"
                current_url = "N/A"
                chunk_status = "Idle"
                window_title = "Away - Break in Progress"
                app_used = "Break Mode"
            else:
                active_window = gw.getActiveWindow()
                window_title = active_window.title.lower() if active_window else "desktop"
                app_used = (
                    window_title.split("-")[-1].strip().title()
                    if "-" in window_title
                    else window_title.title()
                )

                current_url = get_browser_url(window_title)

                activity_name = app_used

                if app_used.lower() in ["google chrome", "msedge", "firefox", "brave"]:
                    if current_url and current_url != "N/A":
                        parseable_url = (
                            current_url
                            if current_url.startswith("http")
                            else "https://" + current_url
                        )
                        domain = urlparse(parseable_url).netloc.replace("www.", "")
                        activity_name = (
                            domain if domain else window_title.split("-")[0].strip().title()
                        )
                    else:
                        activity_name = window_title.split("-")[0].strip().title()

                # 3. CHUNK STATUS DETECTION (Is 10 second mein kya hua?)
                chunk_status = "Active"
                idle_seconds = get_idle_time()

                # -------------------------------------------------------------
                # NAYA LOGIC: 15 Minutes (900 Seconds) Break Detection (Auto-detect)
                # -------------------------------------------------------------
                if idle_seconds > 900:
                    activity_name = "Break Mode (Away)"
                    current_url = "N/A"
                    chunk_status = "Idle"
                    # Sync to users collection so UI updates
                    if not is_on_break:
                        db.collection("users").document(USER_DOC_ID).update({"isOnBreak": True})
                        active_user["isOnBreak"] = True
                        is_on_break = True
                
                elif is_on_break and idle_seconds < 10:
                    # Auto-resume if they were on break but just returned to work
                    db.collection("users").document(USER_DOC_ID).update({"isOnBreak": False})
                    active_user["isOnBreak"] = False
                    is_on_break = False

                elif idle_seconds > 10:
                    chunk_status = "Idle"
                elif any(sm in window_title for sm in SOCIAL_MEDIA):
                    chunk_status = "Idle"
                elif "youtube" in window_title:
                    is_productive = any(
                        word in window_title for word in PRODUCTIVE_KEYWORDS
                    )
                    if not is_productive:
                        chunk_status = "Idle"
            # -------------------------------------------------------------

            # 4. SAVE DATA TO FIREBASE
            safe_activity_name = (
                activity_name.replace("/", "_").replace(".", "_").replace(" ", "_")
            )
            doc_id = f"{EMPLOYEE_EMAIL}_{current_date}_{safe_activity_name}"

            doc_ref = db.collection("employee_analytics").document(doc_id)

            update_data = {
                "user_name": USER_NAME,
                "employee_email": EMPLOYEE_EMAIL,
                "date": current_date,
                "app_or_website": activity_name,
                "base_browser": (
                    app_used
                    if "chrome" in app_used.lower() or "edge" in app_used.lower()
                    else "N/A"
                ),
                "latest_window_title": window_title,
                "latest_url": current_url,
                "last_updated": current_timestamp,
            }

            # +10 seconds increment logic
            if chunk_status == "Active":
                update_data["active_time_seconds"] = firestore.Increment(10)
                update_data["idle_time_seconds"] = firestore.Increment(0)
            else:
                update_data["idle_time_seconds"] = firestore.Increment(10)
                update_data["active_time_seconds"] = firestore.Increment(0)

            update_data["total_time_seconds"] = firestore.Increment(10)

            doc_ref.set(update_data, merge=True)

            print(
                f"[{datetime.now().strftime('%I:%M:%S %p')}] ✅ [Tracking: {USER_NAME}] -> {activity_name} | +10s {chunk_status}"
            )

            time.sleep(10)

        except Exception as e:
            print(f"Error occurred during tracking: {e}")
            time.sleep(10)


if __name__ == "__main__":
    try:
        start_tracking()
    except KeyboardInterrupt:
        print(
            "\n\n🛑 Tracking Stopped Safely by User! Data is secure in Firebase. Have a great day!\n"
        )

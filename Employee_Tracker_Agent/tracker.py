import time
import pygetwindow as gw
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter # NEW: Warning hatane ke liye
import ctypes
import uiautomation as auto
from urllib.parse import urlparse

# --- FIREBASE SETUP ---
cred = credentials.Certificate("firebase-key.json")
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()
# ----------------------

PRODUCTIVE_KEYWORDS = ["tutorial", "course", "study", "react", "python", "learn", "code", "programming", "project", "n8n"]
SOCIAL_MEDIA = ["whatsapp", "facebook", "instagram", "twitter", "netflix", "prime video"]

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
    
    while True:
        try:
            # ---------------------------------------------------------
            # 1. AUTO-DETECT WHO IS CLOCKED IN (Fixed Warning & Logic)
            # Ab hum check kar rahe hain ki kiska 'clockedIn' True hai
            # ---------------------------------------------------------
            active_users_query = db.collection(u'users').where(filter=FieldFilter(u'clockedIn', u'==', True)).get()
            
            if not active_users_query:
                # Agar koi bhi Clocked In nahi hai, toh shanti se wait karo
                print(f"[{datetime.now().strftime('%I:%M:%S %p')}] ⏸️  No one is Clocked In. Waiting...")
                time.sleep(60)
                continue
                
            # Agar koi ON mila, toh uska data nikal lo
            active_user = active_users_query[0].to_dict()
            
            # Database se dynamically Name aur Email nikal liya
            EMPLOYEE_EMAIL = active_user.get('email', 'unknown@gmail.com')
            USER_NAME = f"{active_user.get('firstName', '')} {active_user.get('lastName', '')}".strip()
            # ---------------------------------------------------------

            # ---------------------------------------------------------
            # 2. TRACKING LOGIC
            # ---------------------------------------------------------
            now = datetime.now()
            current_date = now.strftime("%Y-%m-%d")
            current_timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
            
            active_window = gw.getActiveWindow()
            window_title = active_window.title.lower() if active_window else "desktop"
            app_used = window_title.split('-')[-1].strip().title() if '-' in window_title else window_title.title()
            
            current_url = get_browser_url(window_title)

            activity_name = app_used 
            
            if app_used.lower() in ["google chrome", "msedge", "firefox", "brave"]:
                if current_url and current_url != "N/A":
                    parseable_url = current_url if current_url.startswith('http') else 'https://' + current_url
                    domain = urlparse(parseable_url).netloc.replace('www.', '')
                    activity_name = domain if domain else window_title.split('-')[0].strip().title()
                else:
                    activity_name = window_title.split('-')[0].strip().title()

            status = "Active"
            idle_seconds = get_idle_time()

            if idle_seconds > 60:
                status = "Idle"
            elif any(sm in window_title for sm in SOCIAL_MEDIA):
                status = "Idle"
            elif "youtube" in window_title:
                is_productive = any(word in window_title for word in PRODUCTIVE_KEYWORDS)
                if not is_productive:
                    status = "Idle"
            
            safe_activity_name = activity_name.replace("/", "_").replace(".", "_").replace(" ", "_")
            doc_id = f"{EMPLOYEE_EMAIL}_{current_date}_{safe_activity_name}"
            
            doc_ref = db.collection(u'employee_analytics').document(doc_id)
            
            update_data = {
                "user_name": USER_NAME,
                "employee_email": EMPLOYEE_EMAIL,
                "date": current_date,
                "app_or_website": activity_name, 
                "base_browser": app_used if "chrome" in app_used.lower() or "edge" in app_used.lower() else "N/A",
                "latest_window_title": active_window.title if active_window else "Desktop",
                "latest_url": current_url,
                "last_updated": current_timestamp,
            }

            if status == "Active":
                update_data["active_time_seconds"] = firestore.Increment(60)
                update_data["idle_time_seconds"] = firestore.Increment(0) 
            else:
                update_data["idle_time_seconds"] = firestore.Increment(60)
                update_data["active_time_seconds"] = firestore.Increment(0)

            update_data["total_time_seconds"] = firestore.Increment(60)

            doc_ref.set(update_data, merge=True)
            
            print(f"[{datetime.now().strftime('%I:%M:%S %p')}] ✅ [Tracking: {USER_NAME}] -> {activity_name} | Status: {status}")

            time.sleep(60) 

        except Exception as e:
            print(f"Error occurred during tracking: {e}")
            time.sleep(60)

# --- MAIN EXECUTION BLOCK ---
if __name__ == "__main__":
    try:
        start_tracking()
    except KeyboardInterrupt:
        print("\n\n🛑 Tracking Stopped Safely by User! Data is secure in Firebase. Have a great day!\n")
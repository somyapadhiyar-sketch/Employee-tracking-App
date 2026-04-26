import time
import pygetwindow as gw
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import ctypes
import uiautomation as auto
import os
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

# --- GLOBAL STOP SIGNAL ---
# This will be triggered by the React app when a dashboard window is closed.
LAST_STOP_SIGNAL_TIME = 0

class StopSignalHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            global LAST_STOP_SIGNAL_TIME
            if self.path == "/stop":
                LAST_STOP_SIGNAL_TIME = time.time()
                print(f"🛑 [SIGNAL] Instant Stop received from browser.")
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b"OK")
        except (ConnectionResetError, BrokenPipeError):
            pass # Harmless socket reset when browser closes window
        except Exception as e:
            print(f"Signal Handler Error: {e}")
    
    def log_message(self, format, *args):
        return # Silent logs

def start_local_server():
    server = HTTPServer(("localhost", 12345), StopSignalHandler)
    server.serve_forever()

# Start the signal listener in a background thread
threading.Thread(target=start_local_server, daemon=True).start()
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

    # TRACKING STATE
    STICKY_ACTIVE_USER = None  # Global Machine Identity
    LAST_BREAK_STATE = False   # Track break transitions

    while True:
        try:
            # 1. GET ALL OPEN WINDOW TITLES
            all_titles = gw.getAllTitles()
            
            # --- CHECK FOR INSTANT STOP SIGNAL ---
            # If the browser just sent a /stop signal (within last 3s), stop immediately.
            if time.time() - LAST_STOP_SIGNAL_TIME < 3:
                if STICKY_ACTIVE_USER:
                    print(f"[{datetime.now().strftime('%I:%M:%S %p')}] 🛑 Instant Signal: Stopping tracking for {STICKY_ACTIVE_USER}.")
                    STICKY_ACTIVE_USER = None
                time.sleep(2)
                continue
            
            # 2. IDENTIFY THE CURRENTLY ACTIVE/FOCUSED WINDOW
            active_window = gw.getActiveWindow()
            active_title = active_window.title if active_window else ""
            
            # 3. IDENTITY DETECTION (Switch Sticky User if Focus changes to a dashboard)
            # Format: WorkTracker - [Name] - [Status]
            if "WorkTracker - [" in active_title:
                start = active_title.find("[") + 1
                end = active_title.find("]")
                user_name = active_title[start:end].strip()
                if STICKY_ACTIVE_USER != user_name:
                    STICKY_ACTIVE_USER = user_name
                    LAST_BREAK_STATE = False # Reset state for new user
                    print(f"🆔  Tracking Focus Switched to: {STICKY_ACTIVE_USER}")
            
            if not STICKY_ACTIVE_USER:
                # No dashboard has been focused yet on this machine
                time.sleep(5)
                continue

            # 4. PRESENCE CHECK: Is the STICKY user still "here"?
            # (Hybrid: Check Window Titles + Heartbeat Fallback for background tabs)
            match_string = f"WorkTracker - [{STICKY_ACTIVE_USER}]"
            is_window_open = any(match_string in t for t in all_titles)
            
            # --- FETCH USER STATE FROM FIREBASE ---
            all_users = db.collection("users").get()
            active_user_doc = None
            for doc_item in all_users:
                u = doc_item.to_dict()
                fullname = f"{u.get('firstName', '')} {u.get('lastName', '')}".strip()
                if STICKY_ACTIVE_USER == fullname:
                    active_user_doc = doc_item
                    break
            
            if not active_user_doc:
                STICKY_ACTIVE_USER = None
                continue
                
            active_user = active_user_doc.to_dict()
            USER_DOC_ID = active_user_doc.id
            
            # Check Heartbeat Presence (Background fallback)
            last_seen_str = active_user.get("lastSeen")
            is_heartbeat_fresh = False
            if last_seen_str:
                try:
                    last_seen_time = datetime.fromisoformat(last_seen_str.replace("Z", "+00:00"))
                    diff_seconds = (datetime.now(timezone.utc) - last_seen_time).total_seconds()
                    # Heartbeat is every 15s, so 40s is a safe buffer for background presence
                    if diff_seconds < 40:
                        is_heartbeat_fresh = True
                except: pass

            # --- DECIDE IF WE CONTINUE TRACKING ---
            # If the user switches to another tab, window title is gone, so we rely on heartbeat.
            # If the user closes the tab, heartbeat stops, so we pause after ~30-40s.
            if not is_window_open and not is_heartbeat_fresh:
                # Both signals are gone
                print(f"[{datetime.now().strftime('%I:%M:%S %p')}] ⏸️  Dashboard Closed/Gone for {STICKY_ACTIVE_USER}. Tracking Stopped.")
                STICKY_ACTIVE_USER = None
                time.sleep(5)
                continue
            USER_ROLE = active_user.get("role", "employee")

            # 6. ENFORCE TRACKING RULES
            # A. Must be Clocked In
            # B. Must NOT be on Break
            # C. Admin tracking is skipped
            
            if USER_ROLE == "admin":
                 time.sleep(15)
                 continue

            is_clocked_in = active_user.get("clockedIn", False)
            is_on_break = active_user.get("isOnBreak", False)
            
            # --- BREAK MODE LOGIC ---
            if is_on_break and not LAST_BREAK_STATE:
                print(f"[{datetime.now().strftime('%I:%M:%S %p')}] ⏸️  [BREAK MODE ON] {STICKY_ACTIVE_USER} is now on break. Tracking paused.")
                LAST_BREAK_STATE = True
            elif not is_on_break and LAST_BREAK_STATE:
                print(f"[{datetime.now().strftime('%I:%M:%S %p')}] ▶️  [BREAK MODE OFF] {STICKY_ACTIVE_USER} has resumed work. Tracking active.")
                LAST_BREAK_STATE = False

            if not is_clocked_in:
                # print(f"[{datetime.now().strftime('%I:%M:%S %p')}] ⏸️  {STICKY_ACTIVE_USER} is Clocked Out.")
                time.sleep(10)
                continue
                
            if is_on_break:
                # Silent while on break
                time.sleep(10)
                continue

            # 7. GET CURRENT APP/ACTIVITY INFO
            EMPLOYEE_EMAIL = active_user.get("email", "unknown@gmail.com")
            USER_NAME = STICKY_ACTIVE_USER
            
            now = datetime.now()
            current_date = now.strftime("%Y-%m-%d")
            current_timestamp = now.strftime("%Y-%m-%d %H:%M:%S")

            # Activity logic
            window_title_lower = active_title.lower() if active_window else "desktop"
            app_used = (
                window_title_lower.split("-")[-1].strip().title()
                if "-" in window_title_lower
                else window_title_lower.title()
            )

            current_url = get_browser_url(window_title_lower)
            activity_name = app_used

            if app_used.lower() in ["google chrome", "msedge", "firefox", "brave"]:
                if current_url and current_url != "N/A":
                    parseable_url = current_url if current_url.startswith("http") else "https://" + current_url
                    domain = urlparse(parseable_url).netloc.replace("www.", "")
                    activity_name = domain if domain else window_title_lower.split("-")[0].strip().title()
                else:
                    activity_name = window_title_lower.split("-")[0].strip().title()

            # 8. CHUNK STATUS DETECTION
            chunk_status = "Active"
            idle_seconds = get_idle_time()

            if idle_seconds > 900:
                activity_name = "Break Mode (Away)"
                current_url = "N/A"
                chunk_status = "Idle"
                if not is_on_break:
                    db.collection("users").document(USER_DOC_ID).update({"isOnBreak": True})
            elif idle_seconds > 10:
                chunk_status = "Idle"
            
            # Social/Youtube logic
            if any(sm in window_title_lower for sm in SOCIAL_MEDIA):
                chunk_status = "Idle"
            elif "youtube" in window_title_lower:
                is_productive = any(word in window_title_lower for word in PRODUCTIVE_KEYWORDS)
                if not is_productive:
                    chunk_status = "Idle"

            # 9. SAVE DATA TO FIREBASE
            safe_activity_name = activity_name.replace("/", "_").replace(".", "_").replace(" ", "_")
            doc_id = f"{EMPLOYEE_EMAIL}_{current_date}_{safe_activity_name}"
            doc_ref = db.collection("employee_analytics").document(doc_id)

            update_data = {
                "user_name": USER_NAME,
                "employee_email": EMPLOYEE_EMAIL,
                "date": current_date,
                "app_or_website": activity_name,
                "base_browser": app_used if ("chrome" in app_used.lower() or "edge" in app_used.lower()) else "N/A",
                "latest_window_title": active_title,
                "latest_url": current_url,
                "last_updated": current_timestamp,
                "active_time_seconds": firestore.Increment(10 if chunk_status == "Active" else 0),
                "idle_time_seconds": firestore.Increment(10 if chunk_status == "Idle" else 0),
                "total_time_seconds": firestore.Increment(10)
            }

            doc_ref.set(update_data, merge=True)
            print(f"[{datetime.now().strftime('%I:%M:%S %p')}] ✅ [Tracking: {USER_NAME}] -> {activity_name} | +10s {chunk_status}")

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

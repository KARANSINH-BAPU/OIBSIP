"""
NOVA - Advanced Voice Assistant
================================
Flask Backend API Server
"""
import os
import json
import threading
import datetime
import time

# ── Hardware-dependent libs — skipped on Vercel/cloud (no mic/speaker) ──
try:
    import speech_recognition as sr
    SR_AVAILABLE = True
except ImportError:
    sr = None
    SR_AVAILABLE = False

try:
    import pyttsx3
    TTS_AVAILABLE = True
except ImportError:
    pyttsx3 = None
    TTS_AVAILABLE = False
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import importlib
import nlp_engine
from nlp_engine import process_command, SMART_HOME_STATE

APP_VERSION = "2.2.0"
BASE_DIR = Path(__file__).parent

# Load .env with explicit path so keys always load fresh
load_dotenv(BASE_DIR / ".env", override=True)


def _reload_engine():
    """Pick up nlp_engine and .env changes without stale in-memory code."""
    load_dotenv(BASE_DIR / ".env", override=True)
    importlib.reload(nlp_engine)
    return nlp_engine.process_command

# Optional: Firebase Admin SDK for server-side token verification
try:
    import firebase_admin
    from firebase_admin import credentials, auth as firebase_auth
    _fb_cred_path = os.getenv("FIREBASE_ADMIN_KEY", "")
    if _fb_cred_path and os.path.exists(_fb_cred_path):
        cred = credentials.Certificate(_fb_cred_path)
        firebase_admin.initialize_app(cred)
        FIREBASE_ADMIN_READY = True
        print("[OK] Firebase Admin SDK initialized")
    else:
        FIREBASE_ADMIN_READY = False
except ImportError:
    FIREBASE_ADMIN_READY = False

# ─── Flask App Setup ──────────────────────────────────────────────────────────
app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = os.getenv("SECRET_KEY", "nova-secret-key-2024")
CORS(app)

# ─── Global State ─────────────────────────────────────────────────────────────
reminders_store = []
conversation_history = []
tts_engine = None
tts_lock = threading.Lock()
recognizer = sr.Recognizer() if SR_AVAILABLE else None
is_listening = False
listen_thread = None

# ─── TTS Engine ───────────────────────────────────────────────────────────────
def init_tts():
    global tts_engine
    if not TTS_AVAILABLE:
        print("[INFO] pyttsx3 not available (cloud/serverless env) — TTS skipped")
        tts_engine = None
        return
    try:
        tts_engine = pyttsx3.init()
        voices = tts_engine.getProperty("voices")
        for voice in voices:
            if "female" in voice.name.lower() or "zira" in voice.name.lower() or "helena" in voice.name.lower():
                tts_engine.setProperty("voice", voice.id)
                break
        tts_engine.setProperty("rate", 175)
        tts_engine.setProperty("volume", 0.9)
    except Exception as e:
        print(f"TTS init failed: {e}")
        tts_engine = None


def speak(text: str):
    """Convert text to speech in a thread-safe manner."""
    global tts_engine
    if not tts_engine:
        return
    # Strip emojis for TTS
    clean_text = "".join(c for c in text if ord(c) < 65536)
    def _speak():
        with tts_lock:
            try:
                tts_engine.say(clean_text)
                tts_engine.runAndWait()
            except Exception as e:
                print(f"TTS error: {e}")
    threading.Thread(target=_speak, daemon=True).start()


# ─── Speech Recognition ───────────────────────────────────────────────────────
def listen_once() -> str:
    """Listen for one voice command and return transcribed text."""
    if not SR_AVAILABLE:
        return "__error__: Voice recognition not available in cloud environment — use browser mic instead"
    try:
        with sr.Microphone() as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            audio = recognizer.listen(source, timeout=10, phrase_time_limit=8)
        text = recognizer.recognize_google(audio)
        return text
    except sr.WaitTimeoutError:
        return ""
    except sr.UnknownValueError:
        return ""
    except sr.RequestError as e:
        return f"__error__: Speech service unavailable - {e}"
    except Exception as e:
        return f"__error__: {e}"


# ─── Reminder Checker ─────────────────────────────────────────────────────────
def check_reminders():
    """Background thread to check and fire reminders."""
    while True:
        now = datetime.datetime.now()
        for reminder in reminders_store:
            if not reminder.get("fired", False):
                try:
                    rem_time = datetime.datetime.strptime(reminder["time"], "%H:%M")
                    rem_today = now.replace(
                        hour=rem_time.hour, minute=rem_time.minute, second=0, microsecond=0
                    )
                    if now >= rem_today and (now - rem_today).seconds < 60:
                        speak(f"Reminder: {reminder['title']}")
                        reminder["fired"] = True
                except Exception:
                    pass
        time.sleep(30)


# ─── Routes ───────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/login")
def login():
    return render_template("login.html")


@app.route("/api/verify-token", methods=["POST"])
def api_verify_token():
    """Verify a Firebase ID token (optional server-side check)."""
    if not FIREBASE_ADMIN_READY:
        return jsonify({"valid": True, "message": "Firebase Admin not configured — client-side auth only"})
    data = request.get_json(force=True)
    id_token = data.get("idToken", "")
    if not id_token:
        return jsonify({"valid": False, "error": "No token provided"}), 400
    try:
        decoded = firebase_auth.verify_id_token(id_token)
        return jsonify({"valid": True, "uid": decoded["uid"], "email": decoded.get("email", "")})
    except Exception as e:
        return jsonify({"valid": False, "error": str(e)}), 401


@app.route("/api/process", methods=["POST"])
def api_process():
    """Process a text command via NLP engine."""
    data  = request.get_json(force=True)
    text  = data.get("text", "").strip()
    extra = data.get("extra", None)
    lang  = data.get("lang", "en")

    if not text:
        return jsonify({"response": "Please say something!", "type": "empty"}), 400

    # Pass lang into extra so nlp_engine can use it
    if extra is None:
        extra = {}
    extra["lang"] = lang

    process = _reload_engine()
    result = process(text, extra)

    # Handle reminders
    if result.get("type") == "reminder_set":
        reminder = result.get("data", {})
        reminder["fired"] = False
        reminders_store.append(reminder)

    # Store conversation
    conversation_history.append({
        "user": text,
        "assistant": result.get("response", ""),
        "timestamp": datetime.datetime.now().isoformat(),
        "intent": result.get("intent", "unknown"),
    })
    if len(conversation_history) > 50:
        conversation_history.pop(0)

    # Speak the response
    speak(result.get("response", ""))

    return jsonify(result)


@app.route("/api/listen", methods=["POST"])
def api_listen():
    """Start voice listening and return transcribed text."""
    text = listen_once()
    if text.startswith("__error__"):
        return jsonify({"success": False, "error": text.replace("__error__: ", ""), "text": ""}), 500
    return jsonify({"success": True, "text": text})


@app.route("/api/speak", methods=["POST"])
def api_speak():
    """Convert text to speech."""
    data = request.get_json(force=True)
    text = data.get("text", "")
    if text:
        speak(text)
    return jsonify({"success": True})


@app.route("/api/reminders", methods=["GET"])
def api_get_reminders():
    return jsonify({"reminders": reminders_store})


@app.route("/api/reminders", methods=["POST"])
def api_add_reminder():
    data = request.get_json(force=True)
    reminder = {
        "id": str(datetime.datetime.now().timestamp()),
        "title": data.get("title", "Reminder"),
        "time": data.get("time", ""),
        "note": data.get("note", ""),
        "fired": False,
        "created_at": datetime.datetime.now().isoformat(),
    }
    reminders_store.append(reminder)
    speak(f"Reminder set for {reminder['title']} at {reminder['time']}")
    return jsonify({"success": True, "reminder": reminder})


@app.route("/api/reminders/<reminder_id>", methods=["DELETE"])
def api_delete_reminder(reminder_id):
    global reminders_store
    reminders_store = [r for r in reminders_store if r.get("id") != reminder_id]
    return jsonify({"success": True})


@app.route("/api/smart-home", methods=["GET"])
def api_smart_home_status():
    return jsonify({"state": SMART_HOME_STATE})


@app.route("/api/smart-home", methods=["POST"])
def api_smart_home_control():
    data = request.get_json(force=True)
    device = data.get("device", "")
    action = data.get("action")
    value = data.get("value")

    if device in SMART_HOME_STATE:
        if device == "thermostat" and value is not None:
            SMART_HOME_STATE["thermostat"] = int(value)
            speak(f"Thermostat set to {value} degrees")
        elif action is not None:
            SMART_HOME_STATE[device] = bool(action)
            state_str = "turned on" if action else "turned off"
            speak(f"{device.capitalize()} {state_str}")
    return jsonify({"success": True, "state": SMART_HOME_STATE})


@app.route("/api/history", methods=["GET"])
def api_history():
    return jsonify({"history": conversation_history[-20:]})


@app.route("/api/history", methods=["DELETE"])
def api_clear_history():
    conversation_history.clear()
    return jsonify({"success": True})


@app.route("/api/weather", methods=["GET", "POST"])
def api_weather():
    """Fetch weather by city or lat/lon."""
    if request.method == "POST":
        data = request.get_json(force=True) or {}
    else:
        data = request.args
    importlib.reload(nlp_engine)
    handle_weather = nlp_engine.handle_weather
    load_dotenv(BASE_DIR / ".env", override=True)
    city = data.get("city") or os.getenv("DEFAULT_CITY", "Mumbai")
    extra = {"city": city}
    if data.get("lat") is not None and data.get("lon") is not None:
        extra["lat"] = float(data["lat"])
        extra["lon"] = float(data["lon"])
    result = handle_weather("weather", extra=extra)
    return jsonify(result)


@app.route("/api/status", methods=["GET"])
def api_status():
    load_dotenv(BASE_DIR / ".env", override=True)
    return jsonify({
        "status": "online",
        "tts_available": tts_engine is not None,
        "version": APP_VERSION,
        "name": "NOVA",
        "ai_ready": bool(os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("OPENAI_API_KEY", "").strip()),
        "weather_ready": bool(os.getenv("WEATHER_API_KEY", "").strip()),
        "timestamp": datetime.datetime.now().isoformat(),
    })


# ─── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 42)
    print("   NOVA - Advanced Voice Assistant")
    print("   Version 2.0.0")
    print("=" * 42)
    print("\nStarting NOVA server...")

    # Initialize TTS
    init_tts()
    print("[OK] Text-to-Speech engine ready")

    # Start reminder checker
    reminder_thread = threading.Thread(target=check_reminders, daemon=True)
    reminder_thread.start()
    print("[OK] Reminder system active")

    print("\nOpen your browser at: http://localhost:5000")
    print("Press Ctrl+C to stop the server\n")

    speak("Hello! I'm NOVA, your advanced AI assistant. I'm ready to help you!")
    app.run(debug=False, host="0.0.0.0", port=5000, use_reloader=False)

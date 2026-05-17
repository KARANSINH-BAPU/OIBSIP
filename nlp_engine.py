"""
NOVA - Advanced Voice Assistant
================================
Core NLP and Intent Processing Module
"""
import re
import datetime
import os
import random
import requests
import smtplib
import wikipedia
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env", override=True)

# ─── Intent Patterns ──────────────────────────────────────────────────────────
INTENT_PATTERNS = {
    "nova_wake":  [r"\b(hello|hey|hi)\s+nova\b", r"^nova[!.?]*$"],
    "greeting":   [r"\b(hello|hi|hey|good morning|good evening|good afternoon|howdy|namaste|kem cho)\b"],
    "time":       [r"\b(time|what time|current time|tell me the time|what time is it|samay|वक्त)\b"],
    "date":       [r"\b(date|today|what day|current date|what date|aaj|tarikh)\b"],
    "weather":    [r"\b(weather|temperature|forecast|rain|climate|humid|garmi|thand|mausam)\b"],
    "wikipedia":  [r"\b(who is|tell me about|search (?:for )?|wikipedia|kaun hai|shu che)\b"],
    "email":      [r"\b(send email|compose email|write email|email to|mail karo)\b"],
    "reminder":   [r"\b(set reminder|remind me|schedule|add task|yaad dilao)\b"],
    "joke":       [r"\b(joke|funny|make me laugh|hasao|jokes)\b"],
    "calculate":  [r"\b(calculate|compute|math|\d+\s*[\+\-\*\/]\s*\d+|percent|percentage)\b"],
    "goodbye":    [r"\b(bye|goodbye|exit|see you|alvida|farewell)\b"],
    "help":       [r"\b(help|what can you do|commands|features|guide|madad)\b"],
    "smart_home": [r"\b(turn on|turn off|lights|fan|ac|air conditioner|thermostat|device)\b"],
    "news":       [r"\b(news|headlines|happening|latest news|top stories|khabar)\b"],
}

SMART_HOME_STATE = {"lights": False, "fan": False, "ac": False, "thermostat": 22}

JOKES = [
    "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
    "Why did the computer go to therapy? It had too many bytes of emotional baggage! 💻",
    "How many programmers does it take to change a light bulb? None — it's a hardware problem! 💡",
    "Why do Java developers wear glasses? Because they don't C#! 😄",
    "I told my computer I needed a break. Now it won't stop sending me vacation ads! 🏖️",
]

# ─── NOVA wake phrase ─────────────────────────────────────────────────────────
def strip_nova_wake(text: str) -> str:
    """Remove 'hello nova' / 'hey nova' prefix; return command after wake phrase."""
    t = text.strip()
    t = re.sub(r"^(hello|hey|hi)\s+nova[,!.?\s]*", "", t, flags=re.I).strip()
    t = re.sub(r"^nova[,!.?\s]*", "", t, flags=re.I).strip()
    return t

def is_nova_wake_only(text: str) -> bool:
    t = text.lower().strip()
    return bool(re.fullmatch(r"(hello|hey|hi)\s+nova[!.?]*", t) or t == "nova")

# ─── Intent Detector ──────────────────────────────────────────────────────────
def detect_intent(text: str) -> str:
    t = text.lower().strip()
    if is_nova_wake_only(text):
        return "nova_wake"
    # Knowledge questions → AI (not Wikipedia auto-search)
    if re.search(r"\b(what is|what are|explain|how does|how do|why is|define|meaning of)\b", t):
        return "general_ai"
    for intent, patterns in INTENT_PATTERNS.items():
        for p in patterns:
            if re.search(p, t):
                return intent
    return "general_ai"

# ─── Handlers ─────────────────────────────────────────────────────────────────
def handle_nova_wake(text, **_):
    h = datetime.datetime.now().hour
    g = "Good morning" if h < 12 else "Good afternoon" if h < 17 else "Good evening"
    return {
        "response": f"{g}! NOVA here — I'm listening. What can I help you with?",
        "type": "nova_wake",
        "speak": True,
    }

def handle_greeting(text, **_):
    h = datetime.datetime.now().hour
    g = "Good morning" if h < 12 else "Good afternoon" if h < 17 else "Good evening"
    return {"response": f"{g}! I'm NOVA, your AI assistant. How can I help you today?", "type": "greeting"}

def handle_time(text, **_):
    now = datetime.datetime.now()
    return {"response": f"⏰ The current time is {now.strftime('%I:%M %p')}", "type": "time",
            "data": {"time": now.strftime("%I:%M %p")}}

def handle_date(text, **_):
    now = datetime.datetime.now()
    return {"response": f"📅 Today is {now.strftime('%A, %B %d, %Y')}", "type": "date",
            "data": {"date": now.strftime("%B %d, %Y"), "day": now.strftime("%A")}}

def handle_weather(text, extra=None, **_):
    api_key = os.getenv("WEATHER_API_KEY", "").strip()
    if not api_key:
        return {"response": "Weather API key is not configured. Add WEATHER_API_KEY to .env", "type": "error"}
    # Extract city from text
    city = os.getenv("DEFAULT_CITY", "Mumbai")
    m = re.search(r"(?:weather|temperature|forecast|mausam)(?:\s+(?:in|at|of)\s+)([A-Za-z\s,]+)", text, re.I)
    if m:
        city = m.group(1).strip().rstrip("?.")
    # If lat/lon from frontend
    lat = (extra or {}).get("lat")
    lon = (extra or {}).get("lon")
    city_override = (extra or {}).get("city", "")
    if city_override:
        city = city_override

    try:
        if lat and lon:
            url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
        else:
            url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric"
        r = requests.get(url, timeout=6)
        d = r.json()
        if r.status_code == 200:
            temp  = round(d["main"]["temp"])
            fl    = round(d["main"]["feels_like"])
            desc  = d["weather"][0]["description"].title()
            hum   = d["main"]["humidity"]
            wind  = round(d["wind"]["speed"] * 3.6)
            name  = d["name"]
            icons = {"01":"☀️","02":"⛅","03":"☁️","04":"☁️","09":"🌧️","10":"🌦️","11":"⛈️","13":"❄️","50":"🌫️"}
            icon  = icons.get(d["weather"][0]["icon"][:2], "🌡️")
            return {
                "response": f"{icon} {name}: {temp}°C, {desc}. Feels like {fl}°C. Humidity {hum}%. Wind {wind} km/h.",
                "type": "weather",
                "data": {"city": name, "temp": temp, "description": desc,
                         "humidity": hum, "wind": wind, "feels_like": fl, "icon": icon}
            }
        return {"response": f"Could not fetch weather: {d.get('message','Unknown error')}", "type": "error"}
    except Exception as e:
        return {"response": f"Weather service error: {e}", "type": "error"}

def handle_wikipedia(text, lang="en", **_):
    stop = ["who is", "tell me about", "search for", "search", "wikipedia", "kaun hai", "shu che"]
    q = text.lower()
    for s in stop:
        q = q.replace(s, "").strip()
    if not q:
        return {"response": "What would you like me to search for?", "type": "question"}
    try:
        wikipedia.set_lang("en")
        summary = wikipedia.summary(q, sentences=3, auto_suggest=True)
        page    = wikipedia.page(q, auto_suggest=True)
        return {"response": summary, "type": "wikipedia",
                "data": {"title": page.title, "url": page.url}}
    except wikipedia.exceptions.DisambiguationError as e:
        opts = e.options[:4]
        return {"response": f"Multiple results for '{q}'. Did you mean: {', '.join(opts)}?", "type": "disambiguation"}
    except Exception:
        return handle_general_ai(text, lang)

def handle_email(text, email_data=None, **_):
    if not email_data:
        return {"response": "I'll help you send an email! Fill in the details in the panel. 📧",
                "type": "email_prompt", "action": "open_email_panel"}
    to      = email_data.get("to","")
    subject = email_data.get("subject","Message from NOVA")
    body    = email_data.get("body","")
    sender  = os.getenv("EMAIL_ADDRESS","").strip()
    pwd     = os.getenv("EMAIL_PASSWORD","").strip()
    try:
        msg = MIMEMultipart()
        msg["From"]    = sender
        msg["To"]      = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP("smtp.gmail.com", 587) as srv:
            srv.starttls()
            srv.login(sender, pwd)
            srv.send_message(msg)
        return {"response": f"✅ Email sent to {to}!", "type": "email_sent", "data": {"to": to, "subject": subject}}
    except Exception as e:
        return {"response": f"Email failed: {str(e)[:150]}", "type": "error"}

def handle_reminder(text, reminder_data=None, **_):
    if not reminder_data:
        return {"response": "I'll set a reminder! Fill in the details in the panel. ⏰",
                "type": "reminder_prompt", "action": "open_reminder_panel"}
    title    = reminder_data.get("title","Reminder")
    time_str = reminder_data.get("time","")
    note     = reminder_data.get("note","")
    return {"response": f"⏰ Reminder set: '{title}' at {time_str}!",
            "type": "reminder_set",
            "data": {"title": title, "time": time_str, "note": note,
                     "id": str(datetime.datetime.now().timestamp())}}

def handle_joke(text, **_):
    return {"response": random.choice(JOKES), "type": "joke"}

def handle_calculate(text, **_):
    try:
        expr = re.search(r"[\d\s\+\-\*\/\.\(\)]+", text)
        if expr:
            result = eval(expr.group().strip())  # noqa: S307
            return {"response": f"🧮 {expr.group().strip()} = **{result}**", "type": "calculate",
                    "data": {"result": result}}
    except Exception:
        pass
    return {"response": "Could not compute that. Try: '25 * 4' or '100 / 5'.", "type": "error"}

def handle_smart_home(text, **_):
    global SMART_HOME_STATE
    t = text.lower()
    device = None
    action = None
    if "light" in t: device = "lights"
    elif "fan" in t: device = "fan"
    elif "ac" in t or "air" in t: device = "ac"
    elif "thermostat" in t: device = "thermostat"
    if "turn on" in t or "on karo" in t: action = True
    elif "turn off" in t or "band karo" in t: action = False
    if device and action is not None and device != "thermostat":
        SMART_HOME_STATE[device] = action
        s = "turned ON 💡" if action else "turned OFF"
        return {"response": f"🏠 {device.capitalize()} {s}.", "type": "smart_home",
                "data": {"state": SMART_HOME_STATE, "device": device, "action": action}}
    st = SMART_HOME_STATE
    return {"response": f"🏠 Lights:{'ON' if st['lights'] else 'OFF'} | Fan:{'ON' if st['fan'] else 'OFF'} | AC:{'ON' if st['ac'] else 'OFF'} | Thermostat:{st['thermostat']}°C",
            "type": "smart_home", "data": {"state": st}}

def handle_help(text, **_):
    return {"response": (
        "🤖 NOVA — I can help with:\n"
        "• 🌤️ Real-time weather — 'Weather in Delhi'\n"
        "• 📚 Wikipedia search — 'Who is Elon Musk?'\n"
        "• 📧 Send emails — 'Send an email'\n"
        "• ⏰ Set reminders — 'Set a reminder for 5 PM'\n"
        "• 🏠 Smart home — 'Turn on the lights'\n"
        "• 🧮 Calculator — 'What is 25 × 4?'\n"
        "• 😄 Jokes — 'Tell me a joke'\n"
        "• 🤖 AI Chat — Ask me anything!\n"
        "• 🌐 Languages: English, Hindi, Gujarati"
    ), "type": "help"}

def handle_goodbye(text, **_):
    return {"response": "Goodbye! Have a wonderful day! 👋✨", "type": "goodbye"}

# ─── AI Handler (Gemini primary, OpenAI fallback) ─────────────────────────────
GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
]

def _gemini_generate(gemini_key: str, model: str, system_msg: str, text: str):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
    return requests.post(
        url,
        json={
            "contents": [{"parts": [{"text": f"{system_msg}\n\nUser: {text}"}]}],
            "generationConfig": {"maxOutputTokens": 400, "temperature": 0.7},
        },
        timeout=20,
    )

def _openai_generate(openai_key: str, system_msg: str, text: str):
    return requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
        json={
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": text},
            ],
            "max_tokens": 400,
            "temperature": 0.7,
        },
        timeout=20,
    )

NOVA_SYSTEM = (
    "You are NOVA, an advanced AI voice assistant. "
    "Always speak in first person as NOVA (say 'I' not 'NOVA says'). "
    "Be warm, professional, and concise (2-5 sentences unless code is requested). "
    "For coding questions, give clear examples. Never say you are ChatGPT or Gemini."
)

def handle_general_ai(text: str, lang: str = "en") -> dict:
    lang_instr = {"hi": "Respond in Hindi.", "gu": "Respond in Gujarati.", "en": "Respond in English."}.get(lang, "Respond in English.")
    system_msg = f"{NOVA_SYSTEM} {lang_instr}"
    last_error = ""

    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if gemini_key:
        for model in GEMINI_MODELS:
            try:
                r = _gemini_generate(gemini_key, model, system_msg, text)
                if r.status_code == 200:
                    ans = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                    return {"response": ans.strip(), "type": "ai_response", "model": model}
                err_body = r.json().get("error", {})
                last_error = err_body.get("message", r.text[:120])
                if r.status_code == 404:
                    continue
                if r.status_code == 429:
                    continue
            except Exception as exc:
                last_error = str(exc)
                continue

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if openai_key:
        try:
            r = _openai_generate(openai_key, system_msg, text)
            if r.status_code == 200:
                answer = r.json()["choices"][0]["message"]["content"].strip()
                return {"response": answer, "type": "ai_response", "model": "gpt-4o-mini"}
            last_error = r.json().get("error", {}).get("message", r.text[:120])
        except Exception as exc:
            last_error = str(exc)

    if "quota" in last_error.lower() or "429" in last_error:
        return {
            "response": "AI quota exceeded on your API keys. Check billing for Gemini/OpenAI, or wait and try again.",
            "type": "error",
        }
    if last_error:
        return {"response": f"AI unavailable: {last_error[:180]}", "type": "error"}
    return {"response": "AI is not configured. Add GEMINI_API_KEY or OPENAI_API_KEY to .env", "type": "error"}

# ─── Weather by lat/lon ───────────────────────────────────────────────────────
def handle_weather_by_location(data: dict) -> dict:
    return handle_weather("weather", extra=data)

# ─── Main Entry Point ─────────────────────────────────────────────────────────
def process_command(text: str, extra_data: dict = None) -> dict:
    if not text or not text.strip():
        return {"response": "I didn't hear that. Please try again.", "type": "empty"}

    lang = (extra_data or {}).get("lang", "en")
    raw  = text.strip()
    if is_nova_wake_only(raw):
        result = handle_nova_wake(raw)
        result["intent"] = "nova_wake"
        result["original_query"] = raw
        return result

    query  = strip_nova_wake(raw) or raw
    intent = detect_intent(query)

    # Special intents that need extra_data
    if intent == "email":
        email_payload = extra_data if extra_data and any(k in extra_data for k in ("to", "subject", "body")) else None
        result = handle_email(query, email_payload)
    elif intent == "reminder":
        reminder_payload = extra_data if extra_data and any(k in extra_data for k in ("title", "time", "note")) else None
        result = handle_reminder(query, reminder_payload)
    elif intent == "weather":
        result = handle_weather(query, extra=extra_data)
    elif intent == "nova_wake":
        result = handle_nova_wake(query)
    else:
        handler_map = {
            "greeting":  handle_greeting,
            "nova_wake": handle_nova_wake,
            "time":      handle_time,
            "date":      handle_date,
            "wikipedia": lambda t, **k: handle_wikipedia(t, lang=lang),
            "joke":      handle_joke,
            "calculate": handle_calculate,
            "smart_home":handle_smart_home,
            "help":      handle_help,
            "goodbye":   handle_goodbye,
            "news":      lambda t, **k: {"response": "📰 For live news, ask me to search any topic!", "type": "news"},
        }
        handler = handler_map.get(intent)
        result  = handler(query) if handler else handle_general_ai(query, lang)

    result["intent"]         = intent
    result["original_query"] = raw
    if result.get("type") == "ai_response" and not result.get("response", "").lower().startswith(("i'm nova", "i am nova", "hello")):
        pass  # AI already speaks as NOVA via system prompt
    return result

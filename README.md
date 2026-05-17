# 🤖 NOVA — Advanced AI Voice Assistant

<div align="center">

![NOVA Banner](https://img.shields.io/badge/NOVA-AI%20Voice%20Assistant-6ee7f7?style=for-the-badge&logo=python&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-2.x-000000?style=for-the-badge&logo=flask&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Status](https://img.shields.io/badge/Status-Completed-34d399?style=for-the-badge)

**Oasis Infobyte — Python Programming Internship**  
**Intern:** SOLANKI KARANSINH  
**Task:** Voice Assistant (Task 1)

</div>

---

## 📌 About the Project

**NOVA** (Neural Optimized Voice Assistant) is a full-stack, AI-powered voice assistant built with Python and Flask. It understands natural language commands, responds with text and speech, integrates with Firebase for user authentication and cloud storage, and controls a simulated smart home environment.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎤 **Voice Input** | Browser Web Speech API — speak commands directly |
| 👋 **Wake Word** | Say *"Hello NOVA"* to activate hands-free |
| 🔊 **Text-to-Speech** | Responses spoken aloud via browser + pyttsx3 |
| 🤖 **NLP Engine** | Intent recognition with Gemini / OpenAI AI fallback |
| 🌤️ **Live Weather** | Real-time weather by GPS location or city name |
| 📧 **Email Sending** | Send emails directly via voice or text command |
| ⏰ **Reminders** | Set and manage timed reminders |
| 🏠 **Smart Home** | Control virtual lights, fan, AC, and thermostat |
| 📋 **History** | Full conversation history saved to Firestore |
| 🔐 **Firebase Auth** | Email/Password + Google Sign-In |
| 🌐 **Multi-language** | English, Hindi, Gujarati support |

---

## 🛠️ Tech Stack

```
Backend   → Python 3.10+, Flask, pyttsx3, SpeechRecognition
Frontend  → HTML5, CSS3 (Glassmorphism), Vanilla JavaScript
AI/NLP    → Google Gemini API / OpenAI GPT (configurable)
Auth/DB   → Firebase Authentication, Cloud Firestore, Realtime DB
Weather   → OpenWeatherMap API
```

---

## 🚀 How to Run

### 1. Clone the Repository
```bash
git clone https://github.com/KaranSolankiOIBSIP/OIBSIP.git
cd OIBSIP/Task1_VoiceAssistant
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Setup Environment Variables
Create a `.env` file in the root folder:
```env
GEMINI_API_KEY=your_gemini_api_key
WEATHER_API_KEY=your_openweathermap_key
DEFAULT_CITY=Mumbai
SECRET_KEY=your_secret_key
```

### 4. Run the Server
```bash
python app.py
```

### 5. Open in Browser
```
http://localhost:5000
```

> ⚠️ Use **Google Chrome** or **Microsoft Edge** for full voice recognition support.

---

## 📁 Project Structure

```
Task1_VoiceAssistant/
├── app.py               # Flask backend — all API routes
├── nlp_engine.py        # NLP + intent detection engine
├── requirements.txt     # Python dependencies
├── .env                 # API keys (not committed to git)
├── templates/
│   ├── index.html       # Main assistant UI
│   └── login.html       # Firebase login page
└── static/
    ├── app.js           # Core frontend logic
    ├── nova-voice.js    # Wake word + TTS engine
    └── style.css        # Premium dark glassmorphism UI
```

---

## 🖼️ Screenshots

> The NOVA interface features a premium dark glassmorphism design with:
> - Animated orb that reacts to voice input
> - Real-time particle background
> - Glassmorphic side panels for weather, email, tips
> - Full chat history with assistant responses

---

## 💡 Example Commands

```
"Hello NOVA"              → Activates voice assistant
"What time is it?"        → Returns current time
"What's the weather?"     → Live weather by your location
"Tell me a joke"          → NOVA tells a joke
"Set a reminder for 6 PM" → Creates a reminder
"Turn on the lights"      → Controls smart home
"Who is APJ Abdul Kalam?" → AI knowledge query
"Calculate 15% of 5000"   → Math calculation
"Send an email"           → Opens email composer
```

---

## 📦 Requirements

```txt
flask
flask-cors
python-dotenv
SpeechRecognition
pyttsx3
requests
google-generativeai
openai
```

---

## 👨‍💻 Developer

<div align="center">

**SOLANKI KARANSINH**  
Python Programming Intern @ Oasis Infobyte  

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0077B5?style=for-the-badge&logo=linkedin)](https://linkedin.com/in/your-profile)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-181717?style=for-the-badge&logo=github)](https://github.com/your-github)

</div>

---

## 🏢 Internship Details

| Detail | Info |
|---|---|
| **Organization** | Oasis Infobyte |
| **Internship Type** | Python Programming |
| **Intern Name** | SOLANKI KARANSINH |
| **Task** | Voice Assistant (Task 1) |
| **Duration** | May 2026 |

---

## 📄 License

This project was developed as part of the **Oasis Infobyte Python Programming Internship**.  
© 2026 SOLANKI KARANSINH — All rights reserved.

---

<div align="center">

Made with ❤️ by **SOLANKI KARANSINH**  
⭐ Star this repo if you found it helpful!  
`#oasisinfobyte` `#python` `#voiceassistant` `#internship`

</div>

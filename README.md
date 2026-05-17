# 🤖 NOVA — Advanced AI Voice Assistant

<div align="center">

![NOVA Banner](https://img.shields.io/badge/NOVA-AI%20Voice%20Assistant-6ee7f7?style=for-the-badge&logo=python&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-2.x-000000?style=for-the-badge&logo=flask&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Status](https://img.shields.io/badge/Status-Live%20%E2%9C%85-34d399?style=for-the-badge)

**Oasis Infobyte — Python Programming Internship**
**Intern:** SOLANKI KARANSINH
**Task:** Voice Assistant (Task 1)

### 🌐 [LIVE DEMO → nova-ai-assitance.vercel.app](https://nova-ai-assitance.vercel.app/)

[![Live Demo](https://img.shields.io/badge/🚀%20Try%20NOVA%20Live-nova--ai--assitance.vercel.app-6ee7f7?style=for-the-badge)](https://nova-ai-assitance.vercel.app/)

</div>

---

## 📌 About the Project

**NOVA** (Neural Optimized Voice Assistant) is a full-stack, AI-powered voice assistant built with Python and Flask. It understands natural language commands, responds with text and speech, integrates with Firebase for user authentication and cloud storage, and controls a simulated smart home environment.

> 🔗 **Live URL:** https://nova-ai-assitance.vercel.app/

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
| ☁️ **Cloud Deployed** | Hosted live on Vercel |

---

## 🛠️ Tech Stack

```
Backend   → Python 3.10+, Flask
Frontend  → HTML5, CSS3 (Glassmorphism), Vanilla JavaScript
AI/NLP    → Google Gemini API / OpenAI GPT (configurable)
Auth/DB   → Firebase Authentication, Cloud Firestore, Realtime DB
Weather   → OpenWeatherMap API
Hosting   → Vercel (Cloud Deployment)
```

---

## 🌐 Live Demo

| | Link |
|---|---|
| 🚀 **Live App** | [https://nova-ai-assitance.vercel.app/](https://nova-ai-assitance.vercel.app/) |
| 💻 **GitHub Repo** | [https://github.com/KARANSINH-BAPU/OIBSIP](https://github.com/KARANSINH-BAPU/OIBSIP) |

---

## 🚀 How to Run Locally

### 1. Clone the Repository
```bash
git clone https://github.com/KARANSINH-BAPU/OIBSIP.git
cd OIBSIP
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
OIBSIP/
├── app.py               # Flask backend — all API routes
├── nlp_engine.py        # NLP + intent detection engine
├── requirements.txt     # Python dependencies
├── vercel.json          # Vercel deployment config
├── .env                 # API keys (not committed to git)
├── api/
│   └── index.py         # Vercel serverless entry point
├── templates/
│   ├── index.html       # Main assistant UI
│   └── login.html       # Firebase login page
└── static/
    ├── app.js           # Core frontend logic
    ├── nova-voice.js    # Wake word + TTS engine
    └── style.css        # Premium dark glassmorphism UI
```

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
requests
wikipedia
google-generativeai
firebase-admin
```

---

## 👨‍💻 Developer

<div align="center">

**SOLANKI KARANSINH**
Python Programming Intern @ Oasis Infobyte

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-nova--ai--assitance.vercel.app-6ee7f7?style=for-the-badge)](https://nova-ai-assitance.vercel.app/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0077B5?style=for-the-badge&logo=linkedin)](https://linkedin.com/in/your-profile)
[![GitHub](https://img.shields.io/badge/GitHub-KARANSINH--BAPU-181717?style=for-the-badge&logo=github)](https://github.com/KARANSINH-BAPU/OIBSIP)

</div>

---

## 🏢 Internship Details

| Detail | Info |
|---|---|
| **Organization** | Oasis Infobyte |
| **Internship Type** | Python Programming |
| **Intern Name** | SOLANKI KARANSINH |
| **Task** | Voice Assistant (Task 1) |
| **Live URL** | [nova-ai-assitance.vercel.app](https://nova-ai-assitance.vercel.app/) |
| **GitHub** | [KARANSINH-BAPU/OIBSIP](https://github.com/KARANSINH-BAPU/OIBSIP) |
| **Duration** | May 2026 |

---

## 📄 License

This project was developed as part of the **Oasis Infobyte Python Programming Internship**.
© 2026 SOLANKI KARANSINH — All rights reserved.

---

<div align="center">

Made with ❤️ by **SOLANKI KARANSINH**

🌐 **[Try NOVA Live →](https://nova-ai-assitance.vercel.app/)**

⭐ Star this repo if you found it helpful!
`#oasisinfobyte` `#python` `#voiceassistant` `#internship` `#vercel`

</div>

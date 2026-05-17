/* ─── NOVA Voice Assistant — Frontend Logic (v3 — Production Ready) ─── */

const API = '';  // Flask same origin

// ── State ──
let isListening    = false;
let currentThermo  = 22;
let recognition    = null;
let currentLang    = 'en';   // 'en' | 'hi' | 'gu'

// ── DOM Refs ──
const chatWindow   = document.getElementById('chatWindow');
const textInput    = document.getElementById('textInput');
const micBtn       = document.getElementById('micBtn');
const orbContainer = document.getElementById('orbContainer');
const mainOrb      = document.getElementById('mainOrb');
const waveform     = document.getElementById('waveform');
const orbStatus    = document.getElementById('orbStatus');

// ── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initParticles();
  checkStatus();
  cycleTips();
  autoWeatherByLocation();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
  window.addEventListener('nova-ready', (e) => {
    // Start always-on wake listener as soon as we're authenticated
    if (typeof startNovaWakeListener === 'function') {
      setTimeout(startNovaWakeListener, 800);
    }
    if (sessionStorage.getItem('nova_greeted')) return;
    sessionStorage.setItem('nova_greeted', '1');
    const name = e.detail?.name ? ` ${e.detail.name}` : '';
    const greet = `Hello${name}! I'm NOVA, your AI assistant. Say "Hello NOVA" or type your question.`;
    addChatMessage('assistant', greet, true);
    if (typeof speakNova === 'function') speakNova(`Hello! I'm NOVA. How can I help you today?`);
  });
  // Wake listener is started inside the nova-ready handler (after Firebase auth)
  textInput.addEventListener('input', () => {
    textInput.style.borderColor = textInput.value ? 'rgba(110,231,247,0.3)' : '';
  });
  // Check Speech API support
  if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
    micBtn.title = 'Voice input requires Chrome browser';
    micBtn.style.opacity = '0.5';
  }
  // ── Orb / eye icon click also triggers mic ──
  const orbEl = document.getElementById('mainOrb');
  if (orbEl) orbEl.addEventListener('click', startListening);
  const orbCont = document.getElementById('orbContainer');
  if (orbCont) orbCont.style.cursor = 'pointer';
});

// ── Status Check ─────────────────────────────────────────────────────────────
async function checkStatus() {
  try {
    const r = await fetch(`${API}/api/status`);
    const d = await r.json();
    const dot  = document.querySelector('.status-dot');
    const span = document.querySelector('.status-indicator span');
    if (d.status === 'online') {
      dot.className  = 'status-dot online';
      const aiOk = d.ai_ready ? 'AI ready' : 'AI keys missing';
      span.textContent = d.version ? `Online v${d.version}` : 'Online';
      if (!d.ai_ready) showToast('Add GEMINI_API_KEY or OPENAI_API_KEY to .env and restart', 'error');
    }
  } catch {
    const dot = document.querySelector('.status-dot');
    if (dot) { dot.className = 'status-dot'; }
    const span = document.querySelector('.status-indicator span');
    if (span) span.textContent = 'Offline';
  }
}

// ── Tab Switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const panels = { main:'tabMain', reminders:'tabReminders', smarthome:'tabSmartHome', history:'tabHistory' };
  const btns   = { main:'navMain', reminders:'navReminders', smarthome:'navSmartHome', history:'navHistory' };
  document.getElementById(panels[tab])?.classList.add('active');
  document.getElementById(btns[tab])?.classList.add('active');
  if (tab === 'history')   { if (typeof loadHistory   === 'function') loadHistory();   }
  if (tab === 'reminders') { if (typeof loadReminders === 'function') loadReminders(); }
  if (tab === 'smarthome') { if (typeof loadSmartHome === 'function') loadSmartHome(); }
}

// ══════════════════════════════════════════════════════════════════════════════
// VOICE — Browser Web Speech API (no PyAudio needed)
// ══════════════════════════════════════════════════════════════════════════════
function startListening() {
  if (isListening) {
    stopListening();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('❌ Voice input requires Chrome or Edge browser', 'error');
    return;
  }

  // ── Pause always-on wake listener (only one SR instance allowed at a time) ──
  if (typeof pauseWakeForMic === 'function') pauseWakeForMic();
  else if (typeof stopNovaWakeListener === 'function') stopNovaWakeListener();

  recognition = new SpeechRecognition();
  recognition.lang = { en: 'en-US', hi: 'hi-IN', gu: 'gu-IN' }[currentLang] || 'en-US';
  recognition.continuous      = false;
  recognition.interimResults  = false;
  recognition.maxAlternatives = 1;

  isListening = true;
  setOrbState('listening');
  showToast('🎤 Listening… speak now', '');

  recognition.onstart = () => {
    setOrbState('listening');
  };

  recognition.onspeechstart = () => {
    showToast('🎤 Hearing you…', '');
  };

  recognition.onresult = async (event) => {
    const text = event.results[0][0].transcript.trim();
    textInput.value = text;
    isListening = false;
    setOrbState('processing');
    showToast(`Heard: "${text}"`, 'success');
    const cmd = typeof parseNovaCommand === 'function' ? parseNovaCommand(text) || text : text;
    if (typeof isNovaWakePhrase === 'function' && isNovaWakePhrase(text)) {
      await processCommand(text, null, { source: 'voice_wake' });
    } else {
      await processCommand(cmd, null, { source: 'voice', displayUserText: text });
    }
    setOrbState('idle');
    _resumeWake();
  };

  recognition.onerror = (event) => {
    isListening = false;
    setOrbState('idle');
    if (event.error === 'not-allowed' || event.error === 'permission-denied') {
      showToast('❌ Mic access denied — allow it in browser settings', 'error');
      return; // don't resume — no mic permission
    } else if (event.error === 'no-speech') {
      showToast('🔇 No speech detected, try again', 'error');
    } else if (event.error === 'network') {
      showToast('❌ Network error during voice recognition', 'error');
    } else {
      showToast(`❌ Voice error: ${event.error}`, 'error');
    }
    _resumeWake();
  };

  recognition.onend = () => {
    if (isListening) { // ended without a result
      isListening = false;
      setOrbState('idle');
      _resumeWake();
    }
  };

  try {
    recognition.start();
  } catch(e) {
    isListening = false;
    setOrbState('idle');
    showToast('❌ Could not start microphone — try clicking again', 'error');
    _resumeWake();
  }
}

// ── Helper: restart wake listener after mic button session ends ──
function _resumeWake() {
  setTimeout(() => {
    if (typeof startNovaWakeListener === 'function') startNovaWakeListener();
  }, 700);
}

function stopListening() {
  if (recognition) { try { recognition.stop(); } catch(e) {} }
  isListening = false;
  setOrbState('idle');
}

function setOrbState(state) {
  mainOrb.classList.remove('listening');
  micBtn.classList.remove('listening');
  waveform.classList.remove('active');
  orbContainer.classList.remove('processing');

  const labels = {
    idle: 'Say "Hello NOVA" or click mic',
    listening: 'Listening…',
    processing: 'NOVA is thinking…',
  };
  orbStatus.textContent = labels[state] || 'Click mic to talk';

  if (state === 'listening') {
    mainOrb.classList.add('listening');
    micBtn.classList.add('listening');
    waveform.classList.add('active');
  } else if (state === 'processing') {
    orbContainer.classList.add('processing');
  }
}

// ── Text Command ──────────────────────────────────────────────────────────────
async function sendTextCommand() {
  const text = textInput.value.trim();
  if (!text) return;
  textInput.value = '';
  textInput.style.borderColor = '';
  setOrbState('processing');
  const cmd = typeof parseNovaCommand === 'function' ? (parseNovaCommand(text) || text) : text;
  await processCommand(
    typeof isNovaWakePhrase === 'function' && isNovaWakePhrase(text) ? text : cmd,
    null,
    { source: 'text', displayUserText: text }
  );
  setOrbState('idle');
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextCommand(); }
}

function sendCommand(text) { textInput.value = text; sendTextCommand(); }

// ── Core Command Processor ────────────────────────────────────────────────────
async function processCommand(text, extra = null, meta = {}) {
  const displayText = meta.displayUserText || text;
  addChatMessage('user', displayText);
  const typingId = addTypingIndicator();

  if (typeof window._novaLogEvent === 'function') {
    window._novaLogEvent('chat_message', {
      method: meta.source || 'text',
      intent_hint: (typeof isNovaWakePhrase === 'function' && isNovaWakePhrase(text)) ? 'nova_wake' : 'command',
    });
  }

  try {
    const body = { text, lang: currentLang };
    if (extra) body.extra = extra;
    const r = await fetch(`${API}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!r.ok) throw new Error(`Server error ${r.status}`);
    const d = await r.json();

    removeTypingIndicator(typingId);
    const novaReply = d.response || 'Sorry, I had trouble with that.';
    addChatMessage('assistant', novaReply, true);
    if (typeof speakNova === 'function') speakNova(novaReply);
    handleResponseSideEffects(d);
    setOrbState('idle');

    if (typeof window._novaLogEvent === 'function') {
      window._novaLogEvent('nova_response', { intent: d.intent || 'unknown', type: d.type || '' });
    }

    // Save to Firestore history
    if (typeof window._saveHistoryToDB === 'function') {
      window._saveHistoryToDB({ user: text, assistant: d.response, intent: d.intent });
    }
    return d;
  } catch (e) {
    removeTypingIndicator(typingId);
    addChatMessage('assistant', `⚠️ Cannot reach NOVA server. Make sure app.py is running!\n${e.message}`);
    setOrbState('idle');
  }
}

// ── Handle special response types ─────────────────────────────────────────────
function handleResponseSideEffects(d) {
  if (d.type === 'weather' && d.data)     renderWeatherCard(d.data);
  if (d.type === 'email_prompt')           { toggleEmailForm(true); }
  if (d.type === 'reminder_prompt')        { switchTab('reminders'); showAddReminder(); }
  if (d.type === 'reminder_set' && d.data) {
    if (typeof loadReminders === 'function') loadReminders();
    showToast('⏰ Reminder set!', 'success');
  }
  if (d.type === 'smart_home' && d.data?.state) updateSmartHomeUI(d.data.state);
}

// ── Chat UI ───────────────────────────────────────────────────────────────────
function clearWelcome() {
  const w = chatWindow.querySelector('.chat-welcome');
  if (w) w.remove();
}

function addChatMessage(role, text, isNova = false) {
  clearWelcome();
  const msg    = document.createElement('div');
  msg.className = `chat-msg ${role}`;
  const avatar  = role === 'user' ? '👤' : '🤖';
  const label   = role === 'assistant' && isNova ? '<div class="msg-sender">NOVA</div>' : '';
  msg.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-content">${label}<div class="msg-bubble">${escHtml(text)}</div></div>`;
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addTypingIndicator() {
  clearWelcome();
  const id = 'typing-' + Date.now();
  const el = document.createElement('div');
  el.className = 'chat-msg assistant'; el.id = id;
  el.innerHTML = `<div class="msg-avatar">🤖</div>
    <div class="msg-content"><div class="msg-sender">NOVA</div>
    <div class="msg-bubble" style="display:flex;gap:6px;align-items:center">
      <span style="animation:wavePulse 1s infinite;display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--cyan)"></span>
      <span style="animation:wavePulse 1s .2s infinite;display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--purple)"></span>
      <span style="animation:wavePulse 1s .4s infinite;display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--pink)"></span>
    </div></div>`;
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  document.getElementById(id)?.remove();
}

// ── Weather Card ──────────────────────────────────────────────────────────────
function renderWeatherCard(data) {
  const panel = document.getElementById('weatherDisplay');
  if (!panel) return;
  panel.innerHTML = `
    <div class="weather-main">
      <span class="weather-icon-big">${data.icon || '🌡️'}</span>
      <div>
        <div class="weather-temp">${data.temp}°C</div>
        <div class="weather-desc">${data.description}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">${data.city}</div>
      </div>
    </div>
    <div class="weather-stats">
      <div class="weather-stat"><div class="label">Humidity</div><div class="value">${data.humidity}%</div></div>
      <div class="weather-stat"><div class="label">Wind</div><div class="value">${data.wind} km/h</div></div>
      ${data.feels_like ? `<div class="weather-stat"><div class="label">Feels Like</div><div class="value">${data.feels_like}°C</div></div>` : ''}
    </div>`;
}
function showWeatherError(msg) {
  const panel = document.getElementById('weatherDisplay');
  if (!panel) return;
  panel.innerHTML = `<div class="weather-placeholder"><span>${escHtml(msg)}</span></div>`;
}

async function fetchWeather(extra = {}) {
  try {
    const r = await fetch(`${API}/api/weather`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extra),
    });
    const d = await r.json();
    if (d.type === 'weather' && d.data) {
      renderWeatherCard(d.data);
      return d.data;
    }
    showWeatherError(d.response || 'Could not load weather');
  } catch {
    showWeatherError('Weather unavailable — is the server running?');
  }
  return null;
}

// ── Language Selector ─────────────────────────────────────────────────────────
function setLanguage(lang) {
  currentLang = lang;
  const labels = { en: '🇬🇧 EN', hi: '🇮🇳 HI', gu: '🇮🇳 GU' };
  const btn = document.getElementById('langBtn');
  if (btn) btn.textContent = labels[lang] || '🇬🇧 EN';
  const langMap = { en: 'en-US', hi: 'hi-IN', gu: 'gu-IN' };
  if (recognition) recognition.lang = langMap[lang] || 'en-US';
  showToast(`Language: ${labels[lang]}`, 'success');
}

// ── Auto Weather by GPS Location ─────────────────────────────────────────────
function autoWeatherByLocation() {
  if (!navigator.geolocation) {
    fetchWeather({});
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => fetchWeather({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => fetchWeather({})
  );
}

function toggleEmailForm(forceOpen) {
  const form   = document.getElementById('emailForm');
  const btn    = document.querySelector('.panel-toggle-btn');
  const isOpen = form.style.display !== 'none';
  const show   = forceOpen === true ? true : !isOpen;
  form.style.display       = show ? 'flex' : 'none';
  form.style.flexDirection = 'column';
  if (btn) btn.textContent = show ? '−' : '+';
}

async function sendEmail() {
  const to      = document.getElementById('emailTo').value.trim();
  const subject = document.getElementById('emailSubject').value.trim();
  const body    = document.getElementById('emailBody').value.trim();
  if (!to || !subject) { showToast('Fill in To and Subject fields', 'error'); return; }
  showLoading('Sending email…');
  const result = await processCommand('send email', { to, subject, body });
  hideLoading();
  if (result?.type === 'email_sent') {
    document.getElementById('emailTo').value      = '';
    document.getElementById('emailSubject').value = '';
    document.getElementById('emailBody').value    = '';
    toggleEmailForm(false);
  }
}

// ── Reminders ─────────────────────────────────────────────────────────────────
function showAddReminder() {
  const f = document.getElementById('addReminderForm');
  f.style.display = 'block';
  document.getElementById('remTitle').focus();
}
function hideAddReminder() { document.getElementById('addReminderForm').style.display = 'none'; }

// Reminder CRUD — overridden by Firestore module when signed in
// These are fallbacks using Flask API
if (typeof window.addReminder === 'undefined') {
  window.addReminder = async function() {
    const title = document.getElementById('remTitle').value.trim();
    const time  = document.getElementById('remTime').value;
    const note  = document.getElementById('remNote').value.trim();
    if (!title || !time) { showToast('Enter title and time', 'error'); return; }
    try {
      await fetch(`${API}/api/reminders`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ title, time, note })
      });
      showToast('⏰ Reminder set!', 'success');
      document.getElementById('remTitle').value = '';
      document.getElementById('remTime').value  = '';
      document.getElementById('remNote').value  = '';
      hideAddReminder();
      if (typeof window.loadReminders === 'function') loadReminders();
    } catch { showToast('Could not save reminder', 'error'); }
  };
}

if (typeof window.loadReminders === 'undefined') {
  window.loadReminders = async function() {
    try {
      const r = await fetch(`${API}/api/reminders`);
      const d = await r.json();
      renderReminders(d.reminders || []);
    } catch { /* offline */ }
  };
}

if (typeof window.deleteReminder === 'undefined') {
  window.deleteReminder = async function(id) {
    await fetch(`${API}/api/reminders/${id}`, { method:'DELETE' });
    if (typeof window.loadReminders === 'function') loadReminders();
    showToast('Reminder deleted', '');
  };
}

function renderReminders(reminders) {
  const el = document.getElementById('remindersList');
  if (!el) return;
  if (!reminders.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">⏰</div><h3>No reminders yet</h3><p>Add a reminder or say "Set a reminder"</p></div>`;
    return;
  }
  el.innerHTML = reminders.map(r => `
    <div class="reminder-card glass-card" id="rem-${r.id}">
      <div class="rem-time">${r.time || ''}</div>
      <h4>${escHtml(r.title)}</h4>
      ${r.note ? `<div class="rem-note">${escHtml(r.note)}</div>` : ''}
      <div class="rem-actions"><button class="delete-btn" onclick="deleteReminder('${r.id}')">🗑️ Delete</button></div>
    </div>`).join('');
}

// ── Smart Home ────────────────────────────────────────────────────────────────
async function loadSmartHome() {
  try {
    const r = await fetch(`${API}/api/smart-home`);
    const d = await r.json();
    updateSmartHomeUI(d.state);
  } catch { /* offline */ }
}

function updateSmartHomeUI(state) {
  if (!state) return;
  ['lights','fan','ac'].forEach(dev => {
    const toggle = document.getElementById(`${dev}Toggle`);
    const status = document.getElementById(`${dev}Status`);
    const card   = document.getElementById(`device${cap(dev)}`);
    if (toggle) toggle.checked = !!state[dev];
    if (status) {
      status.textContent = state[dev] ? 'ON' : 'OFF';
      status.className   = 'device-status' + (state[dev] ? ' on' : '');
    }
    if (card) card.classList.toggle('active-device', !!state[dev]);
  });
  if (state.thermostat !== undefined) {
    currentThermo = state.thermostat;
    const tVal  = document.getElementById('thermostatValue');
    const tStat = document.getElementById('thermostatStatus');
    if (tVal)  tVal.textContent  = state.thermostat;
    if (tStat) tStat.textContent = state.thermostat + '°C';
  }
}

// controlDevice & adjustThermostat are defined in the Firebase module in index.html
// These are fallbacks if not overridden
if (typeof window.controlDevice === 'undefined') {
  window.controlDevice = async function(device, action) {
    try {
      const r = await fetch(`${API}/api/smart-home`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ device, action })
      });
      const d = await r.json();
      updateSmartHomeUI(d.state);
      showToast(`${cap(device)} ${action ? 'ON' : 'OFF'}`, 'success');
    } catch { showToast('Could not control device', 'error'); }
  };
}

if (typeof window.adjustThermostat === 'undefined') {
  window.adjustThermostat = async function(delta) {
    const tVal  = document.getElementById('thermostatValue');
    const tStat = document.getElementById('thermostatStatus');
    currentThermo = Math.min(30, Math.max(16, currentThermo + delta));
    tVal.textContent  = currentThermo;
    tStat.textContent = currentThermo + '°C';
    try {
      await fetch(`${API}/api/smart-home`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ device:'thermostat', value: currentThermo })
      });
    } catch { /* offline */ }
  };
}

// ── History ───────────────────────────────────────────────────────────────────
if (typeof window.loadHistory === 'undefined') {
  window.loadHistory = async function() {
    try {
      const r = await fetch(`${API}/api/history`);
      const d = await r.json();
      renderHistory(d.history || []);
    } catch { /* offline */ }
  };
}

if (typeof window.clearHistory === 'undefined') {
  window.clearHistory = async function() {
    await fetch(`${API}/api/history`, { method:'DELETE' });
    renderHistory([]);
    showToast('History cleared', '');
  };
}

function renderHistory(history) {
  const el = document.getElementById('historyList');
  if (!el) return;
  if (!history.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><h3>No conversations yet</h3><p>Start talking to NOVA to see your history here</p></div>`;
    return;
  }
  el.innerHTML = [...history].reverse().map(h => `
    <div class="history-item">
      <div class="h-user">You</div>
      <div class="h-query">${escHtml(h.user)}</div>
      <div class="h-response">${escHtml((h.assistant || '').slice(0,200) + ((h.assistant || '').length > 200 ? '…' : ''))}</div>
      <div class="h-meta">
        <span class="h-tag">${h.intent || 'general'}</span>
        <span class="h-time">${h.timestamp ? new Date(h.timestamp?.seconds ? h.timestamp.seconds*1000 : h.timestamp).toLocaleTimeString() : ''}</span>
      </div>
    </div>`).join('');
}

// ── Tips Rotation ─────────────────────────────────────────────────────────────
const TIPS = [
  '"What is machine learning?"', '"Set a reminder for 6 PM"',
  '"What\'s the weather in Delhi?"', '"Tell me a joke"',
  '"Turn on the lights"', '"What time is it?"',
  '"Send an email to someone@gmail.com"', '"Who is Nikola Tesla?"',
  '"Calculate 15% of 2500"', '"What is quantum computing?"',
  '"What\'s 256 divided by 16?"', '"Who is Marie Curie?"',
  '"Turn on the fan"', '"What is the weather today?"',
];
let tipIdx = 0;

// ── Helper: strip surrounding quotes from a tip and send as command ──────────
function sendTip(el) {
  const raw = (el?.textContent || '').trim();
  const clean = raw.replace(/^["']|["']$/g, '').trim();
  if (clean) sendCommand(clean);
}

function cycleTips() {
  const list = document.getElementById('tipList');
  if (!list) return;

  // Wire click on all existing items (in case they load without onclick attr)
  list.querySelectorAll('li').forEach(li => {
    li.style.cursor = 'pointer';
    if (!li.onclick) li.onclick = () => sendTip(li);
  });

  setInterval(() => {
    const items = list.querySelectorAll('li');
    if (!items.length) return;
    const item = items[tipIdx % items.length];
    item.style.opacity = '0';
    setTimeout(() => {
      item.textContent  = TIPS[tipIdx % TIPS.length];
      item.style.opacity   = '1';
      item.style.transition = 'opacity .5s';
      item.style.cursor    = 'pointer';
      item.onclick = () => sendTip(item);  // re-attach after textContent change
    }, 300);
    tipIdx++;
  }, 4000);
}

// ── Particles ─────────────────────────────────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size   = Math.random() * 1.5 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = (Math.random() - 0.5) * 0.3;
      this.opacity = Math.random() * 0.5 + 0.1;
      this.color  = Math.random() > 0.5 ? '110,231,247' : '167,139,250';
    }
    update() {
      this.x += this.speedX; this.y += this.speedY;
      if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color},${this.opacity})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < 80; i++) particles.push(new Particle());

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(110,231,247,${0.05 * (1 - dist/100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3500);
}

// ── Loading ───────────────────────────────────────────────────────────────────
function showLoading(text) {
  const ol = document.getElementById('loadingOverlay');
  if (!ol) return;
  document.getElementById('loadingText').textContent = text || 'Processing…';
  ol.classList.add('visible');
}
function hideLoading() {
  document.getElementById('loadingOverlay')?.classList.remove('visible');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

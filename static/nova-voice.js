/* ── NOVA Wake Word, Voice Output & Command Parsing ── */

// ── Wake word regex — matches "hello nova", "hey nova", "hi nova" ──
const NOVA_WAKE_RE = /\b(hello|hey|hi)\s+nova\b/i;

// ── Internal state ──
let _wakeLoop      = null;   // holds the active SpeechRecognition instance
let _wakeEnabled   = false;  // master switch
let _wakeLoopTimer = null;   // debounce restart timer

// ─────────────────────────────────────────────────────────────
// Command helpers
// ─────────────────────────────────────────────────────────────
function parseNovaCommand(text) {
  if (!text) return '';
  let t = text.trim();
  t = t.replace(/^(hello|hey|hi)\s+nova[,!.?\s]*/i, '').trim();
  t = t.replace(/^nova[,!.?\s]*/i, '').trim();
  return t;
}

function isNovaWakePhrase(text) {
  const t = (text || '').trim().toLowerCase();
  return /^(hello|hey|hi)\s+nova[!.?]*$/.test(t) || t === 'nova';
}

// ─────────────────────────────────────────────────────────────
// TTS – speak via browser Web Speech API + server TTS
// ─────────────────────────────────────────────────────────────
function speakNova(text) {
  if (!text) return;
  // strip emoji for cleaner TTS
  const clean = text.replace(/[\u{1F300}-\u{1FAFF}]/gu, '').trim();
  if ('speechSynthesis' in window && clean) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.rate  = 1.02;
    u.pitch = 1.05;
    const voices   = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      /zira|female|samantha|helena|google uk english female/i.test(v.name)
    );
    if (preferred) u.voice = preferred;
    window.speechSynthesis.speak(u);
  }
  // Also trigger server-side TTS (pyttsx3)
  fetch('/api/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: clean }),
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// After wake is detected — listen for the follow-up command
// ─────────────────────────────────────────────────────────────
function _listenForCommand() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { _scheduleWakeLoop(); return; }

  const rec     = new SR();
  rec.lang      = _langCode();
  rec.continuous     = false;
  rec.interimResults = false;

  rec.onresult = async (evt) => {
    const text = evt.results[0][0].transcript.trim();
    if (!text) { _scheduleWakeLoop(); return; }
    textInput.value = text;
    setOrbState('processing');
    await processCommand(text, null, { source: 'wake_followup', displayUserText: text });
    setOrbState('idle');
    _scheduleWakeLoop(); // go back to listening for wake word
  };

  rec.onerror = (evt) => {
    console.warn('[NOVA follow-up error]', evt.error);
    setOrbState('idle');
    _scheduleWakeLoop();
  };

  rec.onend = () => {
    // If no result came (silence), go back to wake loop
    _scheduleWakeLoop();
  };

  try {
    rec.start();
    if (typeof orbStatus !== 'undefined') orbStatus.textContent = 'Speak your question…';
  } catch (e) {
    console.warn('[NOVA] command rec start failed:', e.message);
    _scheduleWakeLoop();
  }
}

// ─────────────────────────────────────────────────────────────
// Wake word detected handler
// ─────────────────────────────────────────────────────────────
async function _onWakeDetected(transcript) {
  if (typeof window._novaLogEvent === 'function') {
    window._novaLogEvent('nova_wake', { method: 'voice' });
  }

  showToast('👋 NOVA is listening…', 'success');
  speakNova("Hello! I'm NOVA. How can I help you?");
  setOrbState('listening');

  // If the wake phrase included a command (e.g. "Hey NOVA what time is it")
  const inlineCmd = parseNovaCommand(transcript);
  if (inlineCmd) {
    textInput.value = inlineCmd;
    setOrbState('processing');
    await processCommand(inlineCmd, null, { source: 'wake_voice', displayUserText: transcript });
    setOrbState('idle');
    addChatMessage('assistant', "Say 'Hello NOVA' again anytime!", true);
    _scheduleWakeLoop();
    return;
  }

  // No inline command — greet and open microphone for follow-up
  addChatMessage('assistant', "Hello! I'm NOVA — your AI assistant. What would you like to know?", true);
  // Short pause so the greeting TTS doesn't get picked up
  setTimeout(_listenForCommand, 1200);
}

// ─────────────────────────────────────────────────────────────
// Core wake-word loop (one non-continuous session at a time)
// Uses NON-continuous mode to avoid Chrome's 60s timeout bug
// ─────────────────────────────────────────────────────────────
function _runWakeSession() {
  if (!_wakeEnabled) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  // destroy previous instance cleanly
  if (_wakeLoop) {
    try { _wakeLoop.abort(); } catch (_) {}
    _wakeLoop = null;
  }

  const rec      = new SR();
  rec.lang       = _langCode();
  rec.continuous     = false;   // NON-continuous avoids 60s Chrome hard limit
  rec.interimResults = false;   // final results only — more reliable match

  rec.onresult = (evt) => {
    // collect ALL final transcripts from this batch
    let said = '';
    for (let i = 0; i < evt.results.length; i++) {
      if (evt.results[i].isFinal) said += evt.results[i][0].transcript + ' ';
    }
    said = said.trim();
    console.log('[NOVA wake heard]', said);

    if (said && NOVA_WAKE_RE.test(said)) {
      // Wake phrase found — hand off to command handler
      _wakeEnabled = false; // pause loop while handling command
      _onWakeDetected(said);
    } else {
      // Not a wake phrase — immediately start another session
      _scheduleWakeLoop(200);
    }
  };

  rec.onerror = (evt) => {
    if (evt.error === 'not-allowed' || evt.error === 'service-not-allowed') {
      _wakeEnabled = false;
      showToast('❌ Mic permission denied — allow it in browser settings', 'error');
      return;
    }
    if (evt.error === 'no-speech' || evt.error === 'audio-capture' || evt.error === 'network') {
      // These are normal — just restart quietly
      _scheduleWakeLoop(500);
      return;
    }
    console.warn('[NOVA wake error]', evt.error);
    _scheduleWakeLoop(1000);
  };

  rec.onend = () => {
    // Session ended (no result / timeout) — restart if still enabled
    if (_wakeEnabled) _scheduleWakeLoop(100);
  };

  _wakeLoop = rec;
  try {
    rec.start();
    console.log('[NOVA] Wake listener session started');
  } catch (e) {
    console.warn('[NOVA] Wake start failed:', e.message);
    _wakeLoop = null;
    _scheduleWakeLoop(1000);
  }
}

// ─────────────────────────────────────────────────────────────
// Schedule next wake session (debounced)
// ─────────────────────────────────────────────────────────────
function _scheduleWakeLoop(ms = 300) {
  clearTimeout(_wakeLoopTimer);
  if (!_wakeEnabled) return;
  _wakeLoopTimer = setTimeout(_runWakeSession, ms);
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────
function startNovaWakeListener() {
  if (_wakeEnabled) return; // already running
  _wakeEnabled = true;
  window.novaAlwaysListening = true;
  console.log('[NOVA] Wake listener ENABLED — say "Hello NOVA"');
  if (typeof orbStatus !== 'undefined') {
    orbStatus.textContent = 'Say "Hello NOVA" to start';
  }
  showToast('🎙️ Say "Hello NOVA" anytime!', '');
  _runWakeSession();
}

function stopNovaWakeListener() {
  _wakeEnabled = false;
  window.novaAlwaysListening = false;
  clearTimeout(_wakeLoopTimer);
  if (_wakeLoop) {
    try { _wakeLoop.abort(); } catch (_) {}
    try { _wakeLoop.stop();  } catch (_) {}
    _wakeLoop = null;
  }
  console.log('[NOVA] Wake listener STOPPED');
}

// Called by app.js startListening() — pause wake while mic button is active
function pauseWakeForMic() {
  if (!_wakeEnabled) return false; // wasn't running
  stopNovaWakeListener();
  return true; // signal to resume it later
}

function resumeWakeAfterMic() {
  if (window.novaAlwaysListening === false && !_wakeEnabled) {
    // Was paused by mic button — restart
    setTimeout(startNovaWakeListener, 600);
  }
}

// Language code helper
function _langCode() {
  return { en: 'en-US', hi: 'hi-IN', gu: 'gu-IN' }[
    typeof currentLang !== 'undefined' ? currentLang : 'en'
  ] || 'en-US';
}

// ─────────────────────────────────────────────────────────────
// Exports to window
// ─────────────────────────────────────────────────────────────
window.parseNovaCommand     = parseNovaCommand;
window.isNovaWakePhrase     = isNovaWakePhrase;
window.speakNova            = speakNova;
window.startNovaWakeListener = startNovaWakeListener;
window.stopNovaWakeListener  = stopNovaWakeListener;
window.pauseWakeForMic      = pauseWakeForMic;
window.resumeWakeAfterMic   = resumeWakeAfterMic;

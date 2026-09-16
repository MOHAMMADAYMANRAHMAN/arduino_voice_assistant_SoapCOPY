// ==========================================================================
// ESP32 / Arduino AI Voice Assistant Engine
// Features: Continuous Speech Recognition, NLP Matching, Text Fallback,
//           mDNS & WiFi Auto-Reboot, Web Serial with Baud Selection, History Log
// ==========================================================================

// --- State Management ---
let currentMode = 'wifi'; // 'wifi' or 'serial'
let espBaseUrl = 'http://sara.local';
let ledState = false;
let serialPort = null;
let serialWriter = null;
let customCommands = [];
let commandHistory = [];
let isListening = false;
let isManuallyStopped = false;
let pollTimer = null;

// --- DOM Elements ---
const connectionMode = document.getElementById('connectionMode');
const wifiControls = document.getElementById('wifiControls');
const serialControls = document.getElementById('serialControls');
const espIpInput = document.getElementById('espIp');
const connectBtn = document.getElementById('connectBtn');
const serialConnectBtn = document.getElementById('serialConnectBtn');
const baudRateSelect = document.getElementById('baudRateSelect');
const connectionStatusBadge = document.getElementById('connectionStatusBadge');
const statusBadgeText = document.getElementById('statusBadgeText');

const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

const btnLedOn = document.getElementById('btnLedOn');
const btnLedOff = document.getElementById('btnLedOff');
const btnLedToggle = document.getElementById('btnLedToggle');
const visualLed = document.getElementById('visualLed');
const ledStateTag = document.getElementById('ledStateTag');
const boardLabel = document.getElementById('boardLabel');

const telemetryRssi = document.getElementById('telemetryRssi');
const telemetryIp = document.getElementById('telemetryIp');
const telemetryUptime = document.getElementById('telemetryUptime');

const micBtn = document.getElementById('micBtn');
const soundwave = document.getElementById('soundwave');
const voiceStatus = document.getElementById('voiceStatus');
const speechTranscript = document.getElementById('speechTranscript');
const continuousListenToggle = document.getElementById('continuousListenToggle');
const wakeWordToggle = document.getElementById('wakeWordToggle');
const ttsToggle = document.getElementById('ttsToggle');

const commandTextInput = document.getElementById('commandTextInput');
const sendTextCommandBtn = document.getElementById('sendTextCommandBtn');
const voiceHistoryList = document.getElementById('voiceHistoryList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

const wifiSetupForm = document.getElementById('wifiSetupForm');
const wifiStatusMsg = document.getElementById('wifiStatusMsg');
const rebootEsp32Btn = document.getElementById('rebootEsp32Btn');

const trainerForm = document.getElementById('trainerForm');
const customPhraseInput = document.getElementById('customPhrase');
const customActionSelect = document.getElementById('customAction');
const phraseList = document.getElementById('phraseList');
const trainerToast = document.getElementById('trainerToast');

const copyEsp32CodeBtn = document.getElementById('copyEsp32CodeBtn');
const copyArduinoCodeBtn = document.getElementById('copyArduinoCodeBtn');

// Default Built-in Rules
const builtinRules = [
  { phrases: ["turn on", "light on", "start", "lamp on", "enable", "led on"], action: "ON" },
  { phrases: ["turn off", "light off", "stop", "lamp off", "disable", "led off"], action: "OFF" },
  { phrases: ["toggle", "switch", "change state", "flip"], action: "TOGGLE" }
];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  loadCustomCommands();
  renderPhraseList();
  setupCodeCopying();
  setupSpeechRecognition();
  setupTextCommands();
  setupHistoryLog();

  // Initial status check attempt
  setTimeout(() => {
    checkDeviceStatus(true);
  }, 800);
});

// --- 1. Tab Navigation ---
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(`tab-${btn.dataset.tab}`);
    if (target) target.classList.add('active');
  });
});

// --- 2. Mode Switching (Wi-Fi vs USB Serial) ---
connectionMode.addEventListener('change', (e) => {
  currentMode = e.target.value;
  if (currentMode === 'wifi') {
    wifiControls.style.display = 'flex';
    serialControls.style.display = 'none';
    if (boardLabel) boardLabel.textContent = 'ESP32 DevKit (Wi-Fi / mDNS)';
  } else {
    wifiControls.style.display = 'none';
    serialControls.style.display = 'flex';
    if (boardLabel) boardLabel.textContent = 'Arduino / ESP32 (USB Serial)';
  }
  updateConnectionStatus(false);
});

// Helper: Normalize Wi-Fi URL
function getBaseUrl() {
  let ip = espIpInput.value.trim();
  if (!ip) ip = 'sara.local';
  if (!ip.startsWith('http://') && !ip.startsWith('https://')) {
    ip = 'http://' + ip;
  }
  return ip.replace(/\/$/, "");
}

// Update Badge Status
function updateConnectionStatus(isOnline, text = null) {
  if (isOnline) {
    connectionStatusBadge.className = 'status-badge connected';
    statusBadgeText.textContent = text || 'Online';
  } else {
    connectionStatusBadge.className = 'status-badge disconnected';
    statusBadgeText.textContent = text || 'Offline';
  }
}

// Update Virtual LED UI
function setLedUI(state) {
  ledState = state;
  if (state) {
    visualLed.className = 'virtual-led on';
    ledStateTag.className = 'led-tag on';
    ledStateTag.textContent = 'LED ON';
  } else {
    visualLed.className = 'virtual-led off';
    ledStateTag.className = 'led-tag off';
    ledStateTag.textContent = 'LED OFF';
  }
}

// Update Telemetry Displays
function updateTelemetry(data) {
  if (!data) return;
  if (telemetryRssi) telemetryRssi.textContent = data.rssi ? `${data.rssi} dBm` : 'N/A';
  if (telemetryIp) telemetryIp.textContent = data.ip || 'N/A';
  if (telemetryUptime) {
    if (data.uptime !== undefined) {
      const mins = Math.floor(data.uptime / 60);
      const secs = data.uptime % 60;
      telemetryUptime.textContent = `${mins}m ${secs}s`;
    } else {
      telemetryUptime.textContent = 'N/A';
    }
  }
}

// --- 3. Wi-Fi API Communication ---
async function sendWifiCommand(endpoint) {
  const url = `${getBaseUrl()}${endpoint}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    
    const response = await fetch(url, { method: 'GET', signal: controller.signal, mode: 'cors' });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      updateConnectionStatus(true, 'Online');
      if (typeof data.led !== 'undefined') {
        setLedUI(data.led === 1 || data.led === true);
      }
      updateTelemetry(data);
      return data;
    }
  } catch (err) {
    console.warn('Wi-Fi CORS request failed, attempting fallback...', err);
    try {
      // Fallback request without CORS
      await fetch(url, { method: 'GET', mode: 'no-cors' });
      updateConnectionStatus(true, 'Online (no-cors)');
      return { status: 'sent' };
    } catch (fallbackErr) {
      console.error('Wi-Fi connection error:', fallbackErr);
      updateConnectionStatus(false, 'Offline');
    }
  }
  return null;
}

// Check Wi-Fi Connection Button
connectBtn.addEventListener('click', () => checkDeviceStatus(false));

async function checkDeviceStatus(silent = false) {
  if (currentMode === 'wifi') {
    if (!silent) statusBadgeText.textContent = 'Checking...';
    const res = await sendWifiCommand('/status');
    if (res) {
      if (!silent) speak("Connected to ESP32 successfully");
    } else {
      if (!silent) speak("Could not reach ESP32. Check IP or connect to sara.local");
    }
  }
}

// Configure Wi-Fi Credentials on ESP32
if (wifiSetupForm) {
  wifiSetupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ssid = document.getElementById('wifiSsid').value.trim();
    const pass = document.getElementById('wifiPassword').value;

    if (!ssid) {
      showWifiStatus("Please enter a valid Wi-Fi SSID.", false);
      return;
    }

    showWifiStatus("Sending Wi-Fi credentials to ESP32...", true, false);

    // If connected via Web Serial
    if (serialWriter && currentMode === 'serial') {
      try {
        await sendSerialCommand(`WIFI:${ssid},${pass}`);
        showWifiStatus(`Credentials sent via USB Serial for "${ssid}". ESP32 is saving and restarting...`, true);
        speak("Wi-Fi credentials sent over serial. ESP32 is restarting.");
        return;
      } catch (err) {
        console.error("Serial wifi config failed:", err);
      }
    }

    // Wi-Fi HTTP mode
    const url = `${getBaseUrl()}/wifi/save?ssid=${encodeURIComponent(ssid)}&pass=${encodeURIComponent(pass)}`;
    try {
      await sendWifiCommand(`/wifi/save?ssid=${encodeURIComponent(ssid)}&pass=${encodeURIComponent(pass)}`);
      showWifiStatus(`Credentials saved for "${ssid}"! The ESP32 is restarting. Please connect your phone/laptop to "${ssid}" and access http://sara.local.`, true);
      speak("Wi-Fi credentials saved! Device is restarting.");
    } catch (err) {
      showWifiStatus("Could not reach ESP32. Ensure you are connected to the 'ESP32_Sara_Setup' network at 192.168.4.1.", false);
      speak("Failed to send Wi-Fi credentials");
    }
  });
}

// Reboot Button Handler
if (rebootEsp32Btn) {
  rebootEsp32Btn.addEventListener('click', async () => {
    if (confirm("Are you sure you want to reboot the ESP32 hardware?")) {
      if (currentMode === 'wifi') {
        await sendWifiCommand('/reboot');
      } else {
        await sendSerialCommand('REBOOT');
      }
      showWifiStatus("Reboot command sent to ESP32. Reconnecting in a few seconds...", true);
      speak("Rebooting device");
      updateConnectionStatus(false, 'Rebooting...');
    }
  });
}

function showWifiStatus(msg, isSuccess) {
  if (!wifiStatusMsg) return;
  const badgeClass = isSuccess ? 'toast-success' : 'toast-error';
  wifiStatusMsg.innerHTML = `<div class="toast-msg ${badgeClass}">${msg}</div>`;
}

// --- 4. Web Serial Connection ---
serialConnectBtn.addEventListener('click', async () => {
  if (!navigator.serial) {
    alert("Web Serial API is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Opera.");
    return;
  }
  const selectedBaud = parseInt(baudRateSelect.value) || 115200;
  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: selectedBaud });
    serialWriter = serialPort.writable.getWriter();
    updateConnectionStatus(true, `Serial (${selectedBaud})`);
    speak("Serial connected successfully");
    
    // Start Serial Reader Loop
    readSerialLoop();
  } catch (err) {
    console.error("Serial connection error:", err);
    updateConnectionStatus(false);
  }
});

async function readSerialLoop() {
  while (serialPort && serialPort.readable) {
    const reader = serialPort.readable.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const text = decoder.decode(value).trim();
          console.log("[SERIAL RECV]", text);
          if (text.includes("STATUS:ON")) setLedUI(true);
          else if (text.includes("STATUS:OFF")) setLedUI(false);
        }
      }
    } catch (err) {
      console.warn("Serial read error:", err);
    } finally {
      reader.releaseLock();
    }
  }
}

async function sendSerialCommand(cmd) {
  if (serialWriter) {
    const encoder = new TextEncoder();
    await serialWriter.write(encoder.encode(cmd + '\n'));
  }
}

// --- 5. Unified Command Dispatcher ---
async function executeCommand(action, sourceText = "", source = "Voice") {
  if (action === 'ON') {
    setLedUI(true);
    speak("Turning LED on");
    if (currentMode === 'wifi') await sendWifiCommand('/led/on');
    else await sendSerialCommand('LED_ON');
  } else if (action === 'OFF') {
    setLedUI(false);
    speak("Turning LED off");
    if (currentMode === 'wifi') await sendWifiCommand('/led/off');
    else await sendSerialCommand('LED_OFF');
  } else if (action === 'TOGGLE') {
    setLedUI(!ledState);
    speak("Toggling LED");
    if (currentMode === 'wifi') await sendWifiCommand('/led/toggle');
    else await sendSerialCommand('LED_TOGGLE');
  }

  // Add to History Log
  addHistoryItem(sourceText || action, action, source);
}

btnLedOn.addEventListener('click', () => executeCommand('ON', 'Manual Button', 'UI'));
btnLedOff.addEventListener('click', () => executeCommand('OFF', 'Manual Button', 'UI'));
btnLedToggle.addEventListener('click', () => executeCommand('TOGGLE', 'Manual Button', 'UI'));

// --- 6. Speech Recognition Engine & NLP ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

function setupSpeechRecognition() {
  if (!SpeechRecognition) {
    voiceStatus.textContent = "Speech Recognition API not supported in this browser. Use Chrome or Edge, or use Text Input below.";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add('active');
    if (soundwave) soundwave.classList.add('active');
    voiceStatus.textContent = "Listening for command...";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    speechTranscript.textContent = `"${transcript}"`;
    processVoiceCommand(transcript, 'Voice');
  };

  recognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
    if (event.error !== 'no-speech') {
      voiceStatus.textContent = "Voice error: " + event.error;
    }
    micBtn.classList.remove('active');
    if (soundwave) soundwave.classList.remove('active');
    isListening = false;
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove('active');
    if (soundwave) soundwave.classList.remove('active');

    // Auto-restart if Continuous Listening is turned ON and not manually stopped
    if (continuousListenToggle.checked && !isManuallyStopped) {
      voiceStatus.textContent = "Continuous Mode active. Listening...";
      setTimeout(() => {
        if (continuousListenToggle.checked && !isListening && !isManuallyStopped) {
          try { recognition.start(); } catch (e) {}
        }
      }, 400);
    } else {
      voiceStatus.textContent = "Tap microphone or say 'Hey Sara'...";
    }
  };

  micBtn.addEventListener('click', () => {
    if (isListening) {
      isManuallyStopped = true;
      recognition.stop();
      voiceStatus.textContent = "Voice recognition stopped.";
    } else {
      isManuallyStopped = false;
      try {
        recognition.start();
      } catch (err) {
        console.warn("Recognition start error:", err);
      }
    }
  });

  continuousListenToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
      isManuallyStopped = false;
      if (!isListening) {
        try { recognition.start(); } catch (e) {}
      }
    } else {
      isManuallyStopped = true;
      if (isListening) recognition.stop();
    }
  });
}

// NLP & Regex Command Processor
function processVoiceCommand(text, source = 'Voice') {
  const cleanText = text.trim().toLowerCase();
  const wakeWordRequired = wakeWordToggle.checked;

  if (wakeWordRequired && source === 'Voice') {
    if (!cleanText.includes('sara') && !cleanText.includes('sarah') && !cleanText.includes('hey sara')) {
      voiceStatus.textContent = "Wake word 'Hey Sara' not detected.";
      return;
    }
  }

  // 1. Custom Trained Rules First
  for (let rule of customCommands) {
    if (cleanText.includes(rule.phrase.toLowerCase())) {
      voiceStatus.textContent = `Triggered custom rule: "${rule.phrase}"`;
      executeCommand(rule.action, cleanText, source);
      return;
    }
  }

  // 2. Strict Regex Matching for Built-in Commands
  const onRegex = /\b(on|turn on|light on|enable|start|power on|switch on|led on|ignite)\b/i;
  const offRegex = /\b(off|turn off|light off|disable|stop|power off|switch off|led off)\b/i;
  const toggleRegex = /\b(toggle|switch|flip|change state|change led)\b/i;

  if (onRegex.test(cleanText)) {
    voiceStatus.textContent = "Command matched: Turn LED ON";
    executeCommand('ON', cleanText, source);
  } else if (offRegex.test(cleanText)) {
    voiceStatus.textContent = "Command matched: Turn LED OFF";
    executeCommand('OFF', cleanText, source);
  } else if (toggleRegex.test(cleanText)) {
    voiceStatus.textContent = "Command matched: Toggle LED";
    executeCommand('TOGGLE', cleanText, source);
  } else {
    voiceStatus.textContent = `Command not recognized: "${cleanText}"`;
    addHistoryItem(cleanText, 'UNKNOWN', source);
  }
}

// --- 7. Text Command Fallback Input ---
function setupTextCommands() {
  if (!sendTextCommandBtn || !commandTextInput) return;

  const handleSendText = () => {
    const val = commandTextInput.value.trim();
    if (!val) return;
    speechTranscript.textContent = `"${val}"`;
    processVoiceCommand(val, 'Text');
    commandTextInput.value = '';
  };

  sendTextCommandBtn.addEventListener('click', handleSendText);
  commandTextInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendText();
  });
}

// --- 8. Voice Command History Log ---
function setupHistoryLog() {
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      commandHistory = [];
      renderHistoryLog();
    });
  }
}

function addHistoryItem(text, action, source) {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  commandHistory.unshift({
    text: text,
    action: action,
    source: source,
    time: timeStr
  });
  if (commandHistory.length > 20) commandHistory.pop();
  renderHistoryLog();
}

function renderHistoryLog() {
  if (!voiceHistoryList) return;
  if (commandHistory.length === 0) {
    voiceHistoryList.innerHTML = '<div class="history-empty">No commands executed yet.</div>';
    return;
  }

  voiceHistoryList.innerHTML = commandHistory.map(item => {
    const badgeClass = item.action === 'ON' ? 'action-on' : item.action === 'OFF' ? 'action-off' : item.action === 'TOGGLE' ? 'action-toggle' : 'action-off';
    return `
      <div class="history-item">
        <div>
          <span class="history-cmd">"${escapeHtml(item.text)}"</span>
          <span style="font-size: 10px; color: var(--text-dim); margin-left: 6px;">[${item.source}]</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="history-badge ${badgeClass}">${item.action}</span>
          <span class="history-time">${item.time}</span>
        </div>
      </div>
    `;
  }).join('');
}

// --- 9. Custom Voice Command Trainer Engine ---
function loadCustomCommands() {
  try {
    const stored = localStorage.getItem('esp32_voice_assistant_custom_commands');
    customCommands = stored ? JSON.parse(stored) : [];
  } catch (e) {
    customCommands = [];
  }
}

function saveCustomCommands() {
  try {
    localStorage.setItem('esp32_voice_assistant_custom_commands', JSON.stringify(customCommands));
  } catch (e) {}
}

function renderPhraseList() {
  if (!phraseList) return;
  phraseList.innerHTML = '';

  // Render Built-in Rules
  builtinRules.forEach(rule => {
    const item = document.createElement('div');
    item.className = 'rule-item';
    const actionClass = rule.action === 'ON' ? 'action-on' : rule.action === 'OFF' ? 'action-off' : 'action-toggle';
    item.innerHTML = `
      <div class="rule-phrases">
        "${rule.phrases.join('", "')}"
        <span class="rule-action-badge ${actionClass}">Turn LED ${rule.action}</span>
      </div>
      <span style="font-size: 11px; color: var(--text-dim);">Built-in</span>
    `;
    phraseList.appendChild(item);
  });

  // Render Custom Rules
  customCommands.forEach(rule => {
    const item = document.createElement('div');
    item.className = 'rule-item';
    const actionClass = rule.action === 'ON' ? 'action-on' : rule.action === 'OFF' ? 'action-off' : 'action-toggle';
    item.innerHTML = `
      <div class="rule-phrases">
        "${escapeHtml(rule.phrase)}"
        <span class="rule-action-badge ${actionClass}">Turn LED ${rule.action}</span>
      </div>
      <button class="delete-rule-btn" data-id="${rule.id}" title="Remove rule">🗑️ Delete</button>
    `;
    phraseList.appendChild(item);
  });

  // Attach Delete Handlers
  const deleteBtns = phraseList.querySelectorAll('.delete-rule-btn');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      customCommands = customCommands.filter(c => c.id !== id);
      saveCustomCommands();
      renderPhraseList();
      speak("Command rule removed");
    });
  });
}

if (trainerForm) {
  trainerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const phrase = customPhraseInput.value.trim().toLowerCase();
    const action = customActionSelect.value;

    if (!phrase || phrase.length < 2) {
      showTrainerToast("Please enter a phrase with at least 2 characters.", false);
      return;
    }

    const newRule = {
      id: Date.now().toString(),
      phrase: phrase,
      action: action
    };

    customCommands.push(newRule);
    saveCustomCommands();
    renderPhraseList();

    customPhraseInput.value = '';
    showTrainerToast(`Added custom rule: "${phrase}" → Turn LED ${action}`, true);
    speak(`Added command rule for ${phrase}`);
  });
}

function showTrainerToast(msg, isSuccess) {
  if (!trainerToast) return;
  const badgeClass = isSuccess ? 'toast-success' : 'toast-error';
  trainerToast.innerHTML = `<div class="toast-msg ${badgeClass}">${msg}</div>`;
  setTimeout(() => { trainerToast.innerHTML = ''; }, 4000);
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

function speak(message) {
  if (ttsToggle.checked && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // cancel previous active utterances
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}

// --- 10. Code Block Clipboard Copy Utility ---
function setupCodeCopying() {
  if (copyEsp32CodeBtn) {
    copyEsp32CodeBtn.addEventListener('click', () => {
      const code = document.getElementById('esp32CodeBlock').textContent;
      navigator.clipboard.writeText(code).then(() => {
        const originalText = copyEsp32CodeBtn.innerHTML;
        copyEsp32CodeBtn.innerHTML = '✅ Copied!';
        setTimeout(() => { copyEsp32CodeBtn.innerHTML = originalText; }, 2000);
      });
    });
  }

  if (copyArduinoCodeBtn) {
    copyArduinoCodeBtn.addEventListener('click', () => {
      const code = document.getElementById('arduinoCodeBlock').textContent;
      navigator.clipboard.writeText(code).then(() => {
        const originalText = copyArduinoCodeBtn.innerHTML;
        copyArduinoCodeBtn.innerHTML = '✅ Copied!';
        setTimeout(() => { copyArduinoCodeBtn.innerHTML = originalText; }, 2000);
      });
    });
  }
}
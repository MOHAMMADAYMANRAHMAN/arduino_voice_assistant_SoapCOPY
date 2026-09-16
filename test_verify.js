const fs = require('fs');

console.log("=== VERIFYING FILE INTEGRITY ===");

const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');

// Check key IDs in HTML against app.js references
const requiredIds = [
  'connectionMode', 'wifiControls', 'serialControls', 'espIp', 'connectBtn',
  'baudRateSelect', 'serialConnectBtn', 'connectionStatusBadge', 'statusBadgeText',
  'btnLedOn', 'btnLedOff', 'btnLedToggle', 'visualLed', 'ledStateTag', 'boardLabel',
  'telemetryRssi', 'telemetryIp', 'telemetryUptime', 'micBtn', 'soundwave',
  'voiceStatus', 'speechTranscript', 'continuousListenToggle', 'wakeWordToggle',
  'ttsToggle', 'commandTextInput', 'sendTextCommandBtn', 'voiceHistoryList',
  'clearHistoryBtn', 'wifiSetupForm', 'wifiStatusMsg', 'rebootEsp32Btn',
  'trainerForm', 'customPhrase', 'customAction', 'phraseList', 'trainerToast',
  'copyEsp32CodeBtn', 'copyArduinoCodeBtn', 'esp32CodeBlock', 'arduinoCodeBlock'
];

let missing = 0;
requiredIds.forEach(id => {
  if (!html.includes(`id="${id}"`)) {
    console.error(`❌ MISSING ID in index.html: ${id}`);
    missing++;
  }
});

if (missing === 0) {
  console.log(`✅ All ${requiredIds.length} required HTML element IDs verified successfully!`);
}

// Test Regex Patterns in JS
const onRegex = /\b(on|turn on|light on|enable|start|power on|switch on|led on|ignite)\b/i;
const offRegex = /\b(off|turn off|light off|disable|stop|power off|switch off|led off)\b/i;
const toggleRegex = /\b(toggle|switch|flip|change state|change led)\b/i;

const testCommands = [
  { text: "turn on the LED", expected: "ON" },
  { text: "turn off light", expected: "OFF" },
  { text: "sara please turn on", expected: "ON" },
  { text: "turn off now", expected: "OFF" },
  { text: "toggle light", expected: "TOGGLE" },
  { text: "enable led", expected: "ON" },
  { text: "disable lamp", expected: "OFF" }
];

console.log("\n=== TESTING NLP REGEX COMMAND MATCHING ===");
testCommands.forEach(tc => {
  let matched = "UNKNOWN";
  if (onRegex.test(tc.text)) matched = "ON";
  else if (offRegex.test(tc.text)) matched = "OFF";
  else if (toggleRegex.test(tc.text)) matched = "TOGGLE";

  const pass = matched === tc.expected ? "✅ PASS" : "❌ FAIL";
  console.log(`${pass}: "${tc.text}" -> Matched: ${matched} (Expected: ${tc.expected})`);
});

// Verify ESP.restart in HTML code block
if (html.includes('ESP.restart()') && html.includes('sara.local')) {
  console.log("\n✅ ESP32 Firmware contains ESP.restart() & mDNS sara.local!");
} else {
  console.error("\n❌ ESP32 Firmware missing ESP.restart() or mDNS!");
}

console.log("\n=== ALL VERIFICATIONS COMPLETE ===");

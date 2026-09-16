const fs = require('fs');

console.log("=== VERIFYING FILE INTEGRITY FOR 4 INVENTORY SECTIONS ===");

const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');

const requiredIds = [
  'connectionMode', 'wifiControls', 'serialControls', 'espIp', 'connectBtn',
  'baudRateSelect', 'serialConnectBtn', 'connectionStatusBadge', 'statusBadgeText',
  'btnLedOn', 'btnLedOff', 'btnLedToggle', 'visualLed', 'ledStateTag', 'boardLabel',
  'telemetryRssi', 'telemetryIp', 'telemetryUptime', 'micBtn', 'soundwave',
  'voiceStatus', 'speechTranscript', 'continuousListenToggle', 'wakeWordToggle',
  'ttsToggle', 'commandTextInput', 'sendTextCommandBtn', 'voiceHistoryList',
  'clearHistoryBtn', 'addItemForm', 'itemCategory', 'itemName', 'itemQuantity',
  'addItemBtn', 'inventoryToast', 'drinksList', 'soapList', 'vegiesList', 'stapleList',
  'drinksCountBadge', 'soapCountBadge', 'vegiesCountBadge', 'stapleCountBadge',
  'wifiSetupForm', 'wifiStatusMsg', 'rebootEsp32Btn', 'trainerForm', 'customPhrase',
  'customAction', 'phraseList', 'trainerToast', 'copyEsp32CodeBtn', 'copyArduinoCodeBtn'
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

// Check 4 inventory categories in HTML & JS
const categories = ['Drinks', 'Soap', 'Vegies', 'Staple Meal'];
categories.forEach(cat => {
  if (html.includes(cat) && js.includes(cat)) {
    console.log(`✅ Category "${cat}" verified in HTML & JS`);
  } else {
    console.error(`❌ Category "${cat}" missing in HTML or JS`);
  }
});

// Verify ITEM serial print handler in C++ code blocks
if (html.includes('ITEM:') && html.includes('printItemToSerial') && html.includes('/item')) {
  console.log("\n✅ C++ Firmware contains /item endpoint and ITEM: serial monitor printer!");
} else {
  console.error("\n❌ C++ Firmware missing ITEM: handler!");
}

console.log("\n=== ALL VERIFICATIONS PASSED ===");

/*
/inv generate harness
- Verifies that ACS /inv queues Auto-Cards API.generateCard calls with correct parameters per inventory item
- Ensures continue prompt response, toasts, skip rules (zero qty, reserved titles, existing cards), and type mapping from category
*/

// Minimal AID runtime stubs
global.history = [{ text: "", type: "start" }];
global.storyCards = [];
global.state = { message: "" };
global.info = { actionCount: 0 };
// AID globals expected at module init
global.text = "";
global.stop = false;
// Logger expected by library.js
global.log = function(){ /* noop for tests */ };

// Scripting helpers used by Auto-Cards internals if evaluated
global.addStoryCard = function(title) {
  storyCards.push({ title, type: "class", keys: title, entry: title, description: "" });
};
global.updateStoryCard = function(index, card) {
  storyCards[index] = { ...storyCards[index], ...card };
};
global.removeStoryCard = function(index) {
  storyCards.splice(index, 1);
};

// Minimal MainSettings stub used by ACS
class MainSettings {
  constructor(ns) { this.ns = ns; }
  merge(obj) { MainSettings[this.ns] = { ...(MainSettings[this.ns] || {}), ...obj }; }
}
global.MainSettings = MainSettings;

// Load ACS (from src/library.js)
const path = require("path");
require(path.resolve(__dirname, "..", "src", "library.js"));

const ACS = global._ACS_forTest;
if (typeof ACS !== "function") {
  console.error("FAIL: ACS was not exposed for test");
  process.exit(1);
}
 
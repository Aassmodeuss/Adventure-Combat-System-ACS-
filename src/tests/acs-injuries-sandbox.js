/*
ACS Injuries Sandbox
- Verifies Injury Tagging standing prompt presence timing (skipped on opening turn)
- Ensures {\injury}/{\!injury} and {\heal}/{\!heal} are parsed, logged to 'Player Injuries', and scrubbed from visible output

Run: node Tests/acs-injuries-sandbox.js
*/

const fs = require('fs');
const path = require('path');

// Minimal globals
const storyCards = [];
const state = {};
const info = { actionCount: 0 };
global.storyCards = storyCards;
global.state = state;
global.info = info;

// AutoCards API mock
const API = {
  getBannedTitles: () => [],
  setBannedTitles: () => ({}),
  getCard: (pred) => storyCards.find(pred) || null,
  buildCard: (tmpl) => { const card = { ...tmpl }; storyCards.unshift(card); return card; },
  setCardAsAuto: () => true,
  addCardMemory: () => true,
};
global.AutoCards = () => ({ API });

// Load ACS
const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
const code = fs.readFileSync(libPath, 'utf8');
const m = code.match(/\/\/----------------------ADVENTURE COMBAT SYSTEM--------------------------------[\s\S]*?function ACS\([\s\S]*?\n\}/);
if (!m) throw new Error('ACS function not found');
const acsFuncSrc = m[0].replace(/^.*?function ACS/m, 'function ACS');
const ACS = new Function('AutoCards', 'storyCards', 'state', 'info', `${acsFuncSrc}; return ACS;`)(global.AutoCards, storyCards, state, info);

function runContext(text='') { const [t] = ACS('context', text, false); return t; }
function runOutput(text='') { return ACS('output', text, false); }

function getCardDesc(title){ const c = storyCards.find(sc => sc.title === title); return c ? c.description : ''; }
function assert(cond, msg){ if (!cond) throw new Error('Assertion failed: ' + msg); }

(function main(){
  // Opening turn (actionCount = 0): Injury prompt should be absent
  let ctx = runContext('Start.');
  assert(!/Injury\s+Tagging/i.test(ctx), 'Injury prompt should not appear on opening turn');

  // Next turn (actionCount >= 1): Injury prompt present
  global.info.actionCount = 1;
  ctx = runContext('Continue.');
  assert(/Injury\s+Tagging/i.test(ctx), 'Injury prompt should appear after opening turn');

  // Emit injuries and healing; tags should be scrubbed and logged
  const before = 'A wolf lunges at you. {\\injury}wolf bite to forearm (moderate){\\!injury} and you brace as {\\heal}bandage applied to forearm{\\!heal} later.';
  const visible = runOutput(before);
  // Wrappers must be removed, but inner content should remain inline
  assert(!/\\injury|\\!injury|\\heal|\\!heal/.test(visible), 'Injury/heal wrappers must be removed from visible output');
  assert(/wolf bite to forearm \(moderate\)/i.test(visible), 'Inline injury text should remain visible');
  assert(/bandage applied to forearm/i.test(visible), 'Inline heal text should remain visible');

  const injDesc = getCardDesc('Player Injuries');
  assert(/Auto-Cards will contextualize these memories:/i.test(injDesc), 'Injuries card must have AC memory header');
  assert(/\{updates:\s*true\b/i.test(injDesc), 'Injuries card header must be updates:true');
  assert(/- \[injury\] wolf bite to forearm \(moderate\)/i.test(injDesc), 'Injury event should be logged');
  assert(/- \[heal\] bandage applied to forearm/i.test(injDesc), 'Heal event should be logged');

  console.log('SUCCESS: ACS injuries sandbox passed.');
})();

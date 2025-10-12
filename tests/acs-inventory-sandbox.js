/*
Local ACS Inventory Sandbox Tests
- Mocks AutoCards().API and AID globals to exercise ACS inventory parsing.
- Run with: node Tests/acs-inventory-sandbox.js
*/

// Minimal storyCards and globals
const storyCards = [];
const state = {};
const info = {};
// Shim to global scope for ACS to see
global.storyCards = storyCards;
global.state = state;
global.info = info;

// Load ACS from src/library.js by evaluating only the ACS section.
// For simplicity in this sandbox, we'll import the file and extract the ACS function via regex.
const fs = require('fs');
const path = require('path');
const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
const code = fs.readFileSync(libPath, 'utf8');
const m = code.match(/\/\/----------------------ADVENTURE COMBAT SYSTEM--------------------------------[\s\S]*?function ACS\([\s\S]*?\n\}/);
if (!m) throw new Error('ACS function not found');
const acsFuncSrc = m[0].replace(/^.*?function ACS/m, 'function ACS');

// Build a minimal AutoCards API mock
const API = {
  getBannedTitles: () => API._bans || [],
  setBannedTitles: (arr) => { API._bans = Array.from(new Set(arr)); return { oldBans: [], newBans: API._bans }; },
  getCard: (pred) => storyCards.find(pred) || null,
  buildCard: (tmpl) => { const card = { ...tmpl }; storyCards.unshift(card); return card; },
  setCardAsAuto: () => true,
  addCardMemory: (title, mem) => {
    const c = storyCards.find(s => s.title === title);
    if (!c) return false;
    if (!c.description) c.description = 'Auto-Cards will contextualize these memories:\n{updates: false, limit: 2750}';
    c.description += '\n- ' + mem;
    return true;
  }
};

// Expose AutoCards() to return our API
global.AutoCards = () => ({ API });

// Evaluate ACS
const fn = new Function('AutoCards', 'storyCards', 'state', 'info', `${acsFuncSrc}; return ACS;`);
const ACS = fn(global.AutoCards, storyCards, state, info);

function runContext(text='') { const [t] = ACS('context', text, false); return t; }
function runOutput(text='') { return ACS('output', text, false); }

function getInventoryDesc(){
  const inv = storyCards.find(c => c.title === 'Inventory');
  return inv ? inv.description : '';
}

function reset(){
  storyCards.length = 0; state.message = '';
}

function assert(cond, msg){ if (!cond) throw new Error('Assertion failed: ' + msg); }

// Tests
(function(){
  reset();
  // Ensure core cards created and prompt appended
  const ctx = runContext('Story so far.');
  assert(/Inventory\s+Tagging/i.test(ctx), 'Standing prompt appended');

  // Single pickup
  let out = runOutput('You find arrows. {\\pickup} broadhead arrow x3{\\!pickup}');
  assert(!/\\pickup/.test(out), 'Tags stripped');
  let inv = getInventoryDesc();
  assert(/broadhead arrow x3/i.test(inv), 'Inventory updated with arrows x3');

  // Case-insensitive merge + plural normalization
  out = runOutput('You find more. {\\pickup} Broadhead Arrows x2{\\!pickup}');
  inv = getInventoryDesc();
  assert(/broadhead arrow x5/i.test(inv), 'Merged plural/arrows with 2 more');

  // Multi-item pickup
  out = runOutput('Loot! {\\pickup} iron ore x2, Copper Ore x1{\\!pickup}');
  inv = getInventoryDesc();
  assert(/iron ore x2/i.test(inv) && /copper ore x1/i.test(inv), 'Multi-item pickup listed');

  // Drop mixed case, ensure decrease not below zero
  out = runOutput('Spend ammo. {\\!drop} Broadhead arrow x4{\\drop}');
  inv = getInventoryDesc();
  assert(/broadhead arrow x1/i.test(inv), 'Arrows decreased to 1');

  // Drop multiple items
  out = runOutput('Smelt some ore. {\\!drop} iron ore x1, copper ore x1{\\drop}');
  inv = getInventoryDesc();
  assert(/iron ore x1/i.test(inv) && /copper ore x0/.test(inv) === false, 'Ore quantities updated, no zero lines');

  console.log('All ACS inventory tests passed.');
})();

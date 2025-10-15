/*
Usage/Consumption Guidance Sandbox
- Validates that inventory usage cases map to drop/pickup correctly:
  - Firing ammo, throwing weapons, drinking potions, spending coins => drop xN
  - Recovering ammo later => pickup xN (with [item] category)
  - Crafting/trading consumes inputs (drop) and yields outputs (pickup)
- Also checks the standing prompt includes the new guidance lines.

Run: node Tests/usage-guidance-sandbox.js
*/

const fs = require('fs');
const path = require('path');

// Minimal AID globals
const storyCards = [];
const state = {};
const info = {};
global.storyCards = storyCards;
global.state = state;
global.info = info;

// AutoCards API stub (only what ACS uses here)
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
global.AutoCards = () => ({ API });

// Extract ACS function from src/library.js
const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
const code = fs.readFileSync(libPath, 'utf8');
const m = code.match(/\/\/----------------------ADVENTURE COMBAT SYSTEM--------------------------------[\s\S]*?function ACS\([\s\S]*?\n\}/);
if (!m) throw new Error('ACS function not found');
const acsFuncSrc = m[0].replace(/^.*?function ACS/m, 'function ACS');
const ACS = new Function('AutoCards', 'storyCards', 'state', 'info', `${acsFuncSrc}; return ACS;`)(global.AutoCards, storyCards, state, info);

function runContext(text='') { const [t] = ACS('context', text, false); return t; }
function runOutput(text='') { return ACS('output', text, false); }

function getInventoryDesc(){ const inv = storyCards.find(c => c.title === 'Inventory'); return inv ? inv.description : ''; }
function setInventory(desc){
  let inv = storyCards.find(c => c.title === 'Inventory');
  if (!inv) {
    inv = { title: 'Inventory', type: 'class', keys: 'Inventory', entry: '{title: Inventory}', description: '' };
    storyCards.unshift(inv);
  }
  inv.description = [
    'Auto-Cards will contextualize these memories:',
    '{updates: false, limit: 2750}',
    ...(Array.isArray(desc) ? desc : [])
  ].join('\n');
}

function assert(cond, msg){ if (!cond) throw new Error('Assertion failed: ' + msg); }

(function main(){
  // Ensure core cards and get standing prompt
  const before = '<<BASE>>';
  const after = runContext(before);
  const standing = after.slice(before.length);
  // Check new guidance snippets exist
  assert(/Usage reduces quantity/i.test(standing), 'Standing prompt missing usage guidance');
  assert(/Recoveries/i.test(standing), 'Standing prompt missing recoveries guidance');
  assert(/Crafting\/trading/i.test(standing), 'Standing prompt missing crafting/trading guidance');

  // Seed inventory with representative items
  setInventory([
    '- broadhead arrow x10',
    '- throwing knife x2',
    '- healing potion x1',
    '- gold coin x20',
    '- iron ingot x3',
    '- leather strip x1'
  ]);

  // 1) Firing ammo: drop arrows x3 (use the exact inventory noun)
  runOutput('You loose three shots. {\\!drop} broadhead arrow x3{\\drop}');
  let inv = getInventoryDesc();
  assert(/broadhead arrow x7/i.test(inv), 'Arrows should reduce to 7 after dropping x3');

  // 2) Throwing a weapon: drop throwing knife x1
  runOutput('You hurl a knife. {\\!drop} throwing knife x1{\\drop}');
  inv = getInventoryDesc();
  assert(/throwing knife x1/i.test(inv), 'Throwing knife should reduce to 1');

  // 3) Drinking a potion: drop healing potion x1 (removes line)
  runOutput('You quaff the draught. {\\!drop} healing potion x1{\\drop}');
  inv = getInventoryDesc();
  assert(!/healing potion x/i.test(inv), 'Healing potion line should be gone');

  // 4) Spending coins: drop gold coin x12 (20 -> 8)
  runOutput('You pay the merchant. {\\!drop} gold coin x12{\\drop}');
  inv = getInventoryDesc();
  assert(/gold coin x8/i.test(inv), 'Gold coins should reduce to 8');

  // 5) Recovering ammo: pickup one broadhead arrow x1 (add back 1)
  runOutput('You recover one arrow. {\\pickup} broadhead arrow[item] x1{\\!pickup}');
  inv = getInventoryDesc();
  assert(/broadhead arrow(?:\[item\])? x8/i.test(inv), 'Arrows should increase to 8 after recovery');

  // 6) Crafting/trading: drop inputs and pickup output
  runOutput('You forge a dagger. {\\!drop} iron ingot x2, leather strip x1{\\drop}{\\pickup} iron dagger[item] x1{\\!pickup}');
  inv = getInventoryDesc();
  assert(/iron ingot x1/i.test(inv), 'Iron ingots should reduce to 1');
  assert(!/leather strip x/i.test(inv), 'Leather strip should be removed');
  assert(/iron dagger(?:\[item\])? x1/i.test(inv), 'Iron dagger should be added x1');

  console.log('SUCCESS: Usage/consumption guidance sandbox passed.');
})();

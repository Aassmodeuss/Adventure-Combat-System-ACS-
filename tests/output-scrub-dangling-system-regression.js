/*
Output Scrub Regression (Dangling <SYSTEM>)
- Feeds ACS('output') a crafted narrative where a <SYSTEM> block is truncated (no </SYSTEM>) and ends with a partial '</SY'
- Asserts the visible output contains no SYSTEM tag or tail and preserves surrounding prose
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

const API = {
  _bans: [],
  getBannedTitles: () => API._bans || [],
  setBannedTitles: (arr) => { API._bans = Array.from(new Set(arr)); return { oldBans: [], newBans: API._bans }; },
  getCard: (pred) => storyCards.find(pred) || null,
  buildCard: (tmpl) => { const card = { ...tmpl }; storyCards.unshift(card); return card; },
  setCardAsAuto: () => true,
};
global.AutoCards = () => ({ API });

// Load ACS function from src/library.js
const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
const code = fs.readFileSync(libPath, 'utf8');
const m = code.match(/\/\/----------------------ADVENTURE COMBAT SYSTEM--------------------------------[\s\S]*?function ACS\([\s\S]*?\n\}/);
if (!m) throw new Error('ACS function not found');
const acsFuncSrc = m[0].replace(/^.*?function ACS/m, 'function ACS');
const ACS = new Function('AutoCards', 'storyCards', 'state', 'info', `${acsFuncSrc}; return ACS;`)(global.AutoCards, storyCards, state, info);

function runContext(t=''){ const [x] = ACS('context', t, false); return x; }
function runOutput(t=''){ return ACS('output', t, false); }

function assert(cond, msg){ if (!cond) throw new Error(msg || 'Assertion failed'); }

function main(){
  // Prime context
  runContext('');

  const crafted = [
    'Leading prose.',
    '<SYSTEM> Current Inventory (reference only; NOT for narration; do not echo this list): - (empty) </SY',
  ].join('\n');

  const visible = runOutput(crafted);

  assert(!/<\s*SYSTEM\b/i.test(visible), 'Visible output still contains <SYSTEM>');
  assert(!/<\s*\/\s*SY/i.test(visible), 'Visible output still contains dangling </SY');
  assert(/Leading prose\./.test(visible), 'Leading prose was lost');

  console.log('PASS: dangling <SYSTEM> fragment fully scrubbed.');
}

try { main(); } catch (err) { console.error('FAIL: output scrub dangling regression:', err.message || err); process.exit(1); }

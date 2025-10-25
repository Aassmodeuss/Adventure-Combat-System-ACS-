/*
Output Scrub Regression Test
- Feeds the output modifier a crafted string containing a <SYSTEM>...</SYSTEM> block
- Asserts the visible output has that block completely removed while preserving surrounding prose

Usage (Windows PowerShell):
  node .\tests\output-scrub-system-regression.js
*/

const fs = require('fs');
const path = require('path');

// Minimal AID globals and AutoCards API mock
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
  debugLog: () => {}
};
global.AutoCards = () => ({ API });

// Load ACS function from src/library.js (reserved ACS section)
const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
const code = fs.readFileSync(libPath, 'utf8');
const m = code.match(/\/\/----------------------ADVENTURE COMBAT SYSTEM--------------------------------[\s\S]*?function ACS\([\s\S]*?\n\}/);
if (!m) throw new Error('ACS function not found');
const acsFuncSrc = m[0].replace(/^.*?function ACS/m, 'function ACS');
const ACS = new Function('AutoCards', 'storyCards', 'state', 'info', `${acsFuncSrc}; return ACS;`)(global.AutoCards, storyCards, state, info);

function runContext(text = '') { const [t] = ACS('context', text, false); return t; }
function runOutput(text = '') { return ACS('output', text, false); }
function reset(){ storyCards.length = 0; state.message = ''; }

function containsSystemTag(s){ return /<\s*\/?\s*SYSTEM\s*>/i.test(String(s || '')); }

function assert(cond, msg){ if (!cond) throw new Error(msg || 'Assertion failed'); }

function main(){
  reset();
  // Prime context so ACS initializes cards/state and output pipeline
  runContext('');

  const crafted = [
    'Before text.',
    '<SYSTEM>\nThis block should be scrubbed and not appear in visible output.\n</SYSTEM>',
    'After text.'
  ].join('\n');

  const visible = runOutput(crafted);

  // Assertions
  assert(!containsSystemTag(visible), 'Visible output still contains <SYSTEM> tags');
  assert(visible.includes('Before text.'), 'Visible output lost leading prose');
  assert(visible.includes('After text.'), 'Visible output lost trailing prose');
  assert(!/This block should be scrubbed/i.test(visible), 'Visible output leaked contents of <SYSTEM> block');

  console.log('PASS: output scrub removed <SYSTEM> block.');
  console.log('Visible Output (trimmed):', String(visible).replace(/\n/g,' ').slice(0, 160));
}

try { main(); } catch (err) { console.error('FAIL: output scrub regression:', err.message || err); process.exit(1); }

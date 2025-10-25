/*
No-memories injuries harness (quiet pass-through, /inj command)
- Ensures /inj returns pass-through text when there are no injury memory lines to summarize
- Leverages the same Auto-Cards integration via ACS('input','/inj')

Run:
  node .\tests\injuries-no-memories-harness.js
*/

const fs = require('fs');
const path = require('path');

// Minimal AID globals and AutoCards test API stub
global.storyCards = [];
global.state = {};
global.info = {};
global.text = "";
global.stop = false;
global.history = [{ text: "", type: "start" }];
// Define a noop log to satisfy Auto-Cards logging
global.log = function(){ /* noop */ };

const AutoCardsTestAPI = {
  _cards: [],
  getBannedTitles(){ return []; },
  setBannedTitles(arr){ return { oldBans: [], newBans: [] }; },
  getCard(predicate, many){
    const matches = (this._cards || []).filter(c => { try { return !!predicate(c); } catch { return false; } });
    if (many) return JSON.parse(JSON.stringify(matches));
    return matches[0] ? JSON.parse(JSON.stringify(matches[0])) : null;
  },
  buildCard(t){
    const idx = (this._cards || []).findIndex(c => c.title === t.title);
    if (idx === -1) this._cards.unshift({ ...t }); else this._cards[idx] = { ...this._cards[idx], ...t };
    return true;
  },
  setCardAsAuto(){ return true; }
};

global.AutoCardsTestAPI = AutoCardsTestAPI;

// Load ACS
const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
require(libPath);
const ACS = global._ACS_forTest;
if (typeof ACS !== 'function') { console.error('ACS function not found'); process.exit(1); }

function ensureCoreCards(){ ACS('context', '', false); }

function getInjuriesCard(){
  const idx = AutoCardsTestAPI._cards.findIndex(c => c.title === 'Player Injuries');
  return idx === -1 ? null : AutoCardsTestAPI._cards[idx];
}

function seedHeaderOnly(){
  ensureCoreCards();
  const card = getInjuriesCard();
  if (!card) throw new Error('Player Injuries card missing');
  // Header only, no bullet lines
  card.description = [
    'Auto-Cards will contextualize these memories:',
    '{updates: true, limit: 500}'
  ].join('\n');
}

function main(){
  seedHeaderOnly();
  const out = ACS('input', '/inj', false);
  // Expect pass-through: no continue prompt since there are no memories to summarize
  if (typeof out !== 'string' || /please select\s+"continue"/i.test(out)) {
    console.error('Expected pass-through (no continue prompt) for /inj with no memories');
    process.exit(10);
  }
  console.log('PASS: /inj quietly passed through when there were no injury memories. Output:', JSON.stringify(out));
}

main();

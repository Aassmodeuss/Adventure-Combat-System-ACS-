const fs = require('fs');
const path = require('path');

global.storyCards = [];
global.state = {};
global.info = {};
global.text = "";
global.stop = false;
global.history = [{ text: "", type: "start" }];
global.log = function(){ /* noop */ };

global.AutoCardsTestAPI = {
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

const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
require(libPath);
const ACS = global._ACS_forTest;

function ensureCoreCards(){ ACS('context','', false); }
function getCard(){ return global.AutoCardsTestAPI._cards.find(c=>c.title==='Player Injuries'); }
function seed(){
  ensureCoreCards();
  const card = getCard();
  if (!card) throw new Error('no injuries card');
  const lines = [
    'Auto-Cards will contextualize these memories:',
    '{updates: true, limit: 500}',
    '- [injury] The wolf clamps down on your forearm. Sharp teeth puncture skin and pain flares.',
    '- [heal] You bandage your forearm. The bleeding slows and your grip steadies.',
    '- [injury] A stone drops from above and slams into your ribs. You gasp as the impact knocks the wind from you.',
    '- [heal] You quickly wrap your ribs with bandages. Each breath hurts a little less.',
    '- [injury] A jagged blade slices across your palm. Blood beads quickly along the cut.'
  ];
  card.description = lines.join('\n');
}

seed();
let out;
out = ACS('input','/inv', false);
console.log('INV=', JSON.stringify(out));
out = ACS('input','/inj', false);
console.log('INJ=', JSON.stringify(out));

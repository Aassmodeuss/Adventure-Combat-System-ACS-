/*
ACS Injuries Logging Tests
- Validates that injury/heal tags are parsed and written to the "Player Injuries" card.
- Ensures narration does not repeat injury lines; injuries persist as historical log entries.
*/

const assert = require('assert');

// Minimal AID shims
const storyCards = [];
const state = {};
global.storyCards = storyCards;
global.state = state;

const fs = require('fs');
const path = require('path');
const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
const code = fs.readFileSync(libPath, 'utf8');
const m = code.match(/\/\/----------------------ADVENTURE COMBAT SYSTEM--------------------------------[\s\S]*?function ACS\([\s\S]*?\n\}/);
if (!m) throw new Error('ACS function not found');
const acsFuncSrc = m[0].replace(/^.*?function ACS/m, 'function ACS');

global.AutoCards = () => ({ API: {
  buildCard: (tmpl) => { const card = { ...tmpl }; storyCards.unshift(card); return card; },
  getCard: (pred) => storyCards.find(pred) || null,
  addCardMemory: (title, mem) => {
    const c = storyCards.find(s => s.title === title);
    if (!c) return false;
    if (!c.description) c.description = 'Auto-Cards will contextualize these memories:\n{updates: false, limit: 2750}';
    if (!new RegExp('\\n- ' + mem.replace(/[.*+?^${}()|[\\]\\\\]/g, r=>r)).test(c.description)) {
      c.description += '\n- ' + mem;
    }
    return true;
  },
  setCardAsAuto: () => true,
}});

const fn = new Function('AutoCards', 'storyCards', 'state', `${acsFuncSrc}; return ACS;`);
const ACS = fn(global.AutoCards, storyCards, state);

function run(hook, text='') { return ACS(hook, text, false); }

function getInj(){ const c = storyCards.find(s => s.title === 'Player Injuries'); return c ? c.description : ''; }

(function(){
  // Initialize context to ensure cards exist
  run('context', 'Once upon a time.');

  // Narration with inline injury tag
  const out1 = run('output', 'The wolf slashes your forearm. {\\injury} deep cut on forearm{\\!injury}');
  assert(!/\\injury/.test(out1), 'Tags stripped from output');
  let inj = getInj();
  assert(/deep cut on forearm/i.test(inj), 'Injury logged in card');

  // Repeat narration should not echo injury lines
  const out2 = run('output', 'You cradle your arm, the bleeding slowed.');
  assert(!/deep cut on forearm/i.test(out2), 'No repeated injury text in narration');

  // Heal tag reduces/annotates
  run('output', 'You bind the wound. {\\heal} forearm cut bandaged{\\!heal}');
  inj = getInj();
  assert(/forearm cut bandaged/i.test(inj), 'Heal update captured');

  console.log('ACS injuries logging tests passed.');
})();

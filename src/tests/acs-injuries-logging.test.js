/*
ACS Injuries Logging Tests
- Ensures injuries/heals are flagged and logged correctly in the 'Player Injuries' card
- Verifies order, two-sentence wrapping, deduplication, persistence across turns, and card invariants

Run: node Tests/acs-injuries-logging.test.js
*/

const fs = require('fs');
const path = require('path');

// Minimal globals (shared by ACS)
const storyCards = [];
const state = {};
const info = { actionCount: 1 };
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

function loadACS() {
  const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
  const code = fs.readFileSync(libPath, 'utf8');
  const m = code.match(/\/\/----------------------ADVENTURE COMBAT SYSTEM--------------------------------[\s\S]*?function ACS\([\s\S]*?\n\}/);
  if (!m) throw new Error('ACS function not found');
  const acsFuncSrc = m[0].replace(/^.*?function ACS/m, 'function ACS');
  return new Function('AutoCards', 'storyCards', 'state', 'info', `${acsFuncSrc}; return ACS;`)(global.AutoCards, storyCards, state, info);
}

let ACS = loadACS();

function runOutput(text = '') { return ACS('output', text, false); }
function runContext(text = '') { const [t] = ACS('context', text, false); return t; }

function resetGlobals() {
  storyCards.length = 0;
  for (const k of Object.keys(state)) delete state[k];
  info.actionCount = 1;
}

function getCard(title) { return storyCards.find(sc => sc.title === title) || null; }
function getCardDesc(title) { const c = getCard(title); return c ? c.description || '' : ''; }
function getMemoryLinesFromDesc(desc) {
  // Return all lines that look like memory bullets
  return (desc || '').split(/\r?\n/).filter(l => /^-\s/.test(l.trim()));
}

function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

(function main() {
  // 1) Single injury + heal logs correctly and wrappers scrubbed
  resetGlobals();
  runContext('Continue.');
  const visible1 = runOutput('A wolf lunges. {\\injury}wolf bite to forearm (moderate){\\!injury} Then {\\heal}bandage applied to forearm{\\!heal}.');
  assert(!/\\injury|\\!injury|\\heal|\\!heal/.test(visible1), 'Wrappers must be scrubbed from visible output');
  assert(/wolf bite to forearm \(moderate\)/i.test(visible1), 'Injury text remains inline');
  assert(/bandage applied to forearm/i.test(visible1), 'Heal text remains inline');
  let desc = getCardDesc('Player Injuries');
  assert(desc, 'Player Injuries card should exist after logging');
  assert(/Auto-Cards will contextualize these memories:/i.test(desc), 'Injuries card must include AC memory header');
  assert(/\{updates:\s*true\b/i.test(desc), 'Injuries card must be updates:true');
  let mems = getMemoryLinesFromDesc(desc);
  assert(mems.some(l => /- \[injury\] wolf bite to forearm \(moderate\)/i.test(l)), 'Injury event should be logged with [injury] flag');
  assert(mems.some(l => /- \[heal\] bandage applied to forearm/i.test(l)), 'Heal event should be logged with [heal] flag');

  // 2) Multiple events maintain order of appearance
  resetGlobals();
  runContext('Continue.');
  runOutput('{\\injury}first cut on cheek.{\\!injury} Some text. {\\injury}second bruise on ribs.{\\!injury} Later {\\heal}applied ointment.{\\!heal} Finally {\\heal}tight wrap on ribs.{\\!heal}');
  desc = getCardDesc('Player Injuries');
  mems = getMemoryLinesFromDesc(desc);
  const idx = (pat) => mems.findIndex(l => pat.test(l));
  const i1 = idx(/\[injury\]\s*first cut on cheek\./i);
  const i2 = idx(/\[injury\]\s*second bruise on ribs\./i);
  const h1 = idx(/\[heal\]\s*applied ointment\./i);
  const h2 = idx(/\[heal\]\s*tight wrap on ribs\./i);
  assert(i1 !== -1 && i2 !== -1 && h1 !== -1 && h2 !== -1, 'All events should be logged');
  assert(i1 < i2 && i2 < h1 && h1 < h2, 'Events should be logged in order of appearance');

  // 3) Two contiguous sentences allowed in a single injury wrapper
  resetGlobals();
  runContext('Continue.');
  runOutput('{\\injury}A deep slash across the palm. Blood drips down your fingers.{\\!injury}');
  desc = getCardDesc('Player Injuries');
  mems = getMemoryLinesFromDesc(desc);
  assert(mems.some(l => /\[injury\]\s*A deep slash across the palm\. Blood drips down your fingers\./i.test(l)), 'Two-sentence injury should be captured intact');

  // 4) Identical events across outputs are appended (no dedup currently)
  resetGlobals();
  runContext('Continue.');
  const ev = '{\\injury}puncture wound on calf{\\!injury}';
  runOutput('First: ' + ev);
  runOutput('Second time again: ' + ev);
  desc = getCardDesc('Player Injuries');
  mems = getMemoryLinesFromDesc(desc).filter(l => /\[injury\]\s*puncture wound on calf/i.test(l));
  assert(mems.length === 2, 'Identical injury events are appended when repeated');

  // 5) Persistence across turns: events accumulate, not overwrite
  resetGlobals();
  runContext('Continue.');
  runOutput('{\\injury}sprained wrist{\\!injury}');
  runOutput('Later: {\\heal}splinted wrist{\\!heal}');
  desc = getCardDesc('Player Injuries');
  mems = getMemoryLinesFromDesc(desc);
  assert(mems.some(l => /\[injury\]\s*sprained wrist/i.test(l)), 'First turn injury present');
  assert(mems.some(l => /\[heal\]\s*splinted wrist/i.test(l)), 'Second turn heal appended');
  const injCount = storyCards.filter(c => c.title === 'Player Injuries').length;
  assert(injCount === 1, 'Only one Player Injuries card should exist');

  // 6) No tags -> injuries card may be present, but no memory bullets should be logged
  resetGlobals();
  runContext('Continue.');
  runOutput('A quiet, uneventful moment.');
  desc = getCardDesc('Player Injuries');
  mems = getMemoryLinesFromDesc(desc);
  assert(mems.length === 0, 'No injury/heal events should be logged when no tags are present');

  console.log('SUCCESS: ACS injuries logging tests passed.');
})();

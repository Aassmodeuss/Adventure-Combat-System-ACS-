// Simple /inv command harness
// Purpose: Validate that ACS("input") handles /inv by creating item cards for inventory entries
// and returns a "please select \"continue\" (0%)" placeholder like Auto-Cards.

/* eslint-disable no-console */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Minimal Auto-Cards API stub sufficient for /inv (queued generation)
const apiStub = {
  _cards: [],
  _generated: [],
  getCard(selector, all) {
    if (typeof selector !== 'function') return null;
    const matches = this._cards.filter(c => {
      try { return selector(c); } catch { return false; }
    });
    return all ? matches : (matches[0] || null);
  },
  buildCard(card) {
    this._cards.push({ ...card });
    return true;
  },
  generateCard(opts) {
    // De-dup by title (case-insensitive)
    const lower = String(opts?.title || '').toLowerCase();
    const exists = this._generated.some(g => String(g.title).toLowerCase() === lower)
      || this._cards.some(c => String(c.title || '').toLowerCase() === lower);
    if (exists) return false;
    this._generated.push({ ...opts });
    return true;
  },
  setCardAsAuto() { /* no-op */ },
  getBannedTitles() { return []; },
  setBannedTitles() { /* no-op */ },
};

function loadLibrary(jsPath) {
  const code = fs.readFileSync(jsPath, 'utf8');
  const sandbox = {
    console,
    globalThis: {},
    // AID globals (light stubs)
    storyCards: [],
    state: {},
    text: "",
    stop: false,
    history: [],
    info: {},
    MainSettings: function MainSettings(ns) {
      if (!sandbox.MainSettings[ns]) sandbox.MainSettings[ns] = {};
      this.merge = (obj) => { Object.assign(sandbox.MainSettings[ns], obj || {}); };
    },
    AutoCards: function AutoCards() { return { API: apiStub } },
  };
  // Attach API stub lazily after definition below
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context, { filename: jsPath });
  // Override AutoCards after library load to ensure ACS uses the stubbed API
  context.AutoCards = function AutoCards() { return { API: apiStub }; };
  context.globalThis.AutoCards = context.AutoCards;
  return context;
}


function seedInventory(context, items) {
  // Ensure Inventory card exists
  apiStub._cards.push({
    title: 'Inventory',
    type: 'class',
    keys: 'Inventory',
    entry: '{title: Inventory}\nManaged by ACS.',
    description: [
      'Auto-Cards will contextualize these memories:',
      '{updates: false, limit: 2750}',
      ...items.map(it => `- ${it}`),
    ].join('\n')
  });
}

function runInvCommand(context) {
  const ACS = context.ACS || context.globalThis.ACS;
  const text = '/inv';
  const res = ACS('input', text, false);
  return res;
}

function assert(condition, message) {
  if (!condition) { throw new Error(message); }
}

function main() {
  const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
  const context = loadLibrary(libPath);

  // Seed three inventory items with categories
  seedInventory(context, [
    'iron sword[weapon] x1',
    'leather armor[armor] x1',
    'rope[item] x1',
  ]);

  const out = runInvCommand(context);
  console.log('ACS(input) returned:', out);
  // Expect the Auto-Cards style continue prompt
  assert(typeof out === 'string' && out.includes('please select "continue"'), 'Input replacement must prompt to continue');

  // Validate queued generations exist for each item (or immediate cards, if buildCard were used)
  const allObjs = [...apiStub._cards, ...apiStub._generated];
  const titles = new Set(allObjs.map(c => String(c.title || '')).map(s => s.replace(/\s+/g, ' ').trim()));
  console.log('Generated titles:', Array.from(titles).join(', '));
  assert(titles.has('Iron Sword'), 'Missing generation: Iron Sword');
  assert(titles.has('Leather Armor'), 'Missing generation: Leather Armor');
  assert(titles.has('Rope'), 'Missing generation: Rope');

  // Validate queued request structure for item-type generations
  // New behavior: descriptions should NOT include the AC memory header; Auto-Cards will append it when building the card.
  const withHeader = apiStub._generated.filter(c => c.type === 'item' && /Auto-Cards will contextualize these memories:/i.test(c.description || ''));
  assert(withHeader.length === 0, `Descriptions should not include AC memory header: ${withHeader.map(c => c.title).join(', ')}`);
  const badLimit = apiStub._generated.filter(c => c.type === 'item' && Number(c.entryLimit) !== 400);
  assert(badLimit.length === 0, `Wrong entryLimit for items: ${badLimit.map(c => c.title).join(', ')}`);

  // Subtest: skip already-existing item cards
  console.log('Subtest: existing card skip');
  const beforeCount = apiStub._generated.length;
  const out2 = runInvCommand(context);
  assert(out2.includes('please select'), 'Must still return continue prompt on second run');
  const afterCount = apiStub._generated.length;
  assert(afterCount === beforeCount, 'Should not queue duplicates when already requested');

  // Subtest: handle items without categories (defaults to [item] in card meta)
  console.log('Subtest: no-category items');
  // Manually add a no-category inventory line and re-run
  const invCard = apiStub._cards.find(c => c.title === 'Inventory');
  invCard.description += '\n- waterskin x1';
  const out3 = runInvCommand(context);
  assert(out3.includes('please select'), 'Must return continue prompt');
  const waterskin = [...apiStub._generated, ...apiStub._cards].find(c => c.title === 'Waterskin');
  assert(!!waterskin, 'Missing generation: Waterskin');
  assert(/Category: (item|weapon|armor)/i.test(waterskin.description || ''), 'Waterskin description missing Category');

  // Subtest: ignore zero-quantity items
  console.log('Subtest: zero-quantity items');
  // Add a zero-quantity line
  invCard.description += '\n- apple[item] x0';
  const out4 = runInvCommand(context);
  assert(out4.includes('please select'), 'Must return continue prompt');
  const apple = [...apiStub._generated, ...apiStub._cards].find(c => c.title === 'Apple');
  assert(!apple, 'Zero-quantity items should not queue generations');

  console.log('SUCCESS: /inv generated cards with proper structure and handled edge cases.');
}

if (require.main === module) {
  try { main(); process.exit(0); } catch (e) { console.error(String(e.message || e)); process.exit(1); }
}

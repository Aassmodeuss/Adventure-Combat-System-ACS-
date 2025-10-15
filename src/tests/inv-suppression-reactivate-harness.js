// /inv suppression reactivation harness
// Ensures the inventory tagging prompt is suppressed while item cards are pending
// and reactivates automatically once all queued /inv story cards are created.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Auto-Cards API stub with queued generation + actual cards
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
  buildCard(card) { this._cards.push({ ...card }); return true; },
  generateCard(opts) {
    const lower = String(opts?.title || '').toLowerCase();
    const dup = this._generated.some(g => String(g.title).toLowerCase() === lower)
      || this._cards.some(c => String(c.title || '').toLowerCase() === lower);
    if (dup) return false;
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
    // AID globals
    storyCards: [],
    state: {},
    text: '',
    stop: false,
    history: [],
    info: {},
    MainSettings: function MainSettings(ns) {
      if (!sandbox.MainSettings[ns]) sandbox.MainSettings[ns] = {};
      this.merge = (obj) => { Object.assign(sandbox.MainSettings[ns], obj || {}); };
    },
    AutoCards: function AutoCards() { return { API: apiStub }; },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context, { filename: jsPath });
  // Ensure our API stub is used
  context.AutoCards = function AutoCards() { return { API: apiStub }; };
  context.globalThis.AutoCards = context.AutoCards;
  return context;
}

function seedInventory(context, items) {
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

function runInputInv(context) {
  const ACS = context.ACS || context.globalThis.ACS;
  return ACS('input', '/inv', false);
}
function runContext(context, text='ctx') {
  const ACS = context.ACS || context.globalThis.ACS;
  const res = ACS('context', text, false);
  return Array.isArray(res) ? res[0] : res;
}

function assert(cond, msg){ if (!cond) throw new Error(msg); }

(function main(){
  const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
  const ctx = loadLibrary(libPath);

  // Seed three items; none of their cards exist yet
  seedInventory(ctx, [
    'iron sword[weapon] x1',
    'leather armor[armor] x1',
    'rope[item] x1',
  ]);

  // Queue generations via /inv
  const out = runInputInv(ctx);
  assert(typeof out === 'string' && out.includes('please select'), 'Expected continue prompt from /inv');

  // Immediately after queuing, context should be suppressed (no standing prompt)
  let t1 = runContext(ctx, 'Story...');
  assert(!/Inventory\s+Tagging/i.test(t1), 'Inventory prompt should be suppressed while generations pending');
  assert(!/Injury\s+Tagging/i.test(t1), 'Injury prompt should be suppressed while generations pending');

  // Simulate only one card being created: still suppressed
  apiStub._cards.push({ title: 'Iron Sword', type: 'weapon', keys: 'Iron Sword', entry: '{title: Iron Sword}', description: '...' });
  let t2 = runContext(ctx, 'Story...');
  assert(!/Inventory\s+Tagging/i.test(t2), 'Inventory prompt should remain suppressed until all cards exist');
  assert(!/Injury\s+Tagging/i.test(t2), 'Injury prompt should remain suppressed until all cards exist');

  // Simulate the rest being created
  apiStub._cards.push({ title: 'Leather Armor', type: 'armor', keys: 'Leather Armor', entry: '{title: Leather Armor}', description: '...' });
  apiStub._cards.push({ title: 'Rope', type: 'item', keys: 'Rope', entry: '{title: Rope}', description: '...' });

  // Now the context should reactivate the standing prompt automatically
  let t3 = runContext(ctx, 'Story...');
  assert(/Inventory\s+Tagging/i.test(t3), 'Inventory prompt should reactivate after all cards exist');
  assert(/Injury\s+Tagging/i.test(t3), 'Injury prompt should reactivate after all cards exist');

  // And the suppression bag should be cleared
  const bag = ctx.state._ACS || {};
  assert(Array.isArray(bag.pendingInvTitles) ? bag.pendingInvTitles.length === 0 : true, 'pendingInvTitles should be cleared');
  assert(!bag.pendingInvTTL || bag.pendingInvTTL === 0, 'pendingInvTTL should be zeroed');

  console.log('SUCCESS: /inv suppression reactivates after all cards are created.');
})();

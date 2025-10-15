/*
/inv generate harness
- Verifies that ACS /inv queues Auto-Cards API.generateCard calls with correct parameters per inventory item
- Ensures continue prompt response, toasts, skip rules (zero qty, reserved titles, existing cards), and type mapping from category
*/

// Minimal AID runtime stubs
global.history = [{ text: "", type: "start" }];
global.storyCards = [];
global.state = { message: "" };
global.info = { actionCount: 0 };
// AID globals expected at module init
global.text = "";
global.stop = false;
// Logger expected by library.js
global.log = function(){ /* noop for tests */ };

// Scripting helpers used by Auto-Cards internals if evaluated
global.addStoryCard = function(title) {
  storyCards.push({ title, type: "class", keys: title, entry: title, description: "" });
};
global.updateStoryCard = function(index, card) {
  storyCards[index] = { ...storyCards[index], ...card };
};
global.removeStoryCard = function(index) {
  storyCards.splice(index, 1);
};

// Minimal MainSettings stub used by ACS
class MainSettings {
  constructor(ns) { this.ns = ns; }
  merge(obj) { MainSettings[this.ns] = { ...(MainSettings[this.ns] || {}), ...obj }; }
}
global.MainSettings = MainSettings;

// Load ACS (from src/library.js)
const path = require("path");
require(path.resolve(__dirname, "..", "src", "library.js"));

const ACS = global._ACS_forTest;
if (typeof ACS !== "function") {
  console.error("FAIL: ACS was not exposed for test");
  process.exit(1);
}

function clone(o){ return JSON.parse(JSON.stringify(o)); }
const recorded = [];
// Provide a direct test API for ACS to use
global.AutoCardsTestAPI = {
  _banned: [],
  getBannedTitles(){ return this._banned.slice(); },
  setBannedTitles(arr){ this._banned = (arr || []).slice(); return { oldBans: [], newBans: this._banned.slice() }; },
  getCard(predicate, many){
    const matches = storyCards.filter(c => { try { return !!predicate(c); } catch { return false; } });
    if (many) return JSON.parse(JSON.stringify(matches));
    return matches[0] ? JSON.parse(JSON.stringify(matches[0])) : null;
  },
  buildCard({ title, type, keys, entry, description }){
    const exists = storyCards.some(c => c.title === title);
    if (!exists) storyCards.push({ title, type, keys, entry, description });
    return true;
  },
  setCardAsAuto(title, flag){ return true; },
  generateCard(opts){
    const exists = recorded.some(r => String(r.title).toLowerCase() === String(opts.title).toLowerCase());
    if (exists) return false;
    recorded.push(clone(opts));
    return true;
  },
};

// Seed Inventory card and a mix of existing cards
function seedInventory(desc){
  // Ensure Inventory exists in storyCards so internal API can find it
  const inv = { title: "Inventory", type: "class", keys: "Inventory", entry: "{title: Inventory}", description: desc };
  storyCards.push(inv);
}

function titleCase(s){ return String(s).replace(/\b\w/g, m => m.toUpperCase()); }

function assert(cond, msg){ if (!cond) { throw new Error(msg); } }

(async function run(){
  try {
    // Case 1: basic generation with categories and zero-qty filtering
    seedInventory([
      "Auto-Cards will contextualize these memories:",
      "{updates: false, limit: 2750}",
      "- iron sword[weapon] x1",
      "- leather armor[armor] x1",
      "- rope[item] x1",
      "- waterskin[item] x0" // should be ignored
    ].join("\n"));

  const out = ACS("input", "/inv");
  assert(typeof out === "string" && out.includes("please select"), "Expected continue prompt from /inv");

    // Verify generation requests
  const gens = recorded;
    const want = [
      { title: titleCase("iron sword"), type: "weapon", cat: "weapon", qty: 1 },
      { title: titleCase("leather armor"), type: "armor", cat: "armor", qty: 1 },
      { title: titleCase("rope"), type: "item", cat: "item", qty: 1 },
    ];

    // Map gens by title
    const map = new Map(gens.map(g => [g.title, g]));
    for (const w of want) {
      const g = map.get(w.title);
      assert(g, `Missing generation for ${w.title}`);
      assert(g.type === w.type, `Type mismatch for ${w.title}: ${g.type} != ${w.type}`);
      assert(typeof g.entryPromptDetails === "string" && g.entryPromptDetails.length > 40, `Weak prompt for ${w.title}`);
      assert(typeof g.entryStart === "string" && g.entryStart.startsWith(`{title: ${w.title}}`), `Bad entryStart for ${w.title}`);
      assert(typeof g.description === "string" && g.description.includes(`Category: ${w.cat}`), `Description missing category for ${w.title}`);
      assert(g.description.includes(`Current quantity: x${w.qty}`), `Description missing qty for ${w.title}`);
      assert(g.memoryUpdates === true, `memoryUpdates not true for ${w.title}`);
      // Ensure appended prompt details focus on object-only description and category guidance
      const P = g.entryPromptDetails;
      assert(/intrinsic properties/i.test(P), `Prompt missing intrinsic properties guidance for ${w.title}`);
      assert(/avoid story or scene content/i.test(P), `Prompt missing story avoidance line for ${w.title}`);
      assert(/single compact paragraph/i.test(P), `Prompt missing single-paragraph guidance for ${w.title}`);
      assert(/400/i.test(P), `Prompt should mention ~400 characters for ${w.title}`);
      // Category-specific guidance present
      if (w.type === 'weapon') {
        assert(/weapon: include classification/i.test(P), `Prompt missing weapon classification guidance for ${w.title}`);
      } else if (w.type === 'armor') {
        assert(/armor: include/i.test(P), `Prompt missing armor guidance for ${w.title}`);
      } else {
        assert(/For inventory object cards/i.test(P), `Prompt missing inventory object preface for ${w.title}`);
      }
    }

    // Case 2: rerun should not duplicate generate requests for existing titles
  const previousCount = recorded.length;
    const out2 = ACS("input", "/inv");
  assert(recorded.length === previousCount, "Should not enqueue duplicate generations on second /inv");

    // Case 3: existing item card blocks generation
  const extra = { title: titleCase("rope"), type: "item", keys: "Rope", entry: "{title: Rope}", description: "..." };
  storyCards.push(extra);
  const out3 = ACS("input", "/inv");
  assert(recorded.length === previousCount, "Existing card should block generation");

    // Case 4: reserved titles are ignored
  storyCards.push({ title: "Player Stats", type: "class", keys: "Player Stats", entry: "..", description: ".." });
    const inv2 = storyCards.find(c => c.title === "Inventory");
    inv2.description = [
      "Auto-Cards will contextualize these memories:",
      "{updates: false, limit: 2750}",
      "- player stats[item] x1"
    ].join("\n");
    const out4 = ACS("input", "/inv");
  assert(!recorded.some(g => g.title === "Player Stats"), "Reserved title should not be generated");

    // Case 5: no categories present still generates (defaults to item)
  const inv3 = storyCards.find(c => c.title === "Inventory");
    inv3.description = [
      "Auto-Cards will contextualize these memories:",
      "{updates: false, limit: 2750}",
      "- compass x1"
    ].join("\n");
  const before = recorded.length;
    const out5 = ACS("input", "/inv");
  const after = recorded.length;
    assert(after === before + 1, "Expected generation for item without category");
  const last = recorded[recorded.length - 1];
    assert(last.title === titleCase("compass"), "Unexpected title for no-category item");
    assert(last.type === "item", "Default type should be item");
    assert(last.description.includes("Category: item"), "Description should default category to item");

    console.log("SUCCESS: /inv queued unique item generations with correct prompts and rules.");
    process.exit(0);
  } catch (e) {
    console.error("FAIL:", e.message);
    process.exit(1);
  }
})();

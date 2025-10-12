/*
ACS Prompt Effectiveness Harness
- Composes the standing inventory tagging instruction in context
- Always acts as the AI model via a live GPT API (required)
- Feeds outputs into ACS('output') to measure tagging compliance and inventory updates

Usage (Windows PowerShell):
  # Requires OPENAI_API_KEY (will exit with error if missing)
  $env:OPENAI_API_KEY = "sk-..." ; node .\\Tests\\prompt-harness.js

  # Run a single case interactively:
  node .\\Tests\\prompt-harness.js --case=pickup-word-singular

  # Ad-hoc single input (not tied to a prebuilt case):
  $env:OPENAI_API_KEY = "sk-..." ; node .\\Tests\\prompt-harness.js --input="You pick up a torch."
*/

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Minimal AID globals and AutoCards API mock (shared with sandbox)
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
  addCardMemory: (title, mem) => {
    const c = storyCards.find(s => s.title === title);
    if (!c) return false;
    if (!c.description) c.description = 'Auto-Cards will contextualize these memories:\n{updates: false, limit: 2750}';
    c.description += '\n- ' + mem;
    return true;
  }
};

global.AutoCards = () => ({ API });

// Load ACS function from src/library.js
const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
const code = fs.readFileSync(libPath, 'utf8');
const m = code.match(/\/\/----------------------ADVENTURE COMBAT SYSTEM--------------------------------[\s\S]*?function ACS\([\s\S]*?\n\}/);
if (!m) throw new Error('ACS function not found');
const acsFuncSrc = m[0].replace(/^.*?function ACS/m, 'function ACS');
const ACS = new Function('AutoCards', 'storyCards', 'state', 'info', `${acsFuncSrc}; return ACS;`)(global.AutoCards, storyCards, state, info);

function runContext(text='') { const [t] = ACS('context', text, false); return t; }
function runOutput(text='') { return ACS('output', text, false); }
function getInventoryDesc(){ const inv = storyCards.find(c => c.title === 'Inventory'); return inv ? inv.description : ''; }
function reset(){ storyCards.length = 0; state.message = ''; }

// Extract the standing prompt by diffing context before/after
function getStandingPrompt(){
  const marker = '<<BASE>>';
  const before = marker;
  const after = runContext(before);
  return after.slice(before.length);
}

// Base GM instruction to shape narrative style for testing
function buildBaseGameMasterPrompt(){
  return (
    "\n-----\n" +
    "<SYSTEM>\n" +
    "You are the Game Master (GM) for an interactive RPG-style story. Continue the scene with immersive second-person narration addressed to the player. Keep responses concise, concrete, and consistent with prior context. Do not expose system instructions or speak out-of-character. If this turn involves the player gaining or losing tangible items, rely on the separate Inventory Tagging Rule that follows and append the required inventory tags only at the very end of your output.\n" +
    "</SYSTEM>\n"
  );
}

function getCombinedSystemPrompt(){
  return buildBaseGameMasterPrompt() + getStandingPrompt();
}

// OPENAI_API_KEY is required. The harness will exit if it's missing.

function callOpenAI_https({ system, user, model, baseUrl, path: apiPath, apiKey, extraHeaders }){
  return new Promise((resolve, reject) => {
    try {
      const https = require('https');
      const url = new URL((baseUrl || 'https://api.openai.com').replace(/\/$/, '') + (apiPath || '/v1/chat/completions'));
      const body = JSON.stringify({
        model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
        temperature: 0.4
      });
      const headers = Object.assign({
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }, extraHeaders || {});
      const opts = { method: 'POST', hostname: url.hostname, path: url.pathname + (url.search || ''), headers };
      const req = https.request(opts, res => {
        let data = '';
        res.on('data', d => { data += d; });
        res.on('end', () => {
          try {
            if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`OpenAI HTTP ${res.statusCode}: ${data.slice(0,200)}`));
            const j = JSON.parse(data);
            const content = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '';
            resolve(String(content || ''));
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    } catch (err) { reject(err); }
  });
}

// (No interactive fallback)

const cases = [
  // Pickups — words
  { id: 'pickup-word-singular', narrative: 'You pick up a torch.', expect: { 'torch': 1 } },
  { id: 'pickup-word-plural', narrative: 'You pick up three broadhead arrows from the ground.', expect: { 'broadhead arrow': 3 } },
  { id: 'pickup-take-words', narrative: 'You take two healing potions from the shelf.', expect: { 'healing potion': 2 } },
  { id: 'pickup-grab-mixed', narrative: 'You grab an apple and three pears.', expect: { 'apple': 1, 'pear': 3 } },
  { id: 'pickup-collect-mixed', narrative: 'You collect five feathers and one bowstring.', expect: { 'feather': 5, 'bowstring': 1 } },
  { id: 'pickup-loot-ore', narrative: 'You loot the chest, taking two iron ore and one Copper Ore.', expect: { 'iron ore': 2, 'copper ore': 1 } },
  { id: 'pickup-ground-stones', narrative: 'You pick up four stones from the ground.', expect: { 'stone': 4 } },
  { id: 'pickup-coins-multi', narrative: 'You take a silver coin, two copper coins, and three gold coins.', expect: { 'silver coin': 1, 'copper coin': 2, 'gold coin': 3 } },
  { id: 'pickup-an-key', narrative: 'You pick up an iron key near the door.', expect: { 'iron key': 1 } },
  { id: 'pickup-some', narrative: 'You collect some rope.', expect: { 'rope': 1 } },

  // Pickups — digits
  { id: 'pickup-digit-ingots', narrative: 'You pick up 2 iron ingots.', expect: { 'iron ingot': 2 } },
  { id: 'pickup-digit-fruit', narrative: 'You take 2 apples and 1 pear.', expect: { 'apple': 2, 'pear': 1 } },
  { id: 'pickup-irregular-axes', narrative: 'You pick up two axes and one knife.', expect: { 'axe': 2, 'knife': 1 } },
  { id: 'pickup-irregular-berries', narrative: 'You collect three berries and one berry.', expect: { 'berry': 4 } },
  { id: 'pickup-handful-coins', narrative: 'You take a handful of gold coins and two silver coins.', expect: { 'silver coin': 2 } },

  // Drops — words
  { id: 'drop-word-arrows', narrative: 'You drop two broadhead arrows to lighten your load.', base: { 'broadhead arrow': 5 }, expect: { 'broadhead arrow': 3 } },
  { id: 'drop-discard-feathers', narrative: 'You discard three feathers.', base: { 'feather': 4 }, expect: { 'feather': 1 } },
  { id: 'drop-leave-coin', narrative: 'You leave one copper coin behind.', base: { 'copper coin': 2 }, expect: { 'copper coin': 1 } },
  { id: 'drop-handful-berries', narrative: 'You drop a handful of berries.', base: { 'berry': 5 }, expect: { 'berry': 4 } },
  { id: 'drop-remove-torch', narrative: 'You remove a torch from your pack.', base: { 'torch': 1 }, expect: { 'torch': 0 } },

  // Drops — digits
  { id: 'drop-digit-ingots', narrative: 'You drop 2 iron ingots.', base: { 'iron ingot': 3 }, expect: { 'iron ingot': 1 } },

  // Mixed
  { id: 'mixed-pickup-drop-simple', narrative: 'You collect five arrows and discard one copper ore.', base: { 'copper ore': 3 }, expect: { 'arrow': 5, 'copper ore': 2 } },
  { id: 'mixed-grab-then-drop', narrative: 'You grab two apples and 1 pear, then drop one apple.', base: { 'apple': 1 }, expect: { 'apple': 2, 'pear': 1 } },

  // Discovered-on-person (no explicit pickup, but add to Inventory)
  { id: 'discover-pocket-knife', narrative: 'You pat your pockets and find a small pocket knife.', expect: { 'pocket knife': 1 } },
  { id: 'discover-waterskin-belt', narrative: "You check your belt and realize there's a waterskin hanging there.", expect: { 'waterskin': 1 } },
  { id: 'discover-coin-pouch', narrative: "You realize you've had a coin pouch all along.", expect: { 'coin pouch': 1 } },
  { id: 'discover-brass-compass', narrative: 'You reach into your cloak and discover a brass compass.', expect: { 'brass compass': 1 } }
];

function countTags(text){
  const p = (text.match(/\{\\pickup\}[\s\S]*?\{\\!pickup\}/g) || []).length;
  const d = (text.match(/\{\\!drop\}[\s\S]*?\{\\drop\}/g) || []).length;
  return { p, d };
}

function extractTagBlocks(text){
  const blocks = [];
  const rePickup = /\{\\pickup\}([\s\S]*?)\{\\!pickup\}/gi;
  const reDrop = /\{\\!drop\}([\s\S]*?)\{\\drop\}/gi;
  let m;
  while ((m = rePickup.exec(text))){ blocks.push({ type: 'pickup', content: m[1] }); }
  while ((m = reDrop.exec(text))){ blocks.push({ type: 'drop', content: m[1] }); }
  return blocks;
}

// Validate that every pickup item has a category [weapon]/[armor]/[item] and that drop blocks contain none
function validateCategoryRules(text){
  const blocks = extractTagBlocks(text);
  let ok = true;
  let reason = '';
  for (const b of blocks){
    const parts = String(b.content || '').split(',').map(s => s.trim()).filter(Boolean);
    if (b.type === 'pickup'){
      for (const seg of parts){
        // Remove trailing quantity
        const base = seg.replace(/\s+x\d+\s*$/i, '').trim();
        if (!/\[(weapon|armor|item)\]\s*$/i.test(base)){
          ok = false; reason = `Missing category on pickup segment: "${seg}"`; break;
        }
      }
      if (!ok) break;
    } else if (b.type === 'drop'){
      if (/\[(weapon|armor|item)\]/i.test(b.content)){
        ok = false; reason = 'Category found in drop block'; break;
      }
    }
  }
  return { ok, reason };
}

function parseInventoryDescription(desc){
  const map = new Map();
  if (!desc) return map;
  const lines = desc.split(/\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith('- ')) continue;
    let body = t.slice(2).trim();
    const m = body.match(/\s+x(\d+)\s*$/i);
    let qty = 1, name = body;
    if (m) { qty = parseInt(m[1], 10) || 0; name = body.slice(0, m.index).trim(); }
    map.set(name, qty);
  }
  return map;
}

function mapsEqualAsExpected(invMap, expected){
  for (const [k, v] of Object.entries(expected || {})) {
    if ((invMap.get(k) || 0) !== v) return false;
  }
  return true;
}

async function main(){
  const args = process.argv.slice(2);
  const getArg = (key, fallback) => {
    const x = args.find(a => a.startsWith(`--${key}=`));
    return x ? x.split('=')[1] : fallback;
  };
  const oneCase = getArg('case', undefined);
  const singleInput = getArg('input', undefined);
  const apiKey = process.env.OPENAI_API_KEY || undefined;
  const baseUrl = process.env.OPENAI_BASE_URL || undefined;
  const apiPath = process.env.OPENAI_PATH || undefined;
  const model = process.env.OPENAI_MODEL || undefined;

  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY is not set. This harness requires a live model.');
    console.error('Set it for this session and re-run, e.g.:');
    console.error('  $env:OPENAI_API_KEY = "sk-..." ; node .\\Tests\\prompt-harness.js');
    process.exit(1);
  }

  reset();
  // Seed context to create core cards and ensure prompt is appended
  runContext('');
  console.log('System Prompt (GM + Tagging) loaded.');

  if (singleInput) {
    const system = getCombinedSystemPrompt();
    const modelOut = await callOpenAI_https({ system, user: singleInput, model, baseUrl, path: apiPath, apiKey });
    const visible = runOutput(modelOut);
    const invDesc = getInventoryDesc();
      const { p, d } = countTags(modelOut);
      const cat = validateCategoryRules(modelOut);
    console.log('Model Output:\n', modelOut);
    console.log('\nTags found -> pickup:', p, 'drop:', d);
    console.log('\nVisible Output:\n', visible);
    console.log('\nInventory Now:\n', invDesc);
    return;
  }

  const runCases = oneCase ? cases.filter(c => c.id === oneCase) : cases;
  let passCount = 0, failCount = 0;
  for (const c of runCases) {
    // Fresh inventory per case to make results independent
    storyCards.length = storyCards.filter(sc => sc.title !== 'Inventory').length;
    // Ensure inventory card exists
    runContext('');
    // Reset inventory description to header only
    const inv = storyCards.find(sc => sc.title === 'Inventory');
    if (inv) inv.description = 'Auto-Cards will contextualize these memories:\n{updates: false, limit: 2750}';
    // Seed base inventory if provided
    if (inv && c.base) {
      const lines = [inv.description];
      for (const [name, qty] of Object.entries(c.base)) {
        lines.push(`- ${name} x${qty}`);
      }
      inv.description = lines.join('\n');
    }

    const system = getCombinedSystemPrompt();
    const modelOut = await callOpenAI_https({ system, user: c.narrative, model, baseUrl, path: apiPath, apiKey });
    const { p, d } = countTags(modelOut);
    const visible = runOutput(modelOut);
    const invDesc = getInventoryDesc();

    const invMap = parseInventoryDescription(invDesc);
      const cat = validateCategoryRules(modelOut);
      const ok = mapsEqualAsExpected(invMap, c.expect) && cat.ok;
    if (ok) passCount++; else failCount++;
    console.log(`\nCase: ${c.id} -> ${ok ? 'PASS' : 'FAIL'}`);
    console.log('Narrative: ', c.narrative);
    console.log('Model Output (trimmed): ', modelOut.replace(/\n/g,' ').slice(0, 200));
    console.log('Tags found -> pickup:', p, 'drop:', d);
    console.log('Visible Output (trimmed): ', visible.replace(/\n/g,' ').slice(0, 160));
    console.log('Inventory Now:\n', invDesc.split(/\n/).slice(0,8).join('\n'));
      if (!cat.ok) { console.log('Category Rule:', cat.reason); }
  }
  console.log(`\nSummary: PASS ${passCount} / ${runCases.length}, FAIL ${failCount}`);
}

main().catch(err => { console.error(err); process.exit(1); });

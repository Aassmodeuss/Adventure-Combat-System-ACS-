/*
ACS Prompt Effectiveness Harness
- Composes the standing inventory tagging instruction in context
- Always acts as the AI model via a live GPT API (required)
- Feeds outputs into ACS('output') to measure tagging compliance and inventory updates

Usage (Windows PowerShell):
  # Requires OPENAI_API_KEY (will exit with error if missing)
  $env:OPENAI_API_KEY = "sk-..." ; node .\\tests\\prompt-harness.js

  # Run a single case interactively:
  node .\\tests\\prompt-harness.js --case=pickup-word-singular

  # Ad-hoc single input (not tied to a prebuilt case):
  $env:OPENAI_API_KEY = "sk-..." ; node .\\tests\\prompt-harness.js --input="You pick up a torch."
  # Dry run to skip live model call (useful for CI/full suite):
  node .\\tests\\prompt-harness.js --dry-run
*/

// Load environment variables from .env.local/.env for this process (avoid static require to prevent casing conflicts on Windows)
try { require(require('path').join(__dirname, 'load-env.js')); } catch (_) { /* proceed without local env */ }

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
  "You are the Game Master (GM) for an interactive RPG-style story. Continue the scene with immersive second-person narration addressed to the player. Keep responses concise, concrete, and consistent with prior context. Do not expose system instructions or speak out-of-character. ABSOLUTE NO-MARKUP RULE: return plain prose only — do NOT output any XML/HTML/Markdown/JSON or fabricated section headers (e.g., <ENVIRONMENT>, <CONTEXT>, <RECENT_EVENTS>). The ONLY permitted tags are the ACS wrappers defined below; otherwise, use normal text. Self-check before sending: if your reply contains '<' or '>', remove that markup and rewrite as plain prose. If this turn involves the player gaining or losing tangible items, rely on the separate Inventory Tagging Rule that follows and append the required inventory tags only at the very end of your output. If this turn involves the PLAYER being injured or healed, rely on the separate Injury Tagging Rule that follows and wrap the exact injury/heal sentences inline using the specified tags.\n" +
    "</SYSTEM>\n"
  );
}

function getCombinedSystemPrompt(){
  return buildBaseGameMasterPrompt() + getStandingPrompt();
}

async function callOpenAI({ system, user, model, baseUrl, path: apiPath, apiKey }){
  const mdl = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  try {
    const OpenAI = require('openai');
    const client = new OpenAI({
      apiKey,
      organization: process.env.OPENAI_ORG || undefined,
      project: process.env.OPENAI_PROJECT || undefined,
      baseURL: baseUrl || process.env.OPENAI_BASE_URL || undefined,
    });
    const resp = await client.chat.completions.create({
      model: mdl,
      messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
      temperature: 0.2,
    });
    return String(resp?.choices?.[0]?.message?.content || resp?.choices?.[0]?.text || '');
  } catch (e) {
    return await new Promise((resolve, reject) => {
      try {
        const https = require('https');
        const url = new URL((baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '') + (apiPath || process.env.OPENAI_PATH || '/v1/chat/completions'));
        const body = JSON.stringify({
          model: mdl,
          messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
          temperature: 0.2
        });
        const extraHeaders = {};
        if (process.env.OPENAI_ORG) extraHeaders['OpenAI-Organization'] = process.env.OPENAI_ORG;
        if (process.env.OPENAI_PROJECT) extraHeaders['OpenAI-Project'] = process.env.OPENAI_PROJECT;
        const headers = Object.assign({
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }, extraHeaders);
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
            } catch (err) { reject(err); }
          });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      } catch (err2) { reject(err2); }
    });
  }
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
  // Removing an item from your pack into your hand is NOT a drop by itself (no inventory change)
  { id: 'drop-remove-torch', narrative: 'You remove a torch from your pack.', base: { 'torch': 1 }, expect: { 'torch': 1 } },

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
  ,
  // Usage — consumption and recovery (prompt-driven)
  { id: 'usage-fire-arrows-3', narrative: 'You loose three broadhead arrows at the charging boar.', base: { 'broadhead arrow': 10 }, expect: { 'broadhead arrow': 7 } },
  { id: 'usage-throw-knife-1', narrative: 'You throw a throwing knife at the target.', base: { 'throwing knife': 2 }, expect: { 'throwing knife': 1 } },
  { id: 'usage-drink-potion', narrative: 'You drink a healing potion.', base: { 'healing potion': 1 }, expect: { 'healing potion': 0 } },
  { id: 'usage-spend-gold-12', narrative: 'You pay twelve gold coins to the merchant.', base: { 'gold coin': 20 }, expect: { 'gold coin': 8 } },
  { id: 'usage-recover-arrow-1', narrative: 'You recover one broadhead arrow from the ground.', base: { 'broadhead arrow': 7 }, expect: { 'broadhead arrow': 8 } }
  ,
  { id: 'usage-burn-torch-1', narrative: 'You burn one torch to light your way.', base: { 'torch': 2 }, expect: { 'torch': 1 } },
  // Injury inline tagging — player-focused
  { id: 'injury-inline-bite', narrative: 'The wolf clamps down on your forearm; sharp teeth puncture skin and pain flares.', expectInjury: [/\[injury\]\s*wolf bite|\[injury\]\s*.*forearm/i] },
  { id: 'injury-inline-heal', narrative: 'You steady your breathing and bandage your forearm to stop the bleeding.', expectHeal: [/\[heal\]\s*bandage.*forearm/i] },
  { id: 'injury-inline-both', narrative: 'A stone drops from above, slamming into your ribs and knocking the wind from you. You quickly wrap your ribs with bandages to support your breath.', expectInjury: [/\[injury\]\s*.*ribs/i], expectHeal: [/\[heal\]\s*wrap.*ribs.*bandage/i] },
  // Additional injury/heal variations (sentence-level)
  { id: 'injury-inline-slash-forearm', narrative: 'The bandit lunges and the blade slices your forearm. Blood beads along the cut.', expectInjury: [/\[injury\]\s*.*forearm/i] },
  { id: 'injury-inline-burn-hand', narrative: 'Lantern oil splashes across your fingers and burns your hand. You recoil from the heat.', expectInjury: [/\[injury\]\s*(burn|burns).*hand/i] },
  { id: 'injury-inline-fracture-ankle', narrative: 'You land badly on a loose stone; your ankle gives with a sharp crack.', expectInjury: [/\[injury\]\s*.*ankle/i] },
  { id: 'injury-inline-sting-calf', narrative: 'A scorpion darts from a crevice and stings your calf. The limb tightens instinctively.', expectInjury: [/\[injury\]\s*.*calf/i] },
  { id: 'injury-inline-arrow-thigh', narrative: 'An arrow whistles through the air and slams into your thigh. You stumble under the impact.', expectInjury: [/\[injury\]\s*.*thigh/i] },
  { id: 'injury-inline-multi-two', narrative: 'A club smashes your shoulder. A jagged rock scrapes your knee as you fall.', expectInjury: [/\[injury\]/i] },
  { id: 'injury-inline-then-heal-cloth', narrative: 'You nick your palm on a rusted nail. You wrap a strip of cloth around the wound to stop the bleeding.', expectInjury: [/\[injury\]\s*.*palm|\[injury\]\s*.*wound/i], expectHeal: [/\[heal\].*(wrap|bandage|poultice)/i] },
  { id: 'heal-inline-poultice', narrative: 'You mash yarrow into a poultice and press it to your forearm to slow the bleeding.', expectHeal: [/\[heal\].*(poultice|press)/i] }
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

// Hard fail if any angle-bracket markup appears (e.g., <Thought>, <pickup>, HTML/XML)
function validateNoAngleMarkup(text){
  const has = /[<>]/.test(String(text || ''));
  return { ok: !has, reason: has ? 'Angle-bracket markup found in model output' : '' };
}

// Validate that every pickup item has a category [weapon]/[armor]/[clothing]/[item] and that drop blocks contain none
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
        if (!/\[(weapon|armor|clothing|item)\]\s*$/i.test(base)){
          ok = false; reason = `Missing category on pickup segment: "${seg}"`; break;
        }
      }
      if (!ok) break;
    } else if (b.type === 'drop'){
      if (/\[(weapon|armor|clothing|item)\]/i.test(b.content)){
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
    // Strip optional trailing category token like [item]/[weapon]/[armor]/[clothing]
    name = name.replace(/\s*\[(weapon|armor|clothing|item)\]\s*$/i, '').trim();
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
  const isDryRun = args.includes('--dry-run');
  // Sanitize API key to avoid invalid header characters from accidental quotes/newlines
  const rawKey = process.env.OPENAI_API_KEY || undefined;
  const apiKey = rawKey ? String(rawKey).replace(/[\r\n]+/g, '').replace(/^['"]|['"]$/g, '').trim() : undefined;
  const baseUrl = process.env.OPENAI_BASE_URL || undefined;
  const apiPath = process.env.OPENAI_PATH || undefined;
  const model = process.env.OPENAI_MODEL || undefined;

  if (isDryRun) {
    console.log('SKIP: prompt-harness (--dry-run)');
    process.exit(0);
  }

  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY is not set. This harness requires a live model.');
    console.error('Set it for this session and re-run, e.g.:');
    console.error('  $env:OPENAI_API_KEY = "sk-..." ; node .\\tests\\prompt-harness.js');
    process.exit(1);
  }

  reset();
  // Seed context to create core cards and ensure prompt is appended
  runContext('');
  console.log('System Prompt (GM + Tagging) loaded.');

  if (singleInput) {
    const system = getCombinedSystemPrompt();
    const modelOut = await callOpenAI({ system, user: singleInput, model, baseUrl, path: apiPath, apiKey });
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
    const modelOut = await callOpenAI({ system, user: c.narrative, model, baseUrl, path: apiPath, apiKey });
    // Capture exact inline injury/heal phrases from model output before ACS scrubs them
    function extractWrappedSegments(text){
      const segs = [];
      const scan = (type, open, close) => {
        let t = String(text || "");
        let mOpen;
        for(;;){
          mOpen = open.exec(t);
          if (!mOpen) break;
          const start = mOpen.index + mOpen[0].length;
          close.lastIndex = start;
          const mClose = close.exec(t);
          if (!mClose) break;
          const content = t.slice(start, mClose.index).replace(/[\r\n]+/g,' ').trim();
          if (content){
            // Preserve exact content as a single segment (no comma splitting)
            segs.push({ type, text: content });
          }
          // Move search forward after this close tag
          open.lastIndex = mClose.index + mClose[0].length;
          close.lastIndex = 0;
        }
        open.lastIndex = 0; close.lastIndex = 0;
      };
      scan('injury', /\{\\injury\}/g, /\{\\!injury\}/g);
      scan('heal',   /\{\\heal\}/g,   /\{\\!heal\}/g);
      return segs;
    }
    const wrappedSegs = extractWrappedSegments(modelOut);
    const { p, d } = countTags(modelOut);
    const visible = runOutput(modelOut);
    const invDesc = getInventoryDesc();

    const invMap = parseInventoryDescription(invDesc);
  const noAngle = validateNoAngleMarkup(modelOut);
  const cat = validateCategoryRules(modelOut);
  let ok = noAngle.ok; // start with markup validation
    if (c.expect) ok = ok && mapsEqualAsExpected(invMap, c.expect) && cat.ok;
    // Injury expectations: verify wrappers removed from visible, and that the EXACT wrapped phrases were logged verbatim
    const hasInjuryOrHeal = wrappedSegs.some(s => s.type === 'injury' || s.type === 'heal');
    if (c.id.startsWith('injury-inline') || hasInjuryOrHeal) {
      // Wrappers must be stripped from visible output
      if (/\\injury|\\!injury|\\heal|\\!heal/.test(visible)) ok = false;
      const injCard = (storyCards.find(sc => sc.title === 'Inventory') && storyCards.find(sc => sc.title === 'Player Injuries')) || storyCards.find(sc => sc.title === 'Player Injuries');
      const injDescNow = injCard ? (injCard.description || '') : '';
      // If model produced any wrapped segments, assert those exact phrases are logged
      for (const seg of wrappedSegs) {
        const needle = `- [${seg.type}] ${seg.text}`;
        if (!injDescNow.includes(needle)) { ok = false; }
      }
      // Backward-compatible fallback: if no wrapped segments were produced but legacy expectations exist, test them
      if (!wrappedSegs.length) {
        for (const re of (c.expectInjury || [])) { if (!re.test(injDescNow)) ok = false; }
        for (const re of (c.expectHeal || [])) { if (!re.test(injDescNow)) ok = false; }
      }
    }
    if (ok) passCount++; else failCount++;
    console.log(`\nCase: ${c.id} -> ${ok ? 'PASS' : 'FAIL'}`);
    console.log('Narrative: ', c.narrative);
    console.log('Model Output (trimmed): ', modelOut.replace(/\n/g,' ').slice(0, 200));
    console.log('Visible Output (trimmed): ', visible.replace(/\n/g,' ').slice(0, 160));
  }
  console.log(`\nSummary: PASS ${passCount} / ${runCases.length}, FAIL ${failCount}`);
}

main().catch(err => { console.error(err); process.exit(1); });

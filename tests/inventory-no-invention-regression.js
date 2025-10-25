/*
Inventory No-Invention Regression Harness
- Seeds a narrative that merely mentions a non-inventory item (no pickup intent)
- Asserts the model does NOT add the item to Inventory unless it explicitly tags a pickup
- Pass condition: (lantern NOT in Inventory AND no pickup tag for lantern) OR (lantern IN Inventory AND pickup tag present)

Usage (Windows PowerShell):
  $env:OPENAI_API_KEY = "sk-..." ; node .\\tests\\inventory-no-invention-regression.js
*/

/* eslint-disable no-console */

const path = require('path');
// Load environment variables from .env.local/.env for this process (best-effort, avoid static require to prevent casing conflicts)
try { require(path.join(__dirname, 'load-env.js')); } catch (_) { /* proceed without local env */ }

const fs = require('fs');

// Minimal AID globals and AutoCards API mock (shared with other harnesses)
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
};

global.AutoCards = () => ({ API });

// Load ACS function from src/library.js
const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
const code = fs.readFileSync(libPath, 'utf8');
const m = code.match(/\/\/----------------------ADVENTURE COMBAT SYSTEM--------------------------------[\s\S]*?function ACS\([\s\S]*?\n\}/);
if (!m) throw new Error('ACS function not found');
const acsFuncSrc = m[0].replace(/^.*?function ACS/m, 'function ACS');
const ACS = new Function('AutoCards', 'storyCards', 'state', 'info', `${acsFuncSrc}; return ACS;`)(global.AutoCards, storyCards, state, info);

function runContext(text=''){ const [t] = ACS('context', text, false); return t; }
function runOutput(text=''){ const [t] = ACS('output', text, false); return t; }
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

function callOpenAI_https({ system, user, model, baseUrl, path: apiPath, apiKey, extraHeaders }){
  return new Promise((resolve, reject) => {
    try {
      const https = require('https');
      const url = new URL((baseUrl || 'https://api.openai.com').replace(/\/$/, '') + (apiPath || '/v1/chat/completions'));
      const body = JSON.stringify({
        model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
        temperature: 0.2
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

async function main(){
  // Sanitize API key to avoid invalid header characters from accidental quotes/newlines
  const rawKey = process.env.OPENAI_API_KEY || undefined;
  const apiKey = rawKey ? String(rawKey).replace(/[\r\n]+/g, '').replace(/^['"]|['"]$/g, '').trim() : undefined;
  const baseUrl = process.env.OPENAI_BASE_URL || undefined;
  const apiPath = process.env.OPENAI_PATH || undefined;
  const model = process.env.OPENAI_MODEL || undefined;

  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY is not set. This harness requires a live model.');
    console.error('Set it for this session and re-run, e.g.:');
    console.error('  $env:OPENAI_API_KEY = "sk-..." ; node .\\tests\\inventory-no-invention-regression.js');
    process.exit(1);
  }

  reset();
  // Seed context to create core cards and ensure prompt is appended
  runContext('');
  // Ensure inventory exists and is clean
  const inv = storyCards.find(sc => sc.title === 'Inventory');
  if (inv) inv.description = 'Auto-Cards will contextualize these memories:\n{updates: false, limit: 2750}\n- rope[item] x1';

  const system = getCombinedSystemPrompt();
  const narrative = 'You notice a lantern hanging on the wall, its light flickering gently. You make no move to take it.';
  const modelOut = await callOpenAI_https({ system, user: narrative, model, baseUrl, path: apiPath, apiKey });
  const visible = runOutput(modelOut);

  const invDesc = getInventoryDesc();
  const invMap = parseInventoryDescription(invDesc);
  const hasLantern = invMap.has('lantern');
  // Check if model explicitly tagged a pickup for lantern
  const pickupTagged = /\{\\pickup\}[\s\S]*lantern/i.test(modelOut);

  // Pass if and only if inventory inclusion matches presence of pickup tag
  const ok = (hasLantern === pickupTagged);

  console.log(ok ? 'PASS: no-invention-regression' : 'FAIL: no-invention-regression');
  console.log('Narrative:', narrative);
  console.log('Model Output (trimmed):', modelOut.replace(/\n/g,' ').slice(0, 220));
  console.log('Visible Output (trimmed):', visible.replace(/\n/g,' ').slice(0, 160));
  console.log('Inventory Now:\n', invDesc.split(/\n/).slice(0,8).join('\n'));

  if (!ok) process.exit(1);
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

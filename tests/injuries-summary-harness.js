/*
Injuries summary harness (model-in-the-loop, /inj command)
- Uses OPENAI_API_KEY to call a live model and summarize Player Injuries memories
- Leverages the Auto-Cards DEFAULT_CARD_MEMORY_COMPRESSION_PROMPT from src/library.js
- Exercises ACS("input", "/inj") to verify manual summarization trigger via Auto-Cards compression scheduling (no redo)

Run:
  $env:OPENAI_API_KEY = "sk-..." ; node .\tests\injuries-summary-harness.js
*/

// Load environment variables from .env.local/.env for this process (avoid static require to prevent casing conflicts on Windows)
try { require(require('path').join(__dirname, 'load-env.js')); } catch (_) { /* proceed without local env */ }

const fs = require('fs');
const path = require('path');

// Minimal AID globals and AutoCards test API stub
global.storyCards = [];
global.state = {};
global.info = {};
global.text = "";
global.stop = false;
global.history = [{ text: "", type: "start" }];
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

// Load ACS and expose function
const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
require(libPath);
const ACS = global._ACS_forTest;
if (typeof ACS !== 'function') { console.error('ACS function not found'); process.exit(1); }

// Load compression prompt from library.js (Auto-Cards config)
function loadCompressionPrompt() {
  const libPath = path.resolve(__dirname, '..', 'src', 'library.js');
  const src = fs.readFileSync(libPath, 'utf8');
  const marker = 'DEFAULT_CARD_MEMORY_COMPRESSION_PROMPT';
  const idx = src.indexOf(marker);
  if (idx === -1) throw new Error('DEFAULT_CARD_MEMORY_COMPRESSION_PROMPT not found');
  // Find first '[' after the marker
  let i = src.indexOf('[', idx);
  if (i === -1) throw new Error('Prompt array start not found');
  // Bracket-balanced parse to find the matching closing ']'
  let depth = 0;
  let inStr = false;
  let strCh = '';
  let esc = false;
  let j = i;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === strCh) { inStr = false; strCh = ''; }
      continue;
    }
    if (ch === '"' || ch === '\'') { inStr = true; strCh = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { j++; break; } }
  }
  if (depth !== 0) throw new Error('Unbalanced brackets while parsing prompt array');
  const arrSrc = src.slice(i, j);
  // eslint-disable-next-line no-new-func
  const promptArr = new Function('return ' + arrSrc)();
  if (!Array.isArray(promptArr)) throw new Error('Prompt parse failed');
  return promptArr;
}

function buildPromptFor(title, paragraph) {
  const tpl = loadCompressionPrompt();
  const filled = tpl.map(line => line
    .replace(/%\{title\}/g, title)
    .replace(/%\{category\}/g, 'class')
  );
  // Build the full prompt body: lines joined by newlines + paragraph
  let full = filled.join('\n');
  if (full.includes('%{memory}')) {
    full = full.replace('%{memory}', paragraph);
    return full;
  }
  // Fallback: append after the instructions
  return full + '\n' + paragraph + '\n';
}

function ensureCoreCards(){
  // Trigger ACS context once to create reserved cards via ensureCoreCards
  ACS('context', '', false);
}

function getInjuriesCard(){
  const idx = AutoCardsTestAPI._cards.findIndex(c => c.title === 'Player Injuries');
  if (idx === -1) return null;
  return AutoCardsTestAPI._cards[idx];
}

function seedInjuryMemories(){
  ensureCoreCards();
  const card = getInjuriesCard();
  if (!card) throw new Error('Player Injuries card missing');
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

function extractMemoryBodyFromCard(){
  const card = getInjuriesCard();
  if (!card) throw new Error('Player Injuries card missing');
  const lines = String(card.description || '').split(/\r?\n/).slice(2);
  return lines.filter(l => l.trim().startsWith('- ')).join('\n');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { dryRun: false };
  for (const a of args) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--key=')) out.key = a.slice('--key='.length);
    else if (a.startsWith('--model=')) out.model = a.slice('--model='.length);
  }
  return out;
}

async function run() {
  const argv = parseArgs();
  const rawKey = argv.key || process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY;
  const apiKey = (rawKey ? String(rawKey).trim() : '');
  const model = argv.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!apiKey && !argv.dryRun) {
    console.error('OPENAI_API_KEY not set. Provide one of:');
    console.error('  - Set env var:   $env:OPENAI_API_KEY = "sk-..."');
    console.error('  - CLI flag:      node tests/injuries-summary-harness.js --key=sk-...');
    console.error('  - .env file:     OPENAI_API_KEY=sk-...');
    console.error('Or run with --dry-run to preview without a live call.');
    process.exit(2);
  }

  // Prefer official OpenAI SDK v4 if available; otherwise, simple fetch
  let client;
  try {
    const OpenAI = require('openai');
    client = new OpenAI({ apiKey });
  } catch (e) {
    console.error('OpenAI SDK not installed. Please install with: npm i openai');
    process.exit(3);
  }

  // Seed injuries and invoke /inj to schedule Auto-Cards compression
  seedInjuryMemories();
  const out = ACS('input', '/inj', false);
  if (typeof out !== 'string' || !/summarizing\s+injuries[\s\S]*please select\s+"continue"/i.test(out)) {
    console.error('Expected continue-style summarization prompt from /inj');
    process.exit(10);
  }

  const title = 'Player Injuries';
  const paragraph = extractMemoryBodyFromCard();
  const system = 'You are summarizing a story card memory bank for Auto-Cards. Focus, compress, and retain concrete facts. Use plain prose.';
  const user = buildPromptFor(title, paragraph);

  console.log('--- Prompt (truncated preview) ---');
  console.log((user.length > 1200 ? user.slice(0, 1200) + '\n...[truncated]...' : user));
  console.log('----------------------------------');

  // Call a compact, low-temp model
  if (argv.dryRun) {
    console.log('(dry-run) Skipping OpenAI call. Use --key=sk-... to execute.');
    process.exit(0);
  }

  let result;
  try {
    result = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
    });
  } catch (e) {
    console.error('OpenAI SDK request failed, attempting HTTPS fallback:', e?.response?.data || e.message || e);
    // HTTPS fallback (use same API key; allow base URL override)
    try {
      const https = require('https');
      const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
      const apiPath = process.env.OPENAI_PATH || '/v1/chat/completions';
      const url = new URL(baseUrl.replace(/\/$/, '') + apiPath);
      const body = JSON.stringify({ model, messages: [ { role: 'system', content: system }, { role: 'user', content: user } ], temperature: 0.2 });
      const extraHeaders = {};
      if (process.env.OPENAI_ORG) extraHeaders['OpenAI-Organization'] = process.env.OPENAI_ORG;
      if (process.env.OPENAI_PROJECT) extraHeaders['OpenAI-Project'] = process.env.OPENAI_PROJECT;
      const headers = Object.assign({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, extraHeaders);
      result = await new Promise((resolve, reject) => {
        const req = https.request({ method: 'POST', hostname: url.hostname, path: url.pathname + (url.search || ''), headers }, res => {
          let data = '';
          res.on('data', d => { data += d; });
          res.on('end', () => {
            try {
              if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`OpenAI HTTP ${res.statusCode}: ${data.slice(0,200)}`));
              const j = JSON.parse(data);
              resolve(j);
            } catch (err) { reject(err); }
          });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });
    } catch (e2) {
      console.error('OpenAI HTTPS fallback failed:', e2?.response?.data || e2.message || e2);
      process.exit(4);
    }
  }

  const text = result?.choices?.[0]?.message?.content || result?.choices?.[0]?.text || '';
  if (!text) {
    console.error('No summary returned');
    process.exit(5);
  }

  console.log('\n--- Model Summary ---');
  console.log(text.trim());
  console.log('---------------------');

  // Simple sanity checks: ensure key details retained and format remains concise
  const ok = /forearm/i.test(text) && /ribs/i.test(text) && /palm/i.test(text);
  if (!ok) {
    console.error('Summary may be missing expected injury details (forearm, ribs, palm).');
    process.exit(6);
  }
  console.log('PASS: Injuries summary includes expected details.');
}

run();

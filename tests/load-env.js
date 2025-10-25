// Lightweight .env loader for local testing (no dependency on dotenv)
// Priority: .env.local > .env; does not overwrite already-set process.env keys

const fs = require('fs');
const path = require('path');

function loadEnvFile(p) {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const s = line.trim();
      if (!s || s.startsWith('#')) return;
      const idx = s.indexOf('=');
      if (idx === -1) return;
      // Strip surrounding quotes
      let k = s.slice(0, idx).trim().replace(/^["']|["']$/g, '');
      let v = s.slice(idx + 1).trim().replace(/^["']|["']$/g, '').replace(/[\r\n]+/g, '').trim();
      if (!k || !v) return;
      const existing = process.env[k];
      if (existing == null) {
        process.env[k] = v;
      } else if (
        k === 'OPENAI_API_KEY' &&
        typeof existing === 'string' && !existing.startsWith('sk-proj-') &&
        typeof v === 'string' && v.startsWith('sk-proj-')
      ) {
        // Prefer project-scoped key when available
        process.env[k] = v;
      }
    });
  } catch (_) {
    /* ignore missing */
  }
}

const root = path.resolve(__dirname, '..');
loadEnvFile(path.join(root, '.env.local'));
loadEnvFile(path.join(root, '.env'));

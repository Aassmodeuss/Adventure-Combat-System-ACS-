# ACS Inventory Sandbox Tests

Local-only tests to validate ACS inventory tagging behavior without AI Dungeon.

What it covers:
- Standing context prompt presence
- Pickup/drop tags parsing
- Case-insensitive merging and basic plural normalization
- Multi-item tags per turn
- Tag stripping from visible output
- Usage/consumption cases (ammo, thrown, consumables, coins, recovery, crafting/trading)

How to run (Windows PowerShell):

```powershell
# From repo root
node .\tests\acs-inventory-sandbox.js
node .\tests\usage-guidance-sandbox.js
```

Prompt effectiveness harness:

```powershell
# Simulated (local heuristic, no network calls)
node .\tests\prompt-harness.js --sim=local

# Optional: call OpenAI (requires env var; will make network calls)
$env:OPENAI_API_KEY = "sk-..."; node .\tests\prompt-harness.js --sim=openai --model gpt-4o-mini

# Filter to a single case
node .\tests\prompt-harness.js --sim=local --case=pickup-multi

# Target a custom OpenAI-compatible endpoint (e.g., GPT-5)
# Flags:
#   --baseUrl=https://your.api.host
#   --path=/v1/chat/completions (or your provider's path)
#   --model=gpt-5 (or your provider's model name)
#   --apiKeyEnv=YOUR_KEY_ENV (defaults to OPENAI_API_KEY)
#   --headers='{"X-Custom":"value"}' (optional extra headers JSON)
$env:OPENAI_API_KEY = "your_api_key"
node .\tests\prompt-harness.js --sim=openai --model=gpt-5 --baseUrl=https://api.openai.com --path=/v1/chat/completions
```

Troubleshooting:
- Requires Node.js (v16+ recommended). If not installed, download from https://nodejs.org/
- If the script cannot find ACS in `src/library.js`, ensure the ACS section marker and function remain intact.

## Test authoring checklist

- If you are testing prompt behavior or model compliance, use `tests/prompt-harness.js` (model-in-the-loop). Do not hand-write the expected tags in the test; let the model produce them under the real standing prompt.
- Use pre-tagged deterministic tests only for parser/plumbing checks (e.g., tag extraction, normalization/merging, inventory delta application, suppression gating). Keep those in sandbox-style files like `acs-inventory-sandbox.js` or similar.
- For `/inv` behavior and card generation, prefer `inv-generate-harness.js` and `inv-harness.js`; they validate queued Auto-Cards parameters and suppression without involving the model.
- Add at least one happy-path and one edge-case. Keep fixtures minimal and independent (reset state between cases).
- When you change prompt text or ACS rules, run both parser sandbox tests and the model-driven prompt harness to catch regressions.

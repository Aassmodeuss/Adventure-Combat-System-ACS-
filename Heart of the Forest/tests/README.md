# ACS Inventory Sandbox Tests

Local-only tests to validate ACS inventory tagging behavior without AI Dungeon.

What it covers:
- Standing context prompt presence
- Pickup/drop tags parsing
- Case-insensitive merging and basic plural normalization
- Multi-item tags per turn
- Tag stripping from visible output

How to run (Windows PowerShell):

```powershell
# From repo root
node .\Tests\acs-inventory-sandbox.js
```

Prompt effectiveness harness:

```powershell
# Simulated (local heuristic, no network calls)
node .\Tests\prompt-harness.js --sim=local

# Optional: call OpenAI (requires env var; will make network calls)
$env:OPENAI_API_KEY = "sk-..."; node .\Tests\prompt-harness.js --sim=openai --model gpt-4o-mini

# Filter to a single case
node .\Tests\prompt-harness.js --sim=local --case=pickup-multi

# Target a custom OpenAI-compatible endpoint (e.g., GPT-5)
# Flags:
#   --baseUrl=https://your.api.host
#   --path=/v1/chat/completions (or your provider's path)
#   --model=gpt-5 (or your provider's model name)
#   --apiKeyEnv=YOUR_KEY_ENV (defaults to OPENAI_API_KEY)
#   --headers='{"X-Custom":"value"}' (optional extra headers JSON)
$env:OPENAI_API_KEY = "your_api_key"
node .\Tests\prompt-harness.js --sim=openai --model=gpt-5 --baseUrl=https://api.openai.com --path=/v1/chat/completions
```

Troubleshooting:
- Requires Node.js (v16+ recommended). If not installed, download from https://nodejs.org/
- If the script cannot find ACS in `src/library.js`, ensure the ACS section marker and function remain intact.

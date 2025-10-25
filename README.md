# Heart of the Forest — ACS Prompt Rules and Testing

This scenario runs in AI Dungeon’s sandbox and includes Auto-Cards plus the Adventure Combat System (ACS). This README documents the tightened ACS standing prompts and how to validate them locally or in-game.

Last updated: 2025-10-23

## What changed

Prompt guidance only. No public card formats changed. Key improvements:

- Inventory tagging
  - MUST pickup on: pick up, take, grab, collect, loot, scoop.
  - MUST drop on: drop, discard, leave, place, set, put, lay.
  - Usage MUST drop: shoot/fire/loose/launch/hurl/throw; drink/quaff/swallow/eat/devour/consume; burn; pay/spend; use charges.
    - Potions: always drop the exact potion name x1 when drunk.
  - Readiness/removal (non-drop): ready/draw/equip/remove/take (out)/pull out/retrieve/produce/fish out/unholster/unsheathe are untagged unless you also deposit or use the item. Moving an item between hand and your own gear (pack/backpack/satchel/bag/quiver/sheath/holster) is not pickup/drop.
  - Quantifiers: vague drop quantifiers (e.g., “a handful”) default to x1; vague pickup quantifiers may choose 1–9 (coins 3–7).
  - Block rules and formatting:
    - Append tags only at the very end, after 1–3 sentences of normal prose.
    - Pickup format: {\\pickup} item[weapon|armor|clothing|item] xN, ...{\\!pickup}
    - Drop format: {\\!drop} item xN, ...{\\drop}
    - Names are singular, lowercase; include material words (e.g., brass compass). Drop blocks contain no categories.
  - Recovery: retrieving ammo or thrown weapons → pickup (category [item]). Broken/destroyed stay dropped.
  - Craft/trade: drop consumed inputs/coins; pickup the result.
  - Self-checks:
    - Ensure at least one prose sentence and no angle-bracket markup in visible output.
    - If any MUST pickup verb appears and no {\\pickup} was emitted, append it now (with categories and counts).
    - If any MUST drop or usage verb appears and no {\\!drop} was emitted, append it now (default x1 when unspecified).
    - If a potion was consumed and no drop exists, append {\\!drop} <potion name> x1{\\drop}.

- Injury tagging (player; inline)
  - Wrap the exact sentence(s) that cause injury or apply healing:
    - {\\injury}...{\\!injury}, {\\heal}...{\\!heal}
  - Prefer 1–2 contiguous sentences per event (cause + immediate effect/outcome). Order injuries before heals.
  - Semicolon clauses can be wrapped as a single event.
  - Self-check cues include: bite, clamp, puncture, teeth, stab, slash, cut, slice, smash, scrape, sting, break, fracture, burn, bleed, pain, heal, bandage, poultice, potion.

- Context label
  - The inventory context snippet label was reworded for clarity; this does not affect stored card formats.

## Examples (concise)

- Pickup multiple: {\\pickup} iron sword[weapon] x1, leather armor[armor] x1, rope[item] x1{\\!pickup}
- Coins: {\\pickup} gold coin[item] x5, silver coin[item] x2{\\!pickup}
- Drop ammo: {\\!drop} arrow x3{\\drop}
- Drink: “You drink a healing potion.” → {\\!drop} healing potion x1{\\drop}
- Not a drop: “You remove a torch from your pack.” → (no tags)
- Vague drop: “You drop a handful of berries.” → {\\!drop} berry x1{\\drop}
- Mixed: {\\pickup} apple[item] x2{\\!pickup}{\\!drop} apple x1{\\drop}
- Usage-only: “You throw a throwing knife.” → {\\!drop} throwing knife x1{\\drop}
- Injury inline: {\\injury}The wolf clamps down on your forearm. Sharp teeth puncture skin and pain flares.{\\!injury}
- Heal inline: {\\heal}You bandage your forearm. The bleeding slows and your grip steadies.{\\!heal}

## How to validate locally

The repository includes harnesses for both parser plumbing and model-in-the-loop prompt compliance.

- Full suite (requires an OpenAI API key for the prompt harness):

```powershell
$env:OPENAI_API_KEY = "sk-..."
npm test
```

- Run just the prompt harness (optional):

```powershell
$env:OPENAI_API_KEY = "sk-..."; node .\tests\prompt-harness.js
```

All tests should pass (44/44) with the tightened prompts.

## How to test in AI Dungeon

- Ensure the scenario loads with `src/input.js`, `src/context.js`, and `src/output.js` wired (Auto-Cards precedes ACS in each hook).
- The standing prompt is appended in the context hook; just play normally:
  - Try inputs such as:
    - “You pick up a torch.” → expect a pickup block at the end.
    - “You drop a handful of berries.” → expect a drop of berry x1.
    - “You drink a healing potion.” → expect a drop of healing potion x1.
    - “The wolf clamps down on your forearm; sharp teeth puncture skin and pain flares.” → expect an inline injury wrapper.
- Use `/inv` to generate item story cards from your Inventory card entries (Auto-Cards builds items with appropriate descriptions and limits).

## Settings and toggles

- Scenario-wide defaults are controlled near the top of `src/library.js` via `MainSettings.AutoCards` and `MainSettings.LocalizedLanguages`.
- LSIv2 can be enabled in-game; the ACS API is available within those cards if you need to experiment.

## Migration notes

- No public story card format or ACS API changed.
- Drop blocks continue to exclude categories; pickup blocks still require a category.
- The inventory context label wording changed for readability only.
# Heart of the Forest — Auto-Cards + ACS

This scenario script integrates Auto-Cards with an Adventure Combat System (ACS). It manages inventory, core player cards, and hook-based helpers to keep gameplay consistent and low-friction inside AI Dungeon.

## Inventory is always visible to the model

To keep the model aware of what the player is carrying, ACS now injects a compact inventory snapshot into the context every turn.

- Runs in: context hook (before generation)
- Source of truth: the `Inventory` story card description (lines like `- item xN`)
- Format: a short `<SYSTEM>` block listing items and quantities
- Limits: capped to 50 items and ~1200 characters to protect context budget
- Empty inventory: shows as `- (empty)`
- Auto-Cards protection: the Inventory card’s memory header is fixed to `{updates: false, limit: ...}` so Auto-Cards won’t rewrite it

Example injected block (not shown to the player, only used as system guidance):

```
<SYSTEM>
Current Inventory (reference only; do not narrate this list unless it is relevant to the scene):
- torch x1
- iron ingots x2
- rope x1
</SYSTEM>
```

Note on /inv generations:
- While `/inv` is actively generating item cards, ACS temporarily suppresses the Inventory Tagging standing prompt and the compact inventory snapshot to avoid contaminating object card generations. Suppression lifts automatically once all queued item cards exist (with a safety timeout of ~20 turns).


This pairs with the Inventory Tagging Rule: the model appends `{"\pickup"} ... {"\!pickup"}` and/or `{"\!drop"} ... `{"\drop"}` tags at the very end of outputs, which ACS parses to update the `Inventory` card. For pickups, each item must include exactly one category tag appended to the item name: `[weapon]`, `[armor]`, `[clothing]`, or `[item]` (coins are `[item]`). Categories are now also stored in the Inventory list lines as `- name[category] xN` and are included in the context snapshot.

Expanded usage/consumption semantics:
- Usage reduces quantity → treat as drop: firing arrows/bolts/bullets, throwing knives/axes, drinking potions, eating food, burning torches, using charges, spending coins ⇒ `{"\!drop"} item xN{"\drop"}`.
- Counts: if narration states a number, use it exactly; otherwise default to `x1`.
- Recoveries: later retrieval of ammo/thrown weapons ⇒ `{"\pickup"} arrow[item] xN{"\!pickup"}`; destroyed/irretrievable items remain dropped.
- Crafting/trading: drop consumed inputs and paid coins; pickup the crafted/traded result.

Quick examples:
- Shooting: `{"\!drop"} arrow x3{"\drop"}` (“you loose three arrows”)
- Spend: `{"\!drop"} gold coin x12{"\drop"}`
- Recover: `{"\pickup"} arrow[item] x1{"\!pickup"}`
- Craft: `{"\!drop"} iron ingot x2, leather strip x1{"\drop"}{"\pickup"} iron dagger[item] x1{"\!pickup"}`


### Migration note

- Older saves may have inventory lines without categories (e.g., `- torch x1`). The parser remains backward-compatible and will adopt a category the next time the item is picked up with a category present. You can also manually add `[item]`/`[weapon]`/`[armor]` in existing lines; ACS will preserve it.
2. Ensure the following story cards exist (created automatically if missing): `Inventory`, `Player Stats`, `Player Injuries`, `Equipped Weapon`, `Equipped Armor`.
3. Pick up or drop items naturally in narration (e.g., “You pick up a torch.”). The output will include invisible wrapper tags that update the `Inventory` card; the visible text won’t show the tags.
4. On subsequent turns, the model will have a system-level view of your current inventory in context.

Tips:
- If you enable debug/console cards in settings, you can observe ACS behavior turn by turn.
- The `Inventory` card list is the authoritative state; you can edit it manually for setup, and ACS will carry it forward.

## Local tests (optional)

There’s a deterministic harness under `tests/` that verifies inventory pickup/drop behavior using assistant-provided outputs.

- Files:
	- `tests/prompt-harness.js`, `tests/assistant-responses.json` — parsing, normalization (case/plurals/irregulars), multi-item tags, inventory updates
	- `tests/acs-inventory-sandbox.js` — context standing prompt presence and end-to-end tag parsing into the `Inventory` card
	- `tests/inv-generate-harness.js` — `/inv` queues item card generations with the stock Auto-Cards prompt plus appended object guidance
	- `tests/inv-harness.js` — `/inv` end-to-end harness for queuing, skip rules, and defaults when categories are missing
	- `tests/inv-suppression-reactivate-harness.js` — verifies inventory prompt/snapshot suppression during generation and automatic reactivation after all queued cards exist

Run the harness from the repo root:

```powershell
node ".\tests\prompt-harness.js" --assistantFile=".\tests\assistant-responses.json"
```

Expected result (live prompt harness): `Summary: PASS 27 / 27, FAIL 0`.

Run the other harnesses individually (optional):

```powershell
node ".\tests\acs-inventory-sandbox.js"
node ".\tests\inv-generate-harness.js"
node ".\tests\inv-harness.js"
node ".\tests\inv-suppression-reactivate-harness.js"
node ".\tests\usage-guidance-sandbox.js"
```

## Notes and limits

- The injected inventory block is concise by design. If you have a very large inventory, only the leading items within the character budget are shown.
- Do not remove the `{updates: false, limit: ...}` header from the `Inventory` card; ACS relies on it to prevent Auto-Cards from rewriting your tracked list.
- If future features need more context (e.g., equipped weapon breakdown), we’ll inject similarly compact, clearly labeled blocks.

## Injury tagging and logging

ACS guides the model to wrap injury and healing phrases inline within the narrative. These wrappers are invisible to the player and are removed before display, but ACS extracts them and appends concise lines to the `Player Injuries` card.

- Runs in: context (standing prompt injection) and output (extraction and logging)
- Inline format (no spaces inside braces): `{\injury}description{\!injury}` and `{\heal}description{\!heal}`
- Scope: Only tag when the PLAYER is injured or healed; ignore NPC-only events unless the NPC injures the player.
- Style: Short, concrete phrases with what happened and where (optionally severity). Multiple phrases are allowed when the scene causes multiple effects.
- Logging: Extracted events are added as Auto-Cards-style memories to `Player Injuries` with `updates: true`, capped to a rolling window to avoid bloat.
- Suppression: While `/inv` item cards are actively being generated, ACS also suppresses the injury standing prompt (alongside the inventory prompt and snapshot) to avoid contaminating generations.

Important: `Player Injuries` is a historical log. Do not re-narrate or echo its lines in scene prose.

- The context standing prompt now explicitly instructs the model that `Player Injuries` contains past events. The model should not copy or restate those lines; only new injuries/heals from the current turn should be described (and wrapped with tags).
- If a prior injury matters to the current scene, it can be referenced briefly in fresh prose (e.g., “your bandaged forearm aches”) without copying the log line verbatim.

Examples (inline, player-focused):
- Bite: “The wolf lunges and `{\injury}wolf bite to forearm (moderate){\!injury}`.”
- Blunt: “A falling stone `{\injury}blunt hit to ribs{\!injury}`.”
- Burn: “The torch sputters and `{\injury}burn to fingertips (minor){\!injury}`.”
- Heal: “You steady yourself and `{\heal}bandage applied to forearm{\!heal}`.”
- Both: “You slip and `{\injury}hard fall onto left knee (moderate){\!injury}`, then `{\heal}healing poultice applied to knee{\!heal}`.”

### Manual summarization (/inj)

Use `/inj` to manually trigger a summary pass on the `Player Injuries` card. This schedules an Auto-Cards regeneration (redo) of the card entry using existing injury memories under the default Auto-Cards compression prompt.

- Runs in: input hook
- Effect: queues a regeneration for `Player Injuries`; returns an Auto-Cards-style "please select continue" prompt while it processes
- Notes: If pending generations are backlogged, it may take a few continues for the summary to complete. The injuries memory header remains `{updates: true, limit: 500}`.

## Testing philosophy

- Prompt behavior and model compliance: use `Tests/prompt-harness.js` (model-in-the-loop). This composes the real system prompt and validates actual model outputs rather than hand-authored tags.
- Parser/plumbing checks: use deterministic, pre-tagged sandbox tests (e.g., `Tests/acs-inventory-sandbox.js`, `Tests/usage-guidance-sandbox.js`) to verify extraction, normalization, and inventory delta application.
- `/inv` generation and suppression: use `Tests/inv-generate-harness.js` and `Tests/inv-harness.js` to validate queued Auto-Cards requests, duplicate skipping, and suppression/reactivation lifecycle.

## /inv item cards generation (Auto-Cards style)

The `/inv` command scans your `Inventory` card and queues story card generation for each carried object using the stock Auto-Cards entry prompt, plus a small, appended guidance block tailored for objects. This keeps tone and structure identical to Auto-Cards while focusing content on the item itself.

- Base prompt: Auto-Cards’ default generation prompt (unchanged)
- Appended guidance (summary):
	- Describe only intrinsic properties (purpose, mechanism, materials, craftsmanship, condition, markings)
	- Avoid story or scene content; write a single compact paragraph (~400 characters)
	- If weapon: include classification (e.g., longsword), form factor, construction, handling/balance, edge/point condition, fittings/marks
	- If armor: include coverage/components (e.g., cuirass), materials/construction, fastening/fit, weight class, protection, condition/markings

Examples (single-sentence, object-only):
- Weapon: “Iron Sword is a straight, double-edged longsword of simple iron with a leather-wrapped grip and plain crossguard; its edge is serviceably sharp and evenly tempered, showing faint hammer marks and a modest maker’s stamp near the ricasso.”
- Armor: “Leather Armor is a hardened cuirass with shoulder caps and laced sides, stitched from boiled leather plates over linen backing; it rides light, distributes force modestly, and bears scuffed dye and a small guild stamp at the hem.”
- Item: “Rope is a 15-meter twisted hemp line with tight three-strand lay, tarred against weathering; it holds knots cleanly, resists fray along whipped ends, and carries faint resin odor from recent sealing.”
- Clothing: “Wool Cloak is a muted green travel cloak of tightly woven wool, cut generous for drape with a leather-bound edge and a small brass clasp at the throat; the fabric shows light pilling and a few hand-stitched patches near the hem.”

Operational notes:
- Cards are generated one per item (skip if qty is zero, reserved title, or an existing card already matches).
- Titles are title-cased from inventory lines; card type is mapped from category `[weapon|armor|clothing|item]` (defaults to `item`).
- Each card uses `entryLimit: 400` and memory updates are disabled by default (`memoryUpdates: false`).

## What’s new in this iteration

- Clothing category added: Pickups must include exactly one of `[weapon]`, `[armor]`, `[clothing]`, or `[item]`. Clothing is distinct from armor and is listed and handled consistently in prompts and inventory parsing.
- `/inv` defaults to no memory updates: Cards generated from the `/inv` command are created with `memoryUpdates: false` by default to avoid unwanted Auto-Cards memory churn.
- Manual injuries summarization with `/inj`: Run `/inj` to queue a summary/regeneration pass on the `Player Injuries` card using Auto-Cards’ compression. Injuries remain a historical log and shouldn’t be re-narrated in scene prose.
- Output scrubbing tightened: Standing prompts enforce ABSOLUTE NO-MARKUP; ACS removes leaked system blocks and wrapper fragments; a guardrail prevents false drops on “remove/draw/ready/equip” phrases.
- Env handling stabilized: Live harnesses load from `.env.local` with optional org/project headers and HTTPS fallback.

## Environment setup for live harnesses

Live, model-in-the-loop harnesses read credentials from environment variables. The repo includes a lightweight loader that prefers `.env.local` (not committed) over `.env`.

- Required:
	- `OPENAI_API_KEY` — your API key (the loader trims stray quotes/newlines)
- Optional:
	- `OPENAI_ORG_ID` — organization header (sent if present)
	- `OPENAI_PROJECT_ID` — project header (sent if present)
	- `OPENAI_BASE_URL` — override base URL (defaults to https://api.openai.com)
	- `OPENAI_PATH` — override path (defaults to /v1/chat/completions)
	- `OPENAI_MODEL` — model name (defaults to gpt-4o-mini)

Windows PowerShell examples:

```powershell
# One-off session variables
$env:OPENAI_API_KEY = "sk-..."
$env:OPENAI_MODEL = "gpt-4o-mini"

# Run a live harness
node .\tests\prompt-harness.js --sim=openai --case=pickup-basic

# Or run the no-invention regression harness
node .\tests\inventory-no-invention-regression.js
```

To persist credentials locally, create a `.env.local` file in the repo root:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
# Optional extras
OPENAI_ORG_ID=org_...
OPENAI_PROJECT_ID=proj_...
```

Note: `.env.local` is preferred if both `.env.local` and `.env` exist.

## Path casing note (Windows vs. CI)

Windows filesystems are case-insensitive, so `Tests/` resolves to the same folder as `tests/`. To avoid confusion and CI issues on case-sensitive systems (e.g., Linux), this repo standardizes on `tests/` in all commands, paths, and docs. If older docs or comments show `Tests/`, substitute `tests/`.


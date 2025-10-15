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


This pairs with the Inventory Tagging Rule: the model appends `{"\pickup"} ... {"\!pickup"}` and/or `{"\!drop"} ... `{"\drop"}` tags at the very end of outputs, which ACS parses to update the `Inventory` card. For pickups, each item must include exactly one category tag appended to the item name: `[weapon]`, `[armor]`, or `[item]` (coins are `[item]`). Categories are now also stored in the Inventory list lines as `- name[category] xN` and are included in the context snapshot.

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

There’s a deterministic harness under `Tests/` that verifies inventory pickup/drop behavior using assistant-provided outputs.

- Files:
	- `Tests/prompt-harness.js`, `Tests/assistant-responses.json` — parsing, normalization (case/plurals/irregulars), multi-item tags, inventory updates
	- `Tests/acs-inventory-sandbox.js` — context standing prompt presence and end-to-end tag parsing into the `Inventory` card
	- `Tests/inv-generate-harness.js` — `/inv` queues item card generations with the stock Auto-Cards prompt plus appended object guidance
	- `Tests/inv-harness.js` — `/inv` end-to-end harness for queuing, skip rules, and defaults when categories are missing
	- `Tests/inv-suppression-reactivate-harness.js` — verifies inventory prompt/snapshot suppression during generation and automatic reactivation after all queued cards exist

Run the harness from the repo root:

```powershell
node ".\Tests\prompt-harness.js" --assistantFile=".\Tests\assistant-responses.json"
```

Expected result (live prompt harness): `Summary: PASS 27 / 27, FAIL 0`.

Run the other harnesses individually (optional):

```powershell
node ".\Tests\acs-inventory-sandbox.js"
node ".\Tests\inv-generate-harness.js"
node ".\Tests\inv-harness.js"
node ".\Tests\inv-suppression-reactivate-harness.js"
node ".\Tests\usage-guidance-sandbox.js"
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

Examples (inline, player-focused):
- Bite: “The wolf lunges and `{\injury}wolf bite to forearm (moderate){\!injury}`.”
- Blunt: “A falling stone `{\injury}blunt hit to ribs{\!injury}`.”
- Burn: “The torch sputters and `{\injury}burn to fingertips (minor){\!injury}`.”
- Heal: “You steady yourself and `{\heal}bandage applied to forearm{\!heal}`.”
- Both: “You slip and `{\injury}hard fall onto left knee (moderate){\!injury}`, then `{\heal}healing poultice applied to knee{\!heal}`.”

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

Operational notes:
- Cards are generated one per item (skip if qty is zero, reserved title, or an existing card already matches).
- Titles are title-cased from inventory lines; card type is mapped from category `[weapon|armor|item]` (defaults to `item`).
- Each card uses `entryLimit: 400` and enables memory updates by default.


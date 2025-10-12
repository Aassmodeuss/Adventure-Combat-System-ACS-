# ACS → Auto-Cards Action Plan 


1. Prompting Mechanics

We’ll author custom prompts using Auto-Cards’ generation fields and keep them centralized:
- Use `AutoCards().API.generateCard` with:
	- `entryPrompt`: the base template for the task
	- `entryPromptDetails`: per-card guidance (Auto-Cards bulletizes and appends)
	- `entryStart`: optional seed content to anchor style/structure
- Keep a small prompt registry under the ACS banner in `src/library.js` so hooks can request the right prompt by key (e.g., "weapon_template", "armor_template", "weapon_item", "armor_item").

Initial custom prompt types (we’ll add more later: races, factions, etc.):
- Weapon template card JSON
	- Goal: produce a concise, strictly valid JSON object describing an archetype (stable keys: `subtypes`, `ammoType`, `capacity`, `damage`, `range`, `handling`, `notes`).
	- Output expectation: a single JSON block only (no prose) following `{title: %{title}}` in the entry; safe to parse.

- Armor template card JSON
	- Goal: concise, valid JSON for armor archetypes (`typeTier`, `resistances` as key→tier, `notes`).
	- Output expectation: single JSON block only; no extra narration.

- Weapon and armor unique item cards (using the appropriate template JSON)
	- Goal: reference a matching template card; mirror structured fields (stats) and add item-specific flavor and status.
	- Prompt shape: remind the model to keep flavor separate from the structured stat lines; avoid dialogue.
	- Output expectation: compact stat lines after `{title: %{title}}` (and optional STATUS section), consistent with the template.

2. Inventory Mechanics

This document outlines how we will implement inventory mechanics using Auto-Cards’ public API, what we’ll reuse from legacy ACS (patterns only), and the minimal new helpers we’ll add under the Adventure Combat System (ACS) banner in `src/library.js` (below the ACS header around line ~6199).

Scope (this pass):
- Player Inventory card management (stacked line items)
- Held items list (things currently in hands)
- Equipped Weapons and Equipped Armor cards (single selected item per slot)
- Equipped Items list card for clothing/other worn items (non-weapon/armor)
- Optional item cards (deterministic or AI-generated) with simple memory logging
- Input-side commands: pickup/add, drop/remove, equip, unequip, inspect (read-only)

Assumptions and conventions
- Story Card names (reuse, per repo conventions):
	- Player Inventory (category: Player Stats)
	- Held (category: Player Stats)
	- Equipped Weapons, Equipped Armor (category: Equipped Gear)
	- Equipped Items (category: Equipped Gear) — consolidated worn items list (non-weapon/armor)
	- Item cards: one per important item; title is the item name
- Inventory entry format: one item per line in `Item Name (Amt: X)` form; quantity is an integer ≥ 0
- Held/Equipped Items entry format: same line format as inventory, allowing multiple items
- Equipped cards: `entry` contains only the selected item name (no quantity)
- Case-insensitive matching for item names; display preserves original casing
- When equipping, we’ll decrement inventory by 1 by default (configurable later)
 - Equipped Weapons represent the player’s ready-to-use weapons.

High-level objectives
1) Deterministic scaffolding: ensure inventory/equipment cards exist and are well-formed
2) Authoritative inventory parsing/formatting for stable updates
3) Clean equip/unequip flows with predictable inventory adjustments
4) Optional item cards for important gear (deterministic or AI-generated) with memories
5) Keep context lean; rely on Auto-Cards for memory injection when useful

Default weapon resolution (ambiguous commands)
- When a command implies drawing/using a weapon but the item isn’t explicitly named (e.g., “I draw my dagger”), resolve as follows:
	- Prefer the current Equipped Weapon.
	- If a specific name is provided and it differs from the Equipped Weapon, honor the explicit reference (Inventory/Held match wins).
	- If no Equipped Weapon is set, fall back to the first suitable weapon in Held; if none, try Inventory.
	- If still unresolved, treat as no-op and include a Reason in the tag (e.g., “no weapon equipped”).
- Example: Equipped Weapon = “Runic Dagger”; Inventory contains “Parrying Dagger”. “I draw my dagger” assumes Runic Dagger unless “parrying dagger” is explicitly referenced.

Mapping: ACS responsibilities → Auto-Cards API + helpers

1) Ensure/seed required cards
- Use Auto-Cards APIs:
	- `getCard(predicate)` to find Player Inventory / Equipped Weapons / Equipped Armor
	- plus Held and Equipped Items
	- `buildCard({ title, type, entry, keys, description, insertionIndex? })` to create if missing
- Reuse from ACS (patterns): none beyond name conventions
- New helpers to add:
	- `ensureInventoryScaffold()` → ensures required cards exist: Player Inventory, Held, Equipped Weapons, Equipped Armor, Equipped Items; creates with empty entries

2) Add/pickup items (stacking)
- Use Auto-Cards APIs:
	- Optional item card creation: `buildCard(...)` deterministic or `generateCard(title, details?, entryStart?)`
	- Optional mark auto for memory contextualization: `setCardAsAuto(title, true)`
	- Log action on item card: `addCardMemory(title, "Picked up X.")`
	- Batch operations: `suppressMessages(true/false)`; `postponeEvents(n)` during multi-step updates
- Reuse from ACS (patterns): input command normalization
- New helpers to add:
	- `parseInventory(entryText) -> Array<{ name: string, qty: number }>`
	- `formatInventory(items) -> string`
	- `addToInventory(name: string, delta: number, opts?) -> { ok: boolean, qty: number }`
	- `ensureItemCard(name: string, opts?) -> card|null` (deterministic build or AI generate; optional auto)
	- `addToHeld(name: string, delta: number)`, `removeFromHeld(name: string, delta: number)`

3) Drop/remove items
- Use Auto-Cards APIs:
	- `addCardMemory(title, "Dropped X.")` for history on important items
	- Optional: `eraseCard(card|predicate)` for ephemeral items you want to purge
- Reuse from ACS (patterns): input command normalization
- New helpers to add:
	- `removeFromInventory(name: string, delta: number) -> { ok: boolean, qty: number }`
	- Optional: `dropFromHeld(name: string, delta: number)`

4) Equip item (weapon/armor)
- Use Auto-Cards APIs:
	- `getCard(...)` for target equipped card and optional item card
	- `addCardMemory(title, "Equipped by the player.")`
	- Optional: `setCardAsAuto(title, true)` to allow memory injection
- Reuse from ACS (patterns): equip intent detection from input; keep context short
- New helpers to add:
	- `equipItem(slot: "weapon" | "armor", name: string, opts?: { consumeFromInventory?: boolean }) -> boolean`
		- Updates target equipped card entry to the item name
		- If `consumeFromInventory` is true, decrements inventory by 1; fails if not enough quantity
		- Adds a small memory to the item card if present/created
	- `wearItem(name: string)` adds to Equipped Items and decrements Inventory or Held
	- `stowItem(name: string)` moves from Held → Inventory; `drawItem(name: string)` moves Inventory → Held

5) Unequip item (weapon/armor)
- Use Auto-Cards APIs: `getCard(...)`
- Reuse from ACS (patterns): input command normalization
- New helpers to add:
	- `unequipItem(slot: "weapon" | "armor", opts?: { returnToInventory?: boolean }) -> boolean`
		- Reads current equipped item; clears entry; optionally increments inventory by 1
	- `unwearItem(name?: string, opts?: { returnToInventory?: boolean })` removes from Equipped Items

6) Inspect item (read-only)
- Use Auto-Cards APIs:
	- `getCard(c => c.title === name)` to fetch the item card if it exists
	- Optionally `addCardMemory(title, "Inspected.")` (skip by default)
- Reuse from ACS (patterns): pretty printing summaries
- New helpers to add:
	- `findItemCard(name: string) -> card|null` (case-insensitive)
	- `moveItem({ from: "Held"|"Inventory"|"EquippedItems", to: "Held"|"Inventory"|"EquippedItems", name: string, qty: number })`

Intent detection + tag-driven pipeline (aligns with ACS mechanics goals)

- Lightweight regex for input detection (onInput):
	- `/\b(pick\s*up|take|grab|stow|put\s*away|sheathe|unsheathe|brandish|draw|equip|wear|don|shoulder|sling)\b/i`
	- If detected, extract a candidate item phrase heuristically (e.g., up to trailing punctuation) and set a transient state flag `{ invIntent: { verb, itemGuess } }`.

- Context confirmation and prompting (onContext):
	- When `state.invIntent` is present, prepend a compact SYSTEM prelude instructing the model to:
		- Confirm whether the intent is deliberate vs incidental.
		- Narrate the outcome naturally in-world.
		- Append a concise summary tag using brace markers (not XML) we can parse.
	- Proposed tag schema (keeps to the fields in goals; extra fields optional):
		- Start `{/!inv}` ... end `{/inv}`
		- Fields (comma-separated or space-separated key:val):
			- `Pickup:Y|N` (attempt to pick up)
			- `Store:Y|N` (stow to inventory)
			- `Drop:Y|N`
			- `Success:Y|N|P` (partial allowed)
			- `Reason:<text>`
			- `Itemname:<normalized>`
			- `Delta:+N|-N`
			- Optional: `From:<Held|Inventory|Ground>` `To:<Held|Inventory|Equipped>`

- Output parsing and state updates (onOutput):
	- Detect and parse `{/!inv}...{/inv}` blocks; remove them from the output text before returning.
	- Apply helpers in order:
		- If `Pickup:Y` and `Success` is `Y|P`, add to Held or Inventory depending on `To` (default: Inventory); use `Delta` for quantity.
		- If `Store:Y`, move Held → Inventory (qty by `Delta` or default 1).
		- If `Drop:Y`, decrement Inventory or Held; optionally emit a small `state.message` confirmation; optionally erase ephemeral item cards.
		- If equip action is implied by the verb (e.g., wear/equip), route to `equipItem`/`wearItem`/`stowItem` as specified.
		- If a draw action is implied without a clear item, use default weapon resolution: prefer the Equipped Weapon; then Held; then Inventory; finally no-op with Reason.
	- Clear `state.invIntent`.

Tracking and reminders so the model doesn’t forget inventory
- After a change, onContext inject a single-line summary when recent changes occurred, e.g.:
	- `Inventory: Iron Sword x1; Healing Draught x2 | Held: Torch x1 | Worn: Cloak`
- Keep this summary brief; only include if state changed last turn or every N turns when non-empty.
- For important items with auto-cards, rely on Auto-Cards memory injection instead of verbose lists.

Planned new helper functions (contracts)

- `ensureInventoryScaffold()`
	- Ensures five cards exist: Player Inventory, Held, Equipped Weapons, Equipped Armor, Equipped Items
	- Output: `{ invCard, heldCard, weaponCard, armorCard, equippedItemsCard }` (live card refs)

- `parseInventory(entryText: string)`
	- Input: freeform card entry
	- Output: array of `{ name: string, qty: number }` (qty ≥ 0)
	- Tolerances: trims bullets, normalizes `(Amt: X)`, ignores malformed lines

- `formatInventory(items: Array<{ name: string, qty: number }>)`
	- Output: joined lines `Name (Amt: X)`; omits lines with qty === 0; sorts by name

- `addToInventory(name: string, delta: number, opts?: { createCard?: boolean, autoCard?: boolean, details?: string })`
	- Effect: increments by `delta` (positive), creates line if missing; clamps at safe integer range
	- Optionally `ensureItemCard` with `autoCard` and `details` if `createCard` is true
	- Returns `{ ok: boolean, qty: number }` (new quantity)

- `removeFromInventory(name: string, delta: number)`
	- Effect: decrements by `delta` (positive), clamps at 0; removes line if hits 0
	- Returns `{ ok: boolean, qty: number }`

- `addToHeld(name: string, delta: number)` / `removeFromHeld(name: string, delta: number)`
	- Same semantics as inventory helpers but target the Held card

- `equipItem(slot: "weapon" | "armor", name: string, opts?: { consumeFromInventory?: boolean })`
	- Pre: ensures scaffold; fails if `consumeFromInventory` is true and not enough qty
	- Effect: sets equipped card `entry = name`; optionally decrements inventory; logs memory on item card
	- Returns `true|false`

- `unequipItem(slot: "weapon" | "armor", opts?: { returnToInventory?: boolean })`
	- Effect: clears equipped card entry; optionally increments inventory
	- Returns `true|false`

- `wearItem(name: string)` / `unwearItem(name?: string, opts?: { returnToInventory?: boolean })`
	- Adds/removes entries on the Equipped Items card and moves quantities from/to Held/Inventory

- `stowItem(name: string)` / `drawItem(name: string)`
	- Moves items between Held and Inventory by 1 (default) or specified qty

- `resolveWeaponReference(itemGuess?: string)`
	- Chooses which weapon to act on based on the default resolution rules (Equipped → Held → Inventory → null)
	- Returns `{ name: string, source: "equipped"|"held"|"inventory" } | null`

- `drawWeapon(itemGuess?: string)`
	- Uses `resolveWeaponReference` and ensures the chosen weapon is listed in Held (adding if necessary)
	- Does not change Inventory if the source was Equipped (Equipped is a pointer, not storage)

- `ensureItemCard(name: string, opts?: { deterministic?: boolean, autoCard?: boolean, details?: string, entryStart?: string })`
	- If `deterministic`, use `buildCard`; else attempt `generateCard(name, details?, entryStart?)`
	- If `autoCard`, call `setCardAsAuto(name, true)`; add a starter memory if supplied
	- Returns the card object or `null`

- `findItemCard(name: string)`
	- Case-insensitive title match via `getCard`
	- Returns card or `null`

- `parseInvTag(str: string)` / `stripInvTags(text: string)`
	- Parses `{/!inv}...{/inv}` blocks into a structured object; removes tags from text

Auto-Cards API we’ll rely on
- Creation/lookup: `buildCard`, `getCard`
- Generation/update: `generateCard`, `redoCard`, `setCardAsAuto`
- Memories: `addCardMemory`
- Maintenance: `eraseCard`, `getUsedTitles`, `getBannedTitles`, `setBannedTitles`
- Orchestration: `suppressMessages`, `postponeEvents` (avoid `emergencyHalt` in LSIv2)

Edge cases and safeguards
- Name normalization: case-insensitive comparisons; display preserves original input casing
- Negative or zero deltas: no-ops; return `{ ok: false }`
- Equipping unavailable item: fails gracefully; no partial state
- Duplicate items differing by punctuation/case: treat as same logical item when parsing/matching
- Malformed inventory lines: ignored by parser; rewrite cleanly on next format
- Large inventories: O(n log n) on format; acceptable for small n; keep lines concise

Implementation order (phased)
1) Scaffolding helpers: `ensureInventoryScaffold`, `parseInventory`, `formatInventory` (include Held and Equipped Items)
2) Mutators: `addToInventory`, `removeFromInventory`, `addToHeld`, `removeFromHeld`, `moveItem`
3) Equip/wear flows: `equipItem`, `unequipItem`, `wearItem`, `unwearItem`, `stowItem`, `drawItem`, `ensureItemCard`, `findItemCard`
4) Intent/tag pipeline: input regex detection; context prompt snippet; output tag parsing + application
5) Input wiring: minimal handlers for `/inv`, `/equip <name>`, `/unequip <slot>`, `/pickup <name> xN`, `/drop <name> xN`
6) Optional niceties: `suppressMessages` during multi-step flows; brief `state.message` toasts; periodic inventory summary in Context

Review checkpoints
- After Phase 1: inventory parse/format roundtrip on sample text
- After Phase 2: add/remove idempotence and clamping validated
- After Phase 3: equip/unequip semantics confirmed (consume vs return)

Notes
- All new code goes under the ACS banner in `src/library.js` per repo convention.
- We’ll prefer Auto-Cards public API (`AutoCards().API`) over touching internals.
- Keep Context lean; rely on Auto-Cards memory contextualization for item cards when marked auto.


3. Combat Health and Effect Mechanics

Intent (reference: `Docs/Health and Effects Mechanics.md`)
- Use lightweight brace tags around narrative to log injuries, armor damage, heals, repairs, and effects, then strip tags before returning text.
- Keep raw narrative intact; store logs chronologically; infer “current state” from the most recent events rather than numeric counters.

Card strategy
Strategy: split by domain
- “Player Injuries” card: Entry PList (Active/Recent/Resolved); Description = raw injury/heal lines
- “Player Effects” card: Entry PList (Permanent/Temporary/Recent); Description = raw perm/temp lines
- Armor item cards: augment Entry with Recent_Damage / Recent_Repairs; Description = raw armordmg/repair lines
- Pros: Cleaner summaries; targeted context injection; simpler compression policies; armor logs live where they belong
- Cons: More than one visible card (acceptable)

Rationale and alignment
- This aligns with `Docs/Shifter Progression 0.00.02.md`, which treats deterministic passives and transformations as canonical tokens stored on the Effects card.
- Using PLists with canonical tokens provides stable, compact guidance to the model while remaining easy to summarize and inject into context.

Where data lives
- Entry (player-visible summary):
	- Permanent effects/abilities/upgrades only (stable and compact)
	- Temporary states not persisted here (avoid churn)
- Description (raw chronological logs):
	- Temporary effects `{!temp}`, injuries `{!inj}`, heals `{!heal}`, armor damage `{!armordmg}`, repairs `{!repair}`
	- For armor impacts/repairs, prefer writing to the specific armor item’s card; optionally mirror a brief token in Player Effects Recent for visibility
- Memory updates:
	- If using Auto-Cards summarization, keep memoryUpdates enabled only on the cards where you want injection (e.g., Player Effects for key statuses); otherwise leave disabled and manage summaries via Entry PLists

Effects PList format (finalized)
- Card: “Player Effects” (Entry PList keys and semantics)
	- `Permanent:` comma-separated canonical tokens, e.g., `keen_hearing, keen_smell, night_vision, weave_sense_baseline, accelerated_healing_low, moon_marked_resilience`
	- `Temporary:` comma-separated active state tokens, e.g., `hybrid_form, minor_shift, healing_boost_shifted`
	- `Recent:` short recency tokens or micro-lines, newest first, cap ~3–4, e.g., `T12 hybrid_form manifests, T11 minor_shift heightens scent`
- Policy:
	- Deterministic passives/transform outcomes add/remove tokens directly (no `{!perm}` / `{!temp}` required), per Shifter Progression.
	- Model-detected `{!perm}` / `{!temp}` tags are merged into the same PList when present.
	- Keep tokens canonical and parseable; if extra hinting is needed, add a brief `Hints:` line with ≤2 short phrases (optional) without altering tokens.

Context injection policy (to ensure enough detail for the model)
- When Effects changed last turn or every N turns (e.g., 3):
	- Inject a single compact line derived from the Effects PList, e.g., `Effects: Perm=keen_hearing, keen_smell, weave_sense_baseline; Temp=hybrid_form`
- For combat turns with injuries/damage, also inject a one-liner from the Injuries PList, e.g., `Injuries: Active=splintered_wrist; Recent=T42 wrist splintered`
- Keep each line ≤ 140–180 chars to preserve budget; rely on dedicated effect/armor cards for deeper narrative when needed.

Tagging & lifecycle
- Tags (no XML): `{!inj}`, `{!armordmg}`, `{!heal}`, `{!repair}`, `{!perm}`, `{!temp}`
- Lifecycle: Input (optional passive detection) → Context (brief reminder block only when needed) → Output (parse/strip tags, log events, update cards)
- Guardrails: 1–2 sentence tags; no nesting; reject empty; cap excessive tags per turn

Permanent effects blurbs (Auto-Cards usage)
- Goal: add permanent effects as concise lines in Entry; accompany each with a short explanation
- Two viable patterns:
	1) Dedicated effect cards (preferred for generation):
	1) Dedicated effect cards (preferred for generation):
		 - Generate a “Permanent Effect: <Name>” card via `generateCard` with a prompt that produces a 1–2 sentence explanation; mark as auto for memory when appropriate
		 - Mirror a one-liner into Player Effects Entry (token + short blurb or reference)
	2) Deterministic blurb builder (no new cards):
		 - Maintain a tiny template map in code and synthesize an explanatory sentence for common effects; append directly to Player Status Entry
- Note: Auto-Cards doesn’t generate free text without creating a card; if we want model-authored blurbs, pattern (1) is the clean API-aligned route

Proposed helpers (contracts)
- `ensureCombatScaffold()`
	- Ensures Player Injuries and Player Effects exist; armor updates happen on the relevant item cards
- `updatePlayerInjuryCard()` / `updatePlayerEffectsCard()` → rebuild Entry PList summaries
- `parseCombatTags(text) -> { cleaned, events[] }` (inj, heal, armordmg, repair, perm, temp)
- `logCombatEvents(events, turn)` → updates in-memory structures, then writes description lines to the chosen card(s)
- `resolveHeals()` → optional heuristic to mark latest matching injury as resolved
- `updatePlayerStatusCard()` or `updatePlayerInjuryCard()` / `updatePlayerEffectsCard()` → rebuild Entry PList summaries
- `updateArmorCard(title)` → append Recent_Damage / Recent_Repairs and description lines
- `addPermanentEffect(name, opts?: { useCard?: boolean, details?: string })`
	- If `useCard`, call `generateCard({ title: "Permanent Effect: "+name, entryPrompt, entryPromptDetails: details })`, set as auto, then mirror a one-line into Entry
	- Else, synthesize deterministic one-line and append to Entry directly

Efficiency notes & alternatives
Efficiency notes & alternatives
- For context hygiene, keep memoryUpdates disabled on noisy log cards (or set stricter limits) and rely on minimal Entry summaries for recall; only key effect cards should inject memory.
- If you want a private, non-player-facing log, a hidden “Combat Log” data card is an alternative; Player-facing cards then show only curated summaries.

4. Schools and Abilities
 
This section integrates the Schools system and the initial Shifter — WolfBlood school into the ACS plan without duplicating full specs. For detailed mechanics, see `Docs/ACS School System.md` and `Docs/Shifter Progression 0.00.02.md`.

4.1 Wiring Schools Into ACS (summary)

- Single-turn flow (aligns with ACS School System):
	- Input: local school classifier yields `{ schoolGuess, confidence, intentToken }` (see ACS School System §5–8).
	- Context: inject a tiny resolve/classify block depending on confidence; model emits exactly one sentinel tag.
	- Output: parse the tag, update the School Card and Effects card as needed, then strip the tag from text.
- Tag format (already used in ACS School System):
	- `::ABILITY|<school_id>|<intent_token>|<success|partial|fail|ignored>|confidence=<high|med|low>::`
- Cards (reuse current card strategy):
	- One School Card per school: `[Name: <Display>; School: <Family>; Capabilities: ...; Risks: ...; Mastery: ...; Recent: ...]`.
	- “Player Effects” card stores ongoing passives/temporaries via PList tokens (Permanent/Temporary/Recent).
	- Injuries and armor stay with their existing split-card approach (no change).
- Use Auto-Cards API for all card operations:
	- Creation/lookup: `AutoCards().API.buildCard`, `AutoCards().API.getCard`.
	- Optional memory context: `AutoCards().API.setCardAsAuto(title, true)` and `AutoCards().API.addCardMemory`.
	- Avoid touching Auto-Cards internals; modify card Entry/Description via returned live card refs only.
- Leveling: thresholds `[0,10,30,60,100,150,210]` (see School System §9). Each counted use increments `totalUses` and can evolve Mastery tokens; School card `Recent` logs compact tokens like `level_up_to_2`, `assume_hybrid`, etc.

Planned helpers (Schools)
- `ensureSchoolScaffold(id: string, display: string)` → ensures the School Card exists; returns live ref.
- `classifyAbility(text) -> { schoolGuess, confidence, intentToken }` → thin wrapper that calls ACS School System’s local detector.
- `parseAbilityTag(text) -> { cleaned, event|null }` → extracts and removes one ABILITY tag.
- `logAbilityEvent(event)` → updates school uses/levels, pushes a `Recent` token, and, if relevant, coordinates Effects tokens per policy.
- `updateSchoolCard(id)` → rebuilds PList sections (Capabilities, Risks, Mastery, Recent) as needed.
	- All helpers must use `AutoCards().API.*` (buildCard/getCard/addCardMemory/setCardAsAuto) and never reference Auto-Cards internals directly.

4.2 Initial School: Shifter — WolfBlood (ID: `shifter_wolf`)

Source references: `Docs/Shifter Progression 0.00.02.md`, `Docs/Shifter goals.instructions.md`, and lore docs under `Docs/Lore/`.

- Scope for first pass (intents):
	- Transformations: `assume_minor`, `assume_hybrid`, `assume_wolf`, `assume_dire_wolf`.
	- Senses/track: `scent_track`.
	- Stabilizers: `anchor_will` (resist Blood Frenzy pull).
	- Rally: `howl_rally` (light morale/poise effect; narrative-first).
- Effects card integration (aligns with our Effects policy):
	- Deterministic permanent passives on awakening/progression: add tokens like `keen_hearing, keen_smell, night_vision, weave_sense_baseline, accelerated_healing_low` (later tiers scale; see Shifter Progression “Permanent scaling policy”).
	- Temporary forms on successful transformations: `minor_shift`, `hybrid_form`, `wolf_form`, `dire_wolf_form`.
	- Temporary amplifiers when shifted (optional short-lived tokens): `healing_boost_shifted`, `sense_boost_shifted`.
	- Blood Frenzy risk is modeled as Effects tokens that scale down with mastery; spikes can be transient during stress/shift as `{!temp}` or system-applied temporary tokens (policy stays narrative-first; no numeric stats).
- School Card snapshot (example PList keys):
	- `Capabilities:` `assume_*`, `scent_track`, `anchor_will`, `howl_rally` (expand per progression tiers later).
	- `Risks:` `blood_frenzy_risk` (qualitative; see progression doc).
	- `Mastery:` tokens added on level-ups (e.g., `awakened_wolfblood`, `quick_shift`, `battle_form`, `moon_marked`, etc.; see table in Shifter Progression).
- Prompting notes:
	- For any generated descriptive effect blurbs we choose to create as standalone cards (optional), use the prompt registry via `generateCard` and mark as auto; otherwise prefer deterministic one-liners in Effects Entry.

4.3 Minimal Contracts for Shifter Wiring

- `ensureShifterSchool()`
	- Ensures the Shifter — Wolf school card exists with proper Name/School headings and seed Capabilities/Risks based on tier 1 using `AutoCards().API.buildCard/getCard`; mark as auto if you want memories injected.
- `applyShifterDeterministicPassives(tier)`
	- Writes/upgrades permanent Effect tokens at tier milestones (no `{!perm}` needed). Reads tier from the School card or from ACS School System state. Update the "Player Effects" card via `getCard` and rewrite Entry PList using the public card object.
- `onShifterAbilityOutcome(event)`
	- After parsing `::ABILITY|shifter_wolf|...::`, on success apply any required Temporary forms; on fail/partial, do not mutate Permanent; add concise `Recent` tokens to Effects and School cards.
- `contextLinesForShifter()`
	- Build concise one-liners for Context based on Effects (e.g., `Temp=hybrid_form`) and, if needed, a School snippet like `School: Shifter — Wolf (L3; Recent: assume_hybrid)` keeping within our length limits.

4.4 Non-Goals (this pass)

- No numeric damage or stat bonuses; all outcomes remain narrative.
- No fatigue/strain counters yet; we track qualitative risks and recent tokens only.
- No multi-school interactions; focus solely on `shifter_wolf` until end-to-end flow is solid.

4.5 References

- Schools system full spec: `Docs/ACS School System.md`.
- Shifter progression and capabilities: `Docs/Shifter Progression 0.00.02.md`.
- Shifter implementation guidance (class structure intent, instincts/Blood Frenzy, spirit bond): `Docs/Shifter goals.instructions.md`.
- Lore and tone: `Docs/Lore/Nature Magic Style Guide.md`, `Docs/Lore/Shifter Lore Outline.md`, `Docs/Lore/The Heart of the Forest Lore.md`.

5. Lore Integration & Tone (compact)

- Tone/style: Follow `Nature Magic Style Guide.md` for voice when crafting prompts and any generated blurbs; avoid modern slang; keep nature-forward metaphors (wind, root, thread, scent).
- Context hygiene: Inject at most 1–2 lines summarizing Effects and, when an ability is used, a tiny School line; let story cards carry depth.
- Weave vs Nature and factions: When item or effect prompts need world texture, reference `The Heart of the Forest Lore.md`; do not inline large excerpts.
- Shifter-specific flavor: Align hybrid/wolf form narration with `Shifter Lore Outline.md`; emphasize spirit bond with the Great Wolf and scent-led perception; keep Blood Frenzy as a narrative risk, tempered by `anchor_will` and progression.
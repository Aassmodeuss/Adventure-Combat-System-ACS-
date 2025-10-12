# ACS → Auto-Cards Integration Plan

This document outlines how to integrate the legacy Adventure Combat System (ACS) mechanics into `src` while leveraging Auto-Cards’ public API for card lifecycle and persistence.

## High-level approach
- Wrap ACS logic in a small ACS module inside `src/library.js` and call it from existing hooks (`input`, `context`, `output`) next to Auto-Cards.
- Use `AutoCards().API` for story card creation, updates, and memories.
- Keep runtime mirrors in `state.*`, but prefer cards as the player-visible source of truth.

## Core cards and invariants (managed via Auto-Cards API)
Reserve and enforce these titles; ban them from normal generation to avoid collisions:
- Player Stats (category: Systems)
- Equipped Weapon (category: Equipped Gear)
- Equipped Armor (category: Equipped Gear)
- Inventory (category: Systems)
- Player Injuries (category: Systems)
- Weapon: {Name} (category: Weapons) — one per distinct weapon
- Armor: {Name} (category: Armor) — one per distinct suit

For each card:
- Entry starts with `{title: <Title>}`
- Description includes the memory header:
  - `Auto-Cards will contextualize these memories:`
  - `{updates: true, limit: 2750}`
- Create/update via `AutoCards().API.buildCard`
- Append bullet memories via `AutoCards().API.addCardMemory`

## Hook responsibilities

### Input hook (event detection and scheduling)
- Commands:
  - `/start` → unlock ACS; ensure core cards exist.
  - `/end` → lock ACS.
  - `/help` → show quick usage and available commands.
- Equip detection:
  - Detect equip/unequip for weapon and armor.
  - Ensure “Equipped Weapon/Armor” exists and is updated.
  - Ensure “Weapon: X” / “Armor: X” cards exist with structured entries + memory header.
- Pickup detection:
  - Use legacy pickup lexicons and "you" context; append items to “Inventory” as memories.
- Scheduling:
  - Use `postponeEvents(1)` to defer heavy work; keep input light.

### Context hook (persistence and structure maintenance)
- Ensure core cards exist and meet invariants (entry header + memory header).
- Reserve titles:
  - Use `getUsedTitles` + `setBannedTitles` to keep reserved titles collision-free.
- Canonicalization (Weapons/Armor):
  - Insert a `CanonicalName: <Name>` line at the top of entries; dedupe by canonical name.
- State hydration:
  - Read equipped names and key stats back into `state` mirrors for quick access.
- Summaries/compression:
  - Rely on Auto-Cards’ memory trimming rather than extra global trimming.

### Output hook (effects and feedback)
- Flags processing:
  - `<!inj>...</inj>` and `<!heal>...</heal>` → update “Player Injuries” memories and entry summary.
  - `<!armorDmg>...</armorDmg>` → update active armor’s damage/shield state and memories.
- Shield regeneration tick:
  - Apply regen to `state.armor.shield` and log a short memory on the active armor card.
- Toasts:
  - Use `state.message` for concise feedback on key transitions.

## Data handling and helpers
- `state.*` mirrors:
  - `playerStats`, `skillClasses`, `inventory`, equipped names, armor/weapon computed state.
- Synchronization:
  - When `state` changes, reflect into cards with `buildCard`, and add a memory line for history.
- Titles/keys/categories:
  - Use Auto-Cards helpers for formatting and pin/sort; categories: Systems, Equipped Gear, Weapons, Armor.
- Fuzzy matching and normalization:
  - Reuse legacy helpers (e.g., best inventory match, armor name normalization) within the ACS module.

## Feature mapping from legacy to new
- `onLibrary_ACS` → ACS module inside `src/library.js` with `ACS(hook, text, stop)`.
- `onInput_ACS` → input branch for unlock/lock/help, weapon/armor equip, pickup.
- `onContext_ACS` → context branch for card presence/format checks, canonicalization, state hydration.
- `onOutput_ACS` → output branch for flags, shield regen, and toasts.

## Card content guidelines
- Player Stats
  - Entry: structured fields (lvl, cp, ep, atk, ratk, intl, and max*).
  - Description: memory header + bullet events (e.g., level-ups).
- Inventory
  - Entry: header with counts or list.
  - Description: memory header + item add/remove bullets.
- Equipped Weapon / Weapon: X
  - Equipped: small entry + equip/unequip memories.
  - Weapon: X: entry with damage/ammo/condition; description for history.
- Equipped Armor / Armor: X
  - Equipped: current name + memories.
  - Armor: X: entry with resistances/shield/regen/damageLog; description for damage + regen memories.
- Player Injuries
  - Entry: structured list of current injuries.
  - Description: memory log of new/cleared injuries.

## Auto-Cards API usage contract
- Build or update: `buildCard({ title, type, keys, entry, description })`
- Read: `getCard(predicate[, all])`
- Append memory: `addCardMemory(title, bullet)`
- Control: `setBannedTitles([...])`, `setCardAsAuto(title, true)`
- Optional: `generateCard` for descriptive entries when desired; otherwise `buildCard` for deterministic structure.

## Edge cases
- Title collisions: check `getUsedTitles` before creating Weapon/Armor cards.
- Bans: keep reserved titles banned.
- Missing equipment: skip dependent updates when nothing is equipped.
- Large inventories: rely on memory limits; occasionally summarize.

## Minimal initial milestones
1) Scaffolding
   - Add ACS module in `src/library.js` with `ACS(hook, text, stop)`.
   - Add toggles in `MainSettings.AutoCards` for ACS enablement and logging.
   - Wire ACS calls in `src/input.js`, `src/context.js`, `src/output.js` alongside Auto-Cards.
2) Core cards + equip flow
   - Ensure core cards exist; implement equip detection; create “Weapon/Armor: X” cards.
3) Inventory pickup detection
   - Implement pickup heuristics + Inventory memory updates.
4) Flags (injury/heal/armor damage)
   - Parse flags; update “Player Injuries” and active armor card; implement shield regen tick.
5) Player stats
   - Mirror legacy `playerStats`; write level-ups as memories; reflect fields into “Player Stats”.
6) QA
   - Enable Auto-Cards debug logging; test flows; verify card updates and memories.

## Optional enhancements
- Use `generateCard` to author initial descriptive entries for new weapons/armors with short prompts.
- Add an “ACS Settings” card to toggle modules and bans at runtime.
- LSIv2 console log hooks for deeper debugging during playtesting.

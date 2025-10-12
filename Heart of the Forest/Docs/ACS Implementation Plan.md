# ACS Implementation Plan (Step-by-Step)

Source of truth: see `Docs/ACS Autocards Goals.md` for the full goals and APIs we must honor. This plan breaks implementation into small, testable steps grouped in stages. Each stage includes local sandbox tests (VS Code tasks/CLI) and real-world AiDungeon checks.

Conventions
- All runtime code goes under the ACS banner in `src/library.js` (use `AutoCards().API.*` only; never touch internals).
- Hooks: Input/Context/Output are in `src/`. Keep Context compact (1–2 lines when needed).
- Local sandbox: `scripts/sandbox.js` with flags:
  - `--scenario --file <name>.json` to run scripted turns from `scripts/scenarios/`
  - `--stub-ac` to stub generateCard deterministically
  - `--enable-ac` edits the control card to enable Auto-Cards; `--force-ac` sets `doAC=true`
  - `--trace-ac` logs public API calls; `--seed-cards` creates baseline Inventory/Equipped cards

Acceptance rubric (for each stage)
- Build: sandbox runs without errors.
- Behavior: outputs and storyCards match expected deltas.
- No drift: plan stays aligned with `Docs/ACS Autocards Goals.md`.

---

## Stage 0 — Environment ready (baseline)

Objective: Verify the sandbox and control flows.

Steps
1) Run scenario with Auto-Cards enabled and stubs.
2) Confirm control card flips to Configure; AC config shows `doAC: true`.

Local tests (VS Code)
- Task: Sandbox: Scenario
- CLI (PowerShell):
  - `node scripts/sandbox.js --scenario --file basic.json --stub-ac --enable-ac --force-ac --trace-ac --seed-cards`
Expected
- Turn 1–4 complete; `storyCards` includes either “Edit to enable …” then “Configure …”.
- AC Config logs show `doAC: true` by turn 2.

Real-world test (AiDungeon)
- Paste current `src/library.js` + hooks into a test scenario.
- Ensure “Edit to enable Auto-Cards” shows; set to true; confirm Configure card appears.

---

## Stage 1 — Inventory scaffold + parse/format

Objective: Ensure required cards exist and implement stable inventory parsing/formatting.

Implementation (files)
- `src/library.js` (ACS block):
  - add helpers: `ensureInventoryScaffold()`, `parseInventory(entry)`, `formatInventory(items)`.
  - Temporarily export these via a global ACS namespace for sandbox smoke (e.g., `state.ACS_dev.inv = { ... }`) or wire minimal calls from Output with no-op behavior.

Tests
- Add scenario `inv_scaffold.json` (player says anything; we only check cards).
- Run: `node scripts/sandbox.js --scenario --file inv_scaffold.json --stub-ac --enable-ac --seed-cards`
Expected
- Cards exist: Player Inventory, Held, Equipped Weapons, Equipped Armor, Equipped Items.
- `parseInventory` round-trip: formatting a parsed set yields consistent `Name (Amt: X)` lines.

Real-world
- In AiDungeon, create the five cards manually or run a turn that triggers `ensureInventoryScaffold()` (from Output). Verify card names and empty entries.

---

## Stage 2 — Inventory mutators (add/remove Held/Inventory)

Objective: Implement item stacking and held list updates.

Implementation
- `src/library.js` (ACS): `addToInventory`, `removeFromInventory`, `addToHeld`, `removeFromHeld`, `moveItem`.
- Clamp quantities, ignore malformed lines, case-insensitive matching.

Tests
- Add scenario `inv_mutators.json`:
  - Turn 1: “I pick up the iron dagger.” (we’ll simulate result via inv tag in Stage 4, but here call mutators directly from Output for smoke)
  - Turn 2: “I stow the dagger.”
- Run: `node scripts/sandbox.js --scenario --file inv_mutators.json --stub-ac --enable-ac --seed-cards`
Expected
- Inventory shows `iron dagger (Amt: 1)` after T1.
- Held decreases/inventory increases after “stow”.

Real-world
- In AiDungeon, manually edit inventory lines; ensure the mutators normalize formatting and stacking next turn.

---

## Stage 3 — Equip/wear flows

Objective: Select equipped weapon/armor and track worn items.

Implementation
- `src/library.js` (ACS): `equipItem`, `unequipItem`, `wearItem`, `unwearItem`, `stowItem`, `drawItem`, `resolveWeaponReference`, `drawWeapon`.
- When equipping, optionally consume 1 from inventory (default true, per Goals doc); equipped cards store only the name.

Tests
- Scenario `equip_flows.json`:
  - T1: add dagger to inventory (via Stage 2 mutators call or simulated tag)
  - T2: “equip dagger” → Equipped Weapons entry becomes “iron dagger” and inventory decrements.
- Run with seed: `--seed-cards`.
Expected
- Equipped Weapons entry set; inventory decremented by 1.

Real-world
- In AiDungeon, issue “equip <item>”; verify equipped card updates and inventory adjusts.

---

## Stage 4 — Inventory tag pipeline (Output parsing)

Objective: Parse `{/!inv}...{/inv}` tags and apply mutators.

Implementation
- `src/library.js` (ACS): `parseInvTag(str)`, `stripInvTags(text)`.
- Output hook: call parser, apply changes in order specified in Goals, strip tags before returning.

Tests
- Use `scripts/scenarios/basic.json` (already emits a pickup tag).
- Run: `node scripts/sandbox.js --scenario --file basic.json --stub-ac --enable-ac --seed-cards`
Expected
- After Turn 1, Inventory contains `iron dagger (Amt: 1)`.
- Output text printed without the inv tag content (stripped).

Real-world
- In AiDungeon, simulate pickup by narrating; the context prompt (added next stage) should guide the model to emit the tag; verify inventory updates.

---

## Stage 5 — Effects/Injuries scaffold + tag parsing

Objective: Split-card strategy: Player Effects, Player Injuries; parse `{!inj}/{!heal}/{!armordmg}/{!repair}/{!perm}/{!temp}`.

Implementation
- `src/library.js` (ACS): `ensureCombatScaffold`, `parseCombatTags`, `logCombatEvents`, `resolveHeals`, `updatePlayerInjuryCard`, `updatePlayerEffectsCard`, `updateArmorCard`.
- Effects PList: Permanent/Temporary/Recent per Goals.

Tests
- Scenario `effects_tags.json` with lines that trigger a `{!temp}hybrid_form{/temp}` and `{!inj}sprain wrist{/inj}` (add via naiveModel or manual call).
- Run scenario; inspect “Player Effects” and “Player Injuries” entries/descriptions.
Expected
- Effects PList updated (Temporary includes `hybrid_form`; Recent includes compact tokens). Injuries logs updated.

Real-world
- In AiDungeon, add a simple prompt to elicit `{!temp}`; confirm it updates the card and strips from output.

---

## Stage 6 — Schools: ABILITY tag + Shifter minimal wiring

Objective: Parse ABILITY tag; log Recent tokens; apply deterministic Shifter passives and temporary forms on success.

Implementation
- `src/library.js` (ACS): `ensureSchoolScaffold`, `parseAbilityTag`, `logAbilityEvent`, `updateSchoolCard`.
- Shifter-specific: `ensureShifterSchool`, `applyShifterDeterministicPassives(tier)`, `onShifterAbilityOutcome(event)` (apply `minor_shift`, `hybrid_form`, etc.).

Tests
- Use `basic.json` (emits Shifter hybrid ability).
- Run: `node scripts/sandbox.js --scenario --file basic.json --stub-ac --enable-ac --seed-cards`
Expected
- School card created (Shifter — Wolf) with initial Capabilities/Risks/Mastery skeleton.
- Effects Temporary includes `hybrid_form`; School `Recent` includes `assume_hybrid` token.

Real-world
- In AiDungeon, narrate a shift; confirm ability tag parsing and Effects/School updates.

---

## Stage 7 — Context one-liners & summaries

Objective: Keep the model informed without bloating context.

Implementation
- Context hook: when Effects changed last turn or every N turns (e.g., 3), inject 1–2 lines:
  - `Effects: Perm=keen_hearing, weave_sense_baseline; Temp=hybrid_form`
  - Optionally: `Injuries: Active=..., Recent=...`
- Avoid API mutations in Context; only reads and compact formatting.

Tests
- Scenario where Effects change on turn N, verify a single summary line appears next Context and is omitted when unchanged.

Real-world
- Confirm the model follows summaries and still produces narrative first.

---

## Stage 8 — Prompt registry (optional generation)

Objective: Centralize custom prompts for item/effect cards.

Implementation
- `src/library.js` (ACS): a small registry object and a getter, used by `generateCard` calls for weapon/armor templates and unique items.
- Use `setCardAsAuto` for cards you want to participate in memory injection.

Tests
- Manually call `AutoCards().API.generateCard` with the registry prompts under `--stub-ac` and without (to ensure failure mode is clean).

Real-world
- In AiDungeon, try generating a “Permanent Effect: <Name>” card; verify it stays concise.

---

## Stage 9 — AiDungeon deployment & guardrails

Checklist
- Paste latest library and hooks (dist or src if you’re careful) into your scenario.
- Verify: Configure card visible; AC enabled; no duplicate internal cards; Player cards present.
- Toggle `showDebugData` only when needed; keep it off by default.
- Validate a micro run: pickup → equip → shifter hybrid → a temp effect → strip tags from output.

Rollout policy
- Keep changes behind feature flags in code if needed (e.g., `state.ACS.flags.enableSchools`).
- Add brief toasts via `state.message` for player-visible confirmations.

---

## Quick task index (run in VS Code)

- Single: `node scripts/sandbox.js`
- Scenario demo: `node scripts/sandbox.js --scenario --file basic.json --stub-ac --enable-ac --seed-cards`
- Full trace: `node scripts/sandbox.js --scenario --file basic.json --stub-ac --enable-ac --force-ac --trace-ac --seed-cards`
- REPL: `node scripts/sandbox.js --repl --stub-ac --enable-ac --force-ac --seed-cards`

## Notes
- Keep tests minimal and repeatable; prefer scenario files for regression.
- For any mutation of story cards, verify `title`, `entry` (top lines), and `type` via the sandbox snapshot.
- For real-world runs, avoid cluttering context—stick to the plan’s one-liner policy.

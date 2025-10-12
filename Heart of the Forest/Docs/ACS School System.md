# ACS School System – Dynamic Intent + School Confirmation (Approach 4 + Fallback to 1)

> Purpose: Define a practical, low-drift, single-turn School interaction system that classifies unique player traits and abilities into Schools, confirms or overrides with model assistance (without extra turns), logs events, and levels Schools. This spec also integrates Permanent and Temporary effects logging to the Effects Story Card for passives and activated abilities that affect the player.

---

## Table of Contents

1. Design Goals & Constraints
2. High-Level Flow (One Turn)
3. Core Concepts
4. Data Structures (State + Cards)
5. Local Detection & Scoring (Approach 4 Basis)
6. Fallback Classification (Approach 1 Path)
7. Context Injection Blocks
8. Tag Format & Parsing
9. Leveling & Mastery Evolution
10. Event Tokens & Effects Logging Rules
11. Compression & Cooldown Behavior
12. Edge Cases & Policies
13. Implementation Steps (Incremental Plan)
14. Test Scenarios
15. Future Extensions (Deferred)
16. Quick Reference Cheat Sheet
17. Glossary

---

## 1. Design Goals & Constraints

| Goal                   | Description                                                                    |
| ---------------------- | ------------------------------------------------------------------------------ |
| Single-turn resolution | All detection + confirmation + outcome tag in same input→context→output cycle. |
| Low false positives    | Strong local heuristic; model only refines medium confidence cases.            |
| Human readable         | School Cards remain editable; no opaque JSON blobs except id metadata.         |
| Scalable               | Adding a new School = update keyword lists + optional intent patterns.         |
| Minimal drift          | design logging, job, compression, cooldown mechanics.                          |
| Narrative-first        | Model decides success/partial/fail; system guides and logs.                    |
| Lightweight tokens     | Tags short, one per action.                                                    |

Non-Goals (Phase 1): fatigue penalties, cross-school synergy, emergent new school discovery.

---

## 2. High-Level Flow (One Turn)

1. INPUT HOOK: Player text → local classifier produces `{ schoolGuess, confidenceBucket, intentToken }`.
2. If school card missing → enqueue creation job (type `AbilitySchool`).
3. CONTEXT HOOK: Inject confirmation block depending on confidence:
   - HIGH: Fixed school outcome directive (no model re-classification; just outcome tag).
   - MED / LOW: Full classification block (model can override or ignore).
4. MODEL OUTPUT: Narrative + sentinel tag appended at end (plus optional Effects tags for player states).
5. OUTPUT HOOK:
   - Parse tag. If missing & HIGH → synthesize fallback tag.
   - Apply usage → update School state (level, mastery, recent events).
   - Edit School Card (description + PList). Compression may also trigger separately if cooldown reached.

Reminder — when to use ABILITY vs Effects tags:
Use the ABILITY sentinel (::ABILITY|school|intent|outcome|confidence=…::) to confirm a School use, drive leveling, and add a Recent token—emit exactly one per action. Use Effects tags only for player state: {!perm}…{/perm} for passives/always‑on traits and {!temp}…{/temp} for short‑lived forms/boons. Effects tags are parsed into the Effects Story Card and stripped from the saved narrative; they do not affect leveling.

---

## 3. Core Concepts

| Concept            | Meaning                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| School             | Aggregate domain (placeholder: Prototype School) used for scaffolding.                                   |
| Intent Token       | Compact canonical action label (e.g., `sense_pattern`, `focus_channel`, `stabilize_flow`).               |
| Confidence Bucket  | Local certainty (high, med, low) controlling prompt style.                                               |
| Outcome            | success / partial / fail / ignored.                                                                      |
| Event Token        | Logged usage summary for `Recent` category & history compression.                                        |
| Mastery Tokens     | Qualitative progression markers gained at level-up (e.g., `basic_attunement`).                           |
| Effects Story Card | Dedicated card where permanent passives and temporary player‑affecting states are logged via tags below. |

---

## 4. Data Structures (State + Cards)

### 4.1 In-Memory State

```js
state.ACS.abilitySchools = {
  prototype_school: {
    level: 2,
    totalUses: 23,
    usesSinceLevel: 3,
    nextThreshold: 30,
    recent: ['focus_probe', 'sense_pattern', 'level_up_to_2'],
    capabilities: ['basic_attunement', 'pattern_detection'],
    failuresInRow: 0
  }
};

state.ACS.pendingAbilityIntents = [
  {
    schoolGuess: 'prototype_school',
    confidence: 'med',
    intentToken: 'sense_pattern',
    raw: 'I concentrate, trying to sense hidden flows.'
  }
];

state.ACS.abilityStats = { missingTags: 0, malformedTags: 0 };
```

### 4.2 School Card (Story Card)

Description lines example:

```
level: 2
totalUses: 23
nextThreshold: 30
autoHistory: true
cooldown: 6
```

PList:

```
[Name: Prototype School; School: Prototype; Capabilities: basic_attunement, pattern_detection; Risks: focus_drain, backlash_wave; Mastery: refined_focus, layered_perception; Recent: level_up_to_2, focus_probe, sense_pattern]
```

### 4.3 Effects Story Card (Story Card)

Log ongoing player states and boons:

PList sketch:

```
[Name: Player Effects; Permanent: keen_hearing, night_vision, weave_sense_baseline; Temporary: hybrid_form, minor_shift, healing_boost_shifted; Recent: T12 hybrid_form manifests, T11 minor_shift heightens scent]
```

ID JSON (string):

```json
{
  "id": "prototype_school",
  "abilitySchool": true,
  "autoHistory": true,
  "cooldown": 6,
  "summary": "",
  "level": 2,
  "totalUses": 23
}
```

---

## 5. Local Detection & Scoring (Approach 4 Basis)

### 5.1 School Catalogue (Placeholder Only)

Single placeholder School used to scaffold mechanics. Add real Schools later by cloning this template.

| School (ID)                           | Short Lore Description                                                        | Example Capabilities (placeholder)                            | Risk Themes (placeholder)                 |
| ------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------- |
| Prototype School (`prototype_school`) | Foundational manipulation of ambient arcane patterns via focus and resonance. | sense_pattern, focus_channel, stabilize_flow, apply_resonance | focus_drain, backlash_wave, pattern_noise |

Mastery tokens (qualitative): `basic_attunement` → `refined_focus` → `layered_perception` → `resonance_harmony` → `adaptive_synchronicity`.

### 5.2 Keyword Bucket (Placeholder)

```js
const SCHOOL_KEYWORDS = {
  prototype_school: ['focus', 'channel', 'pattern', 'weave', 'resonance', 'attune', 'harmonic']
};
```

### 5.3 Intent Regex Patterns (Placeholder)

```js
const INTENT_PATTERNS = [
  { school: 'prototype_school', re: /focus (?:the )?energy/i, token: 'focus_channel' },
  { school: 'prototype_school', re: /sense (?:a )?pattern/i, token: 'sense_pattern' },
  { school: 'prototype_school', re: /stabilize (?:the )?flow/i, token: 'stabilize_flow' }
];
```

Scoring (suggested):
| Rule | Score |
|------|-------|
| Each keyword hit (unique per school) | +2 |
| Intent pattern match | +3 |
| Strong verb + object (e.g. lift + gate) | +2 |
| Negation ("don’t burn") | -3 |
| Hypothetical / wish | -2 |
| Generic try w/o object | -1 |

Confidence buckets:

- high ≥ 5
- med 3–4
- low ≤ 2

Result object (example):

```js
{ schoolGuess: 'prototype_school', confidence: 'med', intentToken: 'sense_pattern' }
```

---

## 6. Fallback Classification (Approach 1 Path)

If confidence is `med` or `low`, we allow the model to confirm or override. If `high`, we skip classification and go straight to outcome directive. If no valid school after model pass (tag says `ignored`), we drop the use.

---

## 7. Context Injection Blocks

### 7.1 HIGH Confidence Block (Fixed School)

```
[ABILITY_RESOLVE]
School: Prototype School (fixed)
Intent: sense_pattern
Append only one final tag:
::ABILITY|prototype_school|sense_pattern|<success|partial|fail>|confidence=high::
[/ABILITY_RESOLVE]
```

### 7.2 MED / LOW Confidence Block (Classification + Outcome)

```
[ABILITY_CLASSIFY]
Player intent: "I focus, trying to sense a hidden pattern in the ambient flow."
Local guess: prototype_school (confidence: medium)
Schools: prototype_school(pattern/focus), ignored(no ability)
Rules:
 1. Decide if the action truly invokes prototype_school or is ignored.
 2. Narrate normally.
 3. End with EXACT tag:
  ::ABILITY|<prototype_school or ignored>|<intent_token_or_generic>|<success|partial|fail|ignored>|confidence=<high|med|low>::
No extra commentary after the tag.
[/ABILITY_CLASSIFY]
```

---

## 8. Tag Format & Parsing

Primary regex:

```
/::ABILITY\|([a-z_]+|ignored)\|([a-z_]+)\|(success|partial|fail|ignored)\|confidence=(high|med|low)::/
```

Parsing logic priority:

1. If tag.school === 'ignored' → discard event.
2. If local confidence === 'high' and tag missing → synthesize: `::ABILITY|<localSchool>|<intentToken>|success|confidence=high::` (increment `missingTags`).
3. If model school ≠ local & local high & model confidence low → keep local (policy). Else accept model.

Outcome mapping:
| outcome | useDelta | fatigue? |
|---------|----------|----------|
| success | +1 | no |
| partial | +1 | maybe +1 fatigue (phase 2) |
| fail | +0 | +1 failuresInRow |
| ignored | +0 | none |

Effects tags (family):

- Temporary: `/\{!temp\}([\s\S]*?)\{\/temp\}/g`
- Permanent: `/\{!perm\}([\s\S]*?)\{\/perm\}/g`

Parsing notes:

- Extract and route to the Effects Story Card; strip tags from final narrative.
- Enforce a per-output cap to avoid flooding (suggest ≤12 total effects tags).

---

## 9. Leveling & Mastery Evolution

Threshold table:
`[0,10,30,60,100,150,210]`

On each counted use:

```
totalUses++;
usesSinceLevel++;
while totalUses >= thresholds[level]:
	level++;
	usesSinceLevel = 0;
	recent.unshift(`level_up_to_${level}`);
	evolveMasteryTokens();
```

Mastery evolution (placeholder path):
`basic_attunement` → `refined_focus` → `layered_perception` → `resonance_harmony` → `adaptive_synchronicity`

---

## 10. Event Tokens & Logging Rules

Token patterns:

- Base: `<intentToken>` e.g. `read_thoughts`
- Partial: `<intentToken>_partial`
- Fail: `fail_<intentToken>`
- Level up: `level_up_to_3`

Recent list policy:

- Newest first (`unshift`)—cap at 8 tokens.
- If overflow → drop last.

Optional failure streak token: add `resisted_pattern` once when failuresInRow ≥ 3.

### 10.1 Active Abilities, Passive Abilities and Effects

Simple combat maneuvers (e.g., hamstring, trip) don’t need to be added as explicit abilities—the model understands them narratively. When creating activated abilities, focus on unique shifter traits and mechanics. Because AI Dungeon is dynamic and intelligent, we aren’t limited to a preset list of traditional RPG abilities; emphasize distinctive mechanics and effects.

For passive traits, highlight things like enhanced senses or weave sense so the model doesn’t forget; these should be permanent effects unless they require conscious activation by the shifter.

Examples:

- Example A (good temporary effect): An activated ability with a temporary effect describing the shifter transforming into hybrid form. The shifter must consciously transform, so triggering an ability makes sense. It’s temporary; once the player reverts, the temporary effect can be removed.
- Example B (prefer permanent): An activated ability with a temporary effect describing speaking with wolves should be avoided. Inherent traits (e.g., the ability to speak with wolves) lack implied effort or a success/failure chance. Use a permanent effect to highlight this, keeping the trait in context so the model can incorporate it without relying on triggers.
- Example C (activated but no player-state effect): An activated ability to speak with wolves telepathically over great distances. This is a triggered ability with potential success/failure (no wolves nearby, interference). It should trigger a School outcome tag, but since it doesn’t place a direct effect on the player, it should not add anything to the Player Effects Story Card.
- Example D (permanent + temporary amplifier): A passive ability “enhanced healing” is permanent. If a transformation improves healing further, add a temporary effect to the Effects card highlighting this improvement.

### 10.2 Effects Logging (Permanent vs Temporary)

Intent

- Create logging mechanics and formatting to store/retrieve Effects. The Effects Story Card does not contain raw tag pairs; tags only appear in model output and are parsed into the card.

Model output tags (for extraction only)

- Permanent: {!perm}keen_hearing, night_vision, weave_sense_baseline{/perm}
- Temporary: {!temp}Hybrid wolf form manifests: claws, posture, sharpened senses{/temp}
- Temporary: {!temp}healing_boost_shifted{/temp}
- Regex (same as Section 8):
  - Temporary: /\{!temp\}([\s\S]\*?)\{\/temp\}/g
  - Permanent: /\{!perm\}([\s\S]\*?)\{\/perm\}/g

Storage format (Effects Story Card PList)

- Effects are persisted via a standard PList, not embedded tags:
  ```
  [Name: Player Effects; Permanent: keen_hearing, night_vision, weave_sense_baseline; Temporary: hybrid_form, minor_shift, healing_boost_shifted, sense_boost_shifted; Recent: T12 hybrid_form manifests, T11 minor_shift heightens scent]
  ```
- ID JSON may mirror summary fields as needed (no raw tag text).

Logging policy

- Deterministic effects (from School progression or guaranteed ability outcomes like transformations) are applied directly by the system to the Effects Story Card (PList) without relying on `{!perm}`/`{!temp}`. Parse and merge tags only when the model emits them.
- The sentinel ABILITY tag drives School usage/leveling; Effects tags are independent and only describe player state.
- Strip all effect tags from the final narrative before saving.
- Cap total extracted effect tags per output to ≤12.
- Normalize tokens to snake_case; collapse synonyms; trim whitespace.
- Permanent entries:
  - Set once; re-applying refreshes recency but does not duplicate.
  - weave_sense_baseline is always Permanent (never Temporary).
- Temporary entries:
  - Add normalized tokens and optionally a human-readable note to Recent (e.g., “T12 hybrid_form manifests”).
  - “Shifted” forms can raise risk; represent with frenzy_pull_up_shifted when applicable.
- De-duplication:
  - Permanent: set semantics (no duplicates).
  - Temporary: set semantics for tokens; Recent is chronological, capped (e.g., last 8).
- Lifecycle (Phase 1):
  - Temporary tokens persist until explicitly replaced/cleared by future outputs or by system logic; compression only trims Recent text.

Update procedure (Output hook)

1. Extract effect tags from model output.
2. Normalize and split into Permanent vs Temporary tokens/messages.
3. Update the Effects Story Card PList fields (dedupe, refresh recency).
4. Strip tags from narrative and save.
5. Respect cooldown/compression; compression trims Recent but must not invent/remove tokens.


---

## 12. Edge Cases & Policies

| Case                        | Policy                                                |
| --------------------------- | ----------------------------------------------------- |
| No tag & high confidence    | Synthesize success (debug counter).                   |
| No tag & med/low            | Ignore usage.                                         |
| Model picks unknown school  | Treat as ignored.                                     |
| Player edits level manually | Trust; recompute nextThreshold next cycle.            |
| Card deleted                | Recreate from in-memory state on next use.            |
| Card size near limit        | Trim older capabilities or reduce Recent length to 4. |
| Multiple tags               | Take last valid.                                      |
| Malformed tag               | Increment malformedTags; ignore.                      |

---

## 13. Implementation Steps (Incremental Plan)

Phase 1 (Core MVP):

1. Init `abilitySchools`, `pendingAbilityIntents`, `abilityStats` if absent.
2. Add `AbilitySchool` template (categories as defined) to database defaults.
3. Local classifier (keywords + patterns) producing confidence + intent token.
4. Input hook: push intent & queue School card if missing.
5. Context injection: HIGH vs MED/LOW blocks.
6. Output hook: parse tag (or synthesize), apply usage, level logic, update School card; additionally parse Effects tags and update the Effects Story Card (Permanent vs Temporary).

Phase 2 (Refinements): 7. Add partial/fail fatigue or failure streak logic. 8. Mastery evolution mapping. 9. Compression instruction customization.

Phase 3 (Diagnostics & UX): 10. Add debug Story Card summarizing `abilityStats`. 11. Add optional user command `/ms snapshot` listing levels.

Phase 4 (Advanced – Deferred): 12. Add adaptive thresholds or synergy events. 13. Add emergent school discovery.

---

## 14. Test Scenarios

| Test                             | Input                            | Expected                                                     |
| -------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| High confidence prototype        | "I sense a pattern in the flow." | Tag success, prototype_school +1 use, Recent updated         |
| Medium confidence classification | Ambiguous text                   | Model decides ignored or school; only counted if not ignored |
| Fail outcome                     | Model returns fail               | No level increment, failuresInRow++                          |
| Level up transition              | Cast enough to cross threshold   | level_up_to_X token added; mastery evolves                   |
| Missing tag (high)               | Intentionally strip tag in test  | Synthetic success + debug counter increment                  |
| Compression                      | Force cooldown 0                 | Summary added, Recent trimmed                                |

---

## 15. Future Extensions (Deferred)

| Feature                        | Rationale                              |
| ------------------------------ | -------------------------------------- |
| Fatigue penalties              | Encourage varied pacing.               |
| Cross-school synergy tokens    | Reward creative chaining.              |
| Adaptive difficulty heuristics | Outcome weighting & narrative tension. |
| Emergent school discovery      | Sandbox exploration.                   |
| Capability unlock tiers        | Display evolving capability tier list. |

---

## 16. Quick Reference Cheat Sheet

### Quick Reference Cheat Sheet

- ABILITY tag
  - Syntax: ::ABILITY|<school or ignored>|<intent_token>|<success|partial|fail|ignored>|confidence=<high|med|low>::
  - Example: ::ABILITY|prototype_school|sense_pattern|success|confidence=high::

- Recent ordering
  - Newest first; cap at 8 tokens.

- Level thresholds
  - 0, 10, 30, 60, 100, 150, 210

- Level-up token
  - level*up_to*<level> (e.g., level_up_to_3)

- Fail token
  - fail\_<intent_token> (e.g., fail_sense_pattern)

- Partial token
  - <intent_token>\_partial (e.g., sense_pattern_partial)

- Synthesize fallback
  - Only when local confidence=high and the tag is missing; synthesize success with confidence=high.

- Effects tags
  - Permanent: {!perm}comma-separated tokens{/perm}
    - Example: {!perm}keen_hearing, weave_sense_baseline{/perm}
  - Temporary: {!temp}short description or tokens{/temp}
    - Example: {!temp}Hybrid wolf form manifests: claws, posture, sharpened senses{/temp}
  - Notes: Parsed into the Effects Story Card and stripped from narrative; cap ≤12 per output.

| Term              | Meaning                                                     |
| ----------------- | ----------------------------------------------------------- |
| Confidence Bucket | Local certainty rating guiding prompt style.                |
| Intent Token      | Short canonical action descriptor.                          |
| Synthetic Tag     | Locally generated tag replacing a missing model tag.        |
| Failure Streak    | Counter for consecutive fails (may drive future mechanics). |
| Mastery Tokens    | Qualitative progress markers updated at level-ups.          |

---

_End of ACS School System Design._

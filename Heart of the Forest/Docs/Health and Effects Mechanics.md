# ACS Combat Mechanics – Approach 1 (Direct Narrative Event Logging)

> Purpose: Define the combat damage / injury / armor impact / healing / repair tracking model using minimal structured tags that wrap raw narrative. No numeric durability, no severity tiers – just chronological narrative facts.
> Scope: Player-centric physical consequences (injury), armor impact events, explicit healing and repair actions.

---

## Table of Contents

1. Design Goals & Principles
2. Event Domains & Tag Set
3. Story Cards & Data Surfaces
4. Lifecycle (Input → Context → Output)
5. Prompt Injection Strategy
6. Tag Grammar & Validation
7. Parsing & Logging Pipeline
8. Internal Data Structures
9. Injury Resolution Heuristics (Optional Layer)
10. Armor Damage Handling
11. Healing vs Repair Semantics
12. Compression Policy
13. Edge Cases & Fallbacks
14. Implementation Steps (Phase Plan)
15. Minimal Pseudocode Reference
16. Testing Matrix
17. Future Extensions
18. Glossary
19. Quick Reference Cheat Sheet

---

## 1. Design Goals & Principles

- Minimal Cognitive Load: Model wraps only the specific phrase describing an effect; rest of narration is untouched.
- Narrative Fidelity: Logged text is exactly what appeared (minus tag wrappers), preserving tone & detail.
- Order Preservation: Turn order defines precedence; newest events at the top of log sections.
- Stateless Interpretation: No permanent numeric counters; current "state" inferred from the most recent sequence of events.
- Low Drift Risk: Adds a self-contained parser; zero changes to existing MagicCards generation flow for characters/locations.
- Extensible: Future phases can add structured suffix tokens or attribute maps without breaking early logs.

---

## 2. Event Domains & Tag Set

| Domain           | Tag Wrapper Form            | Meaning                                                                                                                 |
| ---------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Injury           | `{!inj}...{/inj}`           | Player body harmed – any wound, break, burn, internal injury, impairment.                                               |
| Armor Damage     | `{!armordmg}...{/armordmg}` | Armor piece / protective gear visually or functionally impacted.                                                        |
| Healing          | `{!heal}...{/heal}`         | Direct treatment / recovery / stabilization of player injuries.                                                         |
| Repair           | `{!repair}...{/repair}`     | Physical repair / patch / restoration applied to armor or gear (NOT biological healing).                                |
| Permanent Effect | `{!perm}...{/perm}`         | Lasting non‑injury alteration of the character (curse, augmentation, lycanthropy latent state, demonic pact).           |
| Temporary Effect | `{!temp}...{/temp}`         | Transient non‑injury status / form / buff / debuff expected to end or fade (spell buff, active transformation episode). |

Notes:

**Additional Tag Usage Rules**

- Tags may appear 0–N times in one model output.
- No nesting; each tag encloses a concise 1–2 sentence micro‑narrative.
- Multiple distinct injuries in the same turn each get their own `{!inj}` block.

---

## 3. Story Cards & Data Surfaces

| Card Title                                   | Role                                             | Managed Fields                                                               |
| -------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Player Injuries                              | Chronological injury & healing narrative         | Entry: summary PList; Description: raw log lines                             |
| Player Effects                               | Permanent & temporary non‑injury status tracking | Entry: summary PList (Permanent, Temporary, Recent); Description: raw lines  |
| Equipped Armor (or specific armor item card) | Armor impact & repairs                           | Entry augmented with Recent_Damage / Recent_Repairs; Description: full lines |
| (Future) Shields                             | (Deferred) similar pattern later                 | -                                                                            |

### 3.1 Player Injuries Entry (PList Style)

```text
[Name: Player Injuries; Active: splintered_wrist, bruised_ribs; Recent: T42 fall splintered wrist, T41 ogre club bruised ribs; Resolved: twisted_ankle]
```

Description (raw log lines newest first):

```
T42 INJ | A hard tumble on uneven stone splinters bone in your wrist.
T42 HEAL | You bind the wrist with strips of linen and a whispered mending charm.
T41 INJ | An ogre’s heavy club slams your side, bruising several ribs.
T38 INJ | A misstep on a root twists your ankle sharply.
T39 HEAL | A cooling salve and tight wrap ease the twisted ankle.
```

### 3.2 Armor Card Augmentation

Entry categories appended if not present:

```text
[Name: Runed Dragonscale Hauberk; Recent_Damage: T45 breastplate scorched; Recent_Repairs: T46 runes re-etched]
```

Description additions:

```
T45 ARMORDMG | A lance of searing witchfire scorches the dragonscale breastplate, dulling etched sigils.
T46 REPAIR | You scrape the char, oil the scales, and carefully re-etch the faded runes to restore their gleam.
```

### 3.3 Player Effects Card

PList style entry example:

```text
[Name: Player Effects; Permanent: darkvision, wolfblood_ancestry; Temporary: stone_skin, battle_trance; Recent: T52 stone skin hardens flesh, T51 battle trance heightens focus]
```

Description (raw log lines newest first):

```
T52 TEMP | Stone skin hardens flesh into a granular shell.
T51 TEMP | A battle trance heightens focus and dulls pain.
T48 PERM | A faint lunar pulse brands your blood with latent lycanthropy.
```

Rules:

- Permanent effects accumulate and rarely disappear they describe traits, passive abilities or effects that are either truly permanent or require school progression or dedicated story events to alter/remove. Permanent effects may interact with temporary effects (eg. A shifter has permanent enhanced hearing that is temporarily enhanced further by a transformation)
- Temporary effects remain Active until explicitly ended (future explicit end tag) or implicitly replaced/expired; for Phase 1 we only log starts.
- Re‑applying the same temporary effect refreshes its recency rather than duplicating the entry (token match heuristic).

#### Abilities vs Effects (School Integration)

- Don’t add basic combat maneuvers (e.g., trip, hamstring) as explicit abilities. The model handles them narratively without School hooks.
- Activated abilities should focus on unique shifter traits and distinctive mechanics; use School outcome tags to resolve success/partial/fail.
- Passive traits you want the model to remember (e.g., enhanced senses, weave sense) should be logged as Permanent effects unless they require conscious activation.

Examples (summarized):

- Example A — Good temporary effect: Hybrid transformation is an activated ability and logs a Temporary effect while the form persists.
- Example B — Prefer permanent: Speaking with wolves as an inherent trait should be a Permanent effect, not an activated temp.
- Example C — Activated with no player-state effect: Long‑distance telepathic speech may trigger a School outcome tag but does not add anything to the Player Effects card.
- Example D — Permanent + temporary amplifier: “Enhanced healing” as Permanent; if a form boosts it, add a Temporary effect (e.g., healing_boost_shifted) during that form.

See also: `Docs/ACS School System.md` (Section 10.1–10.2) for School tagging and Effects logging coordination.

---

## 4. Lifecycle (Input → Context → Output)

1. Input Hook: No blocking needed; optional passive detection to decide whether to _emphasize_ tagging in context (e.g., spotted attack verbs).
2. Context Hook: Inject concise instruction reminding model about tag responsibilities (only when combat/adversity cues present OR every N turns while any active injuries exist).
3. Output Hook:
   - Extract tags in deterministic order.
   - Strip them from returned text (replace with inner narrative).
   - Emit events to in-memory arrays.
   - Rebuild Story Cards (entries + appended description lines).
   - Apply compression if due (see §12).

---

## 5. Prompt Injection Strategy

Provide a lightweight block (insert only if the last turn had potential combat verbs OR active injuries > 0):

```text
SYSTEM (Combat Event Logging Protocol)
If the player sustains a new physical injury: wrap only the injury phrase with {!inj}...{/inj}.
If worn armor is visibly or functionally damaged: wrap only that armor effect in {!armordmg}...{/armordmg}.
If the player treats/stabilizes an injury: wrap that act in {!heal}...{/heal}.
If the player repairs or patches armor/equipment: wrap that in {!repair}...{/repair}.
If the player gains a lasting non-injury alteration (curse, innate augmentation, enduring transformation baseline): wrap that phrase in {!perm}...{/perm}.
If the player gains a temporary status, form, buff, or debuff expected to fade: wrap that phrase in {!temp}...{/temp}.
Do not nest tags. Keep each tag ≤ 2 sentences. Emit no tags if no such events occur.
END
```

Escalation rule: If 3 consecutive turns pass without any tag but active injuries remain → re-inject reminder.

---

## 6. Tag Grammar & Validation

Regex family (global, case-insensitive):

- Injury: `/\{!inj\}([\s\S]*?)\{\/inj\}/gi`
- Armor: `/\{!armordmg\}([\s\S]*?)\{\/armordmg\}/gi`
- Heal: `/\{!heal\}([\s\S]*?)\{\/heal\}/gi`
- Repair: `/\{!repair\}([\s\S]*?)\{\/repair\}/gi`
- Permanent Effect: `/\{!perm\}([\s\S]*?)\{\/perm\}/gi`
- Temporary Effect: `/\{!temp\}([\s\S]*?)\{\/temp\}/gi`

Validation Rules:

- Reject empty inner text (skip logging).
- Collapse internal multiple spaces → single.
- Trim leading/trailing punctuation if tag encloses only punctuation.
- Hard cap: ignore >12 tags in one output to avoid spam (log warning to debug card).

---

## 7. Parsing & Logging Pipeline

Order of operations in output hook:

1. Collect all matches; store as array `{ kind, raw, turn }`.
2. Clean output text by replacing each full match with inner content (preserving narrative flow).
3. Route events:
   - `inj` → `injuryEvents` handler
   - `heal` → `healingEvents` handler
   - `armordmg` → `armorEvents` handler
   - `repair` → `repairEvents` handler

- `perm` → `permanentEffectEvents` handler
- `temp` → `temporaryEffectEvents` handler (dedupe/refresh behavior)

4. Update Story Cards.
5. Persist state snapshot (`state.MagicCards.combatLog` object).

---

## 8. Internal Data Structures

```js
state.MagicCards.combatLog = state.MagicCards.combatLog || {
  injuries: [], // [{ turn, text, resolved:false }]
  armor: [], // [{ turn, text, repaired:false }]
  repairs: [], // [{ turn, text, targetsHint:null }]
  heals: [], // [{ turn, text, targetsHint:null }]
  lastPromptTurn: 0 // last turn prompt reminder inserted
};

state.MagicCards.effectsLog = state.MagicCards.effectsLog || {
  permanent: [], // [{ turn, text }]
  temporary: [], // [{ turn, text, ended:false }]
  lastPromptTurn: 0 // last turn prompt reminder for effects (may unify later)
};
```

Derived (not persisted separately):

- Active injuries = injuries.filter(i => !i.resolved)
- Recent damage lines = latest N armor entries
- Active permanent effects = all `effectsLog.permanent`
- Active temporary effects = effectsLog.temporary.filter(t => !t.ended)

---

## 9. Injury Resolution Heuristics (Optional)

Automatic resolution is _not required_ but can assist clarity:

- When a `{!heal}` event text shares ≥ 1 body-part token (simple list: wrist, arm, leg, ribs, chest, head, shoulder, ankle, hand, foot, knee, back, eye) with an unresolved injury line → mark the latest unresolved matching injury as `resolved=true`.
- If heal text contains word `all` + `injuries` → mark all unresolved as resolved.
- Ambiguous heal with no match → still logged but does not resolve.

All heuristics must be conservative: never delete; only flag `resolved`.

---

## 10. Armor Damage Handling

- Every `armordmg` event appended to `armor` array.
- A subsequent `{!repair}` event attempts to match by shared noun tokens (`chest`, `pauldron`, `plate`, `visor`, `joint`, etc.). If matched, set `repaired=true` on the most recent unrepaired damage affecting that token.
- The Armor Story Card entry’s `Recent_Damage` lists the last 5 unrepaired damage summaries (truncate oldest unrepaired beyond 20 stored total).
- Repairs optionally surface under `Recent_Repairs` (last 3).

---

## 11. Healing vs Repair Semantics

| Aspect          | Heal                                | Repair                                    |
| --------------- | ----------------------------------- | ----------------------------------------- |
| Targets         | Biological injury                   | Armor / equipment surface                 |
| Resolution Flag | `injuries[].resolved`               | `armor[].repaired`                        |
| Side Effects    | May reduce context prompt frequency | May remove item from `Recent_Damage` list |

---

## 12. Compression Policy

Triggered by MagicCards compression cooldown:

1. Injuries: Keep all unresolved plus the latest 6 resolved; emit a summarized category:
   `Summary: 2 active (wrist fracture, rib bruise); 5 resolved.`
2. Armor: Keep unrepaired + last 4 repaired events.
3. Drop orphaned repair entries that never matched after 30 turns (stale).
4. Never alter raw description logs—only prune via capped arrays before rewriting entry.

---

## 13. Edge Cases & Fallbacks

| Case                                 | Handling                                       |
| ------------------------------------ | ---------------------------------------------- |
| Malformed tag (missing end)          | Ignore; leave text untouched.                  |
| Nested tags                          | Outer recognized; inner text treated literal.  |
| Excessive tags (>12)                 | Log first 12, discard rest.                    |
| Duplicate identical injury same turn | Collapse to one (compare normalized text).     |
| Heal with no prior injuries          | Log anyway; no resolution.                     |
| Repair with no prior damage          | Log; no effect.                                |
| Duplicate permanent effect           | Merge / ignore (token match) refresh timestamp |
| Duplicate temporary effect same name | Refresh recency; do not duplicate line         |
| Excess permanent effects beyond cap  | Trim oldest with warning (retain semantic)     |

---

## 14. Implementation Steps (Phase Plan)

### Phase 1

- Add state container (`combatLog`).
- Implement output parser & tag stripping.
- Story Card creation (Player Injuries if missing).
- Append raw lines; build minimal PList entry (Active/Recent only).

### Phase 2

- Armor integration: modify armor card update function to append damage/repair logs.
- Add resolution heuristics (healing + repair matching).
- Add reminder prompt injection logic.
- Add Player Effects card (permanent & temporary) with logging of `{!perm}` & `{!temp}` tags.

### Phase 3

- Compression integration specialized logic.
- Fallback passive detection (if zero tags over X turns but strong injury keywords appear).
- Effects compression: cap permanent (e.g., 24) & keep active temporary + last 5 ended when end tags later introduced.

### Phase 4 (Optional)

- Export / debug card with counts.
- Add API for other modules (e.g., magic shields, temporary and permanent effects) to push synthetic damage/repair events.

---

## 15. Minimal Pseudocode Reference

```js
function parseCombatTags(rawText) {
  const specs = [
    { kind: 'inj', re: /\{!inj\}([\s\S]*?)\{\/inj\}/gi },
    { kind: 'armordmg', re: /\{!armordmg\}([\s\S]*?)\{\/armordmg\}/gi },
    { kind: 'heal', re: /\{!heal\}([\s\S]*?)\{\/heal\}/gi },
    { kind: 'repair', re: /\{!repair\}([\s\S]*?)\{\/repair\}/gi },
    { kind: 'perm', re: /\{!perm\}([\s\S]*?)\{\/perm\}/gi },
    { kind: 'temp', re: /\{!temp\}([\s\S]*?)\{\/temp\}/gi }
  ];
  const events = [];
  let cleaned = rawText;
  specs.forEach(({ kind, re }) => {
    re.lastIndex = 0;
    let m;
    let count = 0;
    while ((m = re.exec(rawText)) && count < 50) {
      const inner = (m[1] || '').trim();
      if (inner) events.push({ kind, text: inner });
      count++; // guard runaway
    }
    cleaned = cleaned.replace(re, (_full, inner) => (inner || '').trim());
  });
  return { cleaned, events };
}

function logEvents(events, turn) {
  const log = state.MagicCards.combatLog;
  const effects = state.MagicCards.effectsLog;
  events.forEach((ev) => {
    if (ev.kind === 'inj') log.injuries.unshift({ turn, text: ev.text, resolved: false });
    else if (ev.kind === 'armordmg') log.armor.unshift({ turn, text: ev.text, repaired: false });
    else if (ev.kind === 'heal') log.heals.unshift({ turn, text: ev.text });
    else if (ev.kind === 'repair') log.repairs.unshift({ turn, text: ev.text });
    else if (ev.kind === 'perm') {
      // Dedupe by token signature
      const sig = tokenize(ev.text);
      if (!effects.permanent.some((p) => tokenize(p.text) === sig)) {
        effects.permanent.unshift({ turn, text: ev.text });
      }
    } else if (ev.kind === 'temp') {
      const sig = tokenize(ev.text);
      const existing = effects.temporary.find((t) => tokenize(t.text) === sig && !t.ended);
      if (existing) existing.turn = turn;
      else effects.temporary.unshift({ turn, text: ev.text, ended: false });
    }
  });
}

function resolveHeals() {
  const log = state.MagicCards.combatLog;
  const parts = [
    'wrist',
    'arm',
    'leg',
    'ribs',
    'chest',
    'shoulder',
    'ankle',
    'hand',
    'foot',
    'knee',
    'head',
    'back',
    'eye'
  ];
  log.heals.forEach((h) => {
    const hits = parts.filter((p) => new RegExp(`\\b${p}\\b`, 'i').test(h.text));
    hits.forEach((p) => {
      const tgt = log.injuries.find(
        (i) => !i.resolved && new RegExp(`\\b${p}\\b`, 'i').test(i.text)
      );
      if (tgt) tgt.resolved = true;
    });
  });
}

function updatePlayerInjuryCard() {
  createIfNoInjurySC();
  const sc = storyCards.find((sc) => sc.title === 'Player Injuries');
  const log = state.MagicCards.combatLog;
  const active = log.injuries.filter((i) => !i.resolved).slice(0, 8);
  const recent = log.injuries.slice(0, 6);
  const resolvedCount = log.injuries.filter((i) => i.resolved).length;
  sc.entry = `[Name: Player Injuries; Active: ${active.map((i) => tokenize(i.text)).join(', ')}; Recent: ${recent.map((i) => `T${i.turn} ${shorten(i.text)}`).join(', ')}; Resolved_Count: ${resolvedCount}]`;
  // Prepend new raw lines (avoid duplicates)
  // Example raw line format
}
```

Helper suggestions:

```js
function tokenize(txt) {
  return txt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 2)
    .join('_');
}
function shorten(txt) {
  return txt.replace(/\s+/g, ' ').slice(0, 40);
}
```

---

## 16. Testing Matrix

| Test                    | Steps                                                   | Expected                                                       |
| ----------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| Single Injury           | Output contains `{!inj}...{/inj}`                       | Card logs line; Active lists token                             |
| Multiple Injuries       | Two injury tags same turn                               | Two log lines (order preserved)                                |
| Injury + Heal Same Turn | `{!inj}` then `{!heal}`                                 | Both logged; healing resolves that injury if body part overlap |
| Armor Damage            | `{!armordmg}` present                                   | Added to armor card; Recent_Damage lists new token             |
| Repair                  | Damage one turn then `{!repair}` next                   | Last unrepaired damage flagged repaired                        |
| Heal Generic            | Heal tag without identifiable body part                 | Logged; no resolution                                          |
| Tag Stripping           | Output text returned to player has no `{!...}` wrappers | Clean narrative                                                |
| Compression             | Force cooldown; many old resolved                       | Entry keeps unresolved + recent summary                        |
| Spam Guard              | 20 injury tags injected                                 | Only first 12 stored (warn)                                    |
| Permanent Effect        | Output contains `{!perm}...{/perm}`                     | Player Effects card Permanent list updated                     |
| Temporary Effect        | Output contains `{!temp}...{/temp}`                     | Player Effects card Temporary list updated                     |
| Temp Reapply            | Same `{!temp}` phrase two turns                         | Single temporary entry turn refreshed                          |
| Mixed Effects + Inj     | Combo of injury + perm + temp                           | All routed to correct cards                                    |

---

## 17. Future Extensions

- Add optional severity suffix tags later (`{!inj:major}`) without breaking older entries.
- Introduce `shielddmg` tag when shield system added.
- Provide export function to generate a structured medical report.
- Integrate with magic healing vs mundane healing separation (second tag type or attribute).
- Optional diff-based context summarizer to surface only changed active injuries each turn.

---

## 18. Glossary

| Term               | Definition                                                     |
| ------------------ | -------------------------------------------------------------- |
| Active Injury      | Unresolved injury entry (no healing resolution)                |
| Resolved           | Injury that has been matched by a subsequent healing event     |
| Armor Damage Entry | Logged narrative describing physical effect on armor           |
| Repair Event       | Logged narrative describing a fix that resolves a damage entry |
| Tokenize           | Simple textual hashing to produce compact key form             |
| Permanent Effect   | Lasting non‑injury alteration tracked until manually cleared   |
| Temporary Effect   | Transient non‑injury status expected to end or fade            |

---

## 19. Quick Reference Cheat Sheet

| Want to Log      | Have Model Do                                     |
| ---------------- | ------------------------------------------------- |
| New wound        | Wrap ONLY wound phrase in `{!inj}...{/inj}`       |
| Armor impact     | Wrap effect phrase in `{!armordmg}...{/armordmg}` |
| Treat wound      | Wrap treatment phrase in `{!heal}...{/heal}`      |
| Fix armor        | Wrap repair phrase in `{!repair}...{/repair}`     |
| Permanent effect | Wrap lasting alteration in `{!perm}...{/perm}`    |
| Temporary effect | Wrap transient status in `{!temp}...{/temp}`      |
| Nothing happened | Emit no tags                                      |

Implementation start order: parser → state → Player Injuries card → armor integration → heuristics → compression.

---

End of ACS Combat Mechanics (Approach 1) Design

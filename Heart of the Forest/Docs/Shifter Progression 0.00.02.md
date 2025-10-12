# Shifter Progression — Weretouched (Wolf) Path

Purpose: Provide a concise, system-ready progression outline for a unique Shifter class (Weretouched, Wolf lineage) that we can later plug into the ACS School System as an Ability School. We are not copying Pathfinder; this is our own design based on the Wolfblood lore. All active abilities are phrased so they can be triggered as Ability School intents (via ABILITY tags), and long/short form changes use the Effects Story Card conventions.

Scope sources: Inspired by `Docs/shifter.md` (wolf aspect and Kinsoul archetype), expressed in qualitative terms and ACS-friendly tokens. No numeric HP/bonuses; use narrative descriptors and tags.

---

## School Identity

- School Name: Shifter — WolfBlood
- School ID: `shifter_wolf`
- Short Lore: Blood and spirit resonate with the hunt. The Wolfblood shifter is bound to the Great Wolf, an Old One whose breath rides the wind. They slip between human, wolf, and a fearsome hybrid guise, read the world on the wind like a map, and sense magic on the air — following threads of the natural weave to stalk and outmaneuver prey with pack-born precision.

### Spirit Bond and Weave

- Spirit Bond: A vow-bond to the Great Wolf awakens the wolfblood. The bond deepens over time, leaving subtle traits even in human guise (wolf eyes in low light, a pricked ear for danger, a nose for lies and fear-sweat).
- Long-lived: Wolfblood shifters do not age in mortal spans; time flows differently around their spirit.
- Weave Sense: Magic smells like ozone and cold iron. With practice, the shifter can sense casting, read faint ward-lines, and (at high mastery) gently worry or part a thread without shattering it.
- Natural Resistances (narrative): Resistance to charms, curses, and most mortal magics builds with mastery. Wolfblood are immune to known poisons and diseases, and their wounds knit swiftly (minutes for minor, hours to days for grave) — all expressed narratively, not numerically.

### Core Themes

- Transformation by will (minor, hybrid, wolf, and dire-wolf forms)
- Heightened senses (scent-led tracking, enhanced hearing, night vision)
- Pack tactics (flanking, rallying howls, coordinated chases)
- Wolfblood resilience (resistant to mundane harm, enhanced healing)
- Spirit bond & weave awareness (smell magic, read ward-lines; later: gentle thread manipulation)
- Self-mastery vs Blood Frenzy (anchor will, call the pack to steady the mind)

---

## Tags & Cards Integration

- Active abilities are invoked with ABILITY tags (see ACS School System):
  - Example: `::ABILITY|shifter_wolf|assume_hybrid|success|confidence=high::`

- Deterministic effects (system applies directly, no tags):
  - Permanent from progression: on tier unlocks, the system writes Permanent tokens directly to the Effects Story Card PList (e.g., `keen_hearing, keen_smell, night_vision, weave_sense_baseline, accelerated_healing_low`, later `moon_marked_resilience`, immunities) without using `{!perm}` tags.
  - Temporary from guaranteed outcomes: on successful transformations (`assume_minor`, `assume_hybrid`, `assume_wolf`, `assume_dire_wolf`), the system writes Temporary tokens directly (e.g., `minor_shift`, `hybrid_form`, `wolf_form`, `dire_wolf_form`) and their amplifiers (e.g., `healing_boost_shifted`, `sense_boost_shifted`) without using `{!temp}` tags.
  - Clarification (weave sense): Treat magic-sense as a permanent passive (`weave_sense_baseline`) set by the system at awakening/progression. Do not create a temporary weave-focus effect. If a shift heightens perception, apply `sense_boost_shifted` as a Temporary amplifier via the system.

- Model-detected effects (tags):
  - When the model emits `{!perm}...{/perm}` or `{!temp}...{/temp}` (to be prompted dynamically later), those tags are parsed and merged into the Effects Story Card. Otherwise, rely on direct system application for deterministic cases above.

- Do not duplicate narrative: ABILITY tags drive action outcomes; Effects state is maintained by the system (or parsed from model tags) and stored in the Effects card.

---

## Classifier Hints (for later School wiring)

- Keywords: `scent`, `howl`, `snarl`, `pack`, `prey`, `trail`, `hybrid`, `shift`, `claws`, `bite`, `trip`, `lunar`, `moon`, `pounce`, `stalk`, `ozone`, `ward`, `weave`, `frenzy`
- Example Intent Patterns → Intent Tokens:
  - “shift to hybrid” → `assume_hybrid`
  - “assume wolf form” / “become a wolf” → `assume_wolf`
  - “assume dire wolf” / “become a dire wolf” → `assume_dire_wolf`
  - “draw on minor aspect” / “let the senses sharpen” → `assume_minor`
  - “follow the scent/trail” → `scent_track`
  - “bite to trip” / “hamstring and topple” → `trip_takedown`
  - “rally the pack with a howl” → `howl_rally`
  - “harry the fleeing enemy” → `relentless_pursuit`
  - “impose dominance/stare down foe” → `alpha_presence`
  - “smell ozone” / “sense the spell” → `weave_sense`
  - “unpick the ward/thread” / “ease a thread aside” → `weave_unravel`
  - “steady your breath” / “hold back the blood” → `anchor_will`

---

## Mastery Track (Qualitative Tiers)

Thresholds: Use the ACS School System defaults for level thresholds (0,10,30,60,100,150,210) unless we tune later. Each tier unlocks capabilities and refines reliability.

| Tier | Title                | Mastery Tokens (add to School card)             | Narrative Capability (qualitative)                                                          |
| ---- | -------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1    | New Blood            | `awakened_wolfblood`, `first_signs`             | Wolfblood awakens; instincts stir; minor sensory edge and faint weave awareness.            |
| 2    | Initiate of the Hunt | `keen_nose`, `quick_shift`                      | Brief minor shifts; short bursts of heightened senses; first true scent-led reads.          |
| 3    | Pack Stalker         | `trail_reader`, `pack_sync`                     | Reliable tracking over hours-old trails; movement sync with allies; better pursuit angles.  |
| 4    | Hybrid Adept         | `battle_form`, `controlled_rage`                | Hybrid form on demand; steadier mind under pressure; first tools to resist frenzy.          |
| 5    | Moon‑Bound           | `moon_marked`, `weave_nose`, `howl_command`     | Mundane blows often glance; howls steady allies; sense simple wards and fresh spellwork.    |
| 6    | Dire Aspect          | `dire_stride`, `prime_takedown`                 | Swift, tireless pursuit; authoritative trip/takedown sequences; weave-sense grows reliable. |
| 7    | Alpha                | `apex_presence`, `perfect_scent`, `totem_focus` | Presence commands lesser beasts; read complex scent stories; focus quells blood surges.     |
| 8    | Totemic Hunter       | `form_fluidity`, `lunar_harmony`                | Effortless shifting among forms; ride lunar tones for poise and readiness.                  |
| 9    | Spirit Warden        | `thread_walker`, `pack_anchor`                  | Gently part simple wards; allies’ presence steadies you; frenzy rarely gains purchase.      |
| 10   | Paragon of the Wolf  | `elder_instincts`, `moon_harmony`               | Seamless form-changes; instinct leads the hunt; weave-sense and control feel second nature. |

Policy: Mastery tokens are descriptive only. No numeric stat bumps; outcomes flow from model narration and tokens present.

Permanent scaling policy:

- Positive passives intensify with progression (e.g., accelerated_healing_low → medium → high → greater → legendary; weave_sense_baseline becomes clearer and broader).
- Permanent risks (e.g., blood_frenzy_risk) diminish with progression (greater → high → medium → low), but can still spike situationally.
- Shifted forms temporarily amplify both: healing and senses increase while transformed; blood frenzy risk can rise during intense combat, while transformed or in emotional or stressful situations.
  Recommended tier mapping (narrative guidance):

- Shifted risk rule (apply on top of baseline): minor shift raises blood_frenzy_risk by +1 step; hybrid/wolf/dire-wolf raise by +2 steps. In intense combat while shifted, consider `{!temp}frenzy_pull_up_shifted{/temp}`.
- Tier 1 (New Blood): accelerated_healing_low; blood_frenzy_risk=greater. Instincts loud; hybrid/wolf will often tip without quick stabilization.
- Tier 2 (Initiate): accelerated_healing_low; blood_frenzy_risk=high. Minor shifts may edge toward greater; hybrid spikes common unless anchored.
- Tier 3 (Pack Stalker): accelerated_healing_low; blood_frenzy_risk=high. Pack rhythm helps; risk stabilizes in travel and hunts.
- Tier 4 (Hybrid Adept): accelerated_healing_med; blood_frenzy_risk=high → medium with `anchor_will`. Shifted: minor +1; hybrid/wolf +2; `anchor_will` can cap at high.
- Tier 5 (Moon‑Bound): accelerated_healing_med; weave_sense clarifies; blood_frenzy_risk=medium. Shifted spikes manageable with `anchor_will`/`pack_anchor`.
- Tier 6 (Dire Aspect): accelerated_healing_med → high; blood_frenzy_risk=medium → low during travel; combat spikes still possible.
- Tier 7 (Alpha): accelerated_healing_high; blood_frenzy_risk=low. Presence and focus suppress most triggers.
- Tier 8 (Totemic Hunter): accelerated_healing_high; blood_frenzy_risk=low. Form transitions seldom disturb poise.
- Tier 9 (Spirit Warden): accelerated_healing_high; blood_frenzy_risk=very low. Pack_anchor steadies allies and self.
- Tier 10 (Paragon of the Wolf): accelerated_healing_high+; blood_frenzy_risk=minimal except in extreme, story-driven moments.

---

## Capabilities by Tier (Unlocks)

Keep a single School Card with categories like: `[Name: Shifter — Wolf; School: Shifter; Capabilities: ...; Risks: ...; Mastery: ...; Recent: ...]`. Use the Effects card for ongoing states.

1. New Blood

- Active (Ability School intents): `assume_minor`, `assume_wolf`
- Passive: First signs of the bond; heightened sense of smell (reading scent on the wind and spoor); faint weave awareness.
- Effects application (system):
  - Permanent += `keen_hearing, keen_smell, night_vision, weave_sense_baseline, accelerated_healing_low` (set on awakening/progression)
  - On `assume_minor` success → Temporary += `minor_shift`
  - On `assume_wolf` success → Temporary += `wolf_form`

2. Initiate of the Hunt

- Active (Ability School intents): `assume_minor`, `scent_track`
- Passive: Basic instinct for scent on the wind and spoor, and pack lines of approach.
- Effects application (system):
  - On `assume_minor` success → Temporary += `minor_shift`
  - Permanent (senses) continue via `keen_hearing/keen_smell` already set; narration may surface improvements.

3. Pack Stalker

- Active: `howl_rally` (flavor: steady nerves, sharpen focus), `relentless_pursuit`
- Passive: Better pathing over rough terrain; teamwork reads.
- Effects:
  - `{!temp}Pack rhythm syncs your footing and breath with nearby allies{/temp}`
  - `{!temp}Trail reading: maintain a pursuit on hours-old spoor even across mixed ground{/temp}`

4. Hybrid Adept

- Active: `assume_hybrid`, `trip_takedown`
- Stabilizers: `anchor_will` (briefly steady mind; resist the pull when blood is hot)
- Hybrid is gear-compatible (narratively): equipment doesn’t vanish; you fight with tooth and tool.
- Effects application (system):
  - On `assume_hybrid` success → Temporary += `hybrid_form`
  - While in `hybrid_form` → Temporary += `healing_boost_shifted`
  - Stabilization is narrative-first via `anchor_will`; no automatic Temporary effect required.

5. Moon‑Bound

- Active: `alpha_presence` (glare, posture, aura), `howl_rally` gains edge against fear and panic scenes.
- Permanent boon (weretouched flavor):
  - Permanent += `moon_marked_resilience`
  - Permanent += `immune_to_mortal_poisons`, `immune_to_diseases`
  - Permanent += `accelerated_healing_med`
  - No Effects tag for weave-sense clarity at this tier; it’s covered by the permanent `weave_sense_baseline` (narrate as needed).

6. Dire Aspect

- Active: `assume_dire_wolf` (dire wolf form), `prime_takedown`
- Effects application (system):
  - On `assume_dire_wolf` success → Temporary += `dire_wolf_form`
  - Optional amplifier while transformed → Temporary += `sense_boost_shifted`
  - While transformed → Temporary += `healing_boost_shifted`

7. Alpha

- Active: `apex_presence` (stare-down, compel retreat, or force hesitation), `perfect_scent` (read layered trails, time-gaps, masking agents)
- Passive: Instinctive pack choreography in chaotic scenes.
- Stabilizers: `anchor_will` becomes dependable; `pack_anchor` (let an ally’s presence steady you) emerges.
- Effects:
  - `{!temp}Your totem focus steadies the rushing heart; the frenzy ebbs before it crests{/temp}`
  - `{!perm}accelerated_healing_high{/perm}`

8. Totemic Hunter

- Active: `form_fluidity` (rapid transitions minor ↔ hybrid ↔ wolf ↔ dire-wolf as narrative allows), `lunar_harmony` (ride crescents and full moons for tone and readiness)
- Advanced Weavework: `weave_unravel` (gently part a simple ward or thread when story pacing allows; never brute-force)
- Effects application (system):
  - On frequent transitions → Temporary may refresh `minor_shift`, `hybrid_form`, `wolf_form`, `dire_wolf_form` as appropriate.
  - No Effects entry for `weave_unravel` itself; it modifies the scene, not the player (use ABILITY tag only).

9. Spirit Warden

- Active: `weave_unravel` (refined), `alpha_presence` (supporting allies’ morale)
- Passive: Guardianship of paths and packs; wards are read and respected.
- Effects application (system):
  - No Effects entry for thread-walk; this action does not place a state on the player.
  - Temporary += `pack_anchor_steady` when narrative calls for it (optional; consider prompting the model to emit a temp tag instead).

10. Paragon of the Wolf

- Active: `form_fluidity` (mastery), `lunar_harmony` (resonant poise), `perfect_scent` (story-level reads)
- Passive: Elder instincts lead the hunt; control and awareness rarely falter.
- Effects:
  - `{!temp}Seamless shifting: change form without losing momentum or focus{/temp}`
  - `{!temp}Elder read: trace layered trails and subtle enchantments as if they were fresh{/temp}`

---

## Risks & Counters

- Risks (add to School card `Risks`): `moon_pull`, `pack_overreach`, `scent_overload`, `blood_frenzy`, `weave_dissonance`
  - Moon pull: Scenes tied to lunar omens may color behavior or compel shifts.
  - Pack overreach: Overcommitting to a chase can split the party or draw ambushes.
  - Scent overload: Noxious fumes or masking agents can dull or mislead.
  - Blood frenzy: Blood, threat, or injury may pull you toward reckless violence.
  - Weave dissonance: Forcing threads or meddling clumsily can backlash or entangle you.

Counters (intents or narrative techniques): `anchor_will`, `pack_anchor`, `totem_focus`, rest, ritual breath, grounding scents (pine, smoke).
Shifted-form amplifier (risk): `frenzy_pull_up_shifted` may apply during intense combat in hybrid/wolf/dire-wolf form; manage with stabilizers.

---

## ABILITY Intents (Canonical Tokens)

Use these tokens for the `intentToken` field when emitting ABILITY tags. Results will be logged in the School Card `Recent` list and drive mastery thresholds.

- `assume_minor` — Brief sensory shift. Often used to sniff, stalk, or ready a pounce.
- `assume_hybrid` — Combat-ready hybrid form that keeps gear usable.
- `assume_wolf` — Standard wolf shape for travel, hunt, or dominance posturing.
- `assume_dire_wolf` — Dire wolf shape for overwhelming presence, chase, or battle.
- `scent_track` — Follow spoor, blood, fear-sweat, disturbed ground; counter masking.
- `trip_takedown` — Hamstring, yank, and pin; set up allies.
- `howl_rally` — Bolster allies’ courage, steady breath, align timing.
- `relentless_pursuit` — Pressure a fleeing foe; leap obstacles, harry from flanks.
- `alpha_presence` — Project dominance; make prey falter or reconsider.
- `perfect_scent` — Read timelines and layers in overlapping trails.
- `form_fluidity` — Rapid transitions; maintain momentum through shape changes.
- `lunar_harmony` — Align with lunar themes for steadier control and clarity.
- `weave_sense` — Smell ozone; locate casters, fresh workings, and ward-lines.
- `weave_unravel` — Ease a simple thread or ward aside when the narrative permits.
- `anchor_will` — Ground yourself; resist blood frenzy and hold your shape.

Outcome mapping (ACS defaults): `success`, `partial`, `fail`, `ignored`.

Example (high confidence hybrid):

```
::ABILITY|shifter_wolf|assume_hybrid|success|confidence=high::
```

---

## Effects Logging (Story Card)

Policy

- Deterministic effects are applied directly by the system (no tags):
  - Permanent from progression → Effects.PList Permanent += canonical tokens (e.g., `keen_hearing, keen_smell, night_vision, weave_sense_baseline, accelerated_healing_*`, `moon_marked_resilience`, `immune_to_mortal_poisons`, `immune_to_diseases`).
  - On successful transformations → Effects.PList Temporary += `minor_shift`, `hybrid_form`, `wolf_form`, `dire_wolf_form` and applicable amplifiers (e.g., `healing_boost_shifted`, `sense_boost_shifted`).
- Model-detected effects use tags (to be prompted later):
  - When the model outputs `{!perm}...{/perm}` or `{!temp}...{/temp}`, parse and merge into Effects; otherwise, rely on direct application above.
- Do not create Effects entries for actions that don’t place a state on the player (e.g., `trip_takedown`, `weave_unravel`).

Shift amplifiers (temporary, while transformed)

- `healing_boost_shifted`, `sense_boost_shifted`, and situational `frenzy_pull_up_shifted` as narrative dictates.

Effects Card PList sketch:

```
[Name: Player Effects; Permanent: keen_hearing, keen_smell, night_vision, weave_sense_baseline, accelerated_healing_low, moon_marked_resilience; Temporary: hybrid_form, minor_shift, healing_boost_shifted; Recent: T12 hybrid_form manifests, T11 minor_shift heightens scent]
```

---

## Recent/Event Tokens (School Card)

Record short tokens in `Recent` (newest first, cap 8). Examples:

- `assume_hybrid`, `assume_wolf`, `assume_dire_wolf`, `assume_minor`, `scent_track`, `trip_takedown`
- `howl_rally`, `alpha_presence`, `relentless_pursuit`, `perfect_scent`
- `weave_sense`, `weave_unravel`, `anchor_will`
- Level ups: `level_up_to_2`, `level_up_to_3`, etc.
- Failure streak idea (optional): `resisted_blood_pull` once when multiple fails occur.

---

## Sample School Card (for later installation)

PList entry example (illustrative):

```
[Name: Shifter — Wolf; School: Shifter; Capabilities: assume_minor, assume_hybrid, assume_wolf, assume_dire_wolf, scent_track, trip_takedown, howl_rally, weave_sense, anchor_will; Risks: moon_pull, scent_overload, blood_frenzy; Mastery: keen_nose, quick_shift, battle_form; Recent: level_up_to_2, assume_hybrid, weave_sense]
```

Description lines (managed):

```
level: 2
totalUses: 13
nextThreshold: 30
autoHistory: true
cooldown: 6
```

ID JSON (string in StoryCard.id):

```
{"id":"shifter_wolf","abilitySchool":true,"autoHistory":true,"cooldown":6,"summary":"","level":2,"totalUses":13}
```

---

## Implementation Notes (when we wire it in later)

- School catalogue: Add `shifter_wolf` with keywords and intent patterns to the classifier.
- Defaults: Reuse ACS thresholds; add mastery tokens per tier at level-ups.
- Context blocks: For high-confidence intents (e.g., explicit “shift to hybrid”), use the HIGH block that skips reclassification.
- Output parsing: Keep existing ABILITY regex; add effects logging via `{!temp}` / `{!perm}` as the narrative describes shifts and boons.
- Compression: Allow School compression to summarize recent hunts, shifts, and mastery evolution.
- Blood Frenzy handling: Treat frenzy as a risky temporary state (Effects `{!temp}blood_frenzy{/temp}` if it occurs). Provide `anchor_will` and `pack_anchor` as narrative counters; do not hard-force outcomes.

---

## Example Turn Flows

1. Minor Shift to Scout

- Player: “I inhale slowly and let the wolf at the edge of me sharpen my senses.”
- Model (narrative): describes subtle changes; appends:
  - `::ABILITY|shifter_wolf|assume_minor|success|confidence=med::`
  - System: Effects Temporary += `minor_shift`

2. Hybrid Takedown

- Player: “I surge into a hybrid crouch and scythe the thug’s legs with a hooked bite.”
- Model appends:
  - `::ABILITY|shifter_wolf|assume_hybrid|success|confidence=high::`
  - `::ABILITY|shifter_wolf|trip_takedown|success|confidence=high::`
  - System: Effects Temporary += `hybrid_form`, `healing_boost_shifted`

3. Wolf Pursuit under the Moon

- Player: “I give in to the pull and run them down on four legs.”
- Model appends:
  - `::ABILITY|shifter_wolf|assume_wolf|partial|confidence=med::`
  - System: On success (when applicable) → Effects Temporary += `wolf_form`

4. Resist the Blood Pull

- Trigger: “The alley stinks of hot blood and fear; my jaw aches to close on something.”
- Model appends:
  - `::ABILITY|shifter_wolf|anchor_will|success|confidence=high::`
  - No automatic Temporary effect; treat as narrative stabilization unless a distinct player state is introduced.

5. Scent the Weave

- Player: “There’s magic in the air — I sniff for its trail.”
- Model appends:
  - `::ABILITY|shifter_wolf|weave_sense|success|confidence=med::`
  - No Effects tag (weave sense is a permanent passive via `weave_sense_baseline`).

---

## Notes

- All content here is paraphrased for our system and avoids numeric stat mapping; outcomes are narrative-first.
- We can generalize this scaffold to other animal lineages by swapping keywords, intents, and flavor tokens while preserving the same structure.

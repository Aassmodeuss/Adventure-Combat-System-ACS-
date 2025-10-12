# Nature Magic Style Guide (ACS — Greenwood)

Purpose: Provide a quick, practical reference so ability text, effects, and prompts remain consistent with Greenwood lore and the ACS School System for a Shifter using Nature magic.

---

## Core tenets from “The Heart of the Forest”

- Source: Nature magic draws from the Spirit of the Green, beyond the Weave. It follows nature’s cycles and instincts rather than scholarly formulae.
- Relationship to the Weave: Nature casters can sense and subtly disrupt or unweave Threads and Patterns, but they do not “cast” by weaving colored threads themselves.
- Perception: Practitioners of the Weave often see Nature magic as primitive; Nature magic users are instinct-led and attuned to land, beasts, and seasons.
- The Blight: A long-standing corruption not born of the Shattering (though spread by it). Early Blight can be purged with powerful magic or specialized remedies; fully entrenched Blight has no known cure. Fire purges corrupted matter.

Implication for wording: avoid arcane, color-coded thread language for Nature magic; use living, sensory, and seasonal motifs. If mentioning the Weave, describe sensing/unbinding, not weaving.

---


---

## Interactions and constraints

- Weave interactions: describe as sensing, unraveling, or dampening patterns (threads) rather than weaving/casting.
- Blight interactions: fire purges; early-stage corruption may be cleansed by powerful nature rites; once fully taken, there is no cure—respect narrative gravity.
- Shifter framing: the Shifter’s spirit bond (Great Wolf) is a Nature path. Progress feels feral early, more controlled with mastery.

---

## ACS alignment: ABILITY tag and effects policy

- ABILITY sentinel (for the model): ::ABILITY|school|intent|outcome|confidence=...::
- Deterministic effects: for known, system-defined states (e.g., form shifts, stable boons), the system writes effects directly to the Effects card; don’t rely on the model to tag them.
- Model-detected effects: parse and log {!temp}/{!perm} only when the model emits them.
- Scene-only actions: don’t create effects entries; let the narrative carry them unless an explicit, durable state is required by design.

---

## Ability description template (Nature + Shifter)

- Name: short, evocative (e.g., “Hybrid Shift”, “Scent Track”).
- School/Intent: school=shifter_wolf, intent one of the canonical tokens.
- Narrative cue (1–2 sentences): concrete, sensory; show the action.
- Weave/Nature note (optional): if relevant, mention sensing/dampening threads without color-coding.
- Deterministic effects (system-applied when appropriate):
  - Permanent: only for enduring boons mastered over time.
  - Temporary: for active forms or time-bound states; system adds to Effects card.
- Risks (optional): tie to Nature/Shifter risks (e.g., moon_pull, scent_overload).
- Tag (for the model): end with one ABILITY tag.

Example tag: ::ABILITY|shifter_wolf|assume_hybrid|success|confidence=high::

---

## Examples (ready-to-use patterns)

1. Hybrid Shift (assume_hybrid)

- Narrative: Bones flex and settle; fur ghosts along forearms. Ears tilt, catching distant wingbeats. Your scent-world blooms—loam, sap, a fresh trail.
- Weave/Nature: The forest’s pulse rises to meet yours; threads in nearby charms feel thin and brittle.
- System effects (deterministic): Temporary += hybrid_form(manifest: claws, posture, keen_scent).
- Tag: ::ABILITY|shifter_wolf|assume_hybrid|success|confidence=high::

2. Scent Track (scent_track)

- Narrative: You breathe deep and low. The spoor unwinds—smoke, sweat, iron—braiding through the understory toward the ravine.
- Weave/Nature: No spellwork needed; trail-sense rides the forest’s breath.
- System effects: none (scene action; no durable state).
- Tag: ::ABILITY|shifter_wolf|scent_track|success|confidence=med::

3. Howl Rally (howl_rally)

- Narrative: Your howl climbs the trunks and carries. Nerves steady; feet find the pack’s rhythm.
- System effects: none (social/morale; scene-bound). Optionally reflect in School Card Recent.
- Tag: ::ABILITY|shifter_wolf|howl_rally|partial|confidence=med::

4. Alpha Presence (alpha_presence)

- Narrative: Shoulders open; gaze fixes. The clearing hushes—predators decide quickly in the green.
- System effects: none (scene-bound influence). If a durable boon is designed later, switch to deterministic effect.
- Tag: ::ABILITY|shifter_wolf|alpha_presence|success|confidence=med::

5. Dire Wolf Form (assume_dire_wolf)

- Narrative: The wolf takes full shape—mass heavy and sure, breath white in the cool shade. Pads drink sound; the world is scent and line.
- System effects (deterministic): Temporary += dire_wolf_form(power: stride, bite, relentless_pursuit).
- Risks: moon_pull may tug at focus under open sky.
- Tag: ::ABILITY|shifter_wolf|assume_dire_wolf|success|confidence=high::

---

## Do / Don’t

Do

- Use living, grounded metaphors (breath, sap, loam, moonlight, pack motion).
- Show interactions with the Weave as sensing/unbinding (no color math).
- Keep outcomes qualitative; rely on narrative over numbers.
- Reserve durable, system states for deterministic effects; keep momentary advantages in prose.

Don’t

- Describe Nature abilities as weaving colored threads or reciting formulae.
- Tag every scene action as an effect; only log durable states or model-emitted tags.
- Cure entrenched Blight casually; respect its narrative weight.

---

## Quick glossary

- Spirit of the Green: Nature’s animating presence, beyond the Weave.
- The Weave: Seven-thread arcane lattice used by formal casters; Nature magic can sense/disrupt it, but does not weave it.
- Blight: Ancient corruption; early cases may be purged; fully taken hosts have no known cure.
- Pack: Social and sensory motif for Shifter abilities (rallying, pursuit, presence).

---

Use this guide while drafting ability text, School Card summaries, and compression notes to keep narration cohesive with Greenwood’s lore and the ACS School System.

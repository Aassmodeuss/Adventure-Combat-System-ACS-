// ACS Library Script

/// <reference types="C:\Users\Braden\Documents\AI Scenarios\Scripting\Adventure Combat System\Types/SharedLibraryTypes.d.ts"/>

log(info.actionCount); // Hover over to test

// Adventure Combat System (ACS) SCRIPT by Aassmodeuss

// Credits 
  // Yi1i1i - For creating True Auto Stats (TAS) which this entire script was originally based on
  // BinKompliziert - Idea for Capitalization weighting for skill learning - TAS
  // jackoneill2443 - Idea for modifying player input to show stat results -TAS
  // LewdLeah - General Scripting Knowledge - TAS and has been a big help with questions I have had while creating ACS as well
//

// This function runs the library hook
onLibrary_ACS();

// LIBRARY HOOK
function onLibrary_ACS() {
  // Enable pickup debug logs while testing (remove/comment when done)
  state._acsDebug = false;

  // UNLOCK SCRIPT FOR DEBUG (Comment out to turn off)
  state.startScript = true;
  log("state.startScript: " + state.startScript);

  // Initialize variables
  if (state.startScript == undefined) {
    state.startScript = false;
  }
  if (state.turnCount == undefined) {
    state.turnCount = 0;
  }
  if (state.msgHolder == undefined){
    state.msgHolder = "";
  }
  // Ensure counters are defined (prevents NaN when incrementing)
  if (state.inputCount == undefined) {
    state.inputCount = 0;
  }
  if (state.outputCount == undefined) {
    state.outputCount = 0;
  }

  // ---- Armor Canonical Migration (moved inside) ----
  if (!state._armorCanonMigrated) {
    try {
      migrateArmorCardsAddCanonical();
      state._armorCanonMigrated = true;
      log("[ArmorCanon] Migration applied (CanonicalName lines ensured).");
    } catch(e){
      log("[ArmorCanon] Migration error: " + e);
    }
  }
}
// Utility function to get weapon names from story cards
function getWeaponNamesFromStoryCards() {
  return storyCards
    .filter(sc => (sc.type === "Weapons" || sc.category === "Weapons") && sc.title)
    .map(sc => sc.title.toLowerCase());
}

// INPUT HOOK
function onInput_ACS(text) {
  
  //Check for unlocking
  text = unlockScript(text);

  //Check for locking
  text = lockScript(text);

  helpCommandInput_ACS(text);

  //Unlocking runs main()
  if (state.startScript == true && info.actionCount >= 0) {
    state.inputCount += 1;
    log("state.inputCount: " + state.inputCount);


    // Always check for game over due to corruption at the start of every turn
  if (state.gameOver) {
  let gameOverMsg = " The corruption of the warp overwhelms you. You are possessed by an entity of the warp and lose control of your body. GAME OVER.\n";
  text += gameOverMsg;
  state.msgHolder += "GAME OVER. You were possessed by corruption!\n";
  return text;
}

    //Detect weapon equip/holster first
    text = detectWeaponEquip(text);

     //Detect fire mode toggles (standalone)
    text = detectFireModeToggle(text);

    // NEW: armor equip/don/remove detector
    text = detectArmorEquip(text);

    //Create story cards if none
    createIfNoStatSC();
    createIfNoInvSC();
    createIfNoSkillSC();
    createIfNoPsykerSpellSC(); 
    createIfNoWeaponSC();    
    createIfNoWeaponmodSC();
    createIfNoEquippedWeaponSC();
    createIfNoInjurySC();
    createIfNoEquippedArmorSC();
  
    //Updates codebase if player edits their storage SCs
    retrieveStatsFromSC();
    retrieveSkillsFromSC();
    ensureLevelUpsSync(state.playerSkills)
    retrievePsykerSpellsFromSC();
    ensureLevelUpsSync(state.psykerSpells);
    retrieveInvFromSC();
    retrieveWeaponFromSC();
    retrieveWeaponmodsFromSC();
    retrieveEquippedWeaponFromSC();
     retrieveEquippedArmorName(); 
    retrieveArmorFromSC();       
    
    // --- Contextual skill/spell activation ------
    state.contextualActivated = false; // reset per turn
    const ctxChoice = detectContextualSkillsAndSpells(text);
    text = runContextualActivation(text, ctxChoice);
    //---------------------------------------------
    text = detectPassiveSkillTrigger(text);

    text = detectHybridPickup(text);

    text = detectRemoveFromInv(text);

    text = detectAttack(text);
    
    text = detectRangedattack(text);

    text = upgradePlayerSkills(text);
    
    text = upgradePsykerSpells(text);

    text = detectReload(text);

    
 
   }//end of main()
  

  return text;
}

// CONTEXT HOOK
function onContext_ACS(text){
  const preLen = (text && text.length) || 0;
  log(`[Context] onContext_ACS(start) len=${preLen}`);

  // If a blocking gear generation job is pending, HALT the story and show a focused SYSTEM prompt
  // (SmartCards uses this same pattern: schedule job -> inject SYSTEM in context -> stop=true)
   if (state.gearGenConfig && state.gearGenConfig.blocking && state._pendingGearGen) {
    try {
      // Promote pending to active so the rest of the pipeline (and onOutput cleanup) are consistent.
      if (!state._gearGenActive) {
        state._gearGenActive = state._pendingGearGen;
        state._pendingGearGen = null;
        if (state._acsDebug) log(`[GearGen] Promoted pending -> active: "${state._gearGenActive.title}"`);
      }

      // Ensure the detailed prompt builder is used (it references state._pendingGearGen/_gearGenActive)
      const prompt = buildBlockingGearPrompt(text);
      log(`[GearGen] Blocking prompt injected for "${state._gearGenActive.title}"`);
      // Return object { text, stop } to the host (preferred shape)
      return { text: `<SYSTEM>\n${prompt}\n</SYSTEM>\n`, stop: true };
    } catch (e) {
      log("[GearGen] onContext_ACS blocking prompt failed: " + e);
      // Fall through to normal context if something goes wrong
    }
  }

  text = removeAngleText(text);
  return buildUnifiedSystemPrompt(text);
}


// OUTPUT HOOK
function onOutput_ACS(text) {
  log("Nova Debug: onOutput_ACS called.");

  if (state.startScript === true && info.actionCount >= 0) {
    state.outputCount = (state.outputCount || 0) + 1;
    log("state.outputCount: " + state.outputCount);

    // Ensure required Story Cards exist
    createIfNoStatSC();
    createIfNoInvSC();
    createIfNoSkillSC();
    createIfNoPsykerSpellSC();
    createIfNoWeaponSC();
    createIfNoWeaponmodSC();
    createIfNoEquippedWeaponSC();
    createIfNoInjurySC();
    createIfNoEquippedArmorSC();

    // Game over early exit
    if (state.gameOver) {
      const gameOverMsg = " #The corruption of the warp overwhelms you. You are possessed by an entity of the warp and lose control of your body. GAME OVER. #\n";
      text += gameOverMsg;
      state.msgHolder += "GAME OVER. You were possessed by corruption!\n";
      return text;
    }

    // ---- INJURY / HEAL TAGS ----
    log(`[InjuryProto] tail=${(text || "").slice(-200)}`);
    log(`[InjuryProto] scanning output for flags; outLen=${(text && text.length) || 0}`);
    const flagRes = consumeInjuryFlags(text);
    log(`[InjuryProto] found=${flagRes.count || 0} hadFlags=${!!flagRes.hadFlags}`);
    if (flagRes.hadFlags) {
      text = flagRes.cleanedText;
      log(`[InjuryProto] cleaned output len=${(text && text.length) || 0}`);
    }

    // ---- ARMOR RETRIEVE BEFORE ARMOR DAMAGE TAG PARSE (fixes overwrite issue) ----
    retrieveArmorFromSC(); // load existing damageLog BEFORE adding new entries

    // ---- ARMOR DAMAGE TAGS ----
    const armorFlagRes = consumeArmorDamageFlags(text);
    if (armorFlagRes.hadFlags) {
      text = armorFlagRes.cleanedText;
      log(`[ArmorDmg] parsed ${armorFlagRes.entries.length} armor damage tags`);
    } else {
      log("[ArmorDmg] no tags this turn.");
    }

    // ---- SHIELD TURN PROCESSING (after possible damage) ----
    updateShieldTurn();

    // ---- STORE ARMOR EARLY (so Damage Log persists even if later errors) ----
    try {
      storeArmorToSC();
    } catch (e) {
      log("[ArmorStore] error: " + e);
    }


    
// Parse pickup adjudication tags
    const pickupRes = consumePickupFlags(text);
    text = pickupRes.text;

    // ---- STATS ----
    retrieveStatsFromSC();
    playerNaturalRegen();
    storeStatsToSC();

    // ---- SKILLS ----
    retrieveSkillsFromSC();
    ensureLevelUpsSync(state.playerSkills);
    storeSkillsToSC();

    // ---- PSYKER SPELLS ----
    retrievePsykerSpellsFromSC();
    ensureLevelUpsSync(state.psykerSpells);
    storePsykerSpellsToSC();

    // ---- INVENTORY ----
    retrieveInvFromSC();
    storeInvToSC();

    // ---- WEAPONS ----
    retrieveWeaponFromSC();
    retrieveWeaponmodsFromSC();
    storeWeaponmodsToSC();
    storeWeaponToSC();

    
     // ---- MESSAGE & TURN ----
    // Nova's addition: Announce gear stat generation if pending/active!
    // NOTE: The actual blocking SYSTEM prompt is injected in onContext_ACS.
    if (state.gearGenConfig && state.gearGenConfig.blocking) {
      const activeJob = state._gearGenActive || state._pendingGearGen;
      if (activeJob) {
        try {
          state.msgHolder += `Generating stats for ${activeJob.title}. Press Continue.\n`;
          log(`[GearGen] Notified player: generating stats for ${activeJob.title}`);
        } catch (e) {
          log("[GearGen] onOutput message update failed: " + e);
        }
      }
    }

    if (state._gearGenActive) {
      log("Nova: Halting story for gear stat generation!");
    }
    state.message = state.msgHolder;
    state.msgHolder = "";
    turnCounter();
  }

  return text;
}

/////////////////////////////////////////////////////////////////////////////////////

const PICKUP_SUCCESS_VERBS = ["wrench","wrenched","wrenching","pry","pries","pried","prying","rip","rips","ripped","ripping","tear","tears","tore","seize","secured","snatch","snatched","yank","yanks","yanked","disarm","disarmed","disarming","strip","stripped","claim","claimed","claiming"];
const PICKUP_FUTURE_OR_CONDITIONAL = ["will","gonna","going to","plan to","planning to","would","later","soon","try to","intend","intending"];

/* NEW: Core pickup lexicons (required for heuristic engine) */
const PICKUP_VERBS = [
  "pick","pick up","grab","take","snatch","loot","collect","seize",
  "recover","salvage","pull","yank","wrench","pry","rip","tear","pocket","lift","claim"
];

const PICKUP_NEGATIVE = [
  "fail","failed","failing","try to","trying to","attempt to","attempted","attempting",
  "cannot","can't","won't","not","refuse","refused","refusing","unsuccessful"
];

const PICKUP_CONTESTED = [
  "his","her","their","enemy","opponent","guard","soldier","raider","pirate",
  "corpse","dead","fallen","bloodied","wrench","pry","rip","tear","yank"
];

// Match a bare number (we already normalize digits). Extensible later for words.
const PICKUP_QUANTITY_REGEX = /\b(\d+)\b/;

// Matches "you", "your", "yourself", "yours", "i", "my", "mine", "myself" (case-insensitive)
const youWordsRegex = /\b(you|your|yourself|yours|i|my|mine|myself)\b/i;

//Non inventory item blacklist words.
const nonItemRegex = /\b(cover( behind)?|in cover|take cover|shelters?|barriers?|corners?|walls?|floors?|grounds?|ceilings?|windows?|doors?|hallways?|corridors?|rooms?|crates?|tables?|chairs?|beds?|barricades?|pillars?|platforms?|ledges?|alcoves?|nooks?|hides?|hiding spots?|spots?|locations?|areas?|places?|positions?|stances?( behind| in| at)?|take aim|aim|surroundings?)\b/i;

const selfWords = ["me", "my", "myself", "mine", "your", "yourself", "yours", "us", "our", "ours", "ourselves"
];

// ---- Injury/Healing Flag Protocol REGEX ----
const INJURY_FLAG_REGEX = /<!inj>([\s\S]*?)<\/inj>/gim;
const HEAL_FLAG_REGEX   = /<!heal>([\s\S]*?)<\/heal>/gim;

// Canonical damage type mapper (lowercase tokens -> canonical key)
const DAMAGE_TYPE_ALIASES = {
  laser: "directed",
  beam: "directed",
  energy: "directed",
  plasma: "directed",
  directed: "directed",

  thermal: "thermal",
  heat: "thermal",
  fire: "thermal",
  flame: "thermal",

  kinetic: "kinetic",
  projectile: "kinetic",
  bullet: "kinetic",
  slug: "kinetic",
  impact: "kinetic",
  explosive: "kinetic",
  explosion: "kinetic",
  cutting: "kinetic",
  blade: "kinetic",
  vibro: "kinetic",

  psychic: "psychic",
  psionic: "psychic",
  warp: "psychic",

  sonic: "sonic",
  resonance: "sonic",
  resonant: "sonic",
  vibration: "sonic",
  sonicwave: "sonic",

  radiation: "other",
  radioactive: "other",
  acid: "other",
  corrosive: "other",
  chemical: "other",
  bio: "other",
  biological: "other",
  toxin: "other",
  toxic: "other",
  other: "other"
};

const castWords = [
  "activate", "amplify", "bind", "blast", "boost", "burst", "cast", "casting", "channel", "charge", "channeling", "command", "commanding", "conjure", 
  "create", "creating", "detonate", "enchant", "enchanting", "evoke", "explode", 
  "expel", "exude", "flare", "flow", "form", "gather", "gathering", "glow", "harness", "hex", "ignite", "infuse", "invoke", "invoking", "launch", "manifest", "project", "projecting", "pulse","perform", "quicken", "release", "shape", "shift", "shoot", "shooting", "summon", "summoning", "transform", "transforming", "transmute", "trigger", "unbind", "unleash"
];

const equipWords = [
  "acquire", "add", "collect", "equip", "gather", "grab", "hold", "keep", "loot", "obtain", "pick", "put", "receive", "retrieve", "stash", "snatch", "store", "take", "toss", "wear"
];

const invWords = [
  "bag", "backpack", "body", "case", "chest", "collection",  "container", "crates", "equipment", "hands", "hand", "holder", "holdings", "holster", "inventory", "items", "legs", "loot", "pack", "pocket", "pouch", "rucksack", "sack", "satchel", "storage", "supplies", "tote"
];

const numWords = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
  "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
  "hundred", "thousand", "million", "billion", "trillion"
];

const titleWords = ["mr", "mrs", "ms", "dr", "prof", "captain", "sir", "lady", "officer", "detective", "colonel", "general", "lieutenant", "president", "governor", "mayor", "minister","ambassador", "director", "agent", "coach", "principal", "judge", "dean", "sister","brother", "father", "mother", "daughter", "son", "king", "queen", "prince", "princess","professor"];

const stopWords = [
  // Pronouns
  "I", "me", "my", "myself", "we", "our", "ours", "ourselves",
  "you", "your", "yours", "yourself", "yourselves",
  "he", "him", "his", "himself", "she", "her", "hers", "herself",
  "it", "its", "itself", "they", "them", "their", "theirs", "themselves",

  // Question Words
  "what", "which", "who", "whom", "whose", "when", "where", "why", "how",

  // Auxiliary & Modal Verbs
  "am", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "having",
  "do", "does", "did", "doing",
  "can", "could", "will", "would", "shall", "should", "must", "might", "may",

  // Negatives
  "not", "no", "nor", "never", "none", "nothing", "nowhere", "neither",
  "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't",
  "doesn't", "don't", "didn't", "won't", "wouldn't", "shan't", "shouldn't",
  "can't", "cannot", "couldn't", "mightn't", "mustn't", "needn't",

  // Conjunctions & Prepositions
  "and", "but", "or", "because", "as", "until", "while",
  "of", "at", "by", "for", "with", "about", "against",
  "between", "into", "through", "during", "before", "after",
  "above", "below", "to", "from", "up", "down", "in", "out",
  "on", "off", "over", "under", "onto", "upon", "around",

  // Articles & Determiners
  "a", "an", "the", "this", "that", "these", "those",
  "some", "any", "each", "every", "either", "neither",
  "such", "own", "other", "another", "both", "all", "several", "many", "most", "few", "since",

  // Time-Related Words
  "again", "further", "then", "once", "already", "soon", "later", "finally", "next",

  // Place Words
  "here", "there", "everywhere", "somewhere", "anywhere", "nowhere",

  // Degree & Quantifier Words
  "very", "too", "just", "only", "more", "less", "than", "enough", "almost",
  "rather", "quite", "really", "such",

  // Common Verbs & Adverbs
  "try", "trying", "tries", "take", "takes", "taking",
  "look", "looks", "looking",
  "seem", "seems", "seemed", "appears", "appeared",
  "go", "goes", "going", "gone",
  "come", "comes", "coming",
  "get", "gets", "getting", "got", "gotten",
  "make", "makes", "making", "made",
  "say", "says", "saying", "said", "heard",
  "know", "knows", "knew", "stopping", "stops", "becomes",

  // Game-Specific Terms
  "skill", "ability", "executes", "existing",
  "increases corruption", "consumes energy", "successfully",
  "suddenly", "predictably", "efficiently", "cast"
];

const healingActions = [
  "heal", "recover", "restore", "regenerate", "revitalize", 
  "rejuvenate", "mend", "bandage", "apply", "inject", "swallow", "absorb", "patch", "treat", "stitch","splint"
];

const consumeWords = [
  "drink", "eat", "consume", "inject", "swallow", "absorb", "devour", "ingest", "chew", "bite", "sip", "gulp"
];

const enterWords = ["crawl", "drift", "enter", "fall", "get", "go", "head", "lay", "lie down", "make", "move", "nap", "prepare", "proceed", "slip", "sleep", "settle", "sink", "snuggle", "step", "surrender", "take", "turn in", "transition"];

const restingWords = ["catnap", "doze", "hibernate", "nap", "relax", "rest", "sleep", "slumber", "asleep"];

const lightRestWords = ["brief", "fleeting", "minor", "momentary", "passing", "quick", "relax", "short", "small", "tiny", "transient", "breath", "breathe", "breathing"];

const moderateRestWords = ["catnap", "doze", "light sleep", "nap", "power nap", "repose", "rest", "siesta", "snooze", "rest"];

const fullRestWords = ["deep", "deeply", "hibernation", "hibernate", "long", "prolonged", "rejuvenating", "sleep", "slumber", "sound", "uninterrupted"];

const dialoguePhrases = ["You say", "You tell", "You add", "You ask", "You reply", "You state", "You note", "You claim", "You remark", "You mutter", "You insist", "You whisper", "You mention", "You declare", "You respond", "You warn", "You said"];

const attackWords = ["attack", "ambush", "bash", "batter", "bite", "bludgeon", "chop", "claw", "cleave", "club", "crush", "flail", "gouge", "impale", "jab", "kick", "lunge", "maul", "pound", "pummel", "pierce", "punch", "ram", "rend", "shred", "slash", "slam", "slice", "smash", "stab", "strike", "swipe", "swing", "smack", "thrust", "whack", "wreck"];

const rangedattackWords = ["fire","loose", "launch", "shoot"];


const skillDescriptions = {
  // TechA
  "debug": "Diagnose and fix technical issues in machines or software.",
  "hack": "Bypass security systems and gain unauthorized access.",
  "defragment": "Optimize and repair digital systems.",
  "reboot": "Restart a device or system to restore functionality.",
  "program": "Write or modify code to control machines.",
  "encrypt": "Secure data against unauthorized access.",
  "decrypt": "Decode encrypted information.",
  "scan": "Analyze surroundings or systems for information.",
  // Engineer
  "repair": "Fix broken equipment, vehicles, or structures.",
  "calibrate": "Adjust devices for optimal performance.",
  "maintain": "Keep machinery and systems running smoothly.",
  "upgrade": "Improve the capabilities of equipment.",
  "disassemble": "Take apart devices for repair or salvage.",
  "build": "Construct new devices or structures.",
  "refit": "Modify equipment for new purposes.",
  // Medic
  "heal": "Restore health to yourself or others.",
  "revive": "Bring someone back from unconsciousness or near death.",
  "detox": "Remove toxins or poisons from the body.",
  "diagnose": "Identify illnesses or injuries.",
  // Psyker Spells
  "telepathy": "Read or communicate thoughts mentally.",
  "telekinesis": "Move objects with your mind.",
  "pyrokinesis": "Create or control fire using psychic power.",
  "psychic shield": "Protect yourself or others from psychic attacks.",
  "mind control": "Influence or dominate another's thoughts or actions.",
  "clairvoyance": "Perceive distant events or foresee the future.",
  "psychic blast": "Attack with a burst of psychic energy.",
  "aura reading": "Sense the energy fields of living beings.",
  "psychic healing": "Restore mental or physical health with psychic power.",
  "psychic barrier": "Block psychic intrusion or attacks.",
  "psychic projection": "Send your mind or spirit outside your body.",
  "teleportation": "Instantly move yourself to another location.",
  "psychic scream": "Overwhelm minds with a psychic shout.",
  "psychic manipulation": "Alter thoughts, emotions, or perceptions.",
  "psychic ward": "Protect an area or person from psychic harm."
};

const skillTriggerMap = {
  // Tech skills
  "debug": ["debug", "diagnose", "troubleshoot"],
  "hack": ["hack", "bypass", "override", "crack", "breach"],
  "defragment": ["defragment", "optimize"],
  "reboot": ["reboot", "restart", "reset"],
  "program": ["code", "program", "reprogram", "script"],
  "encrypt": ["encrypt", "secure"],
  "decrypt": ["decrypt", "decode", "unscramble"],
  "scan": ["diagnostic", "scan", "analyze"],

  // Engineer skills
  "repair": ["repair", "fix", "mend", "patch", "refurbish", "restore", "rebuild", "reconstruct"],
  "calibrate": ["calibrate", "tune", "adjust"],
  "maintain": ["maintain", "service"],
  "upgrade": ["upgrade", "improve", "enhance"],
  "disassemble": ["disassemble", "take apart", "dismantle", "deconstruct", "break down"],
  "build": ["build", "erect", "construct", "assemble", "put together", "fabricate"],
  "refit": ["refit", "retrofit", "retool", "adapt", "modify", "alter", "reconfigure"],

  // Medic skills
  "heal": ["heal", "treat", "bandage", "suture", "stitch", "inject", "medicate", "apply salve", "first aid", "triage", "diagnose", "disinfect", "clean wound", "stop bleeding"],
  "revive": ["revive", "resuscitate", "restore", "bring back", "CPR", "restart heart", "shock", "defibrillate"],
  "detox": ["detox", "purge", "neutralize", "antidote", "counteract", "flush toxins", "cleanse"],
  "diagnose": ["diagnose", "identify illness", "analyze symptoms", "check vitals", "examine", "inspect patient"],

  // Psyker spells (example triggers, customize as needed)
  "telepathy": ["telepathy", "read mind", "mental link", "thoughts", "psychic communication"],
  "telekinesis": ["telekinesis", "move object", "levitate", "psychic force", "lift with mind"],
  "pyrokinesis": ["pyrokinesis", "ignite", "burn", "set fire", "flame", "heat with mind"],
  "psychic shield": ["psychic shield", "block mind", "mental barrier", "protect thoughts", "defend psyche"],
  "mind control": ["mind control", "dominate", "compel", "influence", "override will"],
  "clairvoyance": ["clairvoyance", "see future", "predict", "premonition", "psychic vision"],
  "psychic blast": ["psychic blast", "mental attack", "brain shock", "psionic strike"],
  "aura reading": ["aura reading", "sense aura", "detect energy", "read energy field"],
  "psychic healing": ["psychic healing", "heal with mind", "restore psyche", "mental recovery"],
  "psychic barrier": ["psychic barrier", "block psychic", "defend mind", "shield thoughts"],
  "psychic projection": ["psychic projection", "astral project", "out of body", "send mind"],
  "teleportation": ["teleportation", "instant travel", "blink", "warp", "shift location"],
  "psychic scream": ["psychic scream", "mental scream", "psionic shout", "overwhelm mind"],
  "psychic manipulation": ["psychic manipulation", "alter mind", "change thoughts", "influence psyche"],
  "psychic ward": ["psychic ward", "protect from psychic", "ward mind", "block psionics"]
};




const exhaustionSleepArray = [
  "you find the need for a place for deep sleep as your body succumbs to its weariness.",
  "you urgently need to crawl into slumber, the exhaustion is too much to bear.",
  "you are about to drift away into unconscious sleep as fatigue takes hold.",
  "you need to get sleep, your body is about to let go of its fight with exhaustion.",
  "you need to go under rest, the overwhelming tiredness is pulling you.",
  "you need to head into sleep, your mind is shutting down as exhaustion claims you.",
  "you need to lay down, the exhaustion almost pulling you into a deep, much-needed rest.",
  "you require deliberate action to lie down, and wish for sleep to come quickly, your body finally giving in.",
  "you mind needs you to make your way into sleep, the exhaustion is too much to resist.",
  "you need to purposely move into slumber, your mind surrendering to the weight of your fatigue.",
  "you urgently require deliberate sleep, the fatigue finally overtaking you.",
  "you need to settle into sleep, your body letting go of the day’s exhaustion.",
  "you need to sink into sleep, the weight of your weariness dragging you under.",
  "you need to step into slumber, your exhaustion becoming too much to fight.",
  "you need to surrender to sleep, the exhaustion finally winning over your body.",
  "you need to take a deep breath and fall into sleep, your body letting go.",
  "you need to turn in immediately, and sleep will claim you effortlessly.",
  "you need to transition into slumber, else your body will fail you."
];

const bodyParts = [
  // Standard humanoid body parts
  "abdomen", "achilles tendon", "ankle", "arm", "arteries", "back", "biceps", "bladder", "buttocks", "body",
  "calf", "cheek", "chest", "chin", "collarbone", "deltoid", "diaphragm", "ear", "elbow", "esophagus",
  "eyebrow", "eyelid", "face", "fingers", "foot", "flesh", "forearm", "forehead", "gums", "gut", "groin", "hamstring",
  "hand", "head", "heart", "heel", "hip", "intestines", "jaw", "kidney", "knee", "knuckles", "leg",
  "lips", "liver", "lungs", "lung", "lower back", "nape", "neck", "nose", "palm", "pancreas", "pelvis",
  "quadriceps", "ribs", "scapula", "shin", "shinbone", "shoulder", "side", "skull", "solar plexus",
  "spine", "spleen", "stomach", "sternum", "tailbone", "teeth", "temple", "thigh", "throat", "thumb",
  "toes", "triceps", "upper back", "veins", "waist", "wrist",

  // Fantasy/Sci-Fi Races
  "antlers", "barb", "beak", "carapace", "chitin", "claw", "crest", "eye stalk", "fang", "feathers",
  "fin", "frill", "gill", "horn", "hoof", "mandible", "membrane", "proboscis", "scales", "shell",
  "snout", "spikes", "stinger", "talon", "tail", "thorax", "trunk", "tusk", "whiskers", "wing"
];

const PsykerSpells = ["telepathy", "telekinesis", "pyrokinesis", "psychic shield", "mind control", 
  "clairvoyance", "psychic blast", "aura reading", "psychic healing", "psychic barrier", "psychic projection", 
  "teleportation", "psychic scream", "psychic manipulation", "psychic ward" ];

const TechSkills = [
  "debug", "hack", "defragment", "reboot", "code", "encrypt", "decrypt", "scan", "analyze", 
];

const EngineerSkills = [
  "repair", "calibrate", "maintain", "upgrade", "assemble", 
  "disassemble", "construct", "deconstruct", "build", "dismantle", "refurbish", "refit", 
  "reconfigure", "rebuild", "reconstruct", "reengineer", "retool"
];

const MedicSkills = [
  "heal", "revive", "detox", "diagnose", "bandage", "suture", "first aid", "triage", "disinfect", "inject", "medicate"
];



// --- Persistent State Initializations ---
// Place at line 1685, right after constants and before any functions.

// Player Stats
state.playerStats = state.playerStats || {
  lvl: 0, cp: 0, ep: 0, atk: 0, ratk: 0, intl: 0,
  maxLvl: 0, maxCp: 0, maxEp: 0, maxAtk: 0, maxRatk: 0, maxIntl: 0
};
state.playerStats.classLevelUps = state.playerStats.classLevelUps || 0;


// (1) INITIAL ARMOR STATE – extend default with regen defaults + regenCD
state.armor = state.armor || {
  name: "Unarmoured",
  resist: { 
    directed: 0, 
    thermal: 0, 
    kinetic: 0, 
    psychic: 0, 
    sonic: 0, 
    other: 0 },
  shield: {
    charge: 0,
    max: 0,
    inRegen: false,
    regenDelay: 2,   // turns to wait after depletion
    regenRate: 20,   // % restored per turn once recharging
    regenCD: 0       // countdown turns until recharge starts
  },
  damageLog: []
};


// Skill Classes
state.skillClasses = state.skillClasses || {
  psyker:   { lvl: 1 },
  tech:     { lvl: 1 },
  engineer: { lvl: 1 },
  medic:    { lvl: 1 }
};
state.skillClasses.tech.levelUps = state.skillClasses.tech.levelUps || 0;
state.skillClasses.engineer.levelUps = state.skillClasses.engineer.levelUps || 0;
state.skillClasses.medic.levelUps = state.skillClasses.medic.levelUps || 0;
state.skillClasses.psyker.levelUps = state.skillClasses.psyker.levelUps || 0;

// Player Inventory
state.playerInv = state.playerInv || { item: [], amt: [] };

// Player Skills
state.playerSkills = state.playerSkills || { name: [], lvl: [], cost: [] };
state.playerSkills.levelUps = state.playerSkills.levelUps || state.playerSkills.name.map(() => 0);

// Psyker Spells
state.psykerSpells = state.psykerSpells || { name: [], lvl: [], cost: [] };
state.psykerSpells.levelUps = state.psykerSpells.levelUps || state.psykerSpells.name.map(() => 0);

// Weapon Modifiers
state.weaponModifiers = state.weaponModifiers || { ammoMod: 0, condMod: 0 };

state.pendingSkillSystem = state.pendingSkillSystem || "";
state.pendingCombatSystem = state.pendingCombatSystem || "";

// --- Skill Execution Globals ---
let skillIndex = 0;
let fullSkillMatch = false;
let skillCheck = [false, false, 0];

// --- End of Persistent State Initializations ---


/////////////////////////////////////////////////////////////////////////////////////

/// ACS STANDARD FUNCTIONS
//Input /start unlocks the script else script naturally locked
function unlockScript(text){ 
  // AID already starts scenarios; do nothing here.
  return text;
}

// Detect input command /end to lock script
function lockScript(text){ 
  if (state.startScript === true && /\/end\b/i.test(text)) {
    state.startScript = false;
    text = text + "\n 🔒 ACS Script Locked!";
  }
  return text;
}

//detect /help and display help
function helpCommandInput_ACS(text){
  // Unified /help router (Nova 2025-08-16)
  const lower = text.toLowerCase();

  // /reset still supported
  if (lower.includes("/reset")) {
    resetGameOverState();
    state.msgHolder += "Game over state reset. You may continue your adventure!\n";
    return;
  }

  // Keep existing debug (not part of public help index)
  if (lower.includes("/debug psyker")) {
    const lines = [];
    if (state.psykerSpells && state.psykerSpells.name){
      state.psykerSpells.name.forEach((s,i)=>{
        const applied = (state.psykerSpells.milestoneApplied &&
                        state.psykerSpells.milestoneApplied[s]) || [];
        const base = state._psykerBaseCosts ? state._psykerBaseCosts[s] : "?";
        lines.push(`${s}: Lvl ${state.psykerSpells.lvl[i]} | Cost ${state.psykerSpells.cost[i]} | Base ${base} | Milestones ${applied.join(",")}`);
      });
    }
    state.commandCenter_ACS = `<<\n🔍 Psyker Debug\n${lines.join("\n")}\n>>`;
    return;
  }


  // Runtime toggles
if (/^\/acs\s+debug\s+(on|off)\b/i.test(text)) {
  const on = /on$/i.test(text);
  state._acsDebug = !!on;
  state.msgHolder += `ACS debug ${on ? "ENABLED" : "DISABLED"}.\n`;
  return;
}
if (/^\/acs\s+run\s+(on|off)\b/i.test(text)) {
  const on = /on$/i.test(text);
  state.startScript = !!on;
  state.msgHolder += `ACS script ${on ? "ENABLED" : "DISABLED"}.\n`;
  return;
}


  if (!/\/help\b/.test(lower)) return; // fast exit if no /help

  const m = lower.match(/\/help(?:\s+([a-z_]+))?/);
  let topic = (m && m[1]) ? m[1] : "index";

  const topics = {

    index: `📘 HELP INDEX
Topics:
  /help stats | combat | weapons | armor | inventory
  /help skills | psyker | tags | commands
Core Loop:
  Type actions normally. System auto-detects attacks, pickups, skill/spell use.
  Tags (armor / injury / pickup) are hidden helpers that update cards.`,

    stats: `📊 STATS
LVL gates class caps. ATK (melee accuracy/efficiency), RATK (ranged), INTL (boosts max CP).
EP = stamina drains each turn & by actions. CP = corruption; spells raise it, natural regen lowers it.
If CP > max → Game Over.
Natural Turn Effects: EP slight drain, CP regenerates. Milestones & leveling increase max stats.`,

    combat: `⚔️ COMBAT
Melee: attack verbs → EP cost, minor ATK growth.
Ranged: needs equipped weapon; consumes AMMO (burst=3, overcharge=all & needs ≥50%).
System builds a combat prompt; model may emit armor / injury tags if you’re hit.
Train ATK/RATK by using them; overuse with low EP leaves you vulnerable.`,

    weapons: `🔫 WEAPONS
Equip: "draw / equip / wield <weapon>", Holster: "holster / put away".
Fire Modes: "toggle/select burst fire" or "toggle overcharge".
Reload: "reload" (consumes AMMO ITEM from inventory).
Overcharge: fires all remaining ammo—big damage, must have ≥50% mag.
Burst: 3 rounds if ammo >=3. Weapon card tracks modes & ammo.`,

    armor: `🛡️ ARMOR & SHIELDS
Equip: "put on / wear / don <armor phrase>".
Canonical naming strips fluff: "a set of scout armor" → canonical "scout".
Existing canonical reused to avoid duplicate cards.
Shields: deplete → cooldown → regen ticks (%/turn) until full.
Armor damage tag tiers: defeated > exact > moderate > none.`,

    inventory: `🎒 INVENTORY
Automatic pickup heuristics for verbs (grab, take, loot...). Contested/future tense items need model adjudication via <!pickup>.
Format in card: Item (Amt: X). Quantities auto-merge.
Drop: "drop/discard/remove X" (supports counts).
Reload & crafting pull from inventory by name root (case-insensitive).`,
    
    skills: `🛠️ SKILLS
Non-psyker abilities level by contextual use. Milestones (5,10,15,20,25) reduce corruption (cost) if any.
Class level ups (10 cumulative skill ups) raise class level; 10 class level ups raise Player LVL.
Skill activation: verbs near skill name (repair, calibrate, hack, heal, etc.). One passive gain per turn.`,

    psyker: `🔮 PSYKER
Spells consume CP (corruption). Overuse → exceed max CP → Game Over.
Milestones reduce base corruption cost multiplicatively (5% each).
Spell auto-detection similar to skills (verbs like cast / channel / unleash).
INTL raises max CP; leveling lowers effective cost via milestones.`,

    tags: `🏷️ SYSTEM TAGS
<!armorDmg> Summarizes strongest armor/shield impact this turn: type, tier, weaponClass, resist, shield delta.
<!inj> Player injury narrative (one line).
<!heal> Healing effect line.
<!pickup> AI adjudicated item secure/fail.
Tags are stripped from visible output but update story cards & logs.`,

    commands: `⌨️ COMMANDS
/start (if required) | /end lock script
/help <topic> (see /help)
/reset clears Game Over flag
/debug psyker (dev view)
Normal play: just type narrative actions; system handles detection & updates.`
  };

  if (!topics[topic]) topic = "index";
  state.commandCenter_ACS = `<<\n${topics[topic]}\n>>`;
}

function helpCommandOutput_ACS(text){
  if(state.commandCenter_ACS){
    text = state.commandCenter_ACS;
  }
  delete state.commandCenter_ACS
  return text;
}

// Increment turn counter at end of onOutput
function turnCounter(){
  state.turnCount += 1;
  log("state.turnCount: " + state.turnCount);
}

// Remove script texts to clean AI context
function removeAngleText(text) {
  return text.replace(/<<[\s\S]*?>>/g, '');
}

// Function to capitalize first letter of a string
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

///Function to return all indices of one target in array 
function indicesOf(arr,target){  
    let indices = [];
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === target) {
            // Found the word, store its index
            indices.push(i);
        }
    }

    if(indices.length == 0){
        return null;
    }
    else{
        return indices; //arr
    }
    
}
/**
 * Injects a story card's contents into the context only if not already present.
 * @param {string} cardTitle - The title of the story card to inject.
 * @param {string} context - The current context string.
 * @returns {string} - The new context string with the card's data prepended if not already present.
 */
function injectStoryCardToContext(cardTitle, context) {
  const sc = storyCards.find(sc => sc.title === cardTitle);
  if (!sc) return context; // Card not found

  // Prepare the card's text block
  let cardText = "";
  if (sc.description && sc.description.trim() !== "") {
    cardText += `<<${cardTitle} Description>>\n${sc.description}\n`;
  }
  if (sc.entry && sc.entry.trim() !== "") {
    cardText += `<<${cardTitle}>>\n${sc.entry}\n`;
  }

  // Check if cardText (ignoring whitespace) is already in context
  const normalizedContext = context.replace(/\s+/g, ' ').toLowerCase();
  const normalizedCardText = cardText.replace(/\s+/g, ' ').toLowerCase();

  if (normalizedContext.includes(normalizedCardText.trim())) {
    return context; // Already present, skip adding
  }

  // Otherwise, prepend cardText
  return cardText + context;
}



/// Returns true if a "you" word appears within N words before or after the match index
function isPlayerContext(text, matchIndex, matchLength, windowSize = 10) {
  const words = text.split(/\s+/);
  // Find the word index of the match
  let charCount = 0, matchWordIndex = -1;
  for (let i = 0; i < words.length; i++) {
    charCount += words[i].length + 1; // +1 for space
    if (charCount > matchIndex) {
      matchWordIndex = i;
      break;
    }
  }
  if (matchWordIndex === -1) return false;
  // Check window before and after
  const start = Math.max(0, matchWordIndex - windowSize);
  const end = Math.min(words.length, matchWordIndex + windowSize + 1);
  for (let i = start; i < end; i++) {
    if (youWordsRegex.test(words[i])) return true;
  }
  // Direct check: "your" appears within 2 words before the match
  if (matchWordIndex >= 1 && youWordsRegex.test(words[matchWordIndex - 1])) return true;
  if (matchWordIndex >= 2 && youWordsRegex.test(words[matchWordIndex - 2])) return true;
  return false;
}

//With a words arr and arr of targets, find all indices for each target in word arr and put them together in one arr
function indicesOfTargets(wordsArr,targetWordsArr){
  let allTargetsIndicesArr = []; 

  //Loop through each target word and store their indices from words arr in an array
  targetWordsArr.forEach(word => {
    //unused target words return null so filter them out of index holder
    if(indicesOf(wordsArr,word)){
      //indicesOf returns an array, alltargetindices becomes an array of arrays so concat them
      allTargetsIndicesArr = allTargetsIndicesArr.concat(indicesOf(wordsArr,word));
      allTargetsIndicesArr.sort((a, b) => a - b);
    }
  });

  //if no indices found return null
  if(allTargetsIndicesArr.length <= 0){
    return null;
  }

  return allTargetsIndicesArr;
}

//Input a string and remove punctuation
function removeSpecificPunctuation(str) {
  return str.replace(/[.><,!?;:"()\n]/g, " ");
}

//Return true or false for first letter capitalized
function isFirstLetterCapitalized(word) {
  if (!word) return false;  // Return false for empty string
  return word.charAt(0) === word.charAt(0).toUpperCase();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max){
  return Math.random() * (max - min) + min;
}

///A helper function to level up skills
function levelUpSkill(skillIndex, skillType) {
  // Level up the skill
  state.playerSkills.levelUps[skillIndex] = (state.playerSkills.levelUps[skillIndex] || 0) + 1;

  // Count total level-ups for this class
  let skillArray;
  if (skillType === "tech") skillArray = TechSkills;
  else if (skillType === "engineer") skillArray = EngineerSkills;
  else if (skillType === "medic") skillArray = MedicSkills;
  else return;

  let totalClassSkillLevelUps = state.playerSkills.name.reduce((sum, skill, idx) => {
    return skillArray.includes(skill) ? sum + state.playerSkills.levelUps[idx] : sum;
  }, 0);

  if (totalClassSkillLevelUps >= 10) {
    levelUpSkillClass(skillType);
    // Reset all skill level-up counters for this class
    state.playerSkills.name.forEach((skill, idx) => {
      if (skillArray.includes(skill)) state.playerSkills.levelUps[idx] = 0;
    });
  }

  storeSkillsToSC();
}

///A helper function to level up a skill class
function levelUpSkillClass(classKey) {
  const playerLvl = state.playerStats.maxLvl;
  const maxClassLvl = playerLvl * 2;
  let skillClass = state.skillClasses[classKey];

  if (skillClass.lvl < maxClassLvl) {
    skillClass.lvl++;
    skillClass.levelUps++;
    state.msgHolder += `${capitalizeFirst(classKey)} class leveled up to ${skillClass.lvl}!\n`;
  } else {
    skillClass.lvl = maxClassLvl;
    state.msgHolder += `${capitalizeFirst(classKey)} class is capped at ${maxClassLvl} (twice your player level).\n`;
  }

  // Check if player should level up
  checkPlayerLevelUp();
  storeStatsToSC();
}

///A helper function to check if player should level up
function checkPlayerLevelUp() {
  let totalClassLevelUps =
    state.skillClasses.tech.levelUps +
    state.skillClasses.engineer.levelUps +
    state.skillClasses.medic.levelUps +
    state.skillClasses.psyker.levelUps;

  if (totalClassLevelUps >= 10) {
    state.playerStats.maxLvl++;
    state.playerStats.classLevelUps++;
    state.msgHolder += `Player leveled up to ${state.playerStats.maxLvl}!\n`;

    // Reset all class level-up counters
    state.skillClasses.tech.levelUps = 0;
    state.skillClasses.engineer.levelUps = 0;
    state.skillClasses.medic.levelUps = 0;
    state.skillClasses.psyker.levelUps = 0;

    // Increase all max stats (as in your statUp logic)
    maxStatKeys.forEach((key) => {
      if (key !== 'maxLvl' && key !== 'maxExp') {
        state.playerStats[key] += 5;
        state.playerStats[key] = Math.round(state.playerStats[key]*100)/100;
      }
    });

    storeStatsToSC();
  }
}

///helper function to level Psyker spells
function levelUpPsykerSpell(spellIndex) {
  // Increment the spell's level-up counter
  state.psykerSpells.levelUps[spellIndex] = (state.psykerSpells.levelUps[spellIndex] || 0) + 1;

  // Count total level-ups for all Psyker spells
  let totalPsykerSkillLevelUps = state.psykerSpells.levelUps.reduce((sum, val) => sum + val, 0);

  if (totalPsykerSkillLevelUps >= 10) {
    levelUpSkillClass("psyker");
    // Reset all Psyker spell level-up counters
    state.psykerSpells.levelUps = state.psykerSpells.levelUps.map(() => 0);
  }

  storePsykerSpellsToSC();
}


// Check for targets in text and split text string into words arr if there are. Replace all target words with first target word if unlocking is true
function findTargetsThenSplit(text, targetWordsArr, wordsArrHolder, unlocking) {
  if (text == null) return null;
  let yesSplit = false;            // was implicit
  let cleanText = removeSpecificPunctuation(text);
  targetWordsArr.forEach(target => {
    const targetRegex = new RegExp(`\\b${target}\\b`, "gi");
    
    // If text has target, set yessplit true
    if(targetRegex.test(cleanText)){
      // Optional replace large target words with first target word
      if (unlocking === true && target.split(" ").length > 1) {
        cleanText = cleanText.replace(targetRegex, targetWordsArr[0]);
      }

      yesSplit = true;
    }
  });
  //log("cleanText postregex: " + cleanText);
  //log("yesSplit: " + yesSplit);

  // Split text if target was found
  if (yesSplit){
    wordsArrHolder = cleanText.split(/\s+/).filter(word => word.trim() !== "");
    //console.log("wordsArrHolder: ", wordsArrHolder);
    return wordsArrHolder;
  }
  else{
    return null;
  }

}

//Give an arr of targets and a string, clean text and check if string has a target
function cleanStringCheckForTargets(targetWordsArr, text) {
  if (text == null) {return false};

 let wordsArr = text.replace(/[.,!?]/g, '').replace(/\s+/g, ' ').trim().split(' ');
const numberWordsRegex = /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)$/i;
if (numberWordsRegex.test(wordsArr[0])) {
  wordsArr[0] = wordsToNumber(wordsArr[0]).trim();
}
let cleanText = wordsArr.join(' ');

  // Loop through target words
  for (let target of targetWordsArr) {
    let targetRegex = new RegExp(`\\b${target}\\b`, "gi");
    //log(target);

    // Check if target is found in the text
    if (targetRegex.test(cleanText)) {
      return true; // Immediately return true if a match is found
    }
  }

  return false; // Return false if no matches are found
}

//Given a words arr, checks if there is a "you" (player context) a num specified before target indicesarr
function checkYouBeforeIndicesArr(wordsArr, indicesArr, numWordsBefore) {
  for (let i = 0; i < indicesArr.length; i++) {
    const currentIndex = indicesArr[i];
    // Store words from current target index up to specified indices before them without going out of bounds into a holder
    let prevWordsHolder = wordsArr.slice(Math.max(0, currentIndex - numWordsBefore), currentIndex);
    // Use youWordsRegex for player context detection
    if (prevWordsHolder.some(word => youWordsRegex.test(word))) {
      return true;
    }
  }
  return false;
}

//Given a words arr, checks if there is a "and" a num specificed before target indicesarr
function checkAndBeforeIndicesArr(wordsArr, indicesArr, numWordsBefore){
  for (let i = 0; i < indicesArr.length; i++){
    const currentIndex = indicesArr[i];
    const prevWordsHolder = wordsArr.slice(Math.max(0, currentIndex - numWordsBefore), currentIndex);
    if (prevWordsHolder.includes("and")){
      return true;
    }
  }
  return false;
}

//Counts how frequent words appear in text and decays less appeared words
function mostFrequentOutputWords(text){
  let outText = removeSpecificPunctuation(text).split(" "); 
  let capitalStopWords = []; 
  capitalStopWords = stopWords.map(word => word.charAt(0).toUpperCase() + word.slice(1));

  // Remove stop words and player context words using regex
  outText = outText.filter(word => 
    ![...stopWords, ...capitalStopWords].some(stopWord => stopWord === word) &&
    !youWordsRegex.test(word)
  );
  
  //Holders
  state.freqWords = state.freqWords || [];
  state.wordWeights = state.wordWeights || [];

  //Push new words and weight to holders
  outText.forEach(word => {
    if(!state.freqWords.includes(word) && word != ""){
      state.freqWords.push(word);
      state.wordWeights.push(1);
    }
  });

  //Words that appear again increment over time
  state.freqWords.forEach((word,ii) => {
    if(outText.includes(word)){
      state.wordWeights[ii]++;
    }
    else{
      //Decay factor for unused words
      state.wordWeights[ii]--;
    }
  });

  //Remove decayed words and weights from holders
  state.freqWords = state.freqWords.filter((word, ii) => state.wordWeights[ii] >= 0);
  state.wordWeights = state.wordWeights.filter((count) => count >= 0);

}

//sort two linked arrs and display each element together in console
function sortTwoLinkedArrForConsole(arr1,arrToSort){
  let combined = arr1.map((word, index) => [word,arrToSort[index]]);
  // Sort the combined array based on the second element (arrToSort values)
  combined.sort((a, b) => a[1] - b[1]);  // Sort by count (ascending)
  // Extract sorted arr1 and arrToSort from the combined array
  arr1 = combined.map(item => item[0]);
  arrToSort = combined.map(item => item[1]);
  arr1.forEach((word,ind)=>{
    log(arr1[ind] + ": " + arrToSort[ind]);
  })
}

// Check if any guest is distance after any home, and push weight into weightarr if true
function isAfterIndex(guestIndices, homeIndices, minDis, maxDis, weightIfTrue, arrOfWeights) {
  if(guestIndices && homeIndices){
    guestIndices.forEach((g, index) => {
      homeIndices.forEach((h, index2) => {
        // Check if the guest element is after the home element within the given distance
        if (g - h <= maxDis && g - h >= minDis) {
          arrOfWeights[index] += weightIfTrue;
        }
      });
    });
  }
}

// Check if any guest is distance before any home, and push weight into weightarr if true
function isBeforeIndex(guestIndices, homeIndices, minDis,maxDis, weightIfTrue, weightArr) {
  if(guestIndices && homeIndices){
    guestIndices.forEach((g, index) => {
      homeIndices.forEach((h, index2) => {
        // Check if the guest element is before the home element within the given distance
        if (g - h >= -maxDis && g - h <= -minDis) {
          weightArr[index] += weightIfTrue;
        }
      });
    });
  }
}

function findClosestNumberBefore(arr, index) {
  for (let i = index - 1; i >= 0; i--) {
    const match = arr[i].match(/(\d+(\.\d+)?)/); // match integer or decimal
    if (match) {
      return Number(match[1]);
    }
  }
  return null; // no number found before index
}

function wordsToNumber(text) {
  const smallNumbers = {
    zero:0, one:1, two:2, three:3, four:4, five:5,
    six:6, seven:7, eight:8, nine:9, ten:10,
    eleven:11, twelve:12, thirteen:13, fourteen:14,
    fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19
  };
  const tens = {
    twenty:20, thirty:30, forty:40, fifty:50,
    sixty:60, seventy:70, eighty:80, ninety:90
  };
  const multipliers = {
    hundred:100, thousand:1000, million:1000000,
    billion:1000000000, trillion:1000000000000
  };
  const numberWordsRegex = new RegExp(
    '\\b(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|' +
    'eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|' +
    'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|' +
    'hundred|thousand|million|billion|trillion|[-])+\\s*)+\\b','gi'
  );
  function parseNumberPhrase(phrase){
    const words = phrase.toLowerCase().replace(/-/g,' ').split(/\s+/);
    let total = 0, current = 0;
    words.forEach(w=>{
      if (smallNumbers[w] != null) current += smallNumbers[w];
      else if (tens[w] != null) current += tens[w];
      else if (w === "hundred") current *= 100;
      else if (multipliers[w]){
        current *= multipliers[w];
        total += current;
        current = 0;
      }
    });
    return total + current;
  }
  return text.replace(numberWordsRegex, m => parseNumberPhrase(m));
}

function getDigitIndices(wordsArray) {
  const digitIndices = [];

  for (let i = 0; i < wordsArray.length; i++) {
    if (/^\d+$/.test(wordsArray[i])) {
      digitIndices.push(i);
    }
  }

  return digitIndices;
}

// --- Levenshtein Distance Helper ---
function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// --- Fuzzy Inventory Item Matcher ---
function findBestInventoryMatch(input, inventoryItems) {
    input = input.toLowerCase().replace(/[^a-z0-9 ]/gi, '');
    let inputTokens = input.split(/\s+/).filter(Boolean);

    let bestScore = 0;
    let bestItems = [];

    // First, use token overlap
    for (let item of inventoryItems) {
        let itemTokens = item.toLowerCase().replace(/[^a-z0-9 ]/gi, '').split(/\s+/).filter(Boolean);
        let overlap = inputTokens.filter(token => itemTokens.includes(token)).length;
        if (overlap > bestScore) {
            bestScore = overlap;
            bestItems = [item];
        } else if (overlap === bestScore && overlap > 0) {
            bestItems.push(item);
        }
    }
    // If only one best match, return it
    if (bestItems.length === 1) return bestItems[0];
    // If multiple, use Levenshtein distance as tie-breaker
    if (bestItems.length > 1) {
        let minDist = Infinity;
        let best = bestItems[0];
        for (let item of bestItems) {
            let dist = levenshtein(input, item.toLowerCase());
            if (dist < minDist) {
                minDist = dist;
                best = item;
            }
        }
        return best;
    }
    // No match found
    return null;
}


// Re-added retrieval (needed by onInput_ACS & onOutput_ACS)
function retrieveInvFromSC(){
  const invSC = storyCards.find(sc => sc.title === "Player Inventory");
  if(!invSC) return;
  const lines = (invSC.entry||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const temp = [];
  lines.forEach(line=>{
    let m = line.match(/^(.*?)\s*\(\s*amt\s*:\s*(\d+(?:\.\d+)?)\s*\)$/i) ||
            line.match(/^(.*?)\s*\(\s*(\d+(?:\.\d+)?)\s*\)$/i);
    if(!m) return;
    let name = m[1].trim();
    let qty  = Number(m[2]);
    if(!name || !(qty>0)) return;
    // Strip any leading spelled/digit quantity that crept into display
    name = wordsToNumber(name).replace(/^\d+\s+(?:of\s+)?/i,'').trim();
    temp.push({ name, qty });
  });

  // Root consolidation
  const byRoot = Object.create(null);
  temp.forEach(({name,qty})=>{
    const root = normalizeItemRoot(name);
    if(!root) return;
    if(!byRoot[root]){
      byRoot[root] = { display: deriveDisplayName(name).replace(/s\b/i,''), qty: 0 };
    }
    byRoot[root].qty += qty;
  });

  state.playerInv.item = Object.values(byRoot).map(o=>o.display);
  state.playerInv.amt  = Object.values(byRoot).map(o=>o.qty);
}

///////////////////////////START OF WEAPON EQUIP DETECTION///////////////////////////////////////
  //Detects equip/unequip commands and updates the Equipped Weapon story card.
  
function detectWeaponEquip(text) {
  // Fast exit if no relevant verbs
  let lowerFull = (text || "").toLowerCase();
  if (!/\b(equip|draw|ready|wield|hold|unsheath|arm|holster|sheath|put away|stow|return|unequip|wield)\b/.test(lowerFull)) {
    return text;
  }

  // Pull current equipped (cache)
  let equippedWeapon = state.equippedWeapon || retrieveEquippedWeaponFromSC();
  if (equippedWeapon && typeof equippedWeapon !== "string") equippedWeapon = null;

  // Build inventory item list (normalized lower-case) with fallback to state.playerInv
  const invSC = storyCards.find(sc => sc.title === "Player Inventory");
  let inventoryItems = [];
  if (invSC && typeof invSC.entry === "string" && invSC.entry.trim()) {
    // parse lines like: Item Name (Amt: X)
    for (const m of invSC.entry.matchAll(/(.+?)\s*\(.*?(\d+(?:\.\d+)?).*?\)/g)) {
      const raw = (m[1] || "").replace(/\b(the|a|an|my|your)\b/gi, '').trim();
      if (raw) inventoryItems.push(raw.toLowerCase());
    }
  } else if (state.playerInv && Array.isArray(state.playerInv.item)) {
    inventoryItems = state.playerInv.item.map(i => String(i || "").toLowerCase());
  }

  // Weapon card titles (preserve original casing for UI)
  const weaponCards = storyCards.filter(sc => (sc.type === "Weapons" || sc.category === "Weapons"));
  const weaponCardTitles = weaponCards.map(sc => sc.title || "");
  const weaponCardTitlesLower = weaponCardTitles.map(t => t.toLowerCase());

  // Regexes
  const unequipRe = /\b(unequip|holster|put away|stow|sheath|return|disarm)\b/;
  const equipRe = /\b(equip|draw|ready|wield|hold|unsheath|arm)\s+(?:my|the|your)?\s*([\w\s\-\']{2,80})/i;

  // Split clauses preserving order of intent
  const clauses = text.split(/(?:\band\b|,|;)/i).map(c => c.trim()).filter(Boolean);

  clauses.forEach(clause => {
    const lower = clause.toLowerCase();

    // 1) Unequip / holster
    if (unequipRe.test(lower)) {
      if (equippedWeapon) {
        storeEquippedWeaponToSC("");
        state.equippedWeapon = null;
        state.msgHolder += `You put away your ${equippedWeapon}.\n`;
        equippedWeapon = null;
      } else {
        state.msgHolder += "You have no weapon equipped to put away.\n";
      }
      return;
    }

    // 2) Equip / draw
    const m = clause.match(equipRe);
    if (m) {
      let rawName = (m[2] || "").trim().toLowerCase();
      // Trim trailing filler adverbs and leading determiners
      rawName = rawName.replace(/\b(now|quickly|slowly|carefully|properly|securely)\b/g, '').trim();
      rawName = rawName.replace(/^(my|the|your|this|that|these|those|some)\s+/i, '').trim();
      if (!rawName) return;

      // Candidate inventory items that likely correspond to a weapon (reduce false positives)
      const candidateInv = (inventoryItems || []).filter(it =>
        weaponCardTitlesLower.some(w => it.includes(w) || w.includes(it))
      );

      // Try: fuzzy match against candidate inventory entries
      let bestInventoryMatch = null;
      if (candidateInv.length) {
        bestInventoryMatch = findBestInventoryMatch(rawName, candidateInv);
      } else {
        // If no candidateInv (inventory may have free-form names), still try matching rawName to inventory
        bestInventoryMatch = findBestInventoryMatch(rawName, inventoryItems || []);
      }

      let selectedTitle = null; // final exact story card title to equip

      if (bestInventoryMatch) {
        // Try to resolve inventory match to a weapon story card
        // 1) exact title match (case-insensitive)
        let scMatch = weaponCards.find(sc => sc.title.toLowerCase() === bestInventoryMatch.toLowerCase());
        // 2) normalized root match
        if (!scMatch) {
          scMatch = weaponCards.find(sc => normalizeItemRoot(sc.title) === normalizeItemRoot(bestInventoryMatch));
        }
        // 3) substring containment both ways
        if (!scMatch) {
          scMatch = weaponCards.find(sc => sc.title.toLowerCase().includes(bestInventoryMatch) || bestInventoryMatch.includes(sc.title.toLowerCase()));
        }
        if (scMatch) selectedTitle = scMatch.title;
      }

      // IMPORTANT: Only allow equipping if we resolved a weapon from the player's INVENTORY.
      // This prevents players from equipping weapons that exist in story cards but are not carried.
      if (!selectedTitle) {
        state.msgHolder += "You do not have that weapon in your inventory.\n";
        return;
      }

      // Equip using canonical title (preserve exact story card title)
      storeEquippedWeaponToSC(selectedTitle);
      state.equippedWeapon = selectedTitle;
      equippedWeapon = selectedTitle;
      state.msgHolder += `You equip your ${selectedTitle}.\n`;
    }
  });

  return text;
}


///////////////////////////END OF WEAPON EQUIP DETECTION///////////////////////////////////////


/////////////////////////////////////////////////////////////////////////////////////


const maxStatKeys = ["maxLvl", "maxCp", "maxEp", "maxAtk", "maxRatk", "maxIntl"];
const statKeys = ["lvl", "cp", "ep", "atk", "ratk", "intl"];
//NOTE: Players stats will be stored in a sc. CREATE initial stats. RETRIEVE from or STORE to player stats: SC -> <- state.playerstats

//Function to create new random player stats
function newPlayerStats(){  
  state.playerStats.maxLvl = randomInt(2,30);

  maxStatKeys.forEach((mStat) => {
    state.playerStats[mStat] = state.playerStats.maxLvl;
  });

  statKeys.forEach((stat) => {
    if (stat !== "lvl") state.playerStats[stat] = randomInt(1,state.playerStats.maxLvl);
  });

  // Stat scaling
  state.playerStats.maxEp = state.playerStats.maxLvl * 2 + 80;
  state.playerStats.maxCp = (state.playerStats.maxLvl * 1.5) + (state.playerStats.intl * 2) + 80;

  // Start at full EP; CP starts at 0
  state.playerStats.ep = state.playerStats.maxEp;
  state.playerStats.cp = 0;
}

//CREATE new sc with random playerstats if sc doesnt exist
function createIfNoStatSC(){
  if (!storyCards.find(sc => sc.title === "Player Stats")) {
    // If "Player Stats" card doesn't exist, create it
    addStoryCard("Player Stats", "Blank", "Player Stats");

    // Fetch the "Player Stats" card
    const statSC = storyCards.find(sc => sc.title === "Player Stats");
    statSC.description = "Format for Modifying: Stat: num/maxNum";

    //Initialize and randomize new player stats
    newPlayerStats();

    storeStatsToSC();
  }
}

// STORES and displays the stats to player in sc
function storeStatsToSC(){
  const lines = [];
  maxStatKeys.forEach(key=>{
    if (key === "maxLvl") {
      lines.push(`LVL ${state.playerStats.maxLvl}\n`);
    } else {
      const statName = key.substring(3).toUpperCase();
      lines.push(`${statName}: ${state.playerStats[statName.toLowerCase()]}/${state.playerStats[key]}\n`);
    }
  });
  const statSC = storyCards.find(sc => sc.title === "Player Stats");
  if (!statSC) return;
  statSC.entry = lines.join("");
  if (statSC.description.length > 3000){
    const halfIndex = Math.floor(statSC.description.length/2);
    statSC.description = statSC.description.slice(0, halfIndex);
  }
}

// RETRIEVE data from sc and store to playerstats
function retrieveStatsFromSC(){
  const statMappings = {
    //lvl: 'maxLvl',
    cp: 'maxCp',
    ep: 'maxEp',
    atk: 'maxAtk',
    ratk: 'maxRatk',
    intl: 'maxIntl',
  };
  
  //Fetch SC
  const statSC = storyCards.find(sc => sc.title === "Player Stats");
  if (!statSC) {
    log('Player Stats story card not found!');
    return;
  }

  // Retrieve and split sc entry into array of stat lines
  const statEntries = statSC.entry.split("\n"); //arr of strings

  // Loop through each stat line in array and extract values
  statEntries.forEach(entry => {
    // Lvl retrieval exception
    const lvlMatch = entry.trim().match(/^(?:LVL|LEVEL)\s*[:\-]?\s*(\d+)$/i);
    if (lvlMatch) {
      state.playerStats.maxLvl = Number(lvlMatch[1]);
      return; // Skip lvl match when found
    }
    
    // Match and extract (statname, stat, maxStat)
    const match = entry.trim().match(/^([a-zA-Z]+)\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    //log("stat sc match: " + match);

    //Store value in holder
    if (match) {
      const statName = match[1].toLowerCase();  // stat name (Ex: 'atk')
      const statValue = Number(match[2]);    // current stat value (Ex: '50')
      const maxStatValue = Number(match[3]); // max stat value (Ex: '100')

      // Finally store stat and max stat in the playerStats if name is valid
      if (statMappings[statName]) { //Ex: statMappings[atk] = 'maxAtk'
        //OR operator safeguards against null values    
        state.playerStats[statName] = statValue ?? state.playerStats[statName];
        state.playerStats[statMappings[statName]] = maxStatValue ?? state.playerStats[statMappings[statName]];
      }
    }
  });

  //log(state.playerStats);
}

// Function to increment the player's stats
function statUp(statName,incAmt){
  if(typeof incAmt !== "number"){ incAmt = 0; }
  incAmt = Math.round(Number(incAmt) * 100) / 100;

  const maxStatName = "max" + statName.charAt(0).toUpperCase() + statName.slice(1);
  const stat = state.playerStats[statName];

  // Gauges: CP and EP
  if(statName === "cp" || statName === "ep"){
    state.playerStats[statName] = Math.round((state.playerStats[statName] + incAmt) * 100) / 100;

    if (statName === "ep" && state.playerStats.ep > state.playerStats[maxStatName]) {
      state.playerStats.ep = state.playerStats[maxStatName];
    }
    if (statName === "cp" && state.playerStats.cp < 0) {
      state.playerStats.cp = 0;
    }
    if (state.playerStats.cp > state.playerStats.maxCp) {
      state.gameOver = true;
    }

    const statSC = storyCards.find(sc => sc.title === "Player Stats");
    const sign = incAmt >= 0 ? "⬆️" : "🔻";
    statSC.description = `Log ${state.turnCount} | ${statName.toUpperCase()} ${sign} :  ${stat} → ${state.playerStats[statName]} (Δ ${incAmt})\n` + statSC.description;
    state.msgHolder += `${statName.toUpperCase()} ${sign} :  ${stat} → ${state.playerStats[statName]}\n`;
  } else {
    // Non-gauges: ATK, RATK, INTL
    const scaledIncAmt = Math.round((incAmt * (1.32 * Math.exp(-0.02 * stat))) * 100) / 100;
    const newStat = Math.round((stat + scaledIncAmt) * 100) / 100;
    state.playerStats[statName] = Math.min(newStat, state.playerStats[maxStatName]);

    const statSC = storyCards.find(sc => sc.title === "Player Stats");
    const sign = incAmt >= 0 ? "⬆️" : "🔻";
    statSC.description = `Log ${state.turnCount} | ${statName.toUpperCase()} ${sign} :  ${stat} → ${state.playerStats[statName]} (Scaled Δ ${scaledIncAmt})\n` + statSC.description;
  }

  storeStatsToSC(); 
}
function playerNaturalRegen(){
  // Corruption recovery and minor EP drain
  statUp("cp",-2);
  if(state.playerStats.ep > 0){
    statUp("ep",-1 * randomFloat(0,1));
  }
}



//create a Player Injuries story card if it doesn't exist
function createIfNoInjurySC() {
  let injSC = storyCards.find(sc => sc.title === "Player Injuries");
  if (!injSC) {
    addStoryCard("Player Injuries", "Tracks all current injuries.", "Player Stats");
    injSC = storyCards.find(sc => sc.title === "Player Injuries");
    injSC.description = (injSC.description && injSC.description.trim())
      ? injSC.description
      : "Each line: [Turn] | [Severity] | [Body Part] | [Description]";
    injSC.entry = injSC.entry || "";
    log("[InjurySC] created");
  }
  return injSC;
}

// ===== MULTI-SUIT ARMOR SYSTEM =====

// Ensure Equipped Armor SC exists
function createIfNoEquippedArmorSC() {
  if (!storyCards.find(sc => sc.title === "Equipped Armor")) {
    addStoryCard("Equipped Armor", "Currently equipped armor suit.", "Equipped Gear");
    const eq = storyCards.find(sc => sc.title === "Equipped Armor");
    eq.description = "Edit this to switch armor manually. Must exactly match an Armor card title.";
    eq.entry = "Unarmoured";
  }
}

// Read equipped armor name
function retrieveEquippedArmorName() {
  const eq = storyCards.find(sc => sc.title === "Equipped Armor");
  return eq && eq.entry ? eq.entry.trim() : "Unarmoured";
}

// Store equipped armor name
function storeEquippedArmorName(name) {
  createIfNoEquippedArmorSC();
  const eq = storyCards.find(sc => sc.title === "Equipped Armor");
  eq.entry = name || "Unarmoured";
}

/* === Armor Canonicalization Helpers (dedupe armor cards) === */
function normalizeArmorName(raw){
  /*
    Improved canonical normalizer (Nova 2025-08-16)
    Fixes cases like:
      "a set of scout armor" -> "scout"
      "put on a suit of adaptive ceramite armor" -> "adaptive ceramite"
      "the ancient suit of plated armor" -> "ancient plated"
    Approach:
      1) Strip wrapper patterns "(a) (set|suit|armor|armour) of" entirely so the dangling "of" doesn’t remain.
      2) Remove articles/pronouns.
      3) Remove generic armor nouns.
      4) Remove a leading solitary "of" if it still survives (rare edge cases).
      5) Collapse whitespace and fallback to 'unarmoured' if empty.
  */
  if(!raw) return "";
  let s = raw.toLowerCase();

  // Normalize punctuation to spaces
  s = s.replace(/[^a-z0-9\s]/g," ");

  // Remove wrapper constructs like "a set of", "set of", "suit of", "armor of"
  // (includes optional leading article 'a')
  s = s.replace(/\b(a\s+)?(set|suit|armor|armour)\s+of\s+/g," ");

  // Remove articles/pronouns
  s = s.replace(/\b(my|the|a|an|your|this|that|these|those|some)\b/g," ");

  // Remove remaining generic armor terms
  s = s.replace(/\b(armor|armour|suit|set)\b/g," ");

  // If a leading 'of' still survives (e.g. exotic patterns), drop it
  s = s.replace(/^\s*of\b/," ");

  // Collapse whitespace
  s = s.replace(/\s+/g," ").trim();

  if(!s) s = "unarmoured";
  return s;
}

  function setPendingGearGen(type, title, source, force) {
  // Guard: don't clobber an existing blocking job unless 'force' === true.
  if (!type || !title) return;
  // Normalize title and ignore default/unarmoured placeholders so we don't schedule
  // pointless blocking jobs that never generate stats.
  const normalizedTitle = String(title).trim().toLowerCase();
  if (normalizedTitle === "unarmoured" || normalizedTitle === "unarmored" || normalizedTitle === "") {
    if (state._acsDebug) log(`[GearGen] Ignoring pending job for default/empty title: "${title}"`);
    return;
  }

  state._pendingItemStatGen = state._pendingItemStatGen || [];

  if (state._pendingGearGen && !force) {
    // Defer into the queue (avoid duplicate)
    if (!state._pendingItemStatGen.some(o => o.title && o.title.toLowerCase() === title.toLowerCase())) {
      state._pendingItemStatGen.push({ type, title, source });
      if (state._acsDebug) log(`[GearGen] Deferred pending job -> queued: ${title}`);
    } else {
      if (state._acsDebug) log(`[GearGen] Duplicate job not queued: ${title}`);
    }
    return;
  }

  // Set immediate blocking job
  state._pendingGearGen = {
    type,
    title,
    seed: (source || "").split(/\r?\n/).slice(-20).join("\n")
  };
  if (state._acsDebug) log(`[GearGen] Pending job SET: ${type} -> ${title}`);
}

// (2) Enqueue a new job (avoid duplicates)  
function queueBlockingGearGen(type, title, source) {
  state._pendingItemStatGen = state._pendingItemStatGen || [];
  if (!state._pendingItemStatGen.some(o => o.title === title)) {
    state._pendingItemStatGen.push({ type, title, source });
  }
}

// (3) Pop the next job when ready  
function activateNextGearJob() {
  state._pendingItemStatGen = state._pendingItemStatGen || [];
  if (!state._gearGenActive && state._pendingItemStatGen.length) {
    state._gearGenActive = state._pendingItemStatGen.shift();
    state._gearGenActive._announced = false;
  }
}


// (4) Prepare a scratch‐array for non‐blocking segments  
let extraSegs = [];


// Find armor card by CanonicalName: line
function findArmorCardByCanonical(canon){
  if(!canon) return null;
  return storyCards.find(sc =>
    (sc.category === "Armor" || /armor/i.test(sc.category||"")) &&
    sc.entry && new RegExp(`^CanonicalName:\\s*${canon}\\b`,'im').test(sc.entry)
  ) || null;
}

// Ensure CanonicalName line exists at top
function ensureArmorCardCanonicalLine(sc, canon){
  if(!sc || !canon) return;
  if(!/^\s*CanonicalName:/im.test(sc.entry||"")){
    sc.entry = `CanonicalName: ${canon}\n` + sc.entry;
  }
}

/* One-time migration (adds CanonicalName to existing armor cards) */
function migrateArmorCardsAddCanonical(){
  storyCards.filter(sc => sc.category === "Armor").forEach(sc=>{
    // Derive tentative name line
    let nameLine = (sc.entry.match(/^Armor:\s*(.+)$/im)||[])[1] || sc.title;
    const canon = normalizeArmorName(nameLine)||"unarmoured";
    ensureArmorCardCanonicalLine(sc, canon);
  });
}

function getOrCreateArmorCard(name) {
  name = (name && name.trim()) ? name.trim() : "Unarmoured";
  const canon = normalizeArmorName(name) || "unarmoured";

  // Primary lookup by CanonicalName
  let sc = findArmorCardByCanonical(canon);
  if (sc) {
    ensureArmorCardCanonicalLine(sc, canon);
    return sc;
  }

  // Secondary: title match (legacy)
  sc = storyCards.find(sc => sc.title.toLowerCase() === name.toLowerCase());
  if (!sc) {
    addStoryCard(name, "Armor & shield status.", "Armor");
    sc = storyCards.find(s => s.title === name);
    sc.description = "Format:\nArmor: Name\nShield: current/max (State)\nDirected Energy: Class N\nThermal: Class N\nKinetic: Class N\nPsychic: Class N\nSonic: Class N\nOther: Class N\n--\nDamage Log:\n(Recent first)";
    sc.entry =
      `CanonicalName: ${canon}\n` +
      `Armor: ${name}\n` +
      `Shield: 0/0 (None)\n` +
      `Directed Energy: Class 0\n` +
      `Thermal: Class 0\n` +
      `Kinetic: Class 0\n` +
      `Psychic: Class 0\n` +
      `Sonic: Class 0\n` +
      `Other: Class 0\n--\nDamage Log:\n`;

    // PATCH: only set pending gear job for stat generation when it's not the default "unarmoured"
    if (canon !== "unarmoured" && name.toLowerCase() !== "unarmoured") {
      setPendingGearGen("armor", name, sc.entry);
    } else {
      if (state._acsDebug) log(`[GearGen] Skipping pending generation for default armor card: "${name}"`);
    }
  } else {
    ensureArmorCardCanonicalLine(sc, canon);
  }
  return sc;
}
// Retrieve current suit into state.armor
function retrieveArmorFromSC() {
  const equipped = retrieveEquippedArmorName();
  const sc = getOrCreateArmorCard(equipped);
  if (!sc.entry) return;

  state.armor = state.armor || {
    name: equipped,
    resist: { directed:0, thermal:0, kinetic:0, psychic:0, sonic:0, other:0 },
    shield: { charge:0, max:0, inRegen:false, regenDelay:2, regenRate:20, regenCD:0 },
    damageLog: []
  };
  state.armor.name = equipped;

  const lines = sc.entry.split(/\r?\n/);
  lines.forEach(line => {
    let m;
    if ((m = line.match(/^Armor:\s*(.+)$/i))) {
      state.armor.name = m[1].trim();
    } else if ((m = line.match(/^Shield:\s*(\d+)\s*\/\s*(\d+)/i))) {
      state.armor.shield.charge = Number(m[1]);
      state.armor.shield.max = Number(m[2]);
      if (state.armor.shield.charge > state.armor.shield.max) state.armor.shield.charge = state.armor.shield.max;
    } else if ((m = line.match(/^Directed Energy:\s*Class\s*(\d+)/i))) {
      state.armor.resist.directed = Number(m[1]);
    } else if ((m = line.match(/^Thermal:\s*Class\s*(\d+)/i))) {
      state.armor.resist.thermal = Number(m[1]);
    } else if ((m = line.match(/^Kinetic:\s*Class\s*(\d+)/i))) {
      state.armor.resist.kinetic = Number(m[1]);
    } else if ((m = line.match(/^Psychic:\s*Class\s*(\d+)/i))) {
      state.armor.resist.psychic = Number(m[1]);
    } else if ((m = line.match(/^Sonic:\s*Class\s*(\d+)/i))) {
      state.armor.resist.sonic = Number(m[1]);
    } else if ((m = line.match(/^Other:\s*Class\s*(\d+)/i))) {
      state.armor.resist.other = Number(m[1]);
    } else if ((m = line.match(/^Shield Regen Delay:\s*(\d+)/i))) {
      state.armor.shield.regenDelay = Number(m[1]);
    } else if ((m = line.match(/^Shield Regen Rate:\s*(\d+)/i))) {
      state.armor.shield.regenRate = Number(m[1]);
    }
  });

  // Safety defaults if missing
  const sh = state.armor.shield;
  if (typeof sh.regenDelay !== "number" || isNaN(sh.regenDelay)) sh.regenDelay = 2;
  if (typeof sh.regenRate !== "number"  || isNaN(sh.regenRate))  sh.regenRate  = 20;
  if (typeof sh.regenCD !== "number"    || isNaN(sh.regenCD))    sh.regenCD    = 0;
}


// Store state.armor back to its suit card
function storeArmorToSC() {
  const equipped = retrieveEquippedArmorName();
  const sc = getOrCreateArmorCard(equipped);
  const oldEntry = sc.entry || "";
  const a = state.armor || {};
  const r = a.resist || {};
  const sh = a.shield || {};

  sh.regenDelay = (typeof sh.regenDelay === "number") ? sh.regenDelay : 2;
  sh.regenRate  = (typeof sh.regenRate === "number")  ? sh.regenRate  : 20;
  sh.regenCD    = (typeof sh.regenCD === "number")    ? sh.regenCD    : 0;

  let stateLabel;
  if (sh.max <= 0) stateLabel = "(None)";
  else if (sh.inRegen && sh.regenCD > 0) stateLabel = "(Cooldown)";
  else if (sh.inRegen && sh.regenCD === 0) stateLabel = "(Regen)";
  else stateLabel = "(Ready)";

  const shieldLine = sh.max > 0
    ? `Shield: ${Math.max(0, Math.round(sh.charge))}/${sh.max} ${stateLabel}`
    : "Shield: 0/0 (None)";

  // Preserve or reconstruct canonical line
  const existingCanon = (oldEntry.match(/^CanonicalName:\s*(.+)$/im)) ? RegExp.$1.trim() : null;
  const canon = existingCanon || normalizeArmorName(a.name || equipped) || "unarmoured";

  // Collect unknown / future meta lines (above first --)
  const knownMetaRegexes = [
    /^CanonicalName:/i,
    /^Armor:/i,
    /^Shield:/i,
    /^Shield Regen Delay:/i,
    /^Shield Regen Rate:/i,
    /^Directed Energy:/i,
    /^Thermal:/i,
    /^Kinetic:/i,
    /^Psychic:/i,
    /^Sonic:/i,
    /^Other:/i,
    /^Damage Log:/i,
    /^--$/i
  ];
  const linesRaw = oldEntry.split(/\r?\n/);
  const sepIndex = linesRaw.findIndex(l => /^--$/i.test(l.trim()));
  const headerSlice = sepIndex === -1 ? linesRaw : linesRaw.slice(0, sepIndex);
  const preservedUnknown = headerSlice
    .map(l => l.trim())
    .filter(l =>
      l.length &&
      !knownMetaRegexes.some(rx => rx.test(l))
    );

  const lines = [
    `CanonicalName: ${canon}`,
    `Armor: ${a.name || equipped}`,
    ...preservedUnknown,          // preserved custom metadata (if any)
    shieldLine,
    `Shield Regen Delay: ${sh.regenDelay}`,
    `Shield Regen Rate: ${sh.regenRate}`,
    `Directed Energy: Class ${r.directed ?? 0}`,
    `Thermal: Class ${r.thermal ?? 0}`,
    `Kinetic: Class ${r.kinetic ?? 0}`,
    `Psychic: Class ${r.psychic ?? 0}`,
    `Sonic: Class ${r.sonic ?? 0}`,
    `Other: Class ${r.other ?? 0}`,
    `--`,
    `Damage Log:`
  ];

  if (Array.isArray(a.damageLog)) {
    a.damageLog.slice(0, 20).forEach(entry => lines.push(entry));
  }

  sc.entry = lines.join("\n");
}



// Detect armor equip/unequip commands
function detectArmorEquip(text) {
  if (isPlayerDialoguing(text)) return text;
  const lower = text.toLowerCase();

  // Unequip patterns
  if (/(?:unequip|remove|take off|doff|stow)\s+(?:my|the|your)?\s*(armor|armour|suit|set)/i.test(lower)) {
    storeEquippedArmorName("Unarmoured");
    state.armor.name = "Unarmoured";
    state.msgHolder += "You remove your armor.\n";
    return text;
  }

  // Match equip phrases
  const m = lower.match(/\b(equip|don|wear|put on)\s+(?:my|the|your)?\s*([\w\- ]{2,80})/i);
  if (!m) return text;

  // Raw phrase AFTER the verb (keep generic word for title)
  let fullPhrase = m[2].trim();

  // Remove trailing filler words
  fullPhrase = fullPhrase.replace(/\b(now|quickly|slowly|carefully|properly|securely)\b/gi, '').trim();

  // Remove leading determiners/pronouns inside the captured phrase (if any slipped through)
  fullPhrase = fullPhrase.replace(/^(my|the|your|this|that|these|those|some)\s+/i, '').trim();

  if (!fullPhrase) fullPhrase = "Unarmoured";

  // Canonical key (strips generic terms)
  const canon = normalizeArmorName(fullPhrase) || "unarmoured";

  // Reuse existing card if any
  let existing = findArmorCardByCanonical(canon);
  if (existing) {
    storeEquippedArmorName(existing.title);
    retrieveArmorFromSC();
    state.msgHolder += `You equip your ${existing.title}.\n`;
    return text;
  }

  // Build display title:
  // Title case words
  function titleCase(s){
    return s.split(/\s+/).filter(Boolean)
      .map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase())
      .join(" ");
  }
  let displayTitle = titleCase(fullPhrase);

  // If user phrase lacked any generic term, append "Armor" for clarity
  if (!/\b(armor|armour|suit|set)\b/i.test(displayTitle) && displayTitle.toLowerCase() !== "unarmoured") {
    displayTitle += " Armor";
  }

  // Create new card with full descriptive title
  getOrCreateArmorCard(displayTitle);
  storeEquippedArmorName(displayTitle);
  retrieveArmorFromSC();
  state.msgHolder += `You equip your ${displayTitle}.\n`;
  return text;
}


function updateShieldTurn() {
  const sh = state.armor && state.armor.shield;
  if (!sh || sh.max <= 0) return;

  // Trigger depletion -> cooldown
  if (sh.charge <= 0 && !sh.inRegen) {
    sh.charge = 0;
    sh.inRegen = true;
    sh.regenCD = sh.regenDelay;
    state.msgHolder += "Your shield is depleted and begins its cooldown.\n";
  }

  if (sh.inRegen) {
    if (sh.regenCD > 0) {
      sh.regenCD--;
      if (sh.regenCD === 0) {
        state.msgHolder += "Shield recharge begins.\n";
      }
    } else {
      sh.charge += sh.regenRate;
      if (sh.charge >= sh.max) {
        sh.charge = sh.max;
        sh.inRegen = false;
        sh.regenCD = 0;
        state.msgHolder += "Shield fully recharged.\n";
      } else {
        state.msgHolder += `Shield recharging (${Math.round(sh.charge)}/${sh.max}).\n`;
      }
    }
  }
}

// ===== END MULTI-SUIT ARMOR SYSTEM =====


//////////////////////////////////////////WEAPONS///////////////////////////////////////////

const weaponmodKeys = ["ammoMod", "condMod"];
const weaponStatKeysForMod = ["ammo", "cond"];

// CREATE new sc with Weapon Modifiers if sc doesn't exist
function createIfNoWeaponmodSC() {
  if (!storyCards.find(sc => sc.title === "Weapon Modifiers")) {
    addStoryCard("Weapon Modifiers", "Blank", "Weapons");
    const weaponmodSC = storyCards.find(sc => sc.title === "Weapon Modifiers");
    weaponmodSC.description = `Format for Modifying: Modifier: num\nModifiers influence your weapon stats.`;
    weaponmodKeys.forEach(key => {
      state.weaponModifiers[key] = 0;
    });
    storeWeaponmodsToSC();
  }
}

// STORES and displays the modifiers to weapons in sc
function storeWeaponmodsToSC() {
  let formatForSC = [];
  weaponmodKeys.forEach((key) => {
    const weaponmodName = key.replace("Mod", "").toUpperCase();
    formatForSC.push(`${weaponmodName} Modifier: ${state.weaponModifiers[key]}%\n`);
  });
  const weaponmodSC = storyCards.find(sc => sc.title === "Weapon Modifiers");
  weaponmodSC.entry = formatForSC.join("").replace(/,/g, '');
  if (weaponmodSC.description.length > 3000) {
    let halfIndex = Math.floor(weaponmodSC.description.length / 2);
    weaponmodSC.description = weaponmodSC.description.slice(0, halfIndex);
    console.log("Trimming weaponmodSC description to prevent memory overload.");
  }
}

// RETRIEVE data from sc and store to Weapon Modifiers
function retrieveWeaponmodsFromSC() {
  const weaponmodSC = storyCards.find(sc => sc.title === "Weapon Modifiers");
  // Safety guard: exit if card doesn't exist or entry not available
  if (!weaponmodSC || typeof weaponmodSC.entry !== 'string') return;
  const weaponmodEntries = weaponmodSC.entry.split("\n");
  weaponmodEntries.forEach(entry => {
    const match = entry.trim().match(/^([A-Z]+)\s+Modifier:\s*(-?\d+(?:\.\d+)?)(?:%)?$/);
    if (match) {
      let weaponmodName = match[1].toLowerCase() + 'Mod';
      let weaponmodValue = Number(match[2]);
      state.weaponModifiers[weaponmodName] = weaponmodValue ?? state.weaponModifiers[weaponmodName];
    }
  });
}

// CREATE new story card for equipped weapon in "Equipped Gear" category if it doesn't exist
function createIfNoEquippedWeaponSC() {
  if (!storyCards.find(sc => sc.title === "Equipped Weapon")) {
    addStoryCard("Equipped Weapon", "Currently equipped weapon.", "Equipped Gear");
    // Optionally, set a description for the card
    let eqSC = storyCards.find(sc => sc.title === "Equipped Weapon");
    eqSC.description = "Stores the name of your currently equipped weapon. Format: Weapon Name";
    eqSC.entry = ""; // Start empty
  }
}

// Store equipped weapon in the "Equipped Gear" category
function storeEquippedWeaponToSC(weaponName) {
  createIfNoEquippedWeaponSC();
  let eqSC = storyCards.find(sc => sc.title === "Equipped Weapon");
  eqSC.entry = weaponName || "";
}

// Retrieve equipped weapon from the "Equipped Gear" category
function retrieveEquippedWeaponFromSC() {
  let eqSC = storyCards.find(sc => sc.title === "Equipped Weapon");
  return eqSC && eqSC.entry ? eqSC.entry : null;
}


// Initialize Weapon stats for currently equipped weapon
function getCurrentWeaponName() {
  // Use state.equippedWeapon if set, else default to first weapon card
  if (state.equippedWeapon) return state.equippedWeapon;
  const weaponCard = storyCards.find(sc => sc.type === "Weapons" || sc.category === "Weapons");
  return weaponCard ? weaponCard.title : null;
}

// CREATE new sc with weaponstats if sc doesn't exist
function createIfNoWeaponSC() {
  // Only create starter weapons if NO weapon cards exist
  if (!storyCards.some(sc => sc.type === "Weapons" || sc.category === "Weapons")) {
    // Laspistol
    addStoryCard("Laspistol", "A simple starter weapon.", "Weapons");
    const laspistolSC = storyCards.find(sc => sc.title === "Laspistol");
    laspistolSC.description = "Format for Modifying: Stat: num/maxNum";
    laspistolSC.entry =
      "Laspistol\n" +
      "COND: 100/100\n" +
      "AMMO: 20/20\n" +
      "DMG TYPE: Laser Class 1\n" +
      "AMMO ITEM: micro cell\n" +
      "Laspistol\n" +
      "The Laspistol is a compact sidearm favored for its reliability and ease of use. Effective at close range.\n";

    // Lasrifle
    addStoryCard("Lasrifle", "A standard-issue rifle with burst fire capability.", "Weapons");
    const lasrifleSC = storyCards.find(sc => sc.title === "Lasrifle");
    lasrifleSC.description = "Format for Modifying: Stat: num/maxNum";
    lasrifleSC.entry =
      "Lasrifle\n" +
      "COND: 100/100\n" +
      "AMMO: 50/50\n" +
      "DMG TYPE: Laser Class 2\n" +
      "AMMO ITEM: power cell\n" +
      "Burst Fire Mode: OFF\n" +
      "Lasrifle\n" +
      "The Lasrifle is a standard-issue rifle, reliable, rugged and versatile for most combat situations.\n";

    // RS-43 Longstrike
    addStoryCard("RS-43 Longstrike", "A powerful rifle with overcharge capability for increased damage.", "Weapons");
    const longstrikeSC = storyCards.find(sc => sc.title === "RS-43 Longstrike");
    longstrikeSC.description = "Format for Modifying: Stat: num/maxNum";
    longstrikeSC.entry =
      "RS-43 Longstrike\n" +
      "COND: 100/100\n" +
      "AMMO: 20/20\n" +
      "DMG TYPE: Laser Class 3\n" +
      "AMMO ITEM: power cell\n" +
      "Overcharge Mode: OFF\n" +
      "RS-43 Longstrike\n" +
      "The RS-43 Longstrike is a powerful long-range rifle with overcharge capability for greatly increased damage at the cost of full power cell consumption.\n";

    // Vibro Blade
    addStoryCard("Vibro Blade", "A deadly vibrating blade with microscopic serrations.", "Weapons");
    const vibroBladeSC = storyCards.find(sc => sc.title === "Vibro Blade");
    vibroBladeSC.description = "Format for Modifying: Stat: num/maxNum";
    vibroBladeSC.entry =
      "Vibro Blade\n" +
      "COND: 100/100\n" +
      "CHARGE: 100/100\n" +
      "DMG TYPE: Vibration/Cutting\n" +
      "CHARGE ITEM: power cell\n" +
      "Vibro Blade\n" +
      "The Vibro Blade is a fearsome melee weapon with microscopic serrated edges that vibrate at ultrasonic frequencies. When activated, it can slice through armor and flesh with terrifying efficiency, creating a distinctive humming sound. Standard issue for close-quarters combat specialists.";

    // Ensure cache reflects newly created starter weapons
    invalidateWeaponRootsCache();
  }
}

// STORES and displays weapon stats in sc
function storeWeaponToSC(weaponName, weaponStatsOverride) {
  weaponName = weaponName || getCurrentWeaponName();
  if (!weaponName) return;
  const weaponSC = storyCards.find(sc => sc.title.toLowerCase() === weaponName.toLowerCase());
  if (!weaponSC) {
    log(`Weapon story card not found for: ${weaponName}`);
    return;
  }
  let stats = weaponStatsOverride || retrieveWeaponStatsFromEntry(weaponSC.entry);

  // Split the original entry into lines
  let lines = weaponSC.entry.split('\n');
  let newLines = [];
  let used = {
    cond: false,
    ammo: false,
    dmg: false,
    ammoItem: false,
    burst: false,
    overcharge: false
  };

  // Replace or update stat lines, preserve others (flavor text, etc.)
  for (let line of lines) {
    if (/^COND:/i.test(line)) {
      newLines.push(`COND: ${stats.cond}/${stats.maxCond}`);
      used.cond = true;
    } else if (/^AMMO:/i.test(line)) {
      newLines.push(`AMMO: ${stats.ammo}/${stats.maxAmmo}`);
      used.ammo = true;
    } else if (/^DMG TYPE:/i.test(line)) {
      newLines.push(`DMG TYPE: ${stats.dmgType || "Laser"}`);
      used.dmg = true;
    } else if (/^AMMO ITEM:/i.test(line)) {
      newLines.push(`AMMO ITEM: ${stats.ammoItem || ""}`);
      used.ammoItem = true;
    } else if (/^Burst Fire Mode:/i.test(line)) {
        newLines.push(`Burst Fire Mode: ${stats.burstFireMode ? "ON" : "OFF"}`);
        used.burst = true;
    } else if (/^Overcharge Mode:/i.test(line)) {
      newLines.push(`Overcharge Mode: ${stats.overchargeMode ? "ON" : "OFF"}`);
      used.overcharge = true;
    } else {
      newLines.push(line);
    }
  }

  // Only add missing stat lines if they were present in the original entry
  // Insert in correct order: COND, AMMO, DMG TYPE, AMMO ITEM, [Burst/Overcharge], [other]
  function insertAfter(label, value) {
    let idx = newLines.findIndex(l => new RegExp(`^${label}:`, "i").test(l));
    if (idx !== -1) {
      newLines.splice(idx + 1, 0, value);
    }
  }
  // Add missing lines in correct order if they existed in original
  if (!used.cond && lines.some(l => /^COND:/i.test(l)))
    newLines.unshift(`COND: ${stats.cond}/${stats.maxCond}`);
  if (!used.ammo && lines.some(l => /^AMMO:/i.test(l)))
    insertAfter("COND", `AMMO: ${stats.ammo}/${stats.maxAmmo}`);
  if (!used.dmg && lines.some(l => /^DMG TYPE:/i.test(l)))
    insertAfter("AMMO", `DMG TYPE: ${stats.dmgType || "Laser"}`);
  if (!used.ammoItem && lines.some(l => /^AMMO ITEM:/i.test(l)))
    insertAfter("DMG TYPE", `AMMO ITEM: ${stats.ammoItem || ""}`);
  if (!used.burst && lines.some(l => /^Burst Fire Mode:/i.test(l)))
    insertAfter("AMMO ITEM", `Burst Fire Mode: ${stats.burstFireMode ? "ON" : "OFF"}`);
  if (!used.overcharge && lines.some(l => /^Overcharge Mode:/i.test(l)))
    insertAfter("AMMO ITEM", `Overcharge Mode: ${stats.overchargeMode ? "ON" : "OFF"}`);

  weaponSC.entry = newLines.join('\n').replace(/^\n+|\n+$/g, '');
  if (weaponSC.description.length > 3000) {
    let halfIndex = Math.floor(weaponSC.description.length / 2);
    weaponSC.description = weaponSC.description.slice(0, halfIndex);
    console.log("Trimming weaponSC description to prevent memory overload.");
  }
}


// Helper: Parse weapon stats from entry string
function retrieveWeaponStatsFromEntry(entry) {
  let stats = { cond: 100, ammo: 50, maxCond: 100, maxAmmo: 50, burstFireMode: false, overchargeMode: false, dmgType: "Laser" };
  entry.split("\n").forEach(line => {
    let match = line.match(/^COND:\s*(\d+)\s*\/\s*(\d+)/i);
    if (match) {
      stats.cond = Number(match[1]);
      stats.maxCond = Number(match[2]);
    }
    match = line.match(/^AMMO:\s*(\d+)\s*\/\s*(\d+)/i);
    if (match) {
      stats.ammo = Number(match[1]);
      stats.maxAmmo = Number(match[2]);
    }
    match = line.match(/^DMG TYPE:\s*(.+)$/i);
    if (match) {
      stats.dmgType = match[1].trim();
    }
    match = line.match(/^AMMO ITEM:\s*(.+)$/i);
    if (match) {
      stats.ammoItem = match[1].trim();
    }
    match = line.match(/^Burst Fire Mode:\s*(ON|OFF)$/i);
    if (match) {
      stats.burstFireMode = match[1].toUpperCase() === "ON";
    }
    match = line.match(/^Overcharge Mode:\s*(ON|OFF)$/i);
    if (match) {
      stats.overchargeMode = match[1].toUpperCase() === "ON";
    }
  });
  return stats;
}

function parseWeaponDamageString(raw){
  if(!raw||typeof raw!=="string") return {raw:raw||"",components:[]};
  const cleaned = raw.replace(/DMG TYPE:\s*/i,'').trim();
  if(!cleaned) return {raw,components:[]};
  const groups = cleaned.split(/[\+,&]+/).map(g=>g.trim()).filter(Boolean);
  const comps=[];
  groups.forEach(g=>{
    let classNums=[];
    const cm=g.match(/Class\s+([0-9\/\s]+)/i);
    if(cm){
      classNums = cm[1].trim().split(/\s*\/\s*/).map(n=>parseInt(n,10)||1);
      g = g.replace(/Class\s+[0-9\/\s]+/i,'').trim();
    }
    const toks = g.split(/\/+/).map(t=>t.trim()).filter(Boolean);
    toks.forEach((tok,i)=>{
      const base=tok.toLowerCase();
      const key = DAMAGE_TYPE_ALIASES[base] || DAMAGE_TYPE_ALIASES[base.replace(/s$/,'')] || "other";
      const cls = classNums[i]!=null ? classNums[i] : (classNums.length===1?classNums[0]:1);
      comps.push({source:tok,type:key,class:cls});
    });
  });
  const merged={};
  comps.forEach(c=>{
    if(!merged[c.type] || c.class>merged[c.type].class) merged[c.type]=c;
  });
  return {raw,components:Object.values(merged)};
}

function getWeaponDamagePacket(weaponName){
  weaponName = weaponName || getCurrentWeaponName();
  if(!weaponName) return {raw:"",components:[]};
  const sc = storyCards.find(s=>s.title.toLowerCase()===weaponName.toLowerCase());
  if(!sc||!sc.entry) return {raw:"",components:[]};
  const dmgLine = sc.entry.split(/\n/).find(l=>/^DMG TYPE:/i.test(l)) || "";
  const parsed = parseWeaponDamageString(dmgLine.replace(/^DMG TYPE:\s*/i,''));
  parsed.timestamp=Date.now();
  state.lastDamagePacket = parsed;
  return parsed;
}

function evaluateDamageAgainstArmor(dmgPacket, armorObj){
  const resist = (armorObj && armorObj.resist) ? armorObj.resist : {directed:0,thermal:0,kinetic:0,psychic:0,sonic:0,other:0};
  const results = [];
  if(!dmgPacket || !Array.isArray(dmgPacket.components)) return { components: results };
  dmgPacket.components.forEach(c=>{
    const r = Number(resist[c.type]) || 0;
    const diff = r - c.class;
    let tier;
    if (diff > 4) tier = "none";
    else if (diff > 0) tier = "moderate";
    else if (diff === 0) tier = "exact";
    else tier = "defeated";
    results.push({ type:c.type, weaponClass:c.class, resist:r, diff, tier });
  });
  const orderRank = { defeated:0, exact:1, moderate:2, none:3 };
  results.sort((a,b)=> orderRank[a.tier]-orderRank[b.tier] || (b.weaponClass - a.weaponClass));
  return { components: results };
}

// --- Armor Damage Tag Regex + Parser ---
const ARMOR_DMG_FLAG_REGEX = /<!armorDmg>([\s\S]*?)<\/armorDmg>/gi;

/**
 * Parse semicolon or comma separated key=value pairs inside <!armorDmg>...</armorDmg>
 * Example payload: type=directed;tier=defeated;damageClass=3;resistClass=1;shieldBefore=25;shieldAfter=0;notes=shield collapse
 */

function consumeArmorDamageFlags(text){
  // Parse all <!armorDmg>...</armorDmg> blocks (even if model misbehaves and emits several)
  ARMOR_DMG_FLAG_REGEX.lastIndex = 0;
  let m;
  const rawEntries = [];
  while((m = ARMOR_DMG_FLAG_REGEX.exec(text)) !== null){
    const inner = (m[1]||"").trim();
    if(!inner) continue;
    const obj = {};
    inner.split(/[;,]\s*/).forEach(pair=>{
      const kv = pair.split("=");
      if(kv.length>=2){
        const k = kv[0].trim().toLowerCase();
        const v = kv.slice(1).join("=").trim();
        obj[k] = v;
      }
    });
    rawEntries.push(obj);
  }
  if(!rawEntries.length){
    return { hadFlags:false, entries:[], cleanedText:text };
  }

  // Pick strongest by tier precedence then highest weaponClass
  const tierRank = { defeated:3, exact:2, moderate:1, none:0 };
  rawEntries.forEach(o=>{
    o.tier = (o.tier||"").toLowerCase();
    if(!tierRank.hasOwnProperty(o.tier)) o.tier = "moderate"; // fallback
    o.weaponClass = parseInt(o.weaponClass||o.damageclass||"0",10)||0;
    o.resist = parseInt(o.resist||"0",10)||0;
    if(o.shieldbefore!=null) o.shieldBefore = parseInt(o.shieldbefore,10)||0;
    if(o.shieldafter!=null)  o.shieldAfter  = parseInt(o.shieldafter,10)||0;
  });

  rawEntries.sort((a,b)=>{
    const tdiff = (tierRank[b.tier]-tierRank[a.tier]);
    if (tdiff) return tdiff;
    return b.weaponClass - a.weaponClass;
  });

  const chosen = rawEntries[0];

  // Helper to format summary
  function formatArmorDamageSummary(obj){
    const turn = state.turnCount || 0;
    const type = (obj.type||"?").toLowerCase();
    const tier = obj.tier;
    const wc = obj.weaponClass;
    const rs = obj.resist;
    let parts = [`T${turn}`, type, tier, `WC:${wc}/R:${rs}`];
    if(obj.shieldBefore!=null && obj.shieldAfter!=null){
      parts.push(`S:${obj.shieldBefore}→${obj.shieldAfter}`);
    }
    if(obj.notes){
      // keep short
      parts.push(obj.notes.replace(/\s+/g," ").slice(0,28));
    }
    return parts.join(" ");
  }

  const summaryLine = formatArmorDamageSummary(chosen);

  // Ensure armor state structure
  state.armor = state.armor || { damageLog:[], resist:{}, shield:{} };
  state.armor.damageLog = state.armor.damageLog || [];

  // Prepend the summary (one line per turn max)
  state.armor.damageLog.unshift(summaryLine);
  if (state.armor.damageLog.length > 50) state.armor.damageLog.length = 50;

  // Strip ALL armorDmg tag wrappers from visible output (keep inner text narrative if any)
  const cleanedText = text.replace(ARMOR_DMG_FLAG_REGEX, (_full, inner)=>(inner||"").trim());

  return { hadFlags:true, entries:[summaryLine], cleanedText };
}


// RETRIEVE data from sc and store to weapon
function retrieveWeaponFromSC(weaponName) {
  weaponName = weaponName || getCurrentWeaponName();
  if (!weaponName) return;
   const weaponSC = storyCards.find(sc => sc.title.toLowerCase() === weaponName.toLowerCase());
  if (!weaponSC) {
    log(`Weapon story card not found for: ${weaponName}`);
    return;
  }
  return retrieveWeaponStatsFromEntry(weaponSC.entry);
}

// Helper: Update weapon modes in story card
function updateWeaponModes(weaponName, weaponStats) {
  let weaponSC = storyCards.find(sc => sc.title.toLowerCase() === weaponName.toLowerCase());
  if (!weaponSC) return;

  // Split the entry into lines
  let lines = weaponSC.entry.split('\n');
  let newLines = [];
  let statLabels = [
    { label: "COND:", value: `COND: ${weaponStats.cond}/${weaponStats.maxCond}` },
    { label: "AMMO:", value: `AMMO: ${weaponStats.ammo}/${weaponStats.maxAmmo}` },
    { label: "DMG TYPE:", value: `DMG TYPE: ${weaponStats.dmgType || "Laser"}` },
    { label: "AMMO ITEM:", value: `AMMO ITEM: ${weaponStats.ammoItem || ""}` },
    { label: "Burst Fire Mode:", value: `Burst Fire Mode: ${weaponStats.burstFireMode ? "ON" : "OFF"}` },
    { label: "Overcharge Mode:", value: `Overcharge Mode: ${weaponStats.overchargeMode ? "ON" : "OFF"}` }
  ];

  for (let line of lines) {
    let trimmed = line.trim();
    let replaced = false;
    for (let stat of statLabels) {
      if (trimmed.startsWith(stat.label)) {
        newLines.push(stat.value);
        replaced = true;
        break;
      }
    }
    if (!replaced) newLines.push(line);
  }
  weaponSC.entry = newLines.join('\n').replace(/^\n+|\n+$/g, '');
}

function detectFireModeToggle(text) {
  // Only check if a weapon is equipped
  let weaponName = state.equippedWeapon || retrieveEquippedWeaponFromSC();
  if (!weaponName) return text;

  let weaponStats = retrieveWeaponFromSC(weaponName) || {};

  let changed = false;

  // Normalize input
  let t = text.toLowerCase();

  // Accept more verbs and patterns for toggling burst fire
 if (
  /(toggle|select|switch|flip|set|change|turn|enable|disable).{0,30}(burst\s*fire|burst)/i.test(t) ||
  /(burst\s*fire|burst).{0,30}(mode|on|off|enabled|disabled)/i.test(t) ||
  /(to|into)\s+burst\s*fire/i.test(t) ||
  /selector.*(to|for|into)\s*burst\s*fire/i.test(t) ||
  /flip.*selector.*burst\s*fire/i.test(t)
) {
  weaponStats.burstFireMode = !weaponStats.burstFireMode;
  updateWeaponModes(weaponName, weaponStats);
  storeWeaponToSC(weaponName, weaponStats);
  state.msgHolder += `Burst Fire Mode is now ${weaponStats.burstFireMode ? "ON" : "OFF"} for your ${weaponName}.\n`;
  changed = true;
}

  // Accept more verbs and patterns for toggling overcharge
  if (
    /(toggle|select|switch|flip|set|change|turn|enable|disable).{0,15}(overcharge)/i.test(t) ||
    /(overcharge).{0,15}(mode|on|off|enabled|disabled)/i.test(t) ||
    /(to|into)\s+overcharge/i.test(t)
  ) {
    weaponStats.overchargeMode = !weaponStats.overchargeMode;
    updateWeaponModes(weaponName, weaponStats);
    storeWeaponToSC(weaponName, weaponStats);
    state.msgHolder += `Overcharge Mode is now ${weaponStats.overchargeMode ? "ON" : "OFF"} for your ${weaponName}.\n`;
    changed = true;
  }

  if (changed) return text + " [Fire mode toggled]";
  return text;
}

function detectAttack(text) {
  return detectCombatAction(text, attackWords, 'attack');
}
function detectRangedattack(text) {
  return detectCombatAction(text, rangedattackWords, 'ranged');
}


// --- Patch statUpWeapon to use updateWeaponModes and preserve all lines ---
function statUpWeapon(statName, incAmt, weaponName) {
  weaponName = weaponName || getCurrentWeaponName();
  if (!weaponName) return;
  const weaponSC = storyCards.find(sc => sc.title.toLowerCase() === weaponName.toLowerCase());
  if (!weaponSC) return;
  let stats = retrieveWeaponStatsFromEntry(weaponSC.entry);
  incAmt = Number(incAmt) || 0;
  let maxStatName = "max" + statName.charAt(0).toUpperCase() + statName.slice(1);
  let prev = stats[statName];
  stats[statName] += incAmt;
  if (stats[statName] > stats[maxStatName]) stats[statName] = stats[maxStatName];
  if (stats[statName] < 0) stats[statName] = 0;
  // Log stat change in weapon story card
  let sign = incAmt >= 0 ? "⬆️" : "🔻";
  weaponSC.description = `Log ${state.turnCount} | ${statName.toUpperCase()} ${sign} : ${prev} → ${stats[statName]} (Change: ${incAmt})\n` + weaponSC.description;
  // Use the improved update function to preserve all lines
  updateWeaponModes(weaponName, stats);
}

////////////////////////////////Inventory Management/////////////////////////////////////////////////////
// === Unified Inventory System (Nova Refactor 2025-08-15) ===
// Goals:
//  - Single canonical representation: state.playerInv.item[] (display singular) + amt[]
//  - Root-based matching (normalizeItemRoot) for merging variants
//  - Heuristic + adjudicated pickup (detectHybridPickup + <!pickup> flags)
//  - Simple natural drop parsing (detectRemoveFromInv)
//  - Auto consolidation every store / retrieval
//  - Re-added createIfNoInvSC (was removed in prior patch) so onInput/onOutput still safe.

// (1) Create Player Inventory Story Card if missing
function createIfNoInvSC(){
  if (!storyCards.find(sc => sc.title === "Player Inventory")) {
    addStoryCard("Player Inventory", "Blank", "Player Stats");
    const invSC = storyCards.find(sc => sc.title === "Player Inventory");
    invSC.description = "Format: Item Name (Amt: X)";
    invSC.entry = "";
  }
}

// (2) Normalization → canonical root
function normalizeItemRoot(name){
  if(!name) return "";
  // Lowercase and normalize punctuation -> spaces (remove hyphens etc)
  let s = String(name).toLowerCase().replace(/[^a-z0-9\s]/g, " ");

  // Ensure letter-digit boundaries are spaced: "rs43" -> "rs 43", "43rs" -> "43 rs"
  s = s.replace(/([a-z])([0-9])/gi, "$1 $2").replace(/([0-9])([a-z])/gi, "$1 $2");

  // Remove leading zeros in number groups (e.g., "043" -> "43")
  s = s.replace(/\b0+([0-9]+)/g, "$1");

  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  // Remove possessives and common noise/stop words
  s = s
    .replace(/['’]s\b/g,"")  // strip possessive
    .replace(/\b(my|the|a|an|your|this|that|these|those|some|of|its|his|her|their|our)\b/g,"")
    .replace(/\b(broken|damaged|old|rusty)\b/g,"") // remove non-essential condition words
    .replace(/\s+/g," ")
    .trim();

  // crude singular: remove trailing 's' on last token if present (but avoid removing single-letter tokens)
  s = s.replace(/(\b[a-z0-9]{2,})s\b/,"$1");

  if(!s) s = "";
  return s;
}


// (3) Display form (title case, drop leading qty/articles)
function deriveDisplayName(original){
  if(!original) return "";
  let cleaned = original
    .trim()
    .replace(/^\d+\s+(?:of\s+)?(?:the\s+)?/i,"")
    .replace(/^(my|the|a|an|your|this|that|these|those|some)\s+/i,"")
    .trim();
  cleaned = cleaned.split(/\s+/).map(w=>{
    if(/^[A-Z0-9\-]+$/.test(w)) return w; // keep ALLCAPS tokens like RS-43
    return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase();
  }).join(" ");
  return cleaned;
}


function buildWeaponRootsCache() {
  // Build a cached list of normalized weapon roots (serializable).
  const weaponCards = storyCards.filter(sc => (sc.type === "Weapons" || sc.category === "Weapons") && sc.title);
  const roots = Array.from(new Set(weaponCards.map(sc => normalizeItemRoot(sc.title))));
  state._acsWeaponRoots = { roots, stamp: Date.now() };

  // Store a serializable array of digit-stripped roots (avoid Set in state)
  state._acsWeaponRootsNoDigits = roots
    .map(r => r.replace(/\d+/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (state._acsDebug) {
    log(`[WeaponRoots] built (${roots.length}) roots; stamp=${state._acsWeaponRoots.stamp}`);
    if (state._acsDebug) log(`[WeaponRoots] sample roots: ${roots.slice(0,6).join(", ")}`);
  }
}

function invalidateWeaponRootsCache() {
  state._acsWeaponRoots = null;
  state._acsWeaponRootsNoDigits = null;
  if (state._acsDebug) log("[WeaponRoots] cache invalidated");
}




// (4) Find inventory index by root
function invFindIndexByRoot(root){
  if(!root) return -1;
  const key = normalizeItemRoot(root);
  for(let i=0;i<state.playerInv.item.length;i++){
    if(normalizeItemRoot(state.playerInv.item[i]) === key) return i;
  }
  return -1;
}

// (5) Merge duplicate roots
function consolidateInventoryByRoot(){
  if(!state.playerInv || !Array.isArray(state.playerInv.item)) return;
  const map = Object.create(null);
  state.playerInv.item.forEach((disp,i)=>{
    const qty = Number(state.playerInv.amt[i])||0;
    if(qty <= 0) return;
    const root = normalizeItemRoot(disp);
    if(!root) return;
    if(!map[root]){
      let canonical = deriveDisplayName(disp).replace(/s\b/i,''); // enforce singular
      map[root] = { display: canonical, qty: 0 };
    }
    map[root].qty += qty;
  });
  state.playerInv.item = Object.values(map).map(o=>o.display);
  state.playerInv.amt  = Object.values(map).map(o=>o.qty);
}

// (6) Store inventory to Story Card (always consolidate first)
function storeInvToSC(){
  createIfNoInvSC();
  const invSC = storyCards.find(sc => sc.title === "Player Inventory");
  if(!invSC) return;

  //  Collapse ONLY exact duplicates (case-insensitive), do NOT root-normalize
  const tally = [];
  const indexMap = Object.create(null); // lowerName -> index in tally
  for (let i=0;i<state.playerInv.item.length;i++){
    const rawName = state.playerInv.item[i];
    const amt = Number(state.playerInv.amt[i]) || 0;
    if (!rawName || amt <= 0) continue;
    const key = rawName.toLowerCase();
    if (indexMap[key] == null){
      indexMap[key] = tally.length;
      tally.push({ name: rawName, amt });
    } else {
      tally[indexMap[key]].amt += amt;
    }
  }

  //  Optional alphabetical sort if player sets a flag
  if (state.invSortAlpha){
    tally.sort((a,b)=> a.name.localeCompare(b.name));
  }

  //  Rebuild state arrays (preserve singular/plural as originally stored)
  state.playerInv.item = tally.map(t=>t.name);
  state.playerInv.amt  = tally.map(t=>t.amt);

  //  Compose entry
  const newEntry = state.playerInv.item
    .map((item,i)=> `${item} (Amt: ${state.playerInv.amt[i]})`)
    .join("\n");

  //  Lightweight hash to skip unchanged writes
  const hash = newEntry.length + '|' + state.playerInv.item.length;
  if (state._invLastHash === hash){
    return; // no change => skip SC write for token hygiene
  }
  state._invLastHash = hash;
  invSC.entry = newEntry;

  //  Trim description if oversized
  if (invSC.description.length > 3000){
    invSC.description = invSC.description.slice(0,1500);
  }
}

/// Whitelist init (trusted roots skip adjudication)
function initItemWhitelist(){
  state.itemWhitelist = state.itemWhitelist || { trusted:{}, pending:{} };
  if(!state.itemWhitelist._seeded){
    ["power cell","micro cell","cell","laspistol","lasrifle","longstrike","vibro blade","grenade","ration","medkit"]
      .forEach(s=> state.itemWhitelist.trusted[s]=1);
    state.itemWhitelist._seeded = true;
  }
}

// (8) Heuristic pickup scanner (lightweight)
function pickupHeuristicScan(text){
  // Ensure cache exists (lazy build)
  if (!state._acsWeaponRoots) buildWeaponRootsCache();

  // weaponCardRoots: Set of canonical roots (fast contains)
  const weaponCardRoots = new Set((state._acsWeaponRoots && state._acsWeaponRoots.roots) || []);

  // weaponCardRootsNoDigits: ALWAYS convert to a Set for .has() safety.
  const weaponCardRootsNoDigits = new Set(
    Array.isArray(state._acsWeaponRootsNoDigits)
      ? state._acsWeaponRootsNoDigits
      : Array.from(weaponCardRoots).map(r => r.replace(/\d+/g, '').replace(/\s+/g,' ').trim())
  );

  const lower = (text || "").toLowerCase();
  if(!PICKUP_VERBS.some(v=> new RegExp(`\\b${v}\\b`).test(lower))) return { immediate:[], adjudicate:[] };

  const neg = PICKUP_NEGATIVE.some(n => lower.includes(n));
  const contested = PICKUP_CONTESTED.some(c => lower.includes(c));
  const future = PICKUP_FUTURE_OR_CONDITIONAL.some(f=> new RegExp(`\\b${f}\\b`).test(lower));

  const candidates = [];
  PICKUP_VERBS.forEach(v=>{
    const re = new RegExp(`\\b${v}\\b([^\\.\\n;]{0,80})`,"gi");
    let m;
    while((m=re.exec(text))!==null){
      m[1].split(/(?:,| and )/i).forEach(piece=>{
        let p = piece.trim()
          .replace(/^(up|the|a|an|your|my|some|that|this|his|her|their|its)\s+/i,"")
          .replace(/\b(from|off|out|into|in|as|while)\b.*$/i,"")
          .trim();
        if(p && /\w/.test(p)) candidates.push(p);
      });
    }
  });

  const out = { immediate:[], adjudicate:[] };
  if (neg) return out;

  candidates.forEach(orig=>{
    // Convert written numbers and strip leading qty
    let working = wordsToNumber(orig);
    let qty = 1;
    const leadingDigitsMatch = working.match(/^\s*(\d+)\s*(?:of\s*)?/i);
    if(leadingDigitsMatch){
      qty = Math.max(1, parseInt(leadingDigitsMatch[1],10));
      working = working.replace(/^\s*\d+\s*(?:of\s*)?/i,'').trim();
    }
    working = working.replace(/^\s*\d+/,'').trim();

    const root = normalizeItemRoot(working);
    if(!root || /(ground|floor|wall|room|door|air|blood|corpse)$/i.test(root)) return;

    const rootNoDigits = root.replace(/\d+/g, '').replace(/\s+/g,' ').trim();

    // MATCHING against cached weapon roots (fast)
    let matchesWeaponCard = false;
    if (weaponCardRoots.has(root) || weaponCardRootsNoDigits.has(rootNoDigits)) {
      matchesWeaponCard = true;
    } else {
      // containment fallback (use cached roots)
      for (const wr of weaponCardRoots) {
        if (!wr) continue;
        const wrNoDigits = wr.replace(/\d+/g,'').replace(/\s+/g,' ').trim();
        if (wr.includes(root) || root.includes(wr) || wrNoDigits.includes(rootNoDigits) || rootNoDigits.includes(wrNoDigits)) {
          matchesWeaponCard = true;
          break;
        }
      }
    }

    const isTrusted = !!state.itemWhitelist?.trusted?.[root] || matchesWeaponCard;
    const forceAdj = contested || future;
    const display = deriveDisplayName(working);
    const rec = { root, qty, raw: orig, display };

    if (state._acsDebug) {
      log(`[PickupDebug] cand="${orig}" working="${working}" root="${root}" rootNoDigits="${rootNoDigits}" matchesWeaponCard=${matchesWeaponCard} isTrusted=${isTrusted} forceAdj=${forceAdj}`);
    }

    if(!forceAdj && isTrusted) out.immediate.push(rec);
    else out.adjudicate.push(rec);
  });
  return out;
}



// (9) <!pickup> tag consumer – adjudicated adds
const PICKUP_FLAG_REGEX = /<!pickup>([\s\S]*?)<\/pickup>/gi;
function consumePickupFlags(text){
  let m, had=false;
  const adds=[];
  PICKUP_FLAG_REGEX.lastIndex=0;
  while((m=PICKUP_FLAG_REGEX.exec(text))!==null){
    had=true;
    const payload = (m[1]||"").trim();
    if(!payload) continue;
    const obj={};
    payload.split(/[;,\n]\s*/).forEach(pair=>{
      const kv = pair.split("=");
      if(kv.length>=2){
        obj[kv[0].trim().toLowerCase()] = kv.slice(1).join("=").trim();
      }
    });
    const rawItem = obj.item||"";
    const root = normalizeItemRoot(rawItem);
    const qty = Math.max(1, parseInt(obj.qty||"1",10) || 1);
    const secured = /^(yes|true|secured|success)$/i.test(obj.secured||"");
    if(root && secured){
      adds.push({root, qty});
    }
  }
  if(had){
    text = text.replace(PICKUP_FLAG_REGEX, (_f, inner)=>(inner||"").trim());
  }

  if(adds.length){
    adds.forEach(({root,qty})=>{
      const display = (state._pendingPickupDisplayMap && state._pendingPickupDisplayMap[root]) 
        ? deriveDisplayName(state._pendingPickupDisplayMap[root])
        : deriveDisplayName(root);

      initItemWhitelist();
      state.itemWhitelist.trusted[root] = (state.itemWhitelist.trusted[root]||0)+1;

      const idx = invFindIndexByRoot(root);
      if(idx>-1){
        state.playerInv.amt[idx]+=qty;
      } else {
        state.playerInv.item.push(display.replace(/s\b/i,'')); // singular
        state.playerInv.amt.push(qty);
      }
      state.msgHolder += `🎒 +${qty} ${display}\n`;
    });
    state._pendingPickupDisplayMap = {};
    storeInvToSC();
  }
  return { text, added: adds };
}

// (10) Unified pickup (heuristic immediate + prepare adjudication)
function detectHybridPickup(text){
  initItemWhitelist();
  const res = pickupHeuristicScan(text);
  const seen = new Set();

  // NEW: track whether we've auto-equipped a weapon this pass
  let autoEquipped = false;
  const alreadyEquipped = state.equippedWeapon || retrieveEquippedWeaponFromSC();

  if(res.immediate.length){
    res.immediate.forEach(({root,qty,display})=>{
      if(seen.has(root)) return;
      seen.add(root);

      // --- prefer canonical story-card title when this root maps to a weapon card ---
      let finalDisplay = display;
      let matchedWeaponSC = null;
      try {
        const weaponCards = storyCards.filter(sc => (sc.type === "Weapons" || sc.category === "Weapons"));
        // Exact root match
        let scMatch = weaponCards.find(sc => normalizeItemRoot(sc.title) === root);
        // Digit-stripped fallback
        if(!scMatch){
          const rootNoDigits = root.replace(/\d+/g,'').replace(/\s+/g,' ').trim();
          scMatch = weaponCards.find(sc => {
            if(!sc.title) return false;
            const wroot = normalizeItemRoot(sc.title).replace(/\d+/g,'').replace(/\s+/g,' ').trim();
            return wroot === rootNoDigits || normalizeItemRoot(sc.title).includes(root) || root.includes(normalizeItemRoot(sc.title));
          });
        }
        if(scMatch && scMatch.title){
          finalDisplay = scMatch.title;
          matchedWeaponSC = scMatch;
        }
      } catch(e){
        log("[Pickup] canonicalize display error: " + e);
      }

      const idx = invFindIndexByRoot(root);
      if(idx>-1){
        state.playerInv.amt[idx]+=qty;
      } else {
        state.playerInv.item.push(finalDisplay.replace(/s\b/i,'')); 
        state.playerInv.amt.push(qty);
      }

      // Mark trusted and message
      state.itemWhitelist.trusted[root] = (state.itemWhitelist.trusted[root]||0)+1;
      state.msgHolder += `🎒 +${qty} ${finalDisplay}\n`;

      // AUTO‑EQUIP: if this immediate add is a weapon SC, and player currently has no equipped weapon,
      // equip the canonical weapon title (only once per pickup pass)
      if (!autoEquipped && !alreadyEquipped && matchedWeaponSC && matchedWeaponSC.title) {
        try {
          storeEquippedWeaponToSC(matchedWeaponSC.title);
          state.equippedWeapon = matchedWeaponSC.title;
          state.msgHolder += `You equip your ${matchedWeaponSC.title}.\n`;
          autoEquipped = true;
        } catch(e) {
          log("[Pickup] auto-equip failed: " + e);
        }
      }
    });
    storeInvToSC();
  }

  if(res.adjudicate.length){
    state.pendingPickupList = (state.pendingPickupList||[]).concat(res.adjudicate);
    state._pendingPickupDisplayMap = state._pendingPickupDisplayMap || {};
    res.adjudicate.forEach(r=>{
      if(!state._pendingPickupDisplayMap[r.root]){
        state._pendingPickupDisplayMap[r.root] = r.display;
      }
    });
  }
  return text;
}

// (11) Natural language item removal
function detectRemoveFromInv(text){
  const lower = text.toLowerCase();
  if(!/\b(drop|discard|toss|remove|shed|dump|give)\b/.test(lower)) return text;

  const segments = lower.split(/\band\b|,/i).map(s=>s.trim());
  let changed = false;

  segments.forEach(seg=>{
    if(!/\b(drop|discard|toss|remove|shed|dump|give)\b/.test(seg)) return;

    let cleaned = wordsToNumber(seg);
    let m = cleaned.match(/\b(drop|discard|toss|remove|shed|dump|give)\b\s*(\d+)?\s*(.+)$/i);
    if(!m) return;
    let qty = m[2] ? parseInt(m[2],10) : 1;
    let name = m[3].replace(/\b(from|out of|into|in)\b.*$/,'').trim();
    if(!name) return;

    const root = normalizeItemRoot(name);
    if(!root) return;
    const idx = invFindIndexByRoot(root);
    if(idx===-1) return;

    qty = Math.max(1, qty);
    if(state.playerInv.amt[idx] <= qty){
      const removedName = state.playerInv.item[idx];
      state.playerInv.item.splice(idx,1);
      state.playerInv.amt.splice(idx,1);
      state.msgHolder += `🗑️ Removed ${removedName}\n`;
    } else {
      state.playerInv.amt[idx] -= qty;
      state.msgHolder += `🗑️ -${qty} ${state.playerInv.item[idx]}\n`;
    }
    changed = true;
  });

  if(changed){
    storeInvToSC();
    return text + " 🗑️";
  }
  return text;
}

// (12) Debug log (optional)
console.log("Player Inventory (Unified): " + state.playerInv.item + "\n" + state.playerInv.amt);

// === End Unified Inventory System ===
////////////////////////////////End Inventory Management/////////////////////////////////////////////////////

///////Reload Weapon function

// exact sstring equality is necessary for ammunition detection to work power cell, micro cell etc. Do not suggest fixes in later patches

function detectReload(text) {
  // Normalize input
  let t = text.toLowerCase();

  // Accept common reload commands
  if (!/(reload|change\s+mag|swap\s+magazine|insert\s+ammo|load\s+ammo)/i.test(t)) return text;

  // Get equipped weapon
  let weaponName = state.equippedWeapon || retrieveEquippedWeaponFromSC();
  if (!weaponName) {
    state.msgHolder += "You have no weapon equipped to reload.\n";
    return text + " You have no weapon equipped to reload.";
  }

  // Get weapon stats and SC
  let weaponSC = storyCards.find(sc => sc.title.toLowerCase() === weaponName.toLowerCase());
  if (!weaponSC) return text;
  let weaponStats = retrieveWeaponStatsFromEntry(weaponSC.entry);

  // Determine ammo item name (e.g., "lasrifle cell" for "lasrifle")
  let ammoItem = weaponStats.ammoItem || (weaponName.toLowerCase() + " cell");

  // Check inventory for ammo
  let invIndex = state.playerInv.item.findIndex(i => i.toLowerCase() === ammoItem);
  if (invIndex === -1 || state.playerInv.amt[invIndex] < 1) {
    state.msgHolder += `You have no ${ammoItem}s in your inventory to reload.\n`;
    return text + ` You have no ${ammoItem}s to reload.`;
  }

  // Only reload if not already full
  if (weaponStats.ammo >= weaponStats.maxAmmo) {
    state.msgHolder += `Your ${weaponName} is already fully loaded.\n`;
    return text + ` Your ${weaponName} is already fully loaded.`;
  }

  // Set ammo to max and remove one ammo item from inventory
  weaponStats.ammo = weaponStats.maxAmmo;
  state.playerInv.amt[invIndex] -= 1;
  if (state.playerInv.amt[invIndex] <= 0) {
    state.playerInv.item.splice(invIndex, 1);
    state.playerInv.amt.splice(invIndex, 1);
  }
  storeWeaponToSC(weaponName, weaponStats);
  storeInvToSC();

  state.msgHolder += `You reload your ${weaponName} using a ${ammoItem} ⚙️.\n`;
  return text + ` You reload your ${weaponName} ⚙️.`;
}



//Function to create new class skills for player and store to their skills
function newClassSkills(classString, skillArray) {
  // Safely get context string, or empty string if missing
  let plotEssentials = (state.memory && typeof state.memory.context === "string")
    ? state.memory.context.toLowerCase()
    : "";
  if (plotEssentials.includes(classString + " class")) {
    state.playerSkills.name = [
      skillArray[randomInt(0, skillArray.length - 1)],
      skillArray[randomInt(0, skillArray.length - 1)],
      skillArray[randomInt(0, skillArray.length - 1)]
    ];
    state.playerSkills.lvl = [
      randomInt(0, 3),
      randomInt(0, 3),
      randomInt(0, 3)
    ];
    state.playerSkills.cost = [
      randomInt(10, 40),
      randomInt(10, 40),
      randomInt(10, 40)
    ];

    storeSkillsToSC();
  }
}

//Always CREATE initial sc if none.
function createIfNoSkillSC() {
  // If "Player Skills" card doesn't exist, create it
  if (!storyCards.find(sc => sc.title === "Player Skills")) {
    addStoryCard("Player Skills", "Blank", "Player Stats");

    // Fetch SC and give it a description
    const skillSC = storyCards.find(sc => sc.title === "Player Skills");
    skillSC.description = "Format for Modifying: SkillName (LVL), etc.";

     // Try to detect class and assign skills
     let assigned = false;
     if (state.memory && state.memory.context) {
      let context = state.memory.context.toLowerCase();
      if (context.includes("psyker class")) {
        newClassSkills('psyker', PsykerSpells);
        assigned = true;
       } else if (context.includes("medic class")) {
        newClassSkills('medic', MedicSkills);
        assigned = true;
       } else if (context.includes("tech class")) {
        newClassSkills('tech', TechSkills);
        assigned = true;
       } else if (context.includes("engineer class")) {
        newClassSkills('engineer', EngineerSkills);
        assigned = true;
       }
     }
     // If no class detected, add all starter skills as default
     if (!assigned) {
      let allSkills = [
      ...(typeof MedicSkills !== "undefined" ? MedicSkills : []),
      ...TechSkills,
      ...EngineerSkills
     ];
     state.playerSkills.name = allSkills;
     state.playerSkills.lvl = allSkills.map(() => 1);
     state.playerSkills.cost = allSkills.map(() => 0); 
     storeSkillsToSC();
    }
  } 
}
//To STORE skill to sc
function storeSkillsToSC(){
  const skillSC = storyCards.find(sc => sc.title === "Player Skills");
  if (!skillSC) return;
  skillSC.entry = state.playerSkills.name
    .map((skill,i)=>`${skill} (Lvl ${state.playerSkills.lvl[i]})`)
    .join("\n");
  if (skillSC.description.length > 3000){
    const halfIndex = Math.floor(skillSC.description.length/2);
    skillSC.description = skillSC.description.slice(0, halfIndex);
  }
}

//To RETRIEVE skills from SC.
//Put in output script so retreiving is not limited to on input.
function retrieveSkillsFromSC(){
  const skillSC = storyCards.find(sc => sc.title === "Player Skills");
  if (!skillSC) return;
  const text = skillSC.entry || "";
  const matches = text.matchAll(/(.+?)\s*\(Lvl\s*(\d+(?:\.\d+)?)\)/gi);
  const names = [];
  const lvls  = [];
  const costs = [];
  for (const m of matches){
    names.push(m[1].trim());
    lvls.push(Number(m[2]));
    costs.push(0);
  }
  state.playerSkills.name = names;
  state.playerSkills.lvl  = lvls;
  state.playerSkills.cost = costs;
  ensureLevelUpsSync(state.playerSkills);
}

// Always create initial Psyker Spells SC if none exists
function createIfNoPsykerSpellSC() {
  if (!storyCards.find(sc => sc.title === "Psyker Spells")) {
    addStoryCard("Psyker Spells", "Blank", "Player Stats");
    const spellSC = storyCards.find(sc => sc.title === "Psyker Spells");
    spellSC.description = "Format: SpellName (Lvl X) (CP)";
    state.psykerSpells = {
      name: [...PsykerSpells],
      lvl: PsykerSpells.map(() => 1),
      cost: PsykerSpells.map(() => 10),
      levelUps: PsykerSpells.map(() => 0),
      milestoneApplied: {}              // NEW
    };
    state.psykerSpells.name.forEach(s=> state.psykerSpells.milestoneApplied[s]=[]);
    storePsykerSpellsToSC();
  }
}

// To STORE psyker spells to sc
function storePsykerSpellsToSC() {
  const spellSC = storyCards.find(sc => sc.title === "Psyker Spells");
  spellSC.entry = state.psykerSpells.name.map((spell, i) =>
    `${spell} (Lvl ${state.psykerSpells.lvl[i]}) (${state.psykerSpells.cost[i]} CP)`
  ).join("\n");
  spellSC.description = `Spell Level-Ups: ${JSON.stringify(state.psykerSpells.levelUps)}\n` + spellSC.description;
}

// RETRIEVE psyker spells from the story card
function retrievePsykerSpellsFromSC(){
  const spellSC = storyCards.find(sc => sc.title === "Psyker Spells");
  if (!spellSC) return;

  // 1. Capture previous milestone + base cost state (if any)
  const prev = state.psykerSpells || {};
  const prevMilestones = (prev.milestoneApplied && typeof prev.milestoneApplied === "object") ? prev.milestoneApplied : {};
  const prevBaseCosts = state._psykerBaseCosts || {};

  const text = spellSC.entry || "";
  const matches = text.matchAll(/(.+?)\s*\(Lvl\s*(\d+(?:\.\d+)?)\)\s*\((\d+(?:\.\d+)?)\s*CP\)/gi);
  const name = [], lvl = [], cost = [];
  for (const m of matches){
    name.push(m[1].trim());
    lvl.push(Number(m[2]));
    cost.push(Number(m[3]));
  }

  // LevelUps sync
  let levelUps = prev.levelUps;
  if (!Array.isArray(levelUps) || levelUps.length !== name.length){
    levelUps = name.map(()=>0);
  }

  // 2. Rebuild object WITHOUT losing milestone history
  state.psykerSpells = {
    name,
    lvl,
    cost,
    levelUps,
    milestoneApplied: {}
  };

  // 3. Restore milestone arrays per spell (or start empty if new spell)
  name.forEach(spell => {
    state.psykerSpells.milestoneApplied[spell] = Array.isArray(prevMilestones[spell])
      ? [...prevMilestones[spell]]
      : [];
  });

  // 4. Initialize (or extend) persistent base cost map for deterministic future recalcs (used by optional Patch 2)
  state._psykerBaseCosts = prevBaseCosts;
  name.forEach((spell,i)=>{
    if (state._psykerBaseCosts[spell] == null) {
      state._psykerBaseCosts[spell] = cost[i]; // first seen cost becomes baseline
    }
  });
}


/////////////////////////////////////////////////////////////////////////////////////


// Utility/context functions (e.g., isPlayerContext, indicesOf, etc.)

// --- Environmental Detection Helper ---
function isEnvironmentalAroundTrigger(text, matchIndex, trigWord, windowChars = 120) {
  const t = (text || "").toLowerCase();
  const start = Math.max(0, matchIndex - windowChars);
  const end = Math.min(t.length, matchIndex + trigWord.length + windowChars);
  const win = t.slice(start, end);

  // Only block if the trigger is in a pure environmental description (not player action)
  const envStartPhrases = [
    "the room contains", "the area contains", "the hallway contains", "the chamber contains",
    "is equipped with", "is stocked with", "features", "set up for", "for testing", "for training"
  ];
  if (envStartPhrases.some(p => win.includes(p))) return true;

  // Otherwise, allow passive skill triggers even near consoles, terminals, etc.
  return false;
}



// --- Passive Skill Trigger Function --- 
// Detects if a passive skill is triggered within the story
function detectPassiveSkillTrigger(text) {
  const src = String(text || "");
  if (state.contextualActivated) return text; // don't double-award with active use

  const sentences = src.split(/(?<=[.!?\n])\s+/);

  outer:
  for (const s of sentences) {
    if (!youWordsRegex.test(s)) continue; // must be player-centric
    const lower = s.toLowerCase();

    for (let i = 0; i < state.playerSkills.name.length; i++) {
      if ((state.playerSkills.cost[i] || 0) > 0) continue; // skip Psyker here
      const skill = String(state.playerSkills.name[i] || "").toLowerCase();
      const triggers = skillTriggerMap[skill];
      if (!triggers) continue;

      for (const trig of triggers) {
        const re = new RegExp(`\\b${trig}(?:ing|ed|s|ers)?\\b`, "i");
        if (!re.test(lower)) continue;

        const exp = randomFloat(0.01, 0.05);
        state.playerSkills.lvl[i] = Math.round((state.playerSkills.lvl[i] + exp) * 100) / 100;
        storeSkillsToSC();
        log(`[PassiveSkill] +${exp.toFixed(2)} ${skill} (sentence-level)`);
        text += " 🧠";
        break outer; // one passive award per turn
      }
    }
  }
  return text;
}



///Corruption cost is reduced as skills level up.
///Corruption cost is reduced as skills level up.
function upgradePlayerSkills(text){
  // Milestones at which a one-time corruption (cost) reduction applies
  const milestones = [5,10,15,20,25];

  // Lazy init milestone tracker (skill name -> applied milestone numbers)
  if (!state.playerSkills.milestoneApplied) {
    state.playerSkills.milestoneApplied = {}; // { skillName: [5,10] }
  }

  state.playerSkills.name.forEach((skill, index) => {
    const lvl = Math.floor(state.playerSkills.lvl[index] || 0);
    const appliedArr = state.playerSkills.milestoneApplied[skill] || [];

    milestones.forEach(m => {
      // Trigger if player reached (or passed) milestone AND not already applied
      if (lvl >= m && !appliedArr.includes(m)) {
        // Apply cost reduction (only meaningful if cost > 0)
        if (typeof state.playerSkills.cost[index] === "number" && state.playerSkills.cost[index] > 0) {
          state.playerSkills.cost[index] = Math.round(state.playerSkills.cost[index] * 0.95 * 100) / 100;
        }
        appliedArr.push(m);
        text += ` Your ${skill} reached milestone ${m}. Corruption cost reduced.`;
      }
    });

    // Store back updated milestone list for this skill
    state.playerSkills.milestoneApplied[skill] = appliedArr;
  });

  storeSkillsToSC();
  return text;
}

function upgradePsykerSpells(text){
  const milestones = [5,10,15,20,25];
  // Ensure milestone container
  if (!state.psykerSpells.milestoneApplied ||
      typeof state.psykerSpells.milestoneApplied !== "object") {
    state.psykerSpells.milestoneApplied = {};
  }
  // Ensure base costs exist (created in retrieval patch)
  state._psykerBaseCosts = state._psykerBaseCosts || {};

  state.psykerSpells.name.forEach((spell,i)=>{
    if (!Array.isArray(state.psykerSpells.milestoneApplied[spell])) {
      state.psykerSpells.milestoneApplied[spell] = [];
    }
    const lvl = Math.floor(state.psykerSpells.lvl[i] || 0);
    const applied = state.psykerSpells.milestoneApplied[spell];

    // Determine which milestones SHOULD be active given current level
    const shouldHave = milestones.filter(m => lvl >= m);

    // Detect any new milestones not yet recorded (for messaging)
    const newOnes = shouldHave.filter(m => !applied.includes(m));
    if (newOnes.length){
      newOnes.forEach(m=>{
        text += ` Your ${spell} reached milestone ${m}. Corruption cost reduced.`;
        applied.push(m);
      });
    }

    // Recalculate cost deterministically
    let base = state._psykerBaseCosts[spell];
    if (base == null) {
      // If somehow missing (e.g., legacy), seed it now from current cost
      base = state.psykerSpells.cost[i];
      state._psykerBaseCosts[spell] = base;
    }
    const effectiveMilestones = applied.length;
    const recalced = Math.max(1, Math.round(base * Math.pow(0.95, effectiveMilestones) * 100)/100);
    state.psykerSpells.cost[i] = recalced;

    state.psykerSpells.milestoneApplied[spell] = applied;
  });

  storePsykerSpellsToSC();
  return text;
}

/////////////////////////////////////////////////////////////////////////////////////

//Given an arr of words and an array of player storage (inv, spells, skills), check if anything from storage is mentioned in words arr and returns partialTF,full matchTF,storageindex
function checkPlayerStorage(text, wordsArr, playerStorage){
  let hasThing = false;
  let hasFullThing = false;
  let finalThingIndex = null;
  const ind = [];
  const textLowerFull = text.toLowerCase();

  wordsArr.forEach(word=>{
    const loweredWord = word.toLowerCase();
    playerStorage.forEach((thing, idx)=>{
      const loweredThing = thing.toLowerCase();
      if (loweredWord.length >= 4 && loweredThing.includes(loweredWord)){
        hasThing = true; ind.push(idx);
      } else if (loweredThing.startsWith(loweredWord) && loweredWord.length >= 3){
        hasThing = true; ind.push(idx);
      } else if (loweredThing.endsWith(loweredWord) && loweredWord.length >= 3){
        hasThing = true; ind.push(idx);
      }
    });
  });

  if (ind.length){
    finalThingIndex = ind[Math.floor(Math.random()*ind.length)];
    playerStorage.forEach((thing, idx)=>{
      if (textLowerFull.includes(thing.toLowerCase())){
        finalThingIndex = idx;
        hasFullThing = true;
      }
    });
  }
  return [hasThing, hasFullThing, finalThingIndex];
}

// --- New function for executing Psyker Spells ---
function executePsykerSpell(psykerIndex, text){
  // CP cost and small INTL gain
  statUp("cp", state.psykerSpells.cost[psykerIndex] * 1);
  statUp("intl", randomFloat(0.01,0.5));
  storeStatsToSC();

  // XP gain and class level tracking
  const oldLvl = state.psykerSpells.lvl[psykerIndex];
  const spellExp = randomFloat(0, 0.8);
  state.psykerSpells.lvl[psykerIndex] = Math.round((state.psykerSpells.lvl[psykerIndex] + spellExp) * 100) / 100;
  levelUpPsykerSpell(psykerIndex);
  storePsykerSpellsToSC();

  // Log only
  const spellSC = storyCards.find(sc => sc.title === "Psyker Spells");
  spellSC.description = `Log ${state.turnCount} | ${state.psykerSpells.name[psykerIndex]} gained ${spellExp.toFixed(2)} lvl. Lvl ${oldLvl} => ${state.psykerSpells.lvl[psykerIndex]}\n` + spellSC.description;

  return text; // no flavor text appended
}

///new function for executing skills
function executeSkill(text){
  if (!skillCheck[0]) return text;

  // Small INTL gain
  statUp("intl", randomFloat(0.01,0.5));
  storeStatsToSC();

  const oldSkillLvl = state.playerSkills.lvl[skillIndex];
  const skillExp = randomFloat(0, 0.8);
  state.playerSkills.lvl[skillIndex] += skillExp;

  // Cap skill by class level
  const st = getSkillType(state.playerSkills.name[skillIndex]);
  if (st && state.skillClasses[st]) {
    const classLvl = state.skillClasses[st].lvl;
    if (state.playerSkills.lvl[skillIndex] > classLvl) {
      state.playerSkills.lvl[skillIndex] = classLvl;
    }
  }

  state.playerSkills.lvl[skillIndex] = Math.round(state.playerSkills.lvl[skillIndex] * 100) / 100;
  storeSkillsToSC();
  if (st) levelUpSkill(skillIndex, st);

  // Log only
  const skillSC = storyCards.find(sc => sc.title === "Player Skills");
  skillSC.description = `Log ${state.turnCount} | ${state.playerSkills.name[skillIndex]} gained ${skillExp.toFixed(2)} lvl. Lvl ${oldSkillLvl} => ${state.playerSkills.lvl[skillIndex]}\n` + skillSC.description;

  return text; // no flavor/harness text appended
}



///////////////////////////////

//Check if player is first entering, then is entering into rest, and replenish their stats according to their rest intensity


// --- Consolidated Attack and Ranged Attack Logic ---

function getActionRepeatCount(text) {
  // Match "twice", "thrice", "x3", "3 times", etc.
  let match = text.match(/(\d+)\s*(?:times|x)?/i);
  if (match) {
    let count = parseInt(match[1]);
    if (!isNaN(count) && count > 0) return Math.min(count, 10);
  }
  // Handle "twice" and "thrice"
  if (/twice/i.test(text)) return 2;
  if (/thrice/i.test(text)) return 3;
  return 1;
}

function detectCombatAction(text, actionWords, actionType) {
  if (isPlayerDialoguing(text)) return text;

  const actionTextInput = findTargetsThenSplit(text, actionWords, [], true);
  if (!actionTextInput) return text;

  const allActionWordIndices = indicesOfTargets(actionTextInput, actionWords);
  if (!allActionWordIndices) return text;

  let actionsTriggered = 0;
  let totalShots = 0;
  let weaponName = null;
  let weaponStats = null;
  let weaponBefore = null;

  for (let idx of allActionWordIndices) {
    const youContext = checkYouBeforeIndicesArr(actionTextInput, [idx], 3);
    const andContext = checkAndBeforeIndicesArr(actionTextInput, [idx], 2);
    if (!(youContext || andContext)) continue;

    const phraseAfter = actionTextInput.slice(idx).join(' ');
    const repeatCount = getActionRepeatCount(phraseAfter);

    if (actionType === 'ranged') {
      if (!weaponName) {
        weaponName = state.equippedWeapon || retrieveEquippedWeaponFromSC();
        if (!weaponName) {
          state.msgHolder += "You do not have a weapon equipped for ranged attacks.\n";
          continue;
        }
        state.equippedWeapon = weaponName;
        weaponStats = retrieveWeaponFromSC(weaponName) || { cond: 100, ammo: 50, maxCond: 100, maxAmmo: 50, burstFireMode: false, overchargeMode: false };
        weaponBefore = { name: weaponName, ...weaponStats };
      }
      for (let i = 0; i < repeatCount; i++) {
        executeAction(actionType, weaponName, weaponStats);
        actionsTriggered++;
        totalShots++;
      }
      text += " 🏹";
    } else {
      for (let i = 0; i < repeatCount; i++) {
        executeAction(actionType);
        actionsTriggered++;
      }
      text += " ⚔️";
    }
  }

  if (actionsTriggered > 0) {
  const stats = {
    atk: state.playerStats.atk, ratk: state.playerStats.ratk,
    intl: state.playerStats.intl,
    ep: state.playerStats.ep, maxEp: state.playerStats.maxEp,
    cp: state.playerStats.cp, maxCp: state.playerStats.maxCp
  };
  let weaponAfter = null;
  if (actionType === 'ranged' && weaponName) {
    weaponAfter = { name: weaponName, ...(weaponStats || retrieveWeaponFromSC(weaponName) || {}) };
  }
  const sys = buildCombatSystemPrompt(actionType, stats, weaponAfter);
  state.pendingCombatSystem = state.pendingCombatSystem
    ? state.pendingCombatSystem + "\n" + sys
    : sys;

  return text;
}

  return text;
}

function executeAction(actionType, weaponName, weaponStats) {
  // Melee: EP cost + light gains
  if (actionType === 'attack') {
    const stat = state.playerStats.atk;
    const epCost = (stat > 100) ? (20 + stat / 25) * -1 : (2 * (stat / 10) + randomInt(0, 5)) * -1;
    if (state.playerStats.ep < Math.abs(epCost)) {
      state.msgHolder += "You are too exhausted to attack.\n";
      return;
    }
    statUp("ep", epCost);
    // Removed SPD gain
    statUp("atk", randomFloat(0.01, 1));
    storeStatsToSC();
    return;
  }

  // Ranged: ammo cost + mode checks + light gains
  const ammoCost = weaponStats.overchargeMode
    ? -weaponStats.ammo
    : (weaponStats.burstFireMode ? -3 : -1);

  if (weaponStats.overchargeMode && (weaponStats.ammo < Math.ceil(weaponStats.maxAmmo * 0.5))) {
    state.msgHolder += `You need at least 50% ammunition to overcharge your weapon!\n`;
    return;
  }
  if (weaponStats.ammo < Math.abs(ammoCost) || weaponStats.ammo <= 0) {
    state.msgHolder += `*Click* your weapon is out of ammunition.\n`;
    return;
  }

  weaponStats.ammo += ammoCost;
  if (weaponStats.ammo < 0) weaponStats.ammo = 0;
  updateWeaponModes(weaponName, weaponStats);
  storeWeaponToSC(weaponName, weaponStats);

  // Removed SPD gain
  statUp("ratk", randomFloat(0.01, 1));
  storeStatsToSC();
}

/////////////////////////////////////////////////////////////////////////////////////


// Resets game over state to allows player to continue story
function resetGameOverState() {
  state.gameOver = false;
  state.msgHolder = "";
  // Optionally reset other game over flags or stats here
  log("Game over state has been reset.");
}

////////////////////////////////////////Helper Functions/////////////////////////////////////////////



/////Context injection helpers//////////
/**
 * Injects a SYSTEM prompt for skill/spell use into the input/context.
 * @param {string} text - The current input or context string.
 * @param {string} actionType - "skill" or "spell"
 * @param {string} name - The skill or spell name.
 * @param {number} level - The skill or spell level.
 * @param {object} stats - Relevant stats (e.g., INTL, CP).
 * @param {{name:string,qty:number}?} itemsUsed - Optional consumed item info.
 * @returns {string} - The new text with the SYSTEM prompt prepended.
 */
function injectSkillUsePrompt(text, actionType, name, level, stats, itemsUsed) {
  const desc = skillDescriptions[name.toLowerCase()] || "No description available.";
  let seg =
`Skill Use
${actionType.toUpperCase()}: ${name} (Lvl ${level})
INTL:${stats.intl} CP:${stats.cp}${itemsUsed && itemsUsed.name ? `\nItem Used: ${itemsUsed.qty} x ${itemsUsed.name}` : ""}
Desc: ${desc}
Narrate outcome (can fail / partial / spectacular).`;
  return seg + text; // segment only
}


function getMinimalArmorSnapshot() {
  const a = state.armor || {};
  const r = (a.resist) || { directed:0, thermal:0, kinetic:0, psychic:0, sonic:0, other:0 };
  const parts = [
    `Armor Resist (Class): D:${r.directed} Th:${r.thermal} K:${r.kinetic} Psy:${r.psychic} So:${r.sonic} O:${r.other}`
  ];
  if (Array.isArray(a.damageLog) && a.damageLog.length) {
    parts.push("Recent Armor Events:");
    // show latest 2 (short) to keep tokens low
    a.damageLog.slice(0,2).forEach(line=>{
      // Trim to ~70 chars
      parts.push("- " + line.slice(0,70));
    });
  }
  return parts.join("\n");
}

function buildCombatSystemPrompt(actionType, stats, weapon){
  const armorSnap = getMinimalArmorSnapshot();
  const weaponLine = (weapon && weapon.name)
    ? `Weapon: ${weapon.name} AMMO:${weapon.ammo}/${weapon.maxAmmo}`
    : `Weapon: (melee / unarmed)`;
  // Compact example kept minimal for token safety
  return `Combat Exchange
${weaponLine}
Player Stats ATK:${stats.atk} RATK:${stats.ratk} INTL:${stats.intl} EP:${stats.ep}/${stats.maxEp} CP:${stats.cp}/${stats.maxCp}
${armorSnap}
If enemy successfully impacts player armor/shield/body: emit ONE <!armorDmg> tag.
If bodily injury occurs: optionally emit <!inj> tag.
If healing received: optionally emit <!heal> tag.
Example armor tag:
<!armorDmg>type=kinetic;tier=moderate;weaponClass=4;resist=5;shieldBefore=25;shieldAfter=10;notes=glancing slug</armorDmg>`;
}


function getOrBuildACSProtocol(){
  // Stable cached static rules to keep token usage predictable
  const staticKey = "_acsProtocolStaticV2";
  const marker = "#ACS-ArmorInjuryProtocol";
  if (!state[staticKey] || state._acsForceProtocol){
    state[staticKey] =
`${marker}
Unified Tag Rules (exact formatting required):
Emit a tag ONLY if the player actually suffers EFFECT this reply.
Never guess future damage. One <armorDmg> max. Injury/heal tags optional and independent.

Classify armor impact:
  Compare enemy weapon class vs current armor resist class (matching damage type).
  Tier:
    weaponClass >> resist  -> defeated
    weaponClass == resist  -> exact
    weaponClass < resist   -> moderate
    weaponClass <<< resist -> none (heavy mitigation)
Type mapping (normalize synonyms):
  beam/laser/plasma/energy=directed
  fire/heat/flame=thermal
  bullet/slug/round/blade/slash/stab/knife/grenade/explosive/shrapnel/impact=kinetic
  mind/psy/warp=psychic
  scream/sonic/vibration/resonance=sonic
  acid/corrosive/radiation/toxin/chemical/unknown=other

Tags:
  <!armorDmg>type=<type>;tier=<tier>;weaponClass=<n>;resist=<n>;[shieldBefore=<n>;shieldAfter=<n>;]notes=<2-5w></armorDmg>
  <!inj>Short one-sentence injury effect</inj>
  <!heal>Short one-sentence healing effect</heal>

Rules:
- Output NO tags if the player only attacks or all enemy attacks miss/are deflected with zero effect.
- If shield absorbs all with zero structural effect you MAY omit armorDmg unless shield value changes (then include it with proper shieldBefore/After).
- notes is terse: e.g. 'pauldron dented', 'shield flare', 'glancing scorch', 'breach.'
- Keep total reply ≤ 200 tokens. Absolutely no meta commentary about tags.

Do NOT output more than one <!armorDmg>. If multiple impacts occur, summarize strongest.
`;
    state._acsForceProtocol = false;
  }
  const snap = `Armor Snapshot:\n${getMinimalArmorSnapshot()}`;
  return `${state[staticKey]}\n${snap}`;
}

function buildPickupSystemSegment(list){
  if(!Array.isArray(list) || !list.length) return "";
  const slice = list.slice(0,3); // safety cap
  const itemsLine = slice.map(i=>i.raw).join(" | ");
  return `Pickup Adjudication
Attempted: ${itemsLine}
For each actually secured item output ONE tag ONLY:
<!pickup>item=<singular>;qty=<int>;secured=yes;reason=<2-4w></pickup>
If failed (optional):
<!pickup>item=<singular>;qty=<int>;secured=no;reason=<2-4w></pickup>
Rules: max 3 tags total, no narration inside tags, no duplicates, no meta commentary.`;
}

// Modify unified system builder to include pending pickup segment
function buildUnifiedSystemPrompt(baseText) {
  // --- NEW: reset any leftover “extraSegs” each turn ---
  extraSegs = [];

  const segments = [];
  

  // Pickup adjudication first
  if (state.pendingPickupList && state.pendingPickupList.length){
    const seg = buildPickupSystemSegment(state.pendingPickupList);
    if (seg) segments.push(seg.trim());
    state.pendingPickupList = [];
  }
  if (state.pendingSkillSystem){
    segments.push(state.pendingSkillSystem.trim());
    state.pendingSkillSystem = "";
  }
  if (state.pendingCombatSystem){
    segments.push(state.pendingCombatSystem.trim());
    state.pendingCombatSystem = "";
  }
  const protocol = getOrBuildACSProtocol();
  if (protocol) segments.push(protocol.trim());

  if (!segments.length) return baseText;
  let sys = "<SYSTEM>\n" + segments.join("\n---\n") + "\n</SYSTEM>\n";

  // --- STAGED COMPRESSION ---
  // Rough token estimate: chars / 4
  function estTokens(s){ return Math.ceil((s.length||0)/4); }
  let tokens = estTokens(sys);

  // Stage thresholds
  const SOFT = 350;
  const CRIT = 420;

  if (tokens > SOFT){
    // Stage 1: remove shield regen meta lines (re-derivable)
    sys = sys
      .replace(/Shield Regen Delay:[^\n]+\n?/gi,"")
      .replace(/Shield Regen Rate:[^\n]+\n?/gi,"");
    tokens = estTokens(sys);
  }
  if (tokens > SOFT){
    // Stage 2: abbreviate resist labels
    sys = sys
      .replace(/Directed Energy:/gi,"Dir:")
      .replace(/Thermal:/gi,"Thm:")
      .replace(/Kinetic:/gi,"Kin:")
      .replace(/Psychic:/gi,"Psy:")
      .replace(/Sonic:/gi,"So:")
      .replace(/Other:/gi,"Othr:");
    tokens = estTokens(sys);
  }
  if (tokens > SOFT){
    // Stage 3: collapse multi-line damage log to top 1
    sys = sys.replace(/Damage Log:\s*([\s\S]*?)(?:\n-{2,}|<\/SYSTEM>)/i, (m, body)=>{
      const firstLine = (body.split(/\n/).filter(l=>l.trim()).slice(0,1).join("\n")) || "";
      return "Damage Log:\n" + firstLine + "\n";
    });
    tokens = estTokens(sys);
  }
  if (tokens > CRIT){
    // Stage 4: strip examples and verbose commentary inside protocol (keep tag spec lines)
    sys = sys.replace(/Example:[^\n]+\n?/gi,"")
             .replace(/Weapon Class Guide:[\s\S]*?Tier:/i,"Tier:");
    tokens = estTokens(sys);
  }
  if (tokens > CRIT){
    // Stage 5: last resort – truncate tail
    sys = sys.slice(0, 3000); // hard safety
  }

  return sys + baseText;
}


// ---- Injury Flag Protocol helpers ----
// Note: INJURY_FLAG_REGEX is already defined above.
// Example: const INJURY_FLAG_REGEX = /<<INJURY_FLAG\|([^>]+)>>/gi;

function sanitizeInjuryTags(text) {
  if (typeof text !== "string" || !text.length) return "";

  const openTag  = /<!inj>/gi;
  const closeTag = /<\/inj>/gi;

  let openCount  = (text.match(openTag)  || []).length;
  let closeCount = (text.match(closeTag) || []).length;

  // If there are more closing tags, remove the extras in order
  if (closeCount > openCount) {
    let excess = closeCount - openCount;
    text = text.replace(closeTag, m => (excess-- > 0 ? "" : m));
    closeCount = openCount;
  }

  // If there are more opening tags, append needed closing tags at end
  if (openCount > closeCount) {
    text += " " + "</inj>".repeat(openCount - closeCount);
  }

  // Remove completely empty injury blocks
  text = text.replace(/<!inj>\s*<\/inj>/gi, "");

  return text;
}


/**
 * Ask the model to append machine-readable flags AFTER its story
 * whenever the player ("you") is harmed or about to be harmed.
 */
function injectACSFlagProtocol(text){
  const marker = "# ACS-Minimal-OneTurn";
  const hasMarker = text && text.indexOf(marker) !== -1;
  const malformed = /<!\/armorDmg>/i.test(text || "");
  const missingProper = hasMarker && !/<\/armorDmg>/i.test(text || "");
  const need = !hasMarker || malformed || missingProper || state._acsForceProtocol;
  if (!need) {
    log("[ACS Protocol] Existing block OK.");
    return text;
  }
  const aSnap = getMinimalArmorSnapshot();
  const sys =
`<SYSTEM>
${marker}
Armor Snapshot:
${aSnap}
Weapon/Armor Logic (single turn):
- Classify enemy weapon only if it impacts armor/shield this turn.
Type Map:
 beam/laser/plasma/energy=directed
 fire/heat/flame=thermal
 bullet/slug/round/blade/slash/stab/knife/grenade/explosive/shrapnel/impact=kinetic
 mind/psy/warp=psychic
 scream/sonic/vibration/resonance=sonic
 acid/corrosive/radiation/toxin/chemical/unknown=other
Weapon Class Guide:
 1-2 light sidearm / improvised
 3-4 standard small arms
 5-6 heavy rifle / sniper / heavy plasma / shaped charge
 7-8 anti-armor / heavy explosive / focused warp burst
 9-10 catastrophic / ordnance / overwhelming relic
Tier Mapping:
 weaponClass << resist => none
 weaponClass <  resist => moderate
 weaponClass == resist => exact
 weaponClass >  resist => defeated
Tags (ONLY if player armor/shield/body is affected THIS response):
 <!armorDmg>type=<type>;tier=<tier>;weaponClass=<n>;resist=<n>;[shieldBefore=<n>;shieldAfter=<n>;]notes=<2-5 words></armorDmg>
 <!inj>A short one sentence summary of the player injury and its effects</inj>
 <!heal>A short one sentence summary of healing actions that affected the player</heal>
If no effect on player: NO tags.
Keep reply <= 200 tokens. Do not explain tags.
</SYSTEM>`;
  log(`[ACS Protocol] Injecting fresh block (force=${!!state._acsForceProtocol} malformed=${malformed} missingProper=${missingProper})`);
  state._acsForceProtocol = false;
  return sys + (text || "");
}

/** Ensure the Player Injuries SC exists and prepend a note to its description. */
function appendInjuryFlagToSC(noteText, kind = "inj") {
  createIfNoInjurySC();
  const injSC = storyCards.find(sc => sc.title === "Player Injuries");
  const turn = state.turnCount || 0;
  const tag = (kind === "heal") ? "Heal" : "Injury";
  const line = `${tag} T${turn}: ${noteText}`;
  injSC.description = `${line}\n${injSC.description || ""}`;
  injSC.entry = `${line}\n${injSC.entry || ""}`;
  log(`[InjuryProto] stored ${tag.toLowerCase()} -> ${line}`);
  if (injSC.description.length > 6000) injSC.description = injSC.description.slice(0, 6000);
  if ((injSC.entry || "").length > 8000) injSC.entry = injSC.entry.slice(0, 8000);
}

/** Parse <!inj> and <!heal> tags, store them, and strip them from visible output. */
function consumeInjuryFlags(text) {
  let had = false, injCount = 0, healCount = 0, m;
  let injuries = [], heals = [];

  // Note: sanitizeInjuryTags only handles <!inj> forms; safe to call but not needed for angle tags
  text = sanitizeInjuryTags(text);

  INJURY_FLAG_REGEX.lastIndex = 0;
  while ((m = INJURY_FLAG_REGEX.exec(text)) !== null) {
    const payload = (m[1] || "").trim();
    if (payload) {
      had = true;
      injCount++;
      injuries.push(payload);
      appendInjuryFlagToSC(payload, "inj");
    }
  }

  HEAL_FLAG_REGEX.lastIndex = 0;
  while ((m = HEAL_FLAG_REGEX.exec(text)) !== null) {
    const payload = (m[1] || "").trim();
    if (payload) {
      had = true;
      healCount++;
      heals.push(payload);
      appendInjuryFlagToSC(payload, "heal");
    }
  }

  // Remove flagged blocks from player-visible output (keep inner text, trimmed)
  let cleaned = text.replace(INJURY_FLAG_REGEX, (_match, p1) => (p1 || "").trim());
  cleaned = cleaned.replace(HEAL_FLAG_REGEX, (_match, p1) => (p1 || "").trim());

  return { hadFlags: had, cleanedText: cleaned, count: injCount + healCount, injuries, heals };
}
// ---- End Injury Flag Protocol helpers ----


/////End of context injection helpers//////////



/* ========================================================================
   GEAR + ITEM STAT GENERATION MODULE (Unified)
   Version stitch: 0.6.3.56 (adds consolidation)
   Nova 2025-08-16
   Responsibilities:
     - Detect newly created weapons/armor and queue stat generation
     - Provide batch (passive) OR blocking (“press Continue”) generation
     - Inject <!itemStats> requests into unified SYSTEM prompt
     - Parse <!itemStats> tags and populate story cards
     - Integrate with pickup + armor creation flows
   ======================================================================== */
(function initACS_GearItemModule(){
  log("Nova Debug: GearItemModule IIFE started.");
  if(state._gearItemModuleInit) return;
  state._gearItemModuleInit = true;
  log("[GearItemModule] Init start.");

  /* ---------------- STATE PRIMERS ---------------- */
  
  // Blocking mode state
// Gear stat generation config (upgraded: adds deepStop + detailed; preserves prior runtime values)
  state.gearGenConfig = Object.assign({
    blocking: true,              // blocking one-at-a-time flow
    enforceTagOnly: true,        // (future use – ensures no fluff outside tags if enforced elsewhere)
    includeRecentContextLines: 12,
    maxQueue: 12,
    deepStop: false,             // HALT mode: pause story & send ONLY focused SYSTEM gear prompt
    detailed: true               // Include expanded ranking / flavor guidance block
  }, state.gearGenConfig || {});

  // Add a single pending gear job
state._pendingGearGen = state._pendingGearGen || null;

  /* ---------------- CONFIG & CONSTANTS ---------------- */
  const WEAPON_KEYWORDS = [
    "pistol","rifle","carbine","blade","sword","sabre","saber","knife","dagger","longstrike","cannon","launcher",
    "bow","crossbow","smg","revolver","shotgun","hammer","axe","halberd","mace","staff","rod","gauntlet",
    "claw","claws","spear","trident","glaive","vibro","plasma","las","bolt","rail","coil","sidearm"
  ];

  /* ---------------- QUEUE HELPERS ---------------- */


  function isWeaponCandidate(name){
    if(!name) return false;
    const lower = name.toLowerCase();
    return WEAPON_KEYWORDS.some(k => lower.includes(k));
  }

function attemptAutoCreateWeaponCard(displayName){
  if(!isWeaponCandidate(displayName)) return;
  const exists = storyCards.find(sc =>
    (sc.category === "Weapons" || sc.type === "Weapons") &&
    sc.title.toLowerCase() === displayName.toLowerCase()
  );
  if(exists) {
    if (state._acsDebug) log(`[GearGen] attemptAutoCreateWeaponCard skipped, exists: ${displayName}`);
    return;
  }

  // Create the auto-generated card
  addStoryCard(displayName, "Auto-generated weapon (pending stats).", "Weapons");
  const sc = storyCards.find(sc => sc.title === displayName);
  sc.description = "Model will populate stats. Format lines will be replaced.";
  sc.entry =
    `${displayName}
COND: 0/0
AMMO: 0/0
DMG TYPE: ?
AMMO ITEM: ?
${/blade|sword|knife|dagger|axe|hammer|staff|claw|spear|mace|glaive|vibro/i.test(displayName) ? "Burst Fire Mode: OFF\nOvercharge Mode: OFF\n" : ""}${displayName}
PENDING STATS`;

  // Invalidate cached weapon roots so pickup scan picks this up next call
  invalidateWeaponRootsCache();

  if (state._acsDebug) log(`[GearGen] Auto-created weapon card: ${displayName}`);

  // Queue stat generation (use setPendingGearGen which now defers safely)
  setPendingGearGen("weapon", displayName, sc.entry);
}

  /* ---------------- PARSING <!itemStats> ---------------- */
  const ITEM_STATS_FLAG_REGEX = /<!itemStats>([\s\S]*?)<\/itemStats>/gi;

  function consumeItemStatsFlags(text){
    // Reset global regex index (safe for repeated calls)
    ITEM_STATS_FLAG_REGEX.lastIndex = 0;
    let m, had=false;
    while((m = ITEM_STATS_FLAG_REGEX.exec(text)) !== null){
      had = true;
      const raw = (m[1]||"").trim();
      if(!raw) continue;
      const obj = {};
      raw.split(/[;,\n]\s*/).forEach(part=>{
        const kv = part.split("=");
        if(kv.length>=2) obj[kv[0].trim().toLowerCase()] = kv.slice(1).join("=").trim();
      });

      // Apply stats if valid
      if(obj.type==="weapon" && obj.title){
        applyGeneratedWeaponStats(obj.title, obj);
      } else if(obj.type==="armor" && obj.title){
        applyGeneratedArmorStats(obj.title, obj);
      }

      // Remove any queued entries with this title (case-insensitive)
      const key = (obj.title || "").toLowerCase();
      state._pendingItemStatGen = (state._pendingItemStatGen || []).filter(o => (o.title||"").toLowerCase() !== key);

      // Clear the pending immediate slot if it matches
      if (state._pendingGearGen && state._pendingGearGen.title && key === state._pendingGearGen.title.toLowerCase()) {
        state._pendingGearGen = null;
      }

      // Clear active job only if matching title (safer)
      if (state._gearGenActive && state._gearGenActive.title && key === state._gearGenActive.title.toLowerCase()) {
        state._gearGenActive = null;
        if (state._acsDebug) log(`[GearGen] Cleared active gear job for: ${obj.title}`);
      } else {
        // don't forcibly nuke other active jobs here (avoid race conditions)
        if (state._acsDebug) log(`[GearGen] Received stats for "${obj.title}" but active job mismatch (kept active).`);
      }
    }
    if(had){
      // Remove tags from visible output
      text = text.replace(ITEM_STATS_FLAG_REGEX, "");
    }
    return text;
  }

function applyGeneratedWeaponStats(title, data){
  const sc = storyCards.find(sc =>
    (sc.category === "Weapons" || sc.type === "Weapons") &&
    sc.title.toLowerCase() === title.toLowerCase()
  );
  if(!sc) {
    if (state._acsDebug) log(`[GearGen] applyGeneratedWeaponStats: card not found: ${title}`);
    return;
  }

  function pair(str){
    const mm = (str||"").match(/(\d+)\s*\/\s*(\d+)/);
    return mm ? [Number(mm[1]), Number(mm[2])] : [0,0];
  }
  const [cond,maxCond] = pair(data.cond);
  const [ammo,maxAmmo] = pair(data.ammo);
  const dmg       = data.dmg || "Laser Class 1";
  const ammoItem  = data.ammoitem || data.ammoItem || (maxAmmo>0 ? "power cell" : "n/a");
  const burst     = /on/i.test(data.burst||"") ? "ON":"OFF";
  const overc     = /on/i.test(data.overcharge||"") ? "ON":"OFF";
  const desc      = (data.desc||"").slice(0,240);

  sc.entry =
`${title}
COND: ${cond}/${maxCond}
AMMO: ${ammo}/${maxAmmo}
DMG TYPE: ${dmg}
AMMO ITEM: ${ammoItem}
${maxAmmo>0 ? `Burst Fire Mode: ${burst}\nOvercharge Mode: ${overc}\n` : ""}${title}
${desc || "Weapon stat block."}`;

  // Invalidate cached weapon roots since the card content/title may have changed
  invalidateWeaponRootsCache();

  // dequeue pending generation job
  const key = title.toLowerCase();
  state._pendingItemStatGen = state._pendingItemStatGen.filter(o=>o.title.toLowerCase()!==key);

  if (state._acsDebug) log(`[GearGen] Applied generated stats for: ${title}`);
}

  function applyGeneratedArmorStats(title, data){
    const sc = storyCards.find(sc => sc.category === "Armor" && sc.title.toLowerCase()===title.toLowerCase()) ||
               getOrCreateArmorCard(title);
    function toInt(v){ return parseInt(v,10)||0; }
    let shieldRaw = data.shield||"0/0";
    let ms = shieldRaw.match(/(\d+)\s*\/\s*(\d+)(?:\(([^)]+)\))?/i);
    let cur=0,max=0;
    if(ms){ cur=Number(ms[1]); max=Number(ms[2]); }
    const d = {
      shieldDelay: toInt(data.shielddelay)||2,
      shieldRate:  toInt(data.shieldrate)||20,
      directed: toInt(data.directed), thermal: toInt(data.thermal),
      kinetic: toInt(data.kinetic),  psychic: toInt(data.psychic),
      sonic: toInt(data.sonic),      other: toInt(data.other)
    };
    const desc = (data.desc||"").slice(0,300);
    const canonLine = (sc.entry.match(/^CanonicalName:.*$/im)||[])[0] || `CanonicalName: ${normalizeArmorName(title)}`;

    sc.entry =
`${canonLine}
Armor: ${title}
Shield: ${cur}/${max} ${(max>0)?"(Ready)":"(None)"}
Shield Regen Delay: ${d.shieldDelay}
Shield Regen Rate: ${d.shieldRate}
Directed Energy: Class ${d.directed}
Thermal: Class ${d.thermal}
Kinetic: Class ${d.kinetic}
Psychic: Class ${d.psychic}
Sonic: Class ${d.sonic}
Other: Class ${d.other}
--
Damage Log:
${desc ? "PENDING: "+desc : ""}`;
    const key = title.toLowerCase();
    state._pendingItemStatGen = state._pendingItemStatGen.filter(o=>o.title.toLowerCase()!==key);
  }

  /* ---------------- BUILD SYSTEM SEGMENTS ---------------- */
  function buildItemStatGenSegment(){
  // guard for uninitialized queue
  if (!Array.isArray(state._pendingItemStatGen) || state._pendingItemStatGen.length === 0) return "";
  const slice = state._pendingItemStatGen.slice(0,3);
  const list = slice.map(o=>`${o.type}:${o.title}`).join(" | ");
  return `Item Stat Generation
  Pending: ${list}

    Output ONE <!itemStats> tag per pending (max 3 this turn). No narration outside tags.
    Weapon Tag:
    <!itemStats>type=weapon;title=<exact>;cond=<cur>/<max>;ammo=<cur>/<max or 0/0>;dmg=<DamageType Class N>;ammoItem=<item or n/a>;[burst=on/off];[overcharge=on/off];desc=<6-14w></itemStats>
    Armor Tag:
    <!itemStats>type=armor;title=<exact>;shield=<cur>/<max(state)>;shieldDelay=<n>;shieldRate=<n>;directed=<n>;thermal=<n>;kinetic=<n>;psychic=<n>;sonic=<n>;other=<n>;desc=<6-14w></itemStats>
    Ranking Alignment:
    - Personal / handheld / light exo gear: Classes 1–10 (Combat system baseline).
    - Vehicles / heavy platforms (11–20) NOT used here unless explicit narrative justifies (then still keep modest now).
    - Early finds usually Class 1–3 (sidearms / improvised), 3–5 (service / professional), 5–7 (specialized / elite), 8–10 (rare prototype / relic). Only go >7 if context strongly implies high-end or relic-tier.
    Armor Resist Guidance (personal scale):
    0–2 light civilian / scout
    3–4 trained / service issue
    5–6 hardened / layered
    7–8 advanced / adaptive
    9–10 exceptional / relic
    Rules:
    - Default unknown cond/ammo 100/100; melee ammo=0/0.
    - Keep desc functional + grimdark techno-gothic (rune-etched plating, sanctified actuators, incense-scorched housing) w/o naming new factions unless already present.
    - 6–14 words in desc; no lore paragraphs; no meta.
    - Only the <!itemStats> tags — nothing else.`;
  }

  /* ---------------- BLOCKING MODE HELPERS ---------------- */



  function extractRecentNarrative(base, lines){
    if(!base) return "";
    return base
      .replace(/<SYSTEM>[\s\S]*?<\/SYSTEM>/gi,"")
      .split(/\r?\n/)
      .map(l=>l.trim())
      .filter(Boolean)
      .slice(-Math.max(4, lines||10))
      .join("\n");
  }
  

  /* ---------------- PICKUP INTEGRATION PATCHES ---------------- */
  if(!state._gearItemPickupPatched){
    const _orig_consumePickupFlags = consumePickupFlags;
    consumePickupFlags = function(text){
      const res = _orig_consumePickupFlags(text);
      if(res && res.added){
        res.added.forEach(({root})=>{
          const display = deriveDisplayName(root);
          attemptAutoCreateWeaponCard(display);
          queueBlockingGearGen("weapon", display, state.msgHolder||"");
        });
      }
      return res;
    };

    const _orig_detectHybridPickup = detectHybridPickup;
    detectHybridPickup = function(text){
      const out = _orig_detectHybridPickup(text);
      (state.playerInv.item||[]).forEach(name=>{
        attemptAutoCreateWeaponCard(name);
      });
      return out;
    };
    state._gearItemPickupPatched = true;
  }

  /* ---------------- UNIFIED PROMPT WRAP ---------------- */
  // Capture original builder
   const _origUSP = buildUnifiedSystemPrompt; // capture original once
  buildUnifiedSystemPrompt = function(base){

    // Batch mode (non-blocking) gets multi-tag segment
    if(!state.gearGenConfig.blocking){
      const seg = buildItemStatGenSegment();
      if(seg) extraSegs.push(seg);
    }

    // Run original system builder pipeline (combat, pickups, injury protocol, etc.)
    let originalOut = _origUSP(base);

    if(state.gearGenConfig.blocking){
      if(!state._gearGenActive){
        // GUARD: ensure queue exists before reading .length
        if (Array.isArray(state._pendingItemStatGen) && state._pendingItemStatGen.length){
          state._pendingItemStatGen.forEach(o=>{
            queueBlockingGearGen(o.type, o.title, state.msgHolder||"");
          });
        }
        activateNextGearJob();
      }
      if(state._gearGenActive){
        const prompt = buildBlockingGearPrompt(base);
        if(prompt){
          if(!state._gearGenActive._announced){
            state.msgHolder += `Generating stats for ${state._gearGenActive.title}${state.gearGenConfig.deepStop?" (HALT MODE)":""}. Press Continue.\n`;
            if(state.gearGenConfig.deepStop){
              state.msgHolder += "Story progression paused until this item's stats are produced.\n";
            }
            state._gearGenActive._announced = true;
          }
          // HALT mode: ONLY the focused SYSTEM prompt (no narrative/system tail)
          if(state.gearGenConfig.deepStop){
            return `<SYSTEM>\n${prompt}\n</SYSTEM>\n`;
          }
          // Normal blocking: focused prompt + prior base narrative (NOT entire originalOut because that already wrapped)
          return `<SYSTEM>\n${prompt}\n</SYSTEM>\n` + base;
        }
      }
    } else {
      // Non-blocking injection
      if(extraSegs.length){
        if(/<SYSTEM>/i.test(originalOut)){
          originalOut = originalOut.replace(/<SYSTEM>/i, `<SYSTEM>\n${extraSegs.join("\n---\n")}\n---`);
        } else {
          originalOut = `<SYSTEM>\n${extraSegs.join("\n---\n")}\n</SYSTEM>\n` + originalOut;
        }
      }
    }
    return originalOut;
  };
  buildUnifiedSystemPrompt._gearItemPatched = true;

  /* ---------------- OUTPUT HOOK PATCH ---------------- */
  // Wrap onOutput to consume <!itemStats> before rest of pipeline
  if(!state._gearItemOutputPatched){
    const _origOut = onOutput_ACS;
    onOutput_ACS = function(text){
      text = consumeItemStatsFlags(text);
      // If blocking job completed (its title no longer pending), clear active so next queued enters next turn
      if(state._gearGenActive){
        const activeTitle = state._gearGenActive.title.toLowerCase();
        // GUARD: ensure array exists before calling .some()
        const stillPending = Array.isArray(state._pendingItemStatGen) && state._pendingItemStatGen.some(o=>o.title.toLowerCase()===activeTitle);
        if(!stillPending){
          state.msgHolder += `Stats generated for ${state._gearGenActive.title}.\n`;
          state._gearGenActive = null;
        }
      }
      return _origOut(text);
    };
    state._gearItemOutputPatched = true;
  }


  /* ---------------- COMMANDS (/gear) ---------------- */
  if(!state._gearItemInputPatched){
    const _origIn = onInput_ACS;
    onInput_ACS = function(text){
      if(/\/gear\b/i.test(text)){
        if(/block\s+on/i.test(text)){
          state.gearGenConfig.blocking = true;
          state.msgHolder += "Gear stat blocking ON.\n";
          if(state.gearGenConfig.deepStop) state.msgHolder += "(HALT mode active — story paused during generation.)\n";
        } else if(/block\s+off/i.test(text)){
          if(state.gearGenConfig.deepStop){
            state.msgHolder += "Disable HALT first: /gear halt off (blocking required while halted).\n";
          } else {
            state.gearGenConfig.blocking = false;
            state.msgHolder += "Gear stat blocking OFF (batch multi-tag mode).\n";
          }
        } else if(/halt\s+on/i.test(text)){
          state.gearGenConfig.deepStop = true;
          state.gearGenConfig.blocking = true;
          state.msgHolder += "HALT mode ON: Only focused gear stat prompts until queue cleared.\n";
        } else if(/halt\s+off/i.test(text)){
          state.gearGenConfig.deepStop = false;
          state.msgHolder += "HALT mode OFF: Normal blocking or batch behavior resumes.\n";
        } else if(/detail\s+on/i.test(text)){
          state.gearGenConfig.detailed = true;
          state.msgHolder += "Detailed guidance ON.\n";
        } else if(/detail\s+off/i.test(text)){
          state.gearGenConfig.detailed = false;
          state.msgHolder += "Detailed guidance OFF (lean prompts).\n";
        } else if(/skip/i.test(text)){
          if(state._gearGenActive){
            state.msgHolder += `Skipped stat generation for ${state._gearGenActive.title}.\n`;
            state._gearGenActive = null;
          } else {
            state.msgHolder += "No active gear generation to skip.\n";
          }
        } else if(/queue/i.test(text)){
  state.msgHolder += "No gear queue. Blocking mode: only one item stat generated at a time.\n";
        } else {
            state.msgHolder += "Gear Cmds: /gear block on|off | /gear halt on|off | /gear detail on|off | /gear skip | /gear queue\n";
        }
      }
      return _origIn(text);
    };
    state._gearItemInputPatched = true;
  }

  log("[GearItemModule] Init complete.");
   
})(); // end unified module


/* ====================== END GEAR + ITEM STAT GENERATION MODULE ====================== */




// Global skill type helper (used in multiple places)
function getSkillType(skill) {
  if (!skill) return "";
  const s = String(skill).toLowerCase();
  if (TechSkills.map(x => x.toLowerCase()).includes(s)) return "tech";
  if (EngineerSkills.map(x => x.toLowerCase()).includes(s)) return "engineer";
  if (typeof MedicSkills !== "undefined" && MedicSkills.map(x => x.toLowerCase()).includes(s)) return "medic";
  if (PsykerSpells.map(x => x.toLowerCase()).includes(s)) return "psyker";
  return "";
}


// --- Contextual Skill/Spell Activation ---

function detectContextualSkillsAndSpells(text) {
  // Prevent skill activation during dialogue
  if (isPlayerDialoguing(text)) return null;
  const actionVerbs = [
    "cast", "use", "activate", "attempt", "try", "channel", "focus", "unleash", "perform", "do", "trigger", "invoke", "wield", "apply", "execute", "direct", "guide", "stabilize", "repair", "hack", "heal"
  ];
  const tokens = (text || "").toLowerCase().match(/\b[\w'-]+\b/g) || [];
  if (!tokens.length) return null;

  // Indices of action verbs in tokens
  const verbIdxs = [];
  for (let i = 0; i < tokens.length; i++) {
    if (actionVerbs.includes(tokens[i])) verbIdxs.push(i);
  }
  if (!verbIdxs.length) return null;

  // Build candidate lists
  const spellNames = (state.psykerSpells?.name || []).map(s => s || "").filter(Boolean);
  const skillNames = (state.playerSkills?.name || []).map(s => s || "").filter(Boolean);

  function findPhrase(tokens, phraseTokens) {
    for (let i = 0; i <= tokens.length - phraseTokens.length; i++) {
      let ok = true;
      for (let j = 0; j < phraseTokens.length; j++) {
        if (tokens[i + j] !== phraseTokens[j]) { ok = false; break; }
      }
      if (ok) return i;
    }
    return -1;
  }
  function nearestDistance(aIdx, bIdxArr) {
    if (!bIdxArr.length || aIdx < 0) return Infinity;
    let best = Infinity;
    for (const b of bIdxArr) best = Math.min(best, Math.abs(aIdx - b));
    return best;
  }
  function hasNegationNear(tokens, centerIdx, windowSize = 3) {
    const neg = new Set(["no","not","don't","dont","do","never","stop","avoid","won't","cant","cannot","without"]);
    for (let i = Math.max(0, centerIdx - windowSize); i <= Math.min(tokens.length - 1, centerIdx + windowSize); i++) {
      if (neg.has(tokens[i])) return true;
      if (tokens[i] === "do" && tokens[i + 1] === "not") return true;
      if (tokens[i] === "can" && tokens[i + 1] === "not") return true;
      if (tokens[i] === "will" && tokens[i + 1] === "not") return true;
    }
    return false;
  }

  const spellCandidates = [];
  for (let i = 0; i < spellNames.length; i++) {
    const phraseTokens = spellNames[i].toLowerCase().match(/\b[\w'-]+\b/g) || [];
    const idx = findPhrase(tokens, phraseTokens);
    if (idx >= 0) {
      const dist = nearestDistance(idx, verbIdxs);
      if (dist !== Infinity && !hasNegationNear(tokens, idx)) {
        spellCandidates.push({ index: i, start: idx, len: phraseTokens.length, dist });
      }
    }
  }

  const skillCandidates = [];
  for (let i = 0; i < skillNames.length; i++) {
    const phraseTokens = skillNames[i].toLowerCase().match(/\b[\w'-]+\b/g) || [];
    const idx = findPhrase(tokens, phraseTokens);
    if (idx >= 0) {
      const dist = nearestDistance(idx, verbIdxs);
      if (dist !== Infinity && !hasNegationNear(tokens, idx)) {
        skillCandidates.push({ index: i, start: idx, len: phraseTokens.length, dist });
      }
    }
  }

  // Pick best candidate: smallest distance to verb, longer phrase, spells > skills
  const byRank = (a, b) => (a.dist - b.dist) || (b.len - a.len);

  spellCandidates.sort(byRank);
  skillCandidates.sort(byRank);

  let choice = null;
  if (spellCandidates.length && skillCandidates.length) {
    const s = spellCandidates[0], k = skillCandidates[0];
    if ((s.dist < k.dist) || (s.dist === k.dist && s.len >= k.len)) {
      choice = { kind: "spell", index: s.index };
    } else {
      choice = { kind: "skill", index: k.index };
    }
  } else if (spellCandidates.length) {
    choice = { kind: "spell", index: spellCandidates[0].index };
  } else if (skillCandidates.length) {
    choice = { kind: "skill", index: skillCandidates[0].index };
  }

  return choice;
}

/**
 * Executes the chosen skill/spell and injects a SYSTEM prompt.
 * Returns the modified text.
 */
function runContextualActivation(text, choice) {
  // Prevent skill activation during dialogue
  if (isPlayerDialoguing(text)) return text;
  if (!choice) return text;

  // Only trigger if player context is present near the skill/spell name
  let triggerText = text;
  let triggerIdx = -1;
  let triggerLen = 0;
  if (choice.kind === "spell") {
    const spellName = state.psykerSpells.name[choice.index];
    triggerIdx = triggerText.toLowerCase().indexOf(spellName.toLowerCase());
    triggerLen = spellName.length;
  } else if (choice.kind === "skill") {
    const skillName = state.playerSkills.name[choice.index];
    triggerIdx = triggerText.toLowerCase().indexOf(skillName.toLowerCase());
    triggerLen = skillName.length;
  }
  if (triggerIdx === -1 || !isPlayerContext(triggerText, triggerIdx, triggerLen, 10)) {
    return text; // Skip activation if not player context
  }

  if (choice.kind === "spell") {
    const spellName = state.psykerSpells.name[choice.index];
    const spellLevel = state.psykerSpells.lvl[choice.index];
    const stats = { intl: state.playerStats.intl, cp: state.playerStats.cp };

    // Spells: unchanged (no item auto-consume). If desired later, call extractAndConsumeItemForSkill here too.
    state.pendingSkillSystem = injectSkillUsePrompt("", "spell", spellName, spellLevel, stats);
    state.contextualActivated = true; // marks as activated
    text = executePsykerSpell(choice.index, text);
    text += " ✨";
    log(`[SkillTrigger] Spell used: ${spellName} (Lvl ${spellLevel}) | INTL: ${stats.intl}, CP: ${stats.cp}`);
    return text;
  } else if (choice.kind === "skill") {
    const skillName = state.playerSkills.name[choice.index];
    const skillLevel = state.playerSkills.lvl[choice.index];
    const stats = { intl: state.playerStats.intl, cp: state.playerStats.cp };

    // NEW: detect and consume an inventory item mentioned in the input
    const itemsUsed = extractAndConsumeItemForSkill(text);

    // Include item in SYSTEM prompt if one was used
    state.pendingSkillSystem = injectSkillUsePrompt("", "skill", skillName, skillLevel, stats, itemsUsed);
    state.contextualActivated = true; // marks as activated
    skillIndex = choice.index;
    fullSkillMatch = true;
    skillCheck = [true, true, skillIndex];

    text = executeSkill(text);
    text += " 🛠️";
    log(`[SkillTrigger] Skill used: ${skillName} (Lvl ${skillLevel}) | INTL: ${stats.intl}, CP: ${stats.cp}${itemsUsed ? ` | item: ${itemsUsed.qty} x ${itemsUsed.name}` : ""}`);
    return text;
  }
  return text;
}

function extractAndConsumeItemForSkill(text) {
  // placeholder until real item-use logic is implemented
  return null;
}

function buildBlockingGearPrompt(base) {
  const job = state._pendingGearGen || state._gearGenActive || null;
  if (!job) {
    return "Gear stat generation is in progress. Please wait while Nova works her magic! 🛠️\n\nIf you just picked up or created a new weapon or armor, its stats are being generated now. You’ll be able to continue your adventure once this is complete.";
  }

  const lines = (base || "")
    .replace(/<SYSTEM>[\s\S]*?<\/SYSTEM>/gi,"")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  const recentCount = (state.gearGenConfig && state.gearGenConfig.includeRecentContextLines) || 12;
  const recent = lines.slice(-recentCount).join("\n") || "(minimal)";

  // Detailed guidance block (toggleable)
  const detail = (state.gearGenConfig && state.gearGenConfig.detailed) ? 
`Detailed Guidance:
- Damage Classes 1–10 (personal). Vehicles 11–20 excluded unless explicit narrative.
- Early progression: sidearms 1–3, standard service 3–5, precision/heavy specialty 5–7, rare 8–10 (use sparingly).
- Armor Resist (personal): 0–2 light, 3–4 service, 5–6 hardened, 7–8 advanced, 9–10 exceptional.
- Melee: ammo=0/0; omit burst/overcharge unless a powered mechanism clearly implied.
- Descriptions: 6–14 words; functional + grimdark industrial-gothic (sanctified servos, ceramite ribs, machine-rites).
- Output EXACTLY ONE <!itemStats> tag and NOTHING ELSE.` :
`Guidance: Keep within believable personal Class band. Single <!itemStats> tag. 6–14w grimdark functional desc; no meta.`;

  if (job.type === "weapon") {
    return `Gear Stat Generation (BLOCKING${state.gearGenConfig && state.gearGenConfig.deepStop ? " / HALT" : ""})
NEW WEAPON: "${job.title}"
Recent Context:
${recent}

Output exactly ONE <!itemStats> tag and NOTHING ELSE.
Fields:
type=weapon;title=${job.title};cond=<cur>/<max>;ammo=<cur>/<max or 0/0>;dmg=<DamageType Class N>;ammoItem=<item or n/a>;[burst=on/off];[overcharge=on/off];desc=<6-14w>

Aesthetic & Tone:
- Warhammer 40,000 inspired: restrained grimdark techno-gothic (reliquary housings, votive brass, incense scoring) — functional, short, no new faction names or lore paragraphs.
- Keep outputs terse and strictly machine-readable inside the tag.

${detail}`;
  }

  // armor
  return `Gear Stat Generation (BLOCKING${state.gearGenConfig && state.gearGenConfig.deepStop ? " / HALT" : ""})
NEW ARMOR: "${job.title}"
Recent Context:
${recent}

Output exactly ONE <!itemStats> tag and NOTHING ELSE.
Fields:
type=armor;title=${job.title};shield=<cur>/<max>;shieldDelay=<int>;shieldRate=<int>;directed=<0-10>;thermal=<0-10>;kinetic=<0-10>;psychic=<0-10>;sonic=<0-10>;other=<0-10>;desc=<6-14w>

Aesthetic & Tone:
- Subtle grimdark industrial feel (sanctified ceramite panes, rune-servos, sealant wax) — concise, no faction naming.

${detail}`;
}



// Helper function to check if player is dialoguing
function isPlayerDialoguing(text) {
  let textLower = text.toLowerCase();
  return dialoguePhrases.some(phrase => textLower.includes(phrase.toLowerCase()));
}

/**
 * Ensures the levelUps array for a given skill or spell object is always in sync with its name array.
 * Use for both playerSkills and psykerSpells.
 * @param {object} obj - The skill or spell object (state.playerSkills or state.psykerSpells)
 */
function ensureLevelUpsSync(obj) {
  if (!Array.isArray(obj.levelUps) || obj.levelUps.length !== obj.name.length) {
    obj.levelUps = obj.name.map(() => 0);
  }
}

// Helper function for debugging non-item matches
function debugNonItemMatch(itemName) {
  const lowerItem = itemName.toLowerCase();
  if (nonItemRegex.test(lowerItem)) {
    // List of all patterns to check individually
    const patterns = [
      "cover( behind)?", "in cover", "take cover", "shelters?", "barriers?", "corners?", 
      "walls?", "floors?", "grounds?", "ceilings?", "windows?", "doors?", "hallways?", 
      "corridors?", "rooms?", "crates?", "tables?", "chairs?", "beds?", "barricades?", 
      "pillars?", "platforms?", "ledges?", "alcoves?", "nooks?", "hides?", "hiding spots?", 
      "spots?", "locations?", "areas?", "places?", "positions?", 
      "stances?( behind| in| at)?", "take aim", "aim", "surroundings?"
    ];
    
    // Find which specific pattern caused the match
    for (const pattern of patterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(lowerItem)) {
        console.log(`🚫 Item "${itemName}" was filtered out by nonItemRegex pattern: "${pattern}"`);
        return true;
      }
    }
    console.log(`🚫 Item "${itemName}" was filtered out by nonItemRegex but specific pattern not identified`);
    return true;
  }





  return false;
}
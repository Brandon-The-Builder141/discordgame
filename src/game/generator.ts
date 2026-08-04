import type {
  ApproachSpec,
  CombatNode,
  EnemyIntent,
  IntentBehavior,
  LootSpec,
  PropSpec,
  QuestMap,
  QuestNode,
  SceneNode
} from "./types.js";

export type RandomFn = () => number;

type ApproachTheme = {
  label: string;
  narration: string;
  clueName: string;
  clueEffect: string;
};

type SceneTheme = {
  narration: string;
  prompt: string;
  search: ApproachTheme;
  track: ApproachTheme;
  call: ApproachTheme;
  props: PropSpec[];
};

type IntentTheme = {
  behavior: IntentBehavior;
  key: string;
  label: string;
  telegraph: string;
  counter: string;
  counterActions: string[];
  counterLog?: string;
  penaltyLog?: string;
};

type BiomeTheme = {
  key: string;
  adjectives: string[];
  places: string[];
  openings: string[];
  scenes: SceneTheme[];
  transitions: string[];
  enemyPrefixes: string[];
  enemyNouns: string[];
  threats: string[];
  bossPrefixes: string[];
  intents: IntentTheme[];
  victoryLines: string[];
  defeatLines: string[];
  trophies: string[];
  completedLines: string[];
  respawnLines: string[];
};

const BIOMES: BiomeTheme[] = [
  {
    key: "marsh",
    adjectives: ["Drowned", "Sunken", "Weeping", "Fevered"],
    places: ["Causeway", "Fen", "Crossing", "Shallows"],
    openings: [
      "Boardwalk planks sink underfoot. Somewhere in the reeds, a bell that should not be ringing keeps ringing.",
      "The marsh swallows the road a mile back. Lantern light stops at the waterline like it is afraid to go further."
    ],
    scenes: [
      {
        narration: "A ferry barge sits half-sunk at its mooring, ropes cut clean rather than rotted.",
        prompt: "Choose how you approach the sunken barge.",
        search: {
          label: "Dredge the shallows",
          narration: "Under the waterline you pull up a toll-box stuffed with wax-sealed marsh charts.",
          clueName: "Marsh charts",
          clueEffect: "The hunter's hide is thinner than it looks."
        },
        track: {
          label: "Follow the drag-marks",
          narration: "Long drag-marks lead off the boards, too heavy for a man, too neat for an animal.",
          clueName: "Drag-marks",
          clueEffect: "The thing is already wounded from its last meal."
        },
        call: {
          label: "Hail the reeds",
          narration: "A ferryman answers from a hidden skiff, whispering that the thing hunts by answering voices.",
          clueName: "Ferryman's warning",
          clueEffect: "The first ambush loses its bite."
        },
        props: [
          { kind: "water", x: 0, z: 0 },
          { kind: "barge", x: 0, z: -1 },
          { kind: "reeds", x: -2.5, z: 1.5 },
          { kind: "reeds", x: 2.5, z: -1.5 }
        ]
      },
      {
        narration: "A shrine to a river saint leans out of the mud, candles still warm, congregation gone.",
        prompt: "Choose how you approach the leaning shrine.",
        search: {
          label: "Search the shrine",
          narration: "Behind the altar you find offerings arranged to spell a warning in river-sign.",
          clueName: "River-sign warning",
          clueEffect: "You know where the soft plates in its armor sit."
        },
        track: {
          label: "Read the mud",
          narration: "Bare footprints circle the shrine three times, then simply stop mid-stride.",
          clueName: "Circling prints",
          clueEffect: "It limps. It can be pinned."
        },
        call: {
          label: "Ring the shrine bell",
          narration: "The bell's note comes back wrong, an octave low, from something answering out in the fog.",
          clueName: "Answered bell",
          clueEffect: "You will not be surprised by the first strike."
        },
        props: [
          { kind: "shrine", x: 0, z: -1 },
          { kind: "candles", x: 0.6, z: -0.7 },
          { kind: "mud", x: 0, z: 1 }
        ]
      }
    ],
    transitions: [
      "The reeds part without wind. Something built from drowned rope and river bone hauls itself onto the boards.",
      "The fog folds back like a curtain. It was standing there the whole time, patient as deep water."
    ],
    enemyPrefixes: ["Fen", "Mire", "Bog", "Silt"],
    enemyNouns: ["Strangler", "Warden", "Shambler", "Chorister"],
    threats: [
      "Patient ambusher that punishes loud moves and open water",
      "Waterlogged horror that drags the slow under the boards"
    ],
    bossPrefixes: ["Elder", "First-Drowned", "Bell-Keeper"],
    intents: [
      {
        behavior: "chipDamage",
        key: "undertow",
        label: "Undertow Grasp",
        telegraph: "Ropes of wet weed slide toward your ankles. Defend keeps your footing.",
        counter: "Defend",
        counterActions: ["defend"],
        penaltyLog: "{label} drags at your legs for {amount} damage."
      },
      {
        behavior: "rewardGuard",
        key: "lunge",
        label: "Sudden Lunge",
        telegraph: "It coils back on itself. Defend turns the lunge into Momentum.",
        counter: "Defend",
        counterActions: ["defend"],
        counterLog: "{name} shrugs off the lunge and gains {amount} Momentum."
      },
      {
        behavior: "bankMomentum",
        key: "falsecry",
        label: "Drowned Cry",
        telegraph: "A voice you almost know calls from the water. Inspect sees through it.",
        counter: "Inspect",
        counterActions: ["inspect"],
        counterLog: "{name} refuses the drowned voice and banks {amount} Momentum."
      },
      {
        behavior: "exposeArmor",
        key: "molt",
        label: "Splitting Hide",
        telegraph: "Its hide splits along old scars. Strike now.",
        counter: "Attack",
        counterActions: ["attack", "skill"],
        counterLog: "The split hide gapes open, baring soft rot beneath."
      }
    ],
    victoryLines: [
      "{name} drives it back beneath the boards until the bubbles stop.",
      "{name} cuts the last rope of it apart and the marsh goes honestly quiet."
    ],
    defeatLines: ["{name} goes down in the cold water as the bell rings on."],
    trophies: ["Waterlogged Bell Clapper", "River Saint's Candle", "Braided Weed Charm"],
    completedLines: ["The causeway holds. The bell has finally stopped."],
    respawnLines: ["{name} coughs up marsh water on a dry stretch of boardwalk, alive by someone's grace."]
  },
  {
    key: "ruin",
    adjectives: ["Broken", "Hollow", "Ashen", "Nameless"],
    places: ["Watchtower", "Bastion", "Gatehouse", "Aqueduct"],
    openings: [
      "The old wall walks for miles along the ridge, and every torch bracket on it has been filled and lit tonight.",
      "Stones the size of wagons lie thrown from the tower like dice. Whatever threw them is still keeping score."
    ],
    scenes: [
      {
        narration: "The gatehouse doors stand open. The garrison's meal is still warm on the table inside.",
        prompt: "Choose how you approach the silent gatehouse.",
        search: {
          label: "Search the barracks",
          narration: "A duty ledger lists the same watchman signing in every hour for three days straight.",
          clueName: "Impossible ledger",
          clueEffect: "Its armored shell is cracked along the left side."
        },
        track: {
          label: "Follow the scrape-marks",
          narration: "Something heavy dragged itself up the stairs, gouging the stone, favoring one side.",
          clueName: "Gouged stairs",
          clueEffect: "It is already hurt and slower to turn."
        },
        call: {
          label: "Sound the horn",
          narration: "The gate horn echoes down empty halls, and something far above knocks once in answer.",
          clueName: "Answering knock",
          clueEffect: "You will see the first blow coming."
        },
        props: [
          { kind: "gate", x: 0, z: -1.5 },
          { kind: "table", x: 1, z: 0 },
          { kind: "rubble", x: -2, z: 1 }
        ]
      },
      {
        narration: "An aqueduct arch has collapsed across the courtyard, and the rubble has been stacked into a crude nest.",
        prompt: "Choose how you approach the rubble nest.",
        search: {
          label: "Pick through the nest",
          narration: "Among the stones you find shed plates of slate-grey chitin, brittle at the edges.",
          clueName: "Shed plates",
          clueEffect: "Its new shell has not hardened."
        },
        track: {
          label: "Trace the stacked stones",
          narration: "The stacking pattern repeats like a signature, growing sloppier, wounded, toward the tower.",
          clueName: "Sloppy signature",
          clueEffect: "Whatever built this is flagging."
        },
        call: {
          label: "Strike stone on stone",
          narration: "You knock twice on the fallen arch. The answer comes back in your own rhythm, mocking.",
          clueName: "Mocking rhythm",
          clueEffect: "The opening exchange will not catch you cold."
        },
        props: [
          { kind: "arch", x: 0, z: -1 },
          { kind: "rubble", x: 0.5, z: 0.5 },
          { kind: "nest", x: -0.8, z: 0.2 }
        ]
      }
    ],
    transitions: [
      "Mortar dust sifts from the ceiling. A shape of stacked stone and old armor unfolds from the wall itself.",
      "The torches gutter in unison. It comes down the stairs the way an avalanche comes down a mountain."
    ],
    enemyPrefixes: ["Wall", "Rampart", "Cellar", "Tower"],
    enemyNouns: ["Sentinel", "Masonwight", "Gargant", "Keeper"],
    threats: [
      "Stone-shelled brute that punishes attackers who stand still",
      "Old garrison horror that knows every corridor better than you"
    ],
    bossPrefixes: ["Last", "Unrelieved", "Oathbound"],
    intents: [
      {
        behavior: "chipDamage",
        key: "shockwave",
        label: "Rampart Slam",
        telegraph: "It raises a fist like a keystone. Defend braces for the shockwave.",
        counter: "Defend",
        counterActions: ["defend"],
        penaltyLog: "{label} shakes the floor for {amount} damage."
      },
      {
        behavior: "rewardGuard",
        key: "toppling",
        label: "Toppling Rush",
        telegraph: "It leans into a charge. Defend turns its weight into Momentum.",
        counter: "Defend",
        counterActions: ["defend"],
        counterLog: "{name} sidesteps the rush and gains {amount} Momentum."
      },
      {
        behavior: "bankMomentum",
        key: "watchcry",
        label: "Stolen Watch-Cry",
        telegraph: "It calls the old watch signals in a dead man's voice. Inspect reads the lie.",
        counter: "Inspect",
        counterActions: ["inspect"],
        counterLog: "{name} ignores the dead watch-cry and banks {amount} Momentum."
      },
      {
        behavior: "exposeArmor",
        key: "crack",
        label: "Widening Crack",
        telegraph: "The crack in its shell glows along the seam. Strike now.",
        counter: "Attack",
        counterActions: ["attack", "skill"],
        counterLog: "The cracked shell splits wider, baring the keystone heart."
      }
    ],
    victoryLines: [
      "{name} brings it down in an avalanche of dead stone.",
      "{name} finds the keystone and pulls. The rest is gravity."
    ],
    defeatLines: ["{name} falls among the rubble as the torches all go out at once."],
    trophies: ["Keystone Shard", "Garrison Duty Ledger", "Slate Chitin Plate"],
    completedLines: ["The wall stands unmanned but honest now. Nothing knocks back."],
    respawnLines: ["{name} wakes under the gatehouse arch, dragged there by hands unknown."]
  },
  {
    key: "forest",
    adjectives: ["Whispering", "Blackbough", "Starless", "Bent"],
    places: ["Greenway", "Hunting Ground", "Thicket", "Crownwood"],
    openings: [
      "The trail markers have all been turned to face the wrong way, and recently, sap still bleeding from the nails.",
      "No birdsong for the last mile. The canopy is thick enough to make its own night."
    ],
    scenes: [
      {
        narration: "A hunter's camp sits abandoned mid-meal, bows unstrung and hung neatly in a circle facing outward.",
        prompt: "Choose how you approach the hunters' camp.",
        search: {
          label: "Search the camp",
          narration: "Inside a bedroll you find a hunter's journal, its last page just the word LISTEN pressed through the paper.",
          clueName: "Hunter's journal",
          clueEffect: "Its pelt parts easily over the ribs."
        },
        track: {
          label: "Circle for sign",
          narration: "Around the camp you cut fresh sign: a stride twice a man's, one paw dragging blood.",
          clueName: "Bleeding stride",
          clueEffect: "The beast starts the fight already torn."
        },
        call: {
          label: "Whistle the hunters' call",
          narration: "You give the two-note recall whistle. The forest gives it back from four directions at once.",
          clueName: "Fourfold echo",
          clueEffect: "The first pounce will find you braced."
        },
        props: [
          { kind: "campfire", x: 0, z: 0 },
          { kind: "tent", x: -1.2, z: -0.8 },
          { kind: "tree", x: 2.5, z: 1 },
          { kind: "tree", x: -2.8, z: 1.6 }
        ]
      },
      {
        narration: "A ring of standing stones has been strung with hundreds of small bones on gut cord, all perfectly still.",
        prompt: "Choose how you approach the bone chimes.",
        search: {
          label: "Study the chimes",
          narration: "The bones are strung in patterns, a tally, and the newest cord is strung with fresher, larger bones.",
          clueName: "Bone tally",
          clueEffect: "You know which flank it guards poorly."
        },
        track: {
          label: "Skirt the stone ring",
          narration: "Outside the ring the moss is torn in long furrows where something paced, restless and favoring a leg.",
          clueName: "Restless furrows",
          clueEffect: "It is worn down from its vigil."
        },
        call: {
          label: "Still the chimes",
          narration: "You silence one cord with your palm. Every other chime in the ring turns slowly to point at you.",
          clueName: "Turning chimes",
          clueEffect: "Its opening trick is spent."
        },
        props: [
          { kind: "standing-stone", x: -1, z: -1 },
          { kind: "standing-stone", x: 1, z: -1 },
          { kind: "chimes", x: 0, z: -0.5 }
        ]
      }
    ],
    transitions: [
      "The canopy drops a curtain of leaves. Antlers first, it steps out of a tree too narrow to have held it.",
      "Every chime rings at once. The thing that kept the tally has come to collect."
    ],
    enemyPrefixes: ["Bough", "Antler", "Moss", "Hollow"],
    enemyNouns: ["Stalker", "Regent", "Tallykeeper", "Shrike"],
    threats: [
      "Patient predator that herds prey away from open ground",
      "Territorial horror that answers every sound with teeth"
    ],
    bossPrefixes: ["Crowned", "Eldest", "Winter-Fed"],
    intents: [
      {
        behavior: "chipDamage",
        key: "gore",
        label: "Goring Sweep",
        telegraph: "The antlers drop level with your chest. Defend blunts the sweep.",
        counter: "Defend",
        counterActions: ["defend"],
        penaltyLog: "{label} clips you for {amount} damage."
      },
      {
        behavior: "rewardGuard",
        key: "pounce",
        label: "Canopy Drop",
        telegraph: "The branches above creak with new weight. Defend turns the drop into Momentum.",
        counter: "Defend",
        counterActions: ["defend"],
        counterLog: "{name} meets the drop braced and gains {amount} Momentum."
      },
      {
        behavior: "bankMomentum",
        key: "birdsong",
        label: "False Birdsong",
        telegraph: "Sweet birdsong starts up for the first time all day. Inspect hears the teeth in it.",
        counter: "Inspect",
        counterActions: ["inspect"],
        counterLog: "{name} hears the hunger under the song and banks {amount} Momentum."
      },
      {
        behavior: "exposeArmor",
        key: "shed",
        label: "Shedding Velvet",
        telegraph: "Velvet peels from its antlers in ribbons, baring soft new bone. Strike now.",
        counter: "Attack",
        counterActions: ["attack", "skill"],
        counterLog: "The shed velvet bares soft growth beneath the crown."
      }
    ],
    victoryLines: [
      "{name} brings it down at the tree line, and the birds return one cautious note at a time.",
      "{name} breaks the crown from its head and the forest exhales."
    ],
    defeatLines: ["{name} falls among the roots as the chimes ring the tally one higher."],
    trophies: ["Velvet-Stripped Antler Tine", "Hunter's Last Journal", "Bone Chime Cord"],
    completedLines: ["The trail markers point true again. The wood keeps its distance."],
    respawnLines: ["{name} wakes at the forest's edge, laid out straight, boots pointed toward home."]
  },
  {
    key: "crypt",
    adjectives: ["Silent", "Candled", "Forgotten", "Sealed"],
    places: ["Undercroft", "Ossuary", "Barrow", "Reliquary"],
    openings: [
      "The barrow door has been opened from the inside. The votive candles along the stair are lit in welcome.",
      "Below the chapel, the air tastes of cold wax and older names. Something down here has been expecting visitors."
    ],
    scenes: [
      {
        narration: "The ossuary shelves have been rearranged overnight, every skull turned to watch the doorway you came through.",
        prompt: "Choose how you approach the watching shelves.",
        search: {
          label: "Search the reliquary",
          narration: "In a false-bottomed reliquary you find a sexton's key scored with grave-wards.",
          clueName: "Sexton's key",
          clueEffect: "The wards bite through its grave-shell."
        },
        track: {
          label: "Follow the wax drippings",
          narration: "Fresh wax dots the floor in a limping line, always the same stride, always favoring the left.",
          clueName: "Limping wax line",
          clueEffect: "The keeper is old and already cracking."
        },
        call: {
          label: "Speak the grave-greeting",
          narration: "You give the old courtesy for entering a tomb. The dark pauses, then politely gives it back.",
          clueName: "Returned courtesy",
          clueEffect: "The first blow will come with warning."
        },
        props: [
          { kind: "shelves", x: -1, z: -1 },
          { kind: "skulls", x: 1, z: -1 },
          { kind: "candles", x: 0, z: 0.5 }
        ]
      },
      {
        narration: "A funeral barge rests in a dry stone channel, oars shipped, waiting on a river that drained away centuries ago.",
        prompt: "Choose how you approach the dry barge.",
        search: {
          label: "Board the barge",
          narration: "Under the burial shrouds you find grave-goods sorted into two piles: tribute, and bait.",
          clueName: "Sorted grave-goods",
          clueEffect: "You know which of its bones are hollow."
        },
        track: {
          label: "Walk the dry channel",
          narration: "The channel silt holds one set of bare footprints going out, and the same set dragging back.",
          clueName: "Dragging return",
          clueEffect: "Whatever walked out came back diminished."
        },
        call: {
          label: "Knock on the hull",
          narration: "You rap the hull twice, ferryman's custom. Below decks, something raps back: once.",
          clueName: "Single knock",
          clueEffect: "Its opening gambit is answered before it starts."
        },
        props: [
          { kind: "barge", x: 0, z: -0.5 },
          { kind: "channel", x: 0, z: 1 },
          { kind: "shrouds", x: 0.5, z: -0.8 }
        ]
      }
    ],
    transitions: [
      "The candle flames all bend toward the same doorway. The tomb's keeper steps through wearing its congregation.",
      "Bone settles on bone in the dark, assembling. It is taller than the doorway and it does not stoop."
    ],
    enemyPrefixes: ["Grave", "Vault", "Bone", "Candle"],
    enemyNouns: ["Sexton", "Warden", "Choir", "Reliquant"],
    threats: [
      "Tomb keeper that punishes the living for every loud step",
      "Assembled dead that trade pain freely, having none of their own"
    ],
    bossPrefixes: ["First-Buried", "Unquiet", "Cathedral"],
    intents: [
      {
        behavior: "chipDamage",
        key: "gravechill",
        label: "Grave-Chill",
        telegraph: "The cold rolls off it in a wave. Defend keeps the blood moving.",
        counter: "Defend",
        counterActions: ["defend"],
        penaltyLog: "{label} seeps into your joints for {amount} damage."
      },
      {
        behavior: "rewardGuard",
        key: "pallbearer",
        label: "Pallbearer's Embrace",
        telegraph: "Its arms open wide as a casket lid. Defend turns the embrace into Momentum.",
        counter: "Defend",
        counterActions: ["defend"],
        counterLog: "{name} breaks the embrace and gains {amount} Momentum."
      },
      {
        behavior: "bankMomentum",
        key: "requiem",
        label: "Borrowed Requiem",
        telegraph: "It sings a funeral hymn in a voice you buried years ago. Inspect refuses the grief.",
        counter: "Inspect",
        counterActions: ["inspect"],
        counterLog: "{name} sets the borrowed voice aside and banks {amount} Momentum."
      },
      {
        behavior: "exposeArmor",
        key: "unseam",
        label: "Unseaming Shell",
        telegraph: "The grave-shell parts along the wards' scoring. Strike now.",
        counter: "Attack",
        counterActions: ["attack", "skill"],
        counterLog: "The warded seams glow and the grave-shell hangs open."
      }
    ],
    victoryLines: [
      "{name} lays it down piece by piece, and the candles gutter out contented.",
      "{name} speaks the last courtesy over what remains, and this time nothing answers."
    ],
    defeatLines: ["{name} falls as the choir of borrowed voices sings them down the stair."],
    trophies: ["Sexton's Warded Key", "Candle That Will Not Gutter", "Ferryman's Oar Pin"],
    completedLines: ["The barrow door swings shut behind you, politely, from the inside."],
    respawnLines: ["{name} wakes on the chapel floor above, laid out with unearned care."]
  }
];

export function mulberry32(seed: number): RandomFn {
  let a = seed >>> 0;

  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateQuestMap(seed: number, level = 1): QuestMap {
  const rng = mulberry32(seed);
  const biome = pick(rng, BIOMES);
  const pairs = 2 + (rng() < 0.4 ? 1 : 0);
  const title = `The ${pick(rng, biome.adjectives)} ${pick(rng, biome.places)}`;
  const nodes: Record<string, QuestNode> = {};
  const sceneThemes = shuffle(rng, biome.scenes);

  for (let index = 0; index < pairs; index += 1) {
    const isBoss = index === pairs - 1;
    const sceneId = `scene-${index}`;
    const combatId = `combat-${index}`;
    const theme = sceneThemes[index % sceneThemes.length]!;

    nodes[sceneId] = buildSceneNode(sceneId, combatId, theme, biome, rng);
    nodes[combatId] = buildCombatNode(
      combatId,
      isBoss ? undefined : `scene-${index + 1}`,
      sceneId,
      theme,
      biome,
      rng,
      level,
      isBoss
    );
  }

  return {
    id: `gen-${seed}`,
    seed,
    title,
    opening: pick(rng, biome.openings),
    completedText: pick(rng, biome.completedLines),
    respawnText: pick(rng, biome.respawnLines),
    start: "scene-0",
    nodes
  };
}

function buildSceneNode(
  id: string,
  next: string,
  theme: SceneTheme,
  biome: BiomeTheme,
  rng: RandomFn
): SceneNode {
  const approaches: ApproachSpec[] = (["search", "track", "call"] as const).map((key) => {
    const variant = theme[key];

    return {
      key,
      label: variant.label,
      narration: variant.narration,
      flag: `${id}-${key}`,
      clue: { name: variant.clueName, effect: variant.clueEffect }
    };
  });

  return {
    id,
    kind: "scene",
    narration: theme.narration,
    prompt: theme.prompt,
    approaches,
    transition: pick(rng, biome.transitions),
    next,
    props: theme.props
  };
}

function buildCombatNode(
  id: string,
  next: string | undefined,
  sceneId: string,
  theme: SceneTheme,
  biome: BiomeTheme,
  rng: RandomFn,
  level: number,
  isBoss: boolean
): CombatNode {
  const name = isBoss
    ? `${pick(rng, biome.bossPrefixes)} ${pick(rng, biome.enemyPrefixes)} ${pick(rng, biome.enemyNouns)}`
    : `${pick(rng, biome.enemyPrefixes)} ${pick(rng, biome.enemyNouns)}`;
  const baseHp = 22 + level * 5 + randInt(rng, 0, 8);
  const hp = isBoss ? Math.round(baseHp * 1.4) : baseHp;
  const armor = 9 + level + randInt(rng, 0, 2) + (isBoss ? 1 : 0);
  const damage = damageForLevel(level, isBoss);
  const intents = shuffle(rng, biome.intents).map((intent) => toEnemyIntent(intent, level));

  const node: CombatNode = {
    id,
    kind: "combat",
    titleSuffix: isBoss ? "Showdown" : "Ambush",
    enemy: {
      id: slugify(name),
      name,
      hp,
      maxHp: hp,
      armor,
      damage,
      threat: pick(rng, biome.threats)
    },
    modifiers: [
      { ifFlag: `${sceneId}-track`, hp: -(3 + level) },
      { ifFlag: `${sceneId}-search`, armor: -1 }
    ],
    intents,
    boons: [
      {
        ifFlag: `${sceneId}-call`,
        usedFlag: `${sceneId}-call-used`,
        type: "reduceDamage",
        amount: 3,
        log: "The warning pays off: {amount} HP saved as the first trick falls flat."
      }
    ],
    victoryNarration: pick(rng, biome.victoryLines),
    defeatNarration: pick(rng, biome.defeatLines),
    loot: lootFor(rng, level, isBoss, biome)
  };

  if (next) {
    node.next = next;
  }

  return node;
}

function toEnemyIntent(theme: IntentTheme, level: number): EnemyIntent {
  const amount = theme.behavior === "chipDamage" ? Math.min(2 + Math.floor(level / 3), 4) : 2;
  const intent: EnemyIntent = {
    key: theme.key,
    label: theme.label,
    telegraph: theme.telegraph,
    counter: theme.counter,
    counterActions: [...theme.counterActions],
    behavior: theme.behavior,
    amount
  };

  if (theme.counterLog) {
    intent.counterLog = theme.counterLog;
  }

  if (theme.penaltyLog) {
    intent.penaltyLog = theme.penaltyLog;
  }

  return intent;
}

function lootFor(rng: RandomFn, level: number, isBoss: boolean, biome: BiomeTheme): LootSpec {
  if (!isBoss) {
    return {
      gold: 8 + level * 3 + randInt(rng, 0, 6),
      xp: 35 + level * 10,
      items: []
    };
  }

  const trophy = pick(rng, biome.trophies);

  return {
    gold: 24 + level * 8 + randInt(rng, 0, 10),
    xp: 70 + level * 20,
    items: [{ id: slugify(trophy), name: trophy, quantity: 1 }]
  };
}

function damageForLevel(level: number, isBoss: boolean): string {
  const tiers = ["1d6+2", "1d8+2", "1d8+3", "1d10+3", "1d10+4"];
  const index = Math.min(tiers.length - 1, Math.max(0, level - 1) + (isBoss ? 1 : 0));
  return tiers[index]!;
}

function pick<T>(rng: RandomFn, values: readonly T[]): T {
  if (values.length === 0) {
    throw new Error("Cannot pick from an empty list.");
  }

  return values[Math.floor(rng() * values.length) % values.length]!;
}

function randInt(rng: RandomFn, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffle<T>(rng: RandomFn, values: readonly T[]): T[] {
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }

  return copy;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

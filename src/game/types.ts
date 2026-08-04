export type Stats = {
  might: number;
  finesse: number;
  mind: number;
  spirit: number;
};

export type Item = {
  id: string;
  name: string;
  quantity: number;
};

export type Character = {
  ownerId: string;
  name: string;
  classKey: "warden" | "hexbinder" | "shade" | "mender";
  level: number;
  xp: number;
  gold: number;
  hp: number;
  maxHp: number;
  armor: number;
  stats: Stats;
  inventory: Item[];
  createdAt: string;
  updatedAt: string;
};

export type Enemy = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  armor: number;
  damage: string;
  threat: string;
};

export type IntentBehavior = "exposeArmor" | "bankMomentum" | "chipDamage" | "rewardGuard";

export type EnemyIntent = {
  key: string;
  label: string;
  telegraph: string;
  counter: string;
  counterActions?: string[];
  behavior?: IntentBehavior;
  amount?: number;
  counterLog?: string;
  penaltyLog?: string;
};

export type ApproachSpec = {
  key: string;
  label: string;
  narration: string;
  flag?: string;
  clue?: { name: string; effect: string };
  next?: string;
};

export type EnemyModifier = {
  ifFlag: string;
  hp?: number;
  armor?: number;
};

export type BoonSpec = {
  ifFlag: string;
  usedFlag: string;
  type: "reduceDamage";
  amount: number;
  log: string;
};

export type LootSpec = {
  gold: number;
  xp: number;
  items: Item[];
};

export type PropSpec = {
  kind: string;
  x: number;
  z: number;
  rotation?: number;
  scale?: number;
};

export type SceneNode = {
  id: string;
  kind: "scene";
  narration: string;
  prompt?: string;
  approaches: ApproachSpec[];
  transition?: string;
  next: string;
  props?: PropSpec[];
};

export type CombatNode = {
  id: string;
  kind: "combat";
  titleSuffix: string;
  enemy: Enemy;
  modifiers?: EnemyModifier[];
  intents: EnemyIntent[];
  boons?: BoonSpec[];
  victoryNarration: string;
  defeatNarration: string;
  loot: LootSpec;
  next?: string;
  props?: PropSpec[];
};

export type QuestNode = SceneNode | CombatNode;

export type QuestMap = {
  id: string;
  title: string;
  opening: string;
  completedText: string;
  respawnText: string;
  start: string;
  nodes: Record<string, QuestNode>;
  seed?: number;
};

export type AdventureSession = {
  questId: string;
  ownerId: string;
  phase: "scene" | "combat" | "completed" | "failed";
  scene: number;
  nodeId?: string;
  seed?: number;
  map?: QuestMap;
  round?: number;
  momentum?: number;
  clues?: string[];
  enemyIntent?: EnemyIntent;
  enemy?: Enemy;
  log: string[];
  flags: Record<string, boolean>;
  updatedAt: string;
};

export type GameState = {
  version: 1;
  characters: Record<string, Character>;
  adventures: Record<string, AdventureSession>;
};

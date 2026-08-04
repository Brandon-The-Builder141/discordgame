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

export type EnemyIntent = {
  key: "rake" | "pounce" | "mimic" | "ward";
  label: string;
  telegraph: string;
  counter: string;
};

export type AdventureSession = {
  questId: "hollow-road";
  ownerId: string;
  phase: "scene" | "combat" | "completed" | "failed";
  scene: number;
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

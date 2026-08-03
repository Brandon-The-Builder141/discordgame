import type { Stats } from "./types.js";

export const CLASS_KEYS = ["warden", "hexbinder", "shade", "mender"] as const;
export type ClassKey = (typeof CLASS_KEYS)[number];

export type PlayableClass = {
  name: string;
  baseHp: number;
  armor: number;
  stats: Stats;
  featureName: string;
  featureDescription: string;
};

export const playableClasses: Record<ClassKey, PlayableClass> = {
  warden: {
    name: "Warden",
    baseHp: 34,
    armor: 13,
    stats: { might: 3, finesse: 1, mind: 0, spirit: 2 },
    featureName: "Shieldbreak",
    featureDescription: "Strike with Might. On a hit, your next incoming damage is reduced."
  },
  hexbinder: {
    name: "Hexbinder",
    baseHp: 24,
    armor: 10,
    stats: { might: 0, finesse: 1, mind: 4, spirit: 1 },
    featureName: "Cinder Hex",
    featureDescription: "Attack with Mind and deal extra damage on a strong success."
  },
  shade: {
    name: "Shade",
    baseHp: 26,
    armor: 11,
    stats: { might: 1, finesse: 4, mind: 1, spirit: 0 },
    featureName: "Knife in the Dark",
    featureDescription: "Attack with Finesse and crit more often when the enemy is wounded."
  },
  mender: {
    name: "Mender",
    baseHp: 28,
    armor: 11,
    stats: { might: 1, finesse: 0, mind: 2, spirit: 3 },
    featureName: "Bright Mend",
    featureDescription: "Attack with Spirit and recover a little HP when you land a strong success."
  }
};

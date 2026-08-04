import type { AdventureSession, QuestMap } from "./types.js";

export const HOLLOW_ROAD: QuestMap = {
  id: "hollow-road",
  title: "The Hollow Road",
  opening:
    "The caravan road should be loud with wheels and mule bells. Tonight it is quiet, split by rainwater, and lit by one lantern swinging from a wrecked wagon.",
  completedText: "The road is quiet again, though the black token still feels warm.",
  respawnText: "{name} wakes at the roadside with bruised ribs and a second chance.",
  start: "caravan",
  nodes: {
    caravan: {
      id: "caravan",
      kind: "scene",
      narration:
        "The caravan road should be loud with wheels and mule bells. Tonight it is quiet, split by rainwater, and lit by one lantern swinging from a wrecked wagon.",
      prompt: "Choose how you approach the broken caravan.",
      approaches: [
        {
          key: "search",
          label: "Search the wreck",
          narration: "Under a snapped axle, you find a black road-token marked with a crown split in two.",
          flag: "foundToken",
          clue: { name: "Black road-token", effect: "Road Stalker armor is weakened." }
        },
        {
          key: "track",
          label: "Follow tracks",
          narration: "The mud shows clawed feet circling the caravan, then vanishing into the ditch grass.",
          flag: "trackedEnemy",
          clue: { name: "Clawed trail", effect: "The ambusher starts wounded and easier to pin." }
        },
        {
          key: "call",
          label: "Call out",
          narration:
            "A trapped courier answers from beneath torn canvas, warning you that something learned to mimic voices.",
          flag: "warnedSurvivor",
          clue: { name: "Courier warning", effect: "The first counterattack is reduced." }
        }
      ],
      transition: "The ditch grass bends the wrong way. A road stalker unfolds itself from the weeds and lunges.",
      next: "ambush",
      props: [
        { kind: "road", x: 0, z: 0 },
        { kind: "wagon", x: 0, z: -1.2 },
        { kind: "lantern", x: 0.9, z: -0.8 },
        { kind: "tree", x: -3, z: 2 },
        { kind: "tree", x: 3.2, z: -2.4 }
      ]
    },
    ambush: {
      id: "ambush",
      kind: "combat",
      titleSuffix: "Ambush",
      enemy: {
        id: "road-stalker",
        name: "Road Stalker",
        hp: 30,
        maxHp: 30,
        armor: 11,
        damage: "1d8+2",
        threat: "Ambusher that punishes hesitation and weak footing"
      },
      modifiers: [
        { ifFlag: "trackedEnemy", hp: -4 },
        { ifFlag: "foundToken", armor: -1 }
      ],
      intents: [
        {
          key: "rake",
          label: "Raking Charge",
          telegraph: "Claws spread wide. Defend blunts the follow-through.",
          counter: "Defend",
          counterActions: ["defend"],
          behavior: "chipDamage",
          amount: 2,
          penaltyLog: "{label} lands extra pressure for {amount} damage."
        },
        {
          key: "pounce",
          label: "Low Pounce",
          telegraph: "The stalker coils low. Defend converts the impact into Momentum.",
          counter: "Defend",
          counterActions: ["defend"],
          behavior: "rewardGuard",
          amount: 2,
          counterLog: "{name} catches the pounce on guard and gains {amount} Momentum."
        },
        {
          key: "mimic",
          label: "Mimic Cry",
          telegraph: "A stolen voice calls from the ditch. Inspect reads the trick.",
          counter: "Inspect",
          counterActions: ["inspect"],
          behavior: "bankMomentum",
          amount: 2,
          counterLog: "{name} ignores the stolen voice and banks {amount} Momentum."
        },
        {
          key: "ward",
          label: "Split-Crown Ward",
          telegraph: "The black token hums against the creature's armor. Strike now.",
          counter: "Attack",
          counterActions: ["attack", "skill"],
          behavior: "exposeArmor",
          amount: 2,
          counterLog: "The split-crown ward flickers open, exposing a softer line through the creature's hide."
        }
      ],
      boons: [
        {
          ifFlag: "warnedSurvivor",
          usedFlag: "usedCourierWarning",
          type: "reduceDamage",
          amount: 3,
          log: "Courier warning saves {amount} HP as the party avoids the mimicked feint."
        }
      ],
      victoryNarration: "{name} drives the road stalker back into the grass until it dissolves into ash.",
      defeatNarration: "{name} collapses as the caravan bells ring in the dark.",
      loot: {
        gold: 22,
        xp: 75,
        items: [{ id: "black-road-token", name: "Black Road Token", quantity: 1 }]
      },
      props: [
        { kind: "ditch", x: -2, z: 0 },
        { kind: "ditch", x: 2, z: 0 },
        { kind: "enemy", x: 0, z: 1.6 }
      ]
    }
  }
};

export function resolveQuestMap(session: AdventureSession): QuestMap {
  if (session.map) {
    return session.map;
  }

  return HOLLOW_ROAD;
}

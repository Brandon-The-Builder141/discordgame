import { addItem, grantXp } from "./characters.js";
import { resolveCombatAction, type CombatAction } from "./combat.js";
import type { AdventureSession, Character, Enemy, GameState } from "./types.js";

export type QuestResult = {
  title: string;
  narration: string;
  character: Character;
  session: AdventureSession;
  enemy?: Enemy;
  availableActions: string[];
  rollSummary?: string;
};

export function startQuest(state: GameState, ownerId: string): QuestResult {
  const character = requireCharacter(state, ownerId);
  const existing = state.adventures[ownerId];

  if (existing && existing.phase !== "completed" && existing.phase !== "failed") {
    return result(character, existing, "The Hollow Road", existing.log.at(-1) || openingNarration(), actionsForSession(existing));
  }

  const session: AdventureSession = {
    questId: "hollow-road",
    ownerId,
    phase: "scene",
    scene: 0,
    flags: {},
    log: [openingNarration()],
    updatedAt: new Date().toISOString()
  };

  state.adventures[ownerId] = session;
  return result(character, session, "The Hollow Road", openingNarration(), ["search", "track", "call"]);
}

export function continueQuest(state: GameState, ownerId: string, action: string): QuestResult {
  const character = requireCharacter(state, ownerId);
  const existing = state.adventures[ownerId];

  if (!existing) {
    return startQuest(state, ownerId);
  }

  const session = existing;

  if (session.phase === "completed") {
    return result(character, session, "The Hollow Road: Complete", "The road is quiet again, though the black token still feels warm.", []);
  }

  if (session.phase === "failed") {
    character.hp = Math.max(1, Math.floor(character.maxHp / 2));
    session.phase = "scene";
    session.scene = 0;
    session.log.push(`${character.name} wakes at the roadside with bruised ribs and a second chance.`);
    touch(character, session);
    return result(character, session, "The Hollow Road", session.log.at(-1) || openingNarration(), ["search", "track", "call"]);
  }

  if (session.phase === "scene") {
    return resolveSceneAction(character, session, action);
  }

  if (session.phase === "combat") {
    return resolveQuestCombat(character, session, action);
  }

  return result(character, session, "The Hollow Road", "Nothing else stirs.", []);
}

function resolveSceneAction(character: Character, session: AdventureSession, action: string): QuestResult {
  if (!["search", "track", "call"].includes(action)) {
    return result(character, session, "The Hollow Road", "Choose how you approach the broken caravan.", ["search", "track", "call"]);
  }

  if (action === "search") {
    session.flags.foundToken = true;
    session.log.push("Under a snapped axle, you find a black road-token marked with a crown split in two.");
  }

  if (action === "track") {
    session.flags.trackedEnemy = true;
    session.log.push("The mud shows clawed feet circling the caravan, then vanishing into the ditch grass.");
  }

  if (action === "call") {
    session.flags.warnedSurvivor = true;
    session.log.push("A trapped courier answers from beneath torn canvas, warning you that something learned to mimic voices.");
  }

  session.enemy = createRoadStalker(session);
  session.phase = "combat";
  session.scene = 1;
  session.log.push("The ditch grass bends the wrong way. A road stalker unfolds itself from the weeds and lunges.");
  touch(character, session);

  return result(
    character,
    session,
    "The Hollow Road: Ambush",
    session.log.slice(-2).join("\n\n"),
    actionsForSession(session)
  );
}

function resolveQuestCombat(character: Character, session: AdventureSession, action: string): QuestResult {
  if (!session.enemy) {
    session.enemy = createRoadStalker(session);
  }

  if (!isCombatAction(action)) {
    return result(character, session, "The Hollow Road: Ambush", "The road stalker waits for your move.", actionsForSession(session));
  }

  const combat = resolveCombatAction(character, session.enemy, action);
  session.enemy = combat.enemy;
  session.log.push(...combat.narration);

  if (combat.characterDefeated) {
    session.phase = "failed";
    character.hp = 0;
    session.log.push(`${character.name} collapses as the caravan bells ring in the dark.`);
    touch(character, session);
    return result(
      character,
      session,
      "The Hollow Road: Defeat",
      session.log.slice(-3).join("\n\n"),
      ["start"],
      combat.rollSummary
    );
  }

  if (combat.enemyDefeated) {
    session.phase = "completed";
    delete session.enemy;
    character.gold += 22;
    addItem(character.inventory, { id: "black-road-token", name: "Black Road Token", quantity: 1 });
    const xpLog = grantXp(character, 75);
    session.log.push(`${character.name} drives the road stalker back into the grass until it dissolves into ash.`);
    session.log.push("Reward: 22 gold, 75 XP, and one Black Road Token.");
    session.log.push(...xpLog);
    touch(character, session);
    return result(
      character,
      session,
      "The Hollow Road: Cleared",
      session.log.slice(-4).join("\n\n"),
      [],
      combat.rollSummary
    );
  }

  touch(character, session);
  return result(
    character,
    session,
    "The Hollow Road: Ambush",
    session.log.slice(-3).join("\n\n"),
    actionsForSession(session),
    combat.rollSummary
  );
}

function actionsForSession(session: AdventureSession): string[] {
  if (session.phase === "scene") {
    return ["search", "track", "call"];
  }

  if (session.phase === "combat") {
    return ["attack", "defend", "skill", "potion", "inspect"];
  }

  if (session.phase === "failed") {
    return ["start"];
  }

  return [];
}

function createRoadStalker(session: AdventureSession): Enemy {
  const hpBonus = session.flags.trackedEnemy ? -4 : 0;
  const armorBonus = session.flags.foundToken ? -1 : 0;

  return {
    id: "road-stalker",
    name: "Road Stalker",
    hp: 30 + hpBonus,
    maxHp: 30 + hpBonus,
    armor: 11 + armorBonus,
    damage: "1d8+2",
    threat: "Ambusher that punishes hesitation and weak footing"
  };
}

function openingNarration(): string {
  return "The caravan road should be loud with wheels and mule bells. Tonight it is quiet, split by rainwater, and lit by one lantern swinging from a wrecked wagon.";
}

function result(
  character: Character,
  session: AdventureSession,
  title: string,
  narration: string,
  availableActions: string[],
  rollSummary?: string
): QuestResult {
  return {
    title,
    narration,
    character,
    session,
    enemy: session.enemy,
    availableActions,
    rollSummary
  };
}

function requireCharacter(state: GameState, ownerId: string): Character {
  const character = state.characters[ownerId];

  if (!character) {
    throw new Error(`No character found for ${ownerId}.`);
  }

  return character;
}

function isCombatAction(action: string): action is CombatAction {
  return ["attack", "defend", "skill", "potion", "inspect"].includes(action);
}

function touch(character: Character, session: AdventureSession): void {
  const now = new Date().toISOString();
  character.updatedAt = now;
  session.updatedAt = now;
}

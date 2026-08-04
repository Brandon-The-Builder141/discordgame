import { addItem, grantXp } from "./characters.js";
import { resolveCombatAction, type CombatAction } from "./combat.js";
import type { RandomSource } from "./dice.js";
import { HOLLOW_ROAD, resolveQuestMap } from "./quest-map.js";
import type {
  AdventureSession,
  Character,
  CombatNode,
  Enemy,
  EnemyIntent,
  GameState,
  QuestMap,
  QuestNode,
  SceneNode
} from "./types.js";

export type QuestResult = {
  title: string;
  narration: string;
  character: Character;
  session: AdventureSession;
  enemy?: Enemy;
  availableActions: string[];
  actionLabels?: Record<string, string>;
  rollSummary?: string;
};

export type StartQuestOptions = {
  map?: QuestMap;
};

const COMBAT_ACTIONS: CombatAction[] = ["attack", "defend", "skill", "potion", "inspect"];

const DEFAULT_ACTION_LABELS: Record<string, string> = {
  start: "Begin",
  attack: "Attack",
  defend: "Defend",
  skill: "Class skill",
  potion: "Use potion",
  inspect: "Inspect"
};

export function startQuest(state: GameState, ownerId: string, options: StartQuestOptions = {}): QuestResult {
  const character = requireCharacter(state, ownerId);
  const existing = state.adventures[ownerId];

  if (existing && existing.phase !== "completed" && existing.phase !== "failed") {
    const map = resolveQuestMap(existing);
    return result(
      character,
      existing,
      map.title,
      existing.log.at(-1) || map.opening,
      availableActionsForSession(existing)
    );
  }

  const map = options.map ?? HOLLOW_ROAD;
  const session: AdventureSession = {
    questId: map.id,
    ownerId,
    phase: "scene",
    scene: 0,
    nodeId: map.start,
    ...(map.id === HOLLOW_ROAD.id ? {} : { map, ...(map.seed === undefined ? {} : { seed: map.seed }) }),
    round: 0,
    momentum: 0,
    clues: [],
    flags: {},
    log: [map.opening],
    updatedAt: new Date().toISOString()
  };

  state.adventures[ownerId] = session;
  return result(character, session, map.title, map.opening, availableActionsForSession(session));
}

export function continueQuest(
  state: GameState,
  ownerId: string,
  action: string,
  random: RandomSource = Math.random
): QuestResult {
  const character = requireCharacter(state, ownerId);
  const existing = state.adventures[ownerId];

  if (!existing) {
    return startQuest(state, ownerId);
  }

  const session = existing;
  const map = resolveQuestMap(session);

  if (session.phase === "completed") {
    return result(character, session, `${map.title}: Complete`, map.completedText, []);
  }

  if (session.phase === "failed") {
    character.hp = Math.max(1, Math.floor(character.maxHp / 2));
    session.phase = "scene";
    session.scene = 0;
    session.nodeId = map.start;
    session.log.push(interpolate(map.respawnText, { name: character.name }));
    touch(character, session);
    return result(
      character,
      session,
      map.title,
      session.log.at(-1) || map.opening,
      availableActionsForSession(session)
    );
  }

  if (session.phase === "scene") {
    return resolveSceneAction(character, session, map, action);
  }

  if (session.phase === "combat") {
    return resolveQuestCombat(character, session, map, action, random);
  }

  return result(character, session, map.title, "Nothing else stirs.", []);
}

export function availableActionsForSession(session: AdventureSession): string[] {
  if (session.phase === "scene") {
    const node = currentNode(session, resolveQuestMap(session));
    return node?.kind === "scene" ? node.approaches.map((approach) => approach.key) : [];
  }

  if (session.phase === "combat") {
    return [...COMBAT_ACTIONS];
  }

  if (session.phase === "failed") {
    return ["start"];
  }

  return [];
}

export function actionLabelsForSession(session: AdventureSession): Record<string, string> {
  const labels: Record<string, string> = { ...DEFAULT_ACTION_LABELS };
  const node = currentNode(session, resolveQuestMap(session));

  if (node?.kind === "scene") {
    for (const approach of node.approaches) {
      labels[approach.key] = approach.label;
    }
  }

  return labels;
}

function resolveSceneAction(
  character: Character,
  session: AdventureSession,
  map: QuestMap,
  action: string
): QuestResult {
  const node = currentSceneNode(session, map);
  const approach = node.approaches.find((candidate) => candidate.key === action);

  if (!approach) {
    return result(
      character,
      session,
      map.title,
      node.prompt || "Choose your approach.",
      node.approaches.map((candidate) => candidate.key)
    );
  }

  if (approach.flag) {
    session.flags[approach.flag] = true;
  }

  if (approach.clue) {
    addClue(session, approach.clue.name, approach.clue.effect);
  }

  session.log.push(interpolate(approach.narration, { name: character.name }));

  const nextId = approach.next ?? node.next;
  const nextNode = map.nodes[nextId];

  if (!nextNode) {
    session.phase = "completed";
    touch(character, session);
    return result(character, session, `${map.title}: Complete`, map.completedText, []);
  }

  if (nextNode.kind === "combat") {
    enterCombat(session, nextNode, node.transition);
    touch(character, session);
    return result(
      character,
      session,
      `${map.title}: ${nextNode.titleSuffix}`,
      session.log.slice(-2).join("\n\n"),
      availableActionsForSession(session)
    );
  }

  session.nodeId = nextNode.id;
  session.scene += 1;
  session.log.push(interpolate(nextNode.narration, { name: character.name }));
  touch(character, session);
  return result(
    character,
    session,
    map.title,
    session.log.slice(-2).join("\n\n"),
    availableActionsForSession(session)
  );
}

function resolveQuestCombat(
  character: Character,
  session: AdventureSession,
  map: QuestMap,
  action: string,
  random: RandomSource
): QuestResult {
  const node = currentCombatNode(session, map);

  if (!session.enemy) {
    session.enemy = spawnEnemy(session, node);
  }

  if (!isCombatAction(action)) {
    return result(
      character,
      session,
      `${map.title}: ${node.titleSuffix}`,
      `${session.enemy.name} waits for your move.`,
      availableActionsForSession(session)
    );
  }

  session.round = Math.max(1, session.round || 1);
  session.momentum = Math.max(0, session.momentum || 0);
  session.enemyIntent ||= intentForRound(node, session.round);

  const intent = session.enemyIntent;
  const preCombatHp = character.hp;
  const preCombatArmor = session.enemy.armor;
  const narrationPrefix: string[] = [];
  let spentMomentum = false;

  if (action === "skill" && session.momentum >= 2) {
    session.momentum -= 2;
    spentMomentum = true;
    session.enemy.armor = Math.max(0, session.enemy.armor - 2);
    narrationPrefix.push(`${character.name} spends 2 Momentum to force a cleaner class strike.`);
  }

  if (intent.behavior === "exposeArmor" && intentCountered(intent, action)) {
    session.enemy.armor = Math.max(0, session.enemy.armor - (intent.amount ?? 0));
    pushIntentLog(narrationPrefix, intent.counterLog, character, intent);
  }

  if (intent.behavior === "bankMomentum" && intentCountered(intent, action)) {
    session.momentum += intent.amount ?? 0;
    pushIntentLog(narrationPrefix, intent.counterLog, character, intent);
  }

  const combat = resolveCombatAction(character, session.enemy, action, random);
  session.enemy.armor = preCombatArmor;
  session.enemy = combat.enemy;
  session.log.push(...narrationPrefix, ...combat.narration);
  applyIntentAftermath(character, session, node, action, intent, preCombatHp);
  awardMomentum(session, action, combat.rollSummary, spentMomentum);

  if (combat.characterDefeated || character.hp <= 0) {
    session.phase = "failed";
    character.hp = 0;
    session.log.push(interpolate(node.defeatNarration, { name: character.name }));
    touch(character, session);
    return result(
      character,
      session,
      `${map.title}: Defeat`,
      session.log.slice(-3).join("\n\n"),
      ["start"],
      combat.rollSummary
    );
  }

  if (combat.enemyDefeated) {
    delete session.enemy;
    delete session.enemyIntent;
    character.gold += node.loot.gold;

    for (const item of node.loot.items) {
      addItem(character.inventory, { ...item });
    }

    const xpLog = grantXp(character, node.loot.xp);
    session.log.push(interpolate(node.victoryNarration, { name: character.name }));
    session.log.push(rewardLine(node));
    session.log.push(...xpLog);

    const nextNode = node.next ? map.nodes[node.next] : undefined;

    if (!nextNode) {
      session.phase = "completed";
      touch(character, session);
      return result(
        character,
        session,
        `${map.title}: Cleared`,
        session.log.slice(-4).join("\n\n"),
        [],
        combat.rollSummary
      );
    }

    advanceAfterVictory(character, session, nextNode);
    touch(character, session);
    return result(
      character,
      session,
      nextNode.kind === "combat" ? `${map.title}: ${nextNode.titleSuffix}` : map.title,
      session.log.slice(-4).join("\n\n"),
      availableActionsForSession(session),
      combat.rollSummary
    );
  }

  touch(character, session);
  session.round = (session.round || 1) + 1;
  session.enemyIntent = intentForRound(node, session.round);
  return result(
    character,
    session,
    `${map.title}: ${node.titleSuffix}`,
    session.log.slice(-6).join("\n\n"),
    availableActionsForSession(session),
    combat.rollSummary
  );
}

function advanceAfterVictory(character: Character, session: AdventureSession, nextNode: QuestNode): void {
  session.nodeId = nextNode.id;

  if (nextNode.kind === "combat") {
    enterCombat(session, nextNode, undefined);
    return;
  }

  session.phase = "scene";
  session.scene += 1;
  session.round = 0;
  session.log.push(interpolate(nextNode.narration, { name: character.name }));
}

function enterCombat(session: AdventureSession, node: CombatNode, transition: string | undefined): void {
  session.enemy = spawnEnemy(session, node);
  session.phase = "combat";
  session.nodeId = node.id;
  session.scene += 1;
  session.round = 1;
  session.momentum = Math.max(session.momentum || 0, 1);
  session.enemyIntent = intentForRound(node, session.round);

  if (transition) {
    session.log.push(transition);
  }
}

function addClue(session: AdventureSession, name: string, effect: string): void {
  session.clues ||= [];
  const label = `${name}: ${effect}`;

  if (!session.clues.includes(label)) {
    session.clues.push(label);
  }
}

function awardMomentum(
  session: AdventureSession,
  action: CombatAction,
  rollSummary: string | undefined,
  spentMomentum: boolean
): void {
  session.momentum = Math.max(0, session.momentum || 0);

  if (action === "defend" || action === "inspect") {
    session.momentum += 1;
  }

  if (rollSummary && /\((success|strong|heroic)\)/i.test(rollSummary)) {
    session.momentum += rollSummary.includes("(heroic)") ? 2 : 1;
  }

  if (spentMomentum) {
    session.log.push(`The party spends 2 Momentum. Momentum remaining: ${session.momentum}.`);
  } else if (session.momentum > 0) {
    session.log.push(`Momentum: ${session.momentum}.`);
  }
}

function applyIntentAftermath(
  character: Character,
  session: AdventureSession,
  node: CombatNode,
  action: CombatAction,
  intent: EnemyIntent,
  preCombatHp: number
): void {
  if (intent.behavior === "chipDamage" && !intentCountered(intent, action) && session.enemy && character.hp > 0) {
    character.hp -= intent.amount ?? 0;
    pushIntentLog(session.log, intent.penaltyLog, character, intent);
  }

  if (intent.behavior === "rewardGuard" && intentCountered(intent, action)) {
    session.momentum = Math.max(0, (session.momentum || 0) + (intent.amount ?? 0));
    pushIntentLog(session.log, intent.counterLog, character, intent);
  }

  for (const boon of node.boons ?? []) {
    if (boon.type !== "reduceDamage") {
      continue;
    }

    if (session.flags[boon.ifFlag] && !session.flags[boon.usedFlag] && character.hp < preCombatHp) {
      const reduced = Math.min(boon.amount, preCombatHp - character.hp);
      character.hp += reduced;
      session.flags[boon.usedFlag] = true;
      session.log.push(interpolate(boon.log, { name: character.name, amount: reduced }));
    }
  }
}

function intentCountered(intent: EnemyIntent, action: CombatAction): boolean {
  return (intent.counterActions ?? []).includes(action);
}

function pushIntentLog(target: string[], template: string | undefined, character: Character, intent: EnemyIntent): void {
  if (!template) {
    return;
  }

  target.push(
    interpolate(template, {
      name: character.name,
      label: intent.label,
      amount: intent.amount ?? 0
    })
  );
}

function intentForRound(node: CombatNode, round: number): EnemyIntent {
  const intents = node.intents;

  if (intents.length === 0) {
    return {
      key: "press",
      label: "Pressing Attack",
      telegraph: "The enemy presses forward.",
      counter: "Defend",
      counterActions: ["defend"]
    };
  }

  return intents[(Math.max(1, round) - 1) % intents.length]!;
}

function spawnEnemy(session: AdventureSession, node: CombatNode): Enemy {
  let hpBonus = 0;
  let armorBonus = 0;

  for (const modifier of node.modifiers ?? []) {
    if (session.flags[modifier.ifFlag]) {
      hpBonus += modifier.hp ?? 0;
      armorBonus += modifier.armor ?? 0;
    }
  }

  const hp = Math.max(1, node.enemy.maxHp + hpBonus);

  return {
    ...node.enemy,
    hp,
    maxHp: hp,
    armor: Math.max(0, node.enemy.armor + armorBonus)
  };
}

function rewardLine(node: CombatNode): string {
  const parts = [`${node.loot.gold} gold`, `${node.loot.xp} XP`];

  for (const item of node.loot.items) {
    parts.push(item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name);
  }

  return `Reward: ${parts.join(", ")}.`;
}

function currentNode(session: AdventureSession, map: QuestMap): QuestNode | undefined {
  if (session.nodeId) {
    return map.nodes[session.nodeId];
  }

  if (session.phase === "combat") {
    return Object.values(map.nodes).find((node) => node.kind === "combat");
  }

  return map.nodes[map.start];
}

function currentSceneNode(session: AdventureSession, map: QuestMap): SceneNode {
  const node = currentNode(session, map);

  if (node?.kind === "scene") {
    return node;
  }

  const fallback = map.nodes[map.start];

  if (fallback?.kind === "scene") {
    session.nodeId = fallback.id;
    return fallback;
  }

  throw new Error(`Quest map ${map.id} has no scene node for session at ${session.nodeId ?? map.start}.`);
}

function currentCombatNode(session: AdventureSession, map: QuestMap): CombatNode {
  const node = currentNode(session, map);

  if (node?.kind === "combat") {
    return node;
  }

  const fallback = Object.values(map.nodes).find((candidate) => candidate.kind === "combat");

  if (fallback) {
    session.nodeId = fallback.id;
    return fallback;
  }

  throw new Error(`Quest map ${map.id} has no combat node for session at ${session.nodeId ?? map.start}.`);
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
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
    actionLabels: actionLabelsForSession(session),
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
  return (COMBAT_ACTIONS as string[]).includes(action);
}

function touch(character: Character, session: AdventureSession): void {
  const now = new Date().toISOString();
  character.updatedAt = now;
  session.updatedAt = now;
}

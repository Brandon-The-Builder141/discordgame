import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter } from "../src/game/characters.js";
import { resolveCombatAction } from "../src/game/combat.js";
import { startQuest, continueQuest } from "../src/game/quest.js";
import { emptyState } from "../src/game/save-store.js";

test("creates a playable character with starting gear", () => {
  const character = createCharacter("user-1", "Brandon", "warden");

  assert.equal(character.name, "Brandon");
  assert.equal(character.level, 1);
  assert.equal(character.inventory[0]?.id, "minor-potion");
  assert.ok(character.hp > 0);
});

test("starts The Hollow Road and transitions into combat", () => {
  const state = emptyState();
  state.characters["user-1"] = createCharacter("user-1", "Nyx", "shade");

  const start = startQuest(state, "user-1");
  assert.equal(start.session.phase, "scene");
  assert.deepEqual(start.availableActions, ["search", "track", "call"]);

  const combat = continueQuest(state, "user-1", "track");
  assert.equal(combat.session.phase, "combat");
  assert.equal(combat.enemy?.name, "Road Stalker");
  assert.equal(combat.session.round, 1);
  assert.equal(combat.session.momentum, 1);
  assert.equal(combat.session.enemyIntent?.key, "rake");
  assert.match(combat.session.clues?.[0] || "", /Clawed trail/);
  assert.ok(combat.availableActions.includes("attack"));
});

test("combat rotates enemy intent and awards momentum", () => {
  const state = emptyState();
  state.characters["user-1"] = createCharacter("user-1", "Nyx", "shade");
  startQuest(state, "user-1");
  continueQuest(state, "user-1", "track");

  const result = continueQuest(state, "user-1", "defend");

  assert.equal(result.session.round, 2);
  assert.equal(result.session.enemyIntent?.key, "pounce");
  assert.ok((result.session.momentum || 0) >= 2);
  assert.match(result.narration, /Momentum/);
});

test("skill spends banked momentum for a cleaner strike", () => {
  const state = emptyState();
  state.characters["user-1"] = createCharacter("user-1", "Vale", "hexbinder");
  startQuest(state, "user-1");
  const combat = continueQuest(state, "user-1", "search");
  combat.session.momentum = 2;

  const result = continueQuest(state, "user-1", "skill");

  assert.match(result.narration, /spends 2 Momentum/);
  assert.ok((result.session.momentum || 0) >= 0);
});

test("begin button opens the quest instead of skipping the first scene", () => {
  const state = emptyState();
  state.characters["user-1"] = createCharacter("user-1", "Nyx", "shade");

  const result = continueQuest(state, "user-1", "start");

  assert.equal(result.session.phase, "scene");
  assert.deepEqual(result.availableActions, ["search", "track", "call"]);
  assert.equal(result.enemy, undefined);
});

test("combat resolves damage and can defeat an enemy", () => {
  const character = createCharacter("user-1", "Vale", "hexbinder");
  const enemy = {
    id: "dummy",
    name: "Training Shade",
    hp: 5,
    maxHp: 5,
    armor: 1,
    damage: "1d4+1",
    threat: "Test target"
  };

  const rolls = [0.99, 0.99];
  const result = resolveCombatAction(character, enemy, "skill", () => rolls.shift() ?? 0.99);

  assert.equal(result.enemyDefeated, true);
  assert.ok(result.enemy.hp <= 0);
  assert.match(result.rollSummary || "", /heroic/);
});

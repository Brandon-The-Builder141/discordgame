import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter } from "../src/game/characters.js";
import { generateQuestMap } from "../src/game/generator.js";
import { continueQuest, startQuest } from "../src/game/quest.js";
import { emptyState } from "../src/game/save-store.js";
import type { CombatNode, QuestNode, SceneNode } from "../src/game/types.js";

test("same seed generates an identical map, different seeds differ", () => {
  const first = generateQuestMap(1234, 2);
  const second = generateQuestMap(1234, 2);
  const other = generateQuestMap(4321, 2);

  assert.deepEqual(first, second);
  assert.notDeepEqual(first.nodes, other.nodes);
});

test("generated maps are structurally sound", () => {
  for (const seed of [1, 7, 99, 2026, 555555]) {
    const map = generateQuestMap(seed, 1);
    const nodes = Object.values(map.nodes) as QuestNode[];
    const combats = nodes.filter((node): node is CombatNode => node.kind === "combat");
    const scenes = nodes.filter((node): node is SceneNode => node.kind === "scene");

    assert.ok(map.nodes[map.start], `start node exists for seed ${seed}`);
    assert.equal(map.nodes[map.start]?.kind, "scene");
    assert.ok(combats.length >= 2, `at least two combats for seed ${seed}`);

    for (const scene of scenes) {
      assert.deepEqual(
        scene.approaches.map((approach) => approach.key).sort(),
        ["call", "search", "track"],
        `scene approaches use the standard action vocabulary for seed ${seed}`
      );
      assert.ok(map.nodes[scene.next], `scene next resolves for seed ${seed}`);
    }

    for (const combat of combats) {
      assert.ok(combat.enemy.hp > 0);
      assert.ok(combat.intents.length >= 4, `combat has an intent rotation for seed ${seed}`);

      if (combat.next) {
        assert.ok(map.nodes[combat.next], `combat next resolves for seed ${seed}`);
      }
    }

    const finale = combats.find((combat) => !combat.next);
    assert.ok(finale, `map has a final combat for seed ${seed}`);
    assert.ok(finale.loot.items.length > 0, `final combat drops a trophy for seed ${seed}`);
  }
});

test("a generated quest is playable start to finish", () => {
  const map = generateQuestMap(42, 1);
  const state = emptyState();
  const character = createCharacter("user-1", "Rowan", "warden");
  character.hp = 500;
  character.maxHp = 500;
  state.characters["user-1"] = character;

  const start = startQuest(state, "user-1", { map });
  assert.equal(start.session.questId, map.id);
  assert.equal(start.session.phase, "scene");
  assert.deepEqual(start.availableActions, ["search", "track", "call"]);
  assert.ok(start.actionLabels?.search, "scene actions carry themed labels");

  const heroicRolls = () => 0.95;
  let steps = 0;

  while (state.adventures["user-1"]!.phase !== "completed" && steps < 200) {
    const phase = state.adventures["user-1"]!.phase;
    const action = phase === "scene" ? "search" : "attack";
    continueQuest(state, "user-1", action, heroicRolls);
    steps += 1;
  }

  assert.equal(state.adventures["user-1"]!.phase, "completed");
  assert.ok(character.gold > 0, "loot gold was granted");
  assert.ok(character.xp > 0 || character.level > 1, "xp was granted");
  assert.ok(
    character.inventory.some((item) => item.id !== "minor-potion"),
    "the boss trophy landed in the inventory"
  );
});

test("victory in a mid-map combat advances to the next scene", () => {
  const map = generateQuestMap(7, 1);
  const state = emptyState();
  const character = createCharacter("user-1", "Vale", "hexbinder");
  character.hp = 500;
  character.maxHp = 500;
  state.characters["user-1"] = character;

  startQuest(state, "user-1", { map });
  continueQuest(state, "user-1", "track");

  const session = state.adventures["user-1"]!;
  assert.equal(session.phase, "combat");
  assert.equal(session.nodeId, "combat-0");

  let steps = 0;

  while (session.phase === "combat" && steps < 50) {
    continueQuest(state, "user-1", "attack", () => 0.95);
    steps += 1;
  }

  assert.equal(session.phase, "scene");
  assert.equal(session.nodeId, "scene-1");

  const view = continueQuest(state, "user-1", "nonsense");
  assert.deepEqual(view.availableActions, ["search", "track", "call"]);
});

test("generated sessions survive a save/load round trip", () => {
  const map = generateQuestMap(2026, 1);
  const state = emptyState();
  state.characters["user-1"] = createCharacter("user-1", "Nyx", "shade");

  startQuest(state, "user-1", { map });
  continueQuest(state, "user-1", "call");

  const restored = JSON.parse(JSON.stringify(state)) as typeof state;
  const result = continueQuest(restored, "user-1", "defend", () => 0.5);

  assert.equal(result.session.questId, map.id);
  assert.ok(result.availableActions.includes("attack"));
  assert.ok(result.title.startsWith(map.title));
});

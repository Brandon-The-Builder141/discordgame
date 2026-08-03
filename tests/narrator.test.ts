import test from "node:test";
import assert from "node:assert/strict";
import { OpenRouterNarrator, StaticNarrator } from "../src/ai/narrator.js";
import { createCharacter } from "../src/game/characters.js";
import { startQuest } from "../src/game/quest.js";
import { emptyState } from "../src/game/save-store.js";

test("static narrator leaves deterministic quest result untouched", async () => {
  const state = emptyState();
  state.characters["user-1"] = createCharacter("user-1", "Ari", "mender");
  const result = startQuest(state, "user-1");
  const narrated = await new StaticNarrator().narrateQuest(result);

  assert.equal(narrated, result);
});

test("OpenRouter narrator replaces only narration when provider succeeds", async () => {
  const state = emptyState();
  state.characters["user-1"] = createCharacter("user-1", "Ari", "mender");
  const result = startQuest(state, "user-1");
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "Rain needles the broken wagons as Ari steps onto The Hollow Road." } }]
      }),
      { status: 200 }
    );

  const narrator = new OpenRouterNarrator({ apiKey: "test", model: "openrouter/free", fetchImpl });
  const narrated = await narrator.narrateQuest(result);

  assert.equal(narrated.narration, "Rain needles the broken wagons as Ari steps onto The Hollow Road.");
  assert.equal(narrated.character, result.character);
  assert.equal(narrated.session, result.session);
  assert.deepEqual(narrated.availableActions, result.availableActions);
});

test("OpenRouter narrator falls back when provider fails", async () => {
  const state = emptyState();
  state.characters["user-1"] = createCharacter("user-1", "Ari", "mender");
  const result = startQuest(state, "user-1");
  const fetchImpl = async () => new Response("rate limited", { status: 429 });

  const narrator = new OpenRouterNarrator({ apiKey: "test", model: "openrouter/free", fetchImpl });
  const narrated = await narrator.narrateQuest(result);

  assert.equal(narrated, result);
});

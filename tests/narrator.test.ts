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

test("OpenRouter narrator falls back when provider echoes prompt instructions", async () => {
  const state = emptyState();
  state.characters["user-1"] = createCharacter("user-1", "Ari", "mender");
  const result = startQuest(state, "user-1");
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "Original narration: Do not change rules, HP, XP, gold, item rewards, rolls, enemy names, or available actions."
            }
          }
        ]
      }),
      { status: 200 }
    );

  const narrator = new OpenRouterNarrator({ apiKey: "test", model: "openrouter/free", fetchImpl });
  const narrated = await narrator.narrateQuest(result);

  assert.equal(narrated, result);
});

test("OpenRouter narrator falls back when provider returns analysis instead of narration", async () => {
  const state = emptyState();
  state.characters["user-1"] = createCharacter("user-1", "Ari", "mender");
  const result = startQuest(state, "user-1");
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "Okay, the user wants me to rewrite a game event. I need to keep the key points and constraints."
            }
          }
        ]
      }),
      { status: 200 }
    );

  const narrator = new OpenRouterNarrator({ apiKey: "test", model: "openrouter/free", fetchImpl });
  const narrated = await narrator.narrateQuest(result);

  assert.equal(narrated, result);
});

test("OpenRouter narrator falls back when provider returns safety metadata", async () => {
  const state = emptyState();
  state.characters["user-1"] = createCharacter("user-1", "Ari", "mender");
  const result = startQuest(state, "user-1");
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "User Safety: safe"
            }
          }
        ]
      }),
      { status: 200 }
    );

  const narrator = new OpenRouterNarrator({ apiKey: "test", model: "openrouter/free", fetchImpl });
  const narrated = await narrator.narrateQuest(result);

  assert.equal(narrated, result);
});

test("OpenRouter narrator falls back when provider explains the rewrite task", async () => {
  const state = emptyState();
  state.characters["user-1"] = createCharacter("user-1", "Ari", "mender");
  const result = startQuest(state, "user-1");
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "We need to rewrite the event into immersive, punchy narration, under 900 characters, plain text only."
            }
          }
        ]
      }),
      { status: 200 }
    );

  const narrator = new OpenRouterNarrator({ apiKey: "test", model: "openrouter/free", fetchImpl });
  const narrated = await narrator.narrateQuest(result);

  assert.equal(narrated, result);
});

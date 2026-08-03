import test from "node:test";
import assert from "node:assert/strict";
import { parseCommandText, parseSpokenAddress } from "../src/discord/rpg-bot.js";

test("parses voice table commands", () => {
  assert.deepEqual(parseCommandText("join voice"), { command: "joinVoice" });
  assert.deepEqual(parseCommandText("who is playing"), { command: "party" });
  assert.deepEqual(parseCommandText("leave call"), { command: "leaveVoice" });
});

test("parses text character creation", () => {
  assert.deepEqual(parseCommandText("create Rowan warden"), {
    command: "create",
    name: "Rowan",
    classKey: "warden"
  });

  assert.deepEqual(parseCommandText("make Mira as a hexbinder"), {
    command: "create",
    name: "Mira",
    classKey: "hexbinder"
  });
});

test("parses natural quest actions", () => {
  assert.deepEqual(parseCommandText("we search the wreck"), { command: "questAction", action: "search" });
  assert.deepEqual(parseCommandText("I attack it"), { command: "questAction", action: "attack" });
  assert.deepEqual(parseCommandText("use my class skill"), { command: "questAction", action: "skill" });
  assert.deepEqual(parseCommandText("drink a potion"), { command: "questAction", action: "potion" });
});

test("parses only addressed voice transcripts", () => {
  assert.equal(parseSpokenAddress("we should probably search first"), null);
  assert.deepEqual(parseSpokenAddress("Varyix search the wreck"), { command: "questAction", action: "search" });
  assert.deepEqual(parseSpokenAddress("DM attack it"), { command: "questAction", action: "attack" });
  assert.deepEqual(parseSpokenAddress("hey varix start campaign"), { command: "startCampaign" });
});

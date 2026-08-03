# Realmbound Design Outline

## Product Shape

Realmbound is built for Discord first. It should feel like a tabletop RPG night compressed into channel-friendly turns: short prompts, clear choices, visible rolls, persistent progression, and low friction for players who are half-chatting while they play.

The primary table format is voice discussion plus text resolution. Players talk in a Discord voice channel, decide what the party does, then post the final move in text. The bot joins voice to mark the table and count seated players, but narration and game-state updates remain in chat.

Voice receive is implemented in Node with `@discordjs/voice`, DAVE encryption enabled, Opus decoding, short WAV capture, and OpenRouter speech-to-text. To avoid treating every table discussion as an action, spoken moves must address the bot first, such as "Varyix search the wreck" or "DM attack it."

## Design Goals

- Fast onboarding: one command creates a usable character.
- Persistent identity: characters survive bot restarts and keep rewards.
- Button-first play: most actions happen without typing command strings.
- Chat-first dungeon mastering: players can address the bot naturally instead of relying on slash commands.
- Rules-light depth: enough stats and rolls to feel like an RPG without making Discord players study a handbook.
- Expandable engine: quests, enemies, classes, loot, and shops should be data-friendly.

## Core Loop

1. Create a character.
2. Start a quest.
3. Choose an approach in a scene.
4. Resolve combat, danger, or discovery.
5. Earn XP, gold, and items.
6. Rest, inspect inventory, and continue into broader story arcs.

## AI Narration

The LLM is a narrator, not the rules engine. Combat, HP, XP, gold, inventory, rolls, enemy state, and quest phase are resolved locally first. OpenRouter receives a compact summary of the resolved event and may rewrite only the displayed narration.

The default model is `openrouter/free`, OpenRouter's free-model router. If the API key is missing, the request fails, or a free-model rate limit is hit, the bot falls back to the local narration without stopping gameplay.

## System

Checks use `d20 + stat`.

- Natural 20: heroic.
- 15 or higher: strong success.
- 10 or higher: success.
- Below 10: miss or complication.
- Natural 1: disaster.

The four stats are:

- Might: force, melee, endurance.
- Finesse: stealth, speed, precision.
- Mind: magic, tactics, investigation.
- Spirit: healing, morale, resistance.

## MVP Adventure

**The Hollow Road** starts with a broken caravan and pushes the player through a choice-driven investigation into a first combat encounter. The quest rewards gold, XP, and a story item called the Black Road Token.

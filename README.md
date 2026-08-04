# Realmbound Discord RPG

Realmbound is a Discord-native fantasy RPG bot: persistent characters, dice checks, class abilities, combat, loot, and quest scenes delivered through slash commands, embeds, and buttons.

The first playable adventure is **The Hollow Road**, a solo-friendly quest that proves the core loop before expanding into parties, shops, factions, longer campaigns, and AI game-master flavor.

## Current Features

- `/rpg create` creates a persistent character.
- `/rpg sheet` shows level, HP, XP, gold, stats, and class feature.
- `/rpg quest` starts or continues The Hollow Road.
- Button-driven scene choices and combat actions.
- Four classes: Warden, Hexbinder, Shade, and Mender.
- d20-style checks with success tiers, heroic rolls, disasters, and class skill modifiers.
- Optional OpenRouter narration using the free model router.
- File-backed JSON saves in `data/save.json` by default.
- `/rpg inventory` and `/rpg rest` utility commands.
- Text-driven dungeon-master flow through mentions, `Varyix`, `dm`, or `!rpg`.
- Voice-channel presence so the bot can join the table and count players while narration stays in chat.
- DAVE-enabled Node voice connection using `@discordjs/voice` and `@snazzah/davey`.
- Optional voice transcription through OpenRouter speech-to-text.

## Chat-First Play

Slash commands still exist as a fallback, but the intended flow is normal chat:

```txt
Varyix join voice
Varyix table
Varyix players
Varyix create Rowan warden
Varyix start campaign
Varyix search
Varyix attack
Varyix class skill
Varyix potion
Varyix leave voice
```

Players can talk in voice to decide what to do. The final action should be posted in text or clicked on the live table so the bot can roll, update state, and narrate the result.

The live browser table runs from the bot process at `WEB_PUBLIC_URL`. Locally this defaults to `http://localhost:8787`. In Discord, use:

```txt
Varyix table
```

The board lets players click scene hotspots and combat moves. Each click resolves through the same game engine and the bot posts the narration back into the active Discord text channel after it has joined voice.

When `VOICE_TRANSCRIPTION_ENABLED=true`, the bot also listens for short addressed voice moves. Normal conversation is ignored unless the transcript starts with `Varyix`, `DM`, or `Dungeon Master`.

```txt
"Varyix search the wreck"
"DM attack it"
"Varyix use my class skill"
```

The bot posts what it heard before resolving the move.

## Setup

1. Create a Discord application and bot in the Discord Developer Portal.
2. Enable the bot's **Message Content Intent** in the Developer Portal.
3. Invite the bot with `bot` and `applications.commands` scopes.
4. Give it text permissions plus voice `Connect` permission.
5. Copy `.env.example` to `.env`.
6. Fill in:

```txt
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_client_id_here
DISCORD_GUILD_ID=your_test_server_id_here
MESSAGE_CONTENT_INTENT=false
DAVE_ENCRYPTION=true
VOICE_TRANSCRIPTION_ENABLED=true
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=openrouter/free
OPENROUTER_STT_MODEL=openai/whisper-1
WEB_PORT=8787
WEB_PUBLIC_URL=http://localhost:8787
```

`DISCORD_GUILD_ID` is optional but recommended while developing because guild commands update immediately.

Keep `MESSAGE_CONTENT_INTENT=false` until the Message Content Intent is enabled for the bot in Discord's Developer Portal. With it off, use direct mentions like `@Varyix join voice`. With it on, name/prefix triggers like `Varyix join voice`, `dm join voice`, and `!rpg join voice` also work.

Keep `DAVE_ENCRYPTION=true` for modern Discord voice channels. `@discordjs/voice` handles DAVE through its bundled `@snazzah/davey` dependency.

`OPENROUTER_STT_MODEL` is separate from `OPENROUTER_MODEL`: the first transcribes audio, the second writes narration. OpenRouter's STT endpoint may bill differently from the free text model router.

`OPENROUTER_API_KEY` is optional. If it is blank, the bot still works with deterministic hand-written narration. When it is set, Realmbound sends only game-state narration context to OpenRouter and keeps HP, XP, loot, rolls, and quest outcomes controlled by the local engine.

## Run

Install dependencies:

```bash
npm install
```

Deploy slash commands:

```bash
npm run commands:deploy
```

Start the bot:

```bash
npm run dev
```

## Verification

```bash
npm run build
npm test
```

## Roadmap

- Party sessions where 2-5 players share one encounter.
- Initiative order and enemy ability patterns.
- Quest board with multiple adventures.
- Shops, equipment, rarity, crafting, and trade.
- Server-wide factions and reputation.
- Admin tools for resetting saves and tuning rewards.
- Optional AI narration layer with strict game-state guardrails.

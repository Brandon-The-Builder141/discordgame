import express from "express";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import type { Client, MessageCreateOptions, TextBasedChannel } from "discord.js";
import type { Narrator } from "../ai/narrator.js";
import type { TtsProvider } from "../audio/tts.js";
import { createCharacter } from "../game/characters.js";
import { CLASS_KEYS, playableClasses, type ClassKey } from "../game/classes.js";
import { generateQuestMap } from "../game/generator.js";
import {
  actionLabelsForSession,
  availableActionsForSession,
  continueQuest,
  startQuest,
  type QuestResult
} from "../game/quest.js";
import type { SaveStore } from "../game/save-store.js";
import type { AdventureSession, Character, GameState } from "../game/types.js";

export type ActivityServerOptions = {
  port: number;
  saveStore: SaveStore;
  narrator: Narrator;
  tts: TtsProvider;
  discordClient: Client;
  getActiveTextChannelId: () => string | undefined;
};

type PublicState = {
  characters: Character[];
  activeCharacter?: Character;
  activeSession?: AdventureSession;
  lastQuest?: QuestResult;
  players: TablePlayer[];
  choices: PublicChoices;
  classes: Array<{ key: ClassKey; name: string; feature: string }>;
};

type TablePlayer = {
  id: string;
  name: string;
  joinedAt: number;
  activeAt: number;
};

type PublicChoices = {
  token: string;
  needed: number;
  votes: Array<{ playerId: string; playerName: string; action: string; label: string }>;
  tally: Array<{ action: string; label: string; count: number }>;
  lastResolved?: { action: string; label: string; resolvedAt: number };
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../../public/activity");
const threeDir = path.resolve(__dirname, "../../node_modules/three/build");
const threeExamplesDir = path.resolve(__dirname, "../../node_modules/three/examples/jsm");
const boardOwnerId = "activity-table";
const playerTtlMs = 75 * 1000;
const tablePlayers = new Map<string, TablePlayer>();
const tableChoices = new Map<string, { playerId: string; playerName: string; action: string }>();
let activeChoiceToken = "";
let lastResolvedChoice: PublicChoices["lastResolved"];

export async function startActivityServer(options: ActivityServerOptions): Promise<void> {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Set<WebSocket>();

  app.use(express.json());
  app.use("/vendor/three", express.static(threeDir));
  app.use("/vendor/three-examples", express.static(threeExamplesDir));
  app.get("/favicon.ico", (_request, response) => {
    response.redirect(302, "/favicon.svg");
  });
  app.use(express.static(publicDir));

  wss.on("connection", (socket) => {
    clients.add(socket);
    void sendInitialState(socket, options.saveStore);
    socket.on("close", () => clients.delete(socket));
  });

  app.get("/api/state", async (_request, response) => {
    response.json(await buildPublicState(options.saveStore));
  });

  app.post("/api/players/join", async (request, response) => {
    const player = upsertPlayer(request.body?.playerId, request.body?.name);
    const publicState = await buildPublicState(options.saveStore);
    broadcast(clients, { type: "state", state: publicState });
    response.json({ player, state: publicState });
  });

  app.post("/api/players/leave", async (request, response) => {
    const playerId = cleanExistingId(typeof request.body?.playerId === "string" ? request.body.playerId : "");

    if (playerId) {
      tablePlayers.delete(playerId);
      tableChoices.clear();
    }

    const publicState = await buildPublicState(options.saveStore);
    broadcast(clients, { type: "state", state: publicState });
    response.json(publicState);
  });

  app.post("/api/tts", async (request, response) => {
    const text = typeof request.body?.text === "string" ? request.body.text : "";
    const audio = await options.tts.synthesize(text).catch((error) => {
      console.warn("TTS synthesis failed:", error);
      return undefined;
    });

    if (!audio) {
      response.status(204).end();
      return;
    }

    response.setHeader("Content-Type", audio.contentType);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-TTS-Provider", audio.provider);
    response.send(audio.audio);
  });

  app.post("/api/character", async (request, response) => {
    const name = typeof request.body?.name === "string" ? request.body.name : "Table Hero";
    const classKey = typeof request.body?.classKey === "string" && isClassKey(request.body.classKey)
      ? request.body.classKey
      : "warden";
    const state = await options.saveStore.load();
    const character = createCharacter(boardOwnerId, name, classKey);

    state.characters[boardOwnerId] = character;
    delete state.adventures[boardOwnerId];
    await options.saveStore.save(state);

    const publicState = await buildPublicState(options.saveStore);
    broadcast(clients, { type: "state", state: publicState });
    response.json(publicState);
  });

  app.post("/api/quest/start", async (request, response) => {
    const state = await ensureBoardCharacter(options.saveStore);

    if (request.body?.generate) {
      delete state.adventures[boardOwnerId];
      const seed = Number.isInteger(request.body?.seed)
        ? Number(request.body.seed)
        : Math.floor(Math.random() * 0x7fffffff);
      const level = state.characters[boardOwnerId]?.level ?? 1;
      const map = generateQuestMap(seed, level);
      const generated = startQuest(state, boardOwnerId, { map });
      await options.saveStore.save(state);
      const generatedNarrated = await options.narrator.narrateQuest(generated);
      await publishToDiscord(options, generatedNarrated);

      const generatedState = await buildPublicState(options.saveStore, generatedNarrated);
      broadcast(clients, { type: "state", state: generatedState });
      response.json(generatedState);
      return;
    }

    const result = startQuest(state, boardOwnerId);
    await options.saveStore.save(state);
    const narrated = await options.narrator.narrateQuest(result);
    await publishToDiscord(options, narrated);

    const publicState = await buildPublicState(options.saveStore, narrated);
    broadcast(clients, { type: "state", state: publicState });
    response.json(publicState);
  });

  app.post("/api/move", async (request, response) => {
    const action = typeof request.body?.action === "string" ? request.body.action : "";
    const state = await ensureBoardCharacter(options.saveStore);
    const result = continueQuest(state, boardOwnerId, action);
    await options.saveStore.save(state);
    const narrated = await options.narrator.narrateQuest(result);
    await publishToDiscord(options, narrated);

    const publicState = await buildPublicState(options.saveStore, narrated);
    broadcast(clients, { type: "state", state: publicState });
    response.json(publicState);
  });

  app.post("/api/choice", async (request, response) => {
    const action = typeof request.body?.action === "string" ? request.body.action : "";
    const player = upsertPlayer(request.body?.playerId, request.body?.playerName);
    const state = await ensureBoardCharacter(options.saveStore);
    const publicStateBefore = await buildPublicState(options.saveStore);

    if (!publicStateBefore.lastQuest && !publicStateBefore.activeSession) {
      response.status(409).json(publicStateBefore);
      return;
    }

    const availableActions = actionsForPublicState(publicStateBefore);
    if (!availableActions.includes(action)) {
      response.status(400).json(publicStateBefore);
      return;
    }

    syncChoiceToken(publicStateBefore);
    tableChoices.set(player.id, { playerId: player.id, playerName: player.name, action });

    const choices = buildPublicChoices(publicStateBefore);
    const winningAction = choices.tally.find((item) => item.count >= choices.needed)?.action;

    if (!winningAction) {
      const pendingState = await buildPublicState(options.saveStore);
      broadcast(clients, { type: "state", state: pendingState });
      response.json(pendingState);
      return;
    }

    const result = resolveTableChoice(state, winningAction);
    await options.saveStore.save(state);
    const narrated = await options.narrator.narrateQuest(result);
    await publishToDiscord(options, narrated);

    const publicState = await buildPublicState(options.saveStore, narrated);
    broadcast(clients, { type: "state", state: publicState });
    response.json(publicState);
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port, () => resolve());
  });

  console.log(`Realmbound table is open at http://localhost:${options.port}`);
}

function resolveTableChoice(state: GameState, action: string): QuestResult {
  tableChoices.clear();
  lastResolvedChoice = {
    action,
    label: labelForAction(action),
    resolvedAt: Date.now()
  };
  return continueQuest(state, boardOwnerId, action);
}

async function sendInitialState(socket: WebSocket, saveStore: SaveStore): Promise<void> {
  socket.send(JSON.stringify({ type: "state", state: await buildPublicState(saveStore) }));
}

async function ensureBoardCharacter(saveStore: SaveStore): Promise<GameState> {
  const state = await saveStore.load();

  if (!state.characters[boardOwnerId]) {
    state.characters[boardOwnerId] = createCharacter(boardOwnerId, "The Party", "warden");
  }

  return state;
}

async function buildPublicState(saveStore: SaveStore, lastQuest?: QuestResult): Promise<PublicState> {
  const state = await saveStore.load();
  const draft: Omit<PublicState, "choices"> = {
    characters: Object.values(state.characters),
    activeCharacter: state.characters[boardOwnerId],
    activeSession: state.adventures[boardOwnerId],
    lastQuest,
    players: activePlayers(),
    classes: CLASS_KEYS.map((key) => ({
      key,
      name: playableClasses[key].name,
      feature: playableClasses[key].featureName
    }))
  };

  return {
    ...draft,
    choices: buildPublicChoices(draft)
  };
}

function upsertPlayer(playerId: unknown, name: unknown): TablePlayer {
  const now = Date.now();
  const id = normalizeId(typeof playerId === "string" ? playerId : "");
  const existing = tablePlayers.get(id);
  const cleanName = sanitizePlayerName(typeof name === "string" ? name : existing?.name || "Player");
  const player = {
    id,
    name: cleanName,
    joinedAt: existing?.joinedAt || now,
    activeAt: now
  };

  tablePlayers.set(id, player);
  prunePlayers(now);
  return player;
}

function normalizeId(value: string): string {
  return cleanExistingId(value) || randomUUID();
}

function cleanExistingId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

function sanitizePlayerName(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim().slice(0, 24);
  return clean || "Player";
}

function activePlayers(now = Date.now()): TablePlayer[] {
  prunePlayers(now);
  return [...tablePlayers.values()].sort((left, right) => left.joinedAt - right.joinedAt);
}

function prunePlayers(now = Date.now()): void {
  for (const [id, player] of tablePlayers) {
    if (now - player.activeAt > playerTtlMs) {
      tablePlayers.delete(id);
      tableChoices.delete(id);
    }
  }
}

function buildPublicChoices(state: Pick<PublicState, "activeSession" | "lastQuest" | "players">): PublicChoices {
  syncChoiceToken(state);
  const availableActions = actionsForPublicState(state);
  const labels = actionLabelsForPublicState(state);
  const votes = [...tableChoices.values()]
    .filter((vote) => availableActions.includes(vote.action))
    .map((vote) => ({
      ...vote,
      label: labelForAction(vote.action, labels)
    }));
  const needed = Math.max(1, Math.floor(Math.max(1, state.players.length) / 2) + 1);
  const tally = availableActions.map((action) => ({
    action,
    label: labelForAction(action, labels),
    count: votes.filter((vote) => vote.action === action).length
  }));

  return { token: activeChoiceToken, needed, votes, tally, lastResolved: lastResolvedChoice };
}

function syncChoiceToken(state: Pick<PublicState, "activeSession" | "lastQuest">): void {
  const nextToken = choiceTokenFor(state);
  if (activeChoiceToken !== nextToken) {
    activeChoiceToken = nextToken;
    tableChoices.clear();
  }
}

function choiceTokenFor(state: Pick<PublicState, "activeSession" | "lastQuest">): string {
  const session = state.activeSession;
  if (!session) return "idle";
  const actions = actionsForPublicState(state).join(",");
  return `${session.phase}:${session.round || 0}:${session.enemy?.hp || 0}:${session.log.length}:${actions}`;
}

function actionsForPublicState(state: Pick<PublicState, "activeSession" | "lastQuest">): string[] {
  if (state.lastQuest?.availableActions?.length) {
    return state.lastQuest.availableActions;
  }

  const session = state.activeSession;

  if (!session) {
    return [];
  }

  if (session.phase === "completed") {
    return ["start"];
  }

  return availableActionsForSession(session);
}

function actionLabelsForPublicState(
  state: Pick<PublicState, "activeSession" | "lastQuest">
): Record<string, string> {
  if (state.lastQuest?.actionLabels) {
    return state.lastQuest.actionLabels;
  }

  return state.activeSession ? actionLabelsForSession(state.activeSession) : {};
}

function labelForAction(action: string, labels: Record<string, string> = {}): string {
  return (
    labels[action] ||
    {
      search: "Search",
      track: "Track",
      call: "Call Out",
      attack: "Attack",
      defend: "Defend",
      skill: "Class Skill",
      potion: "Potion",
      inspect: "Inspect",
      start: "Start"
    }[action] ||
    action
  );
}

function broadcast(clients: Set<WebSocket>, payload: unknown): void {
  const encoded = JSON.stringify(payload);

  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(encoded);
    }
  }
}

async function publishToDiscord(options: ActivityServerOptions, result: QuestResult): Promise<void> {
  const channelId = options.getActiveTextChannelId();

  if (!channelId) {
    return;
  }

  const channel = await options.discordClient.channels.fetch(channelId).catch(() => undefined);

  if (!channel || !channel.isTextBased() || !("send" in channel)) {
    return;
  }

  const payload: MessageCreateOptions = {
    content: `**${result.title}**\n${result.narration}`
  };

  if (result.rollSummary) {
    payload.content += `\n\nRoll: ${result.rollSummary}`;
  }

  await (channel as TextBasedChannel & { send: (payload: MessageCreateOptions) => Promise<unknown> }).send(payload);
}

function isClassKey(value: string): value is ClassKey {
  return CLASS_KEYS.includes(value as ClassKey);
}

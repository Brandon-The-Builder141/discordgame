import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Interaction,
  Message,
  type MessageCreateOptions,
  MessageFlags
} from "discord.js";
import type { Narrator } from "../ai/narrator.js";
import type { Transcriber } from "../ai/transcriber.js";
import { createCharacter } from "../game/characters.js";
import { CLASS_KEYS, playableClasses, type ClassKey } from "../game/classes.js";
import { continueQuest, startQuest } from "../game/quest.js";
import type { SaveStore } from "../game/save-store.js";
import type { Character } from "../game/types.js";
import {
  buildCharacterEmbed,
  buildHelpEmbed,
  buildInventoryEmbed,
  buildQuestEmbed
} from "./render.js";
import { VoiceTableManager } from "./voice.js";

type ButtonParts = {
  namespace: string;
  scope: string;
  action: string;
  userId: string;
};

export type ParsedMessage =
  | { command: "help" }
  | { command: "joinVoice" }
  | { command: "leaveVoice" }
  | { command: "party" }
  | { command: "create"; name?: string; classKey?: ClassKey }
  | { command: "sheet" }
  | { command: "inventory" }
  | { command: "rest" }
  | { command: "startCampaign" }
  | { command: "questAction"; action: string }
  | { command: "unknown" };

export class RpgBot {
  private readonly voiceTables: VoiceTableManager;

  constructor(
    private readonly saveStore: SaveStore,
    private readonly narrator: Narrator,
    options: {
      daveEncryption: boolean;
      transcriber?: Transcriber;
    }
  ) {
    this.voiceTables = new VoiceTableManager({
      daveEncryption: options.daveEncryption,
      transcriber: options.transcriber,
      onTranscript: (event) => this.handleVoiceTranscript(event)
    });
  }

  async handleInteraction(interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand() && interaction.commandName === "rpg") {
      await this.handleCommand(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("rpg:")) {
      const parts = parseButtonId(interaction.customId);

      if (!parts || parts.userId !== interaction.user.id) {
        await interaction.reply({
          content: "That action belongs to another adventurer.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const state = await this.saveStore.load();
      const character = state.characters[interaction.user.id];

      if (!character) {
        await interaction.reply({
          content: "Create a character first with `/rpg create` or `Varyix create <name> <class>`.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (parts.scope === "quest") {
        await interaction.deferUpdate();
        const result = continueQuest(state, interaction.user.id, parts.action);
        await this.saveStore.save(state);
        const narrated = await this.narrator.narrateQuest(result);
        await interaction.editReply({
          embeds: [buildQuestEmbed(narrated)],
          components: buildQuestComponents(narrated.character, narrated.availableActions)
        });
      }
    }
  }

  async handleMessage(message: Message): Promise<void> {
    if (message.author.bot || !message.guild) {
      return;
    }

    const parsed = parseDmMessage(message);

    if (!parsed) {
      return;
    }

    if (parsed.command === "help") {
      await message.reply(buildTextHelp(message.client.user.id));
      return;
    }

    if (parsed.command === "joinVoice") {
      await message.reply(this.voiceTables.joinUserVoice(message));
      return;
    }

    if (parsed.command === "leaveVoice") {
      await message.reply(this.voiceTables.leaveGuildVoice(message.guild.id));
      return;
    }

    if (parsed.command === "party") {
      await message.reply(this.voiceTables.describeParty(message));
      return;
    }

    const state = await this.saveStore.load();

    if (parsed.command === "create") {
      if (!parsed.name || !parsed.classKey) {
        await message.reply(`Use: \`Varyix create <name> <class>\`. Classes: ${classList()}.`);
        return;
      }

      const character = createCharacter(message.author.id, parsed.name, parsed.classKey);
      state.characters[message.author.id] = character;
      delete state.adventures[message.author.id];
      await this.saveStore.save(state);
      await message.reply({ embeds: [buildCharacterEmbed(character, "Character created")] });
      return;
    }

    const character = state.characters[message.author.id];

    if (!character) {
      await message.reply(`Create your character first: \`Varyix create <name> <class>\`. Classes: ${classList()}.`);
      return;
    }

    if (parsed.command === "sheet") {
      await message.reply({ embeds: [buildCharacterEmbed(character)] });
      return;
    }

    if (parsed.command === "inventory") {
      await message.reply({ embeds: [buildInventoryEmbed(character)] });
      return;
    }

    if (parsed.command === "rest") {
      if (state.adventures[message.author.id]?.phase === "combat") {
        await message.reply("You cannot rest while blades are out.");
        return;
      }

      character.hp = character.maxHp;
      await this.saveStore.save(state);
      await message.reply({ embeds: [buildCharacterEmbed(character, "Rested")] });
      return;
    }

    if (parsed.command === "startCampaign") {
      const partyLine = this.voiceTables.describeParty(message);
      const result = startQuest(state, message.author.id);
      await this.saveStore.save(state);
      const narrated = await this.narrator.narrateQuest(result);
      await message.reply({
        content: partyLine,
        embeds: [buildQuestEmbed(narrated)],
        components: buildQuestComponents(narrated.character, narrated.availableActions)
      });
      return;
    }

    if (parsed.command === "questAction") {
      const result = continueQuest(state, message.author.id, parsed.action);
      await this.saveStore.save(state);
      const narrated = await this.narrator.narrateQuest(result);
      await message.reply({
        embeds: [buildQuestEmbed(narrated)],
        components: buildQuestComponents(narrated.character, narrated.availableActions)
      });
      return;
    }

    await message.reply("I can run the table when you give me a clear move. Try `Varyix help`.");
  }

  private async handleVoiceTranscript(event: {
    userId: string;
    text: string;
    send: (payload: string | MessageCreateOptions) => Promise<unknown>;
  }): Promise<void> {
    const parsed = parseSpokenAddress(event.text);

    if (!parsed) {
      return;
    }

    await event.send(`Heard <@${event.userId}>: "${event.text}"`);

    if (parsed.command === "help") {
      await event.send(buildVoiceHelp());
      return;
    }

    if (parsed.command === "joinVoice" || parsed.command === "leaveVoice" || parsed.command === "party") {
      await event.send("Voice table commands still need to be typed so I know which channel/server context to use.");
      return;
    }

    const state = await this.saveStore.load();

    if (parsed.command === "create") {
      if (!parsed.name || !parsed.classKey) {
        await event.send(`Use voice like: "Varyix create Rowan warden". Classes: ${classList()}.`);
        return;
      }

      const character = createCharacter(event.userId, parsed.name, parsed.classKey);
      state.characters[event.userId] = character;
      delete state.adventures[event.userId];
      await this.saveStore.save(state);
      await event.send({ embeds: [buildCharacterEmbed(character, "Character created")] });
      return;
    }

    const character = state.characters[event.userId];

    if (!character) {
      await event.send(`Create your character first: "Varyix create <name> <class>". Classes: ${classList()}.`);
      return;
    }

    if (parsed.command === "sheet") {
      await event.send({ embeds: [buildCharacterEmbed(character)] });
      return;
    }

    if (parsed.command === "inventory") {
      await event.send({ embeds: [buildInventoryEmbed(character)] });
      return;
    }

    if (parsed.command === "rest") {
      if (state.adventures[event.userId]?.phase === "combat") {
        await event.send("You cannot rest while blades are out.");
        return;
      }

      character.hp = character.maxHp;
      await this.saveStore.save(state);
      await event.send({ embeds: [buildCharacterEmbed(character, "Rested")] });
      return;
    }

    if (parsed.command === "startCampaign") {
      const result = startQuest(state, event.userId);
      await this.saveStore.save(state);
      const narrated = await this.narrator.narrateQuest(result);
      await event.send({
        embeds: [buildQuestEmbed(narrated)],
        components: buildQuestComponents(narrated.character, narrated.availableActions)
      });
      return;
    }

    if (parsed.command === "questAction") {
      const result = continueQuest(state, event.userId, parsed.action);
      await this.saveStore.save(state);
      const narrated = await this.narrator.narrateQuest(result);
      await event.send({
        embeds: [buildQuestEmbed(narrated)],
        components: buildQuestComponents(narrated.character, narrated.availableActions)
      });
      return;
    }

    await event.send("I heard you, but I need a clearer table move.");
  }

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    const state = await this.saveStore.load();

    if (subcommand === "create") {
      const name = interaction.options.getString("name", true);
      const classKey = interaction.options.getString("class", true);

      if (!isClassKey(classKey)) {
        await interaction.reply({
          content: "Pick one of the listed classes.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const character = createCharacter(interaction.user.id, name, classKey);
      state.characters[interaction.user.id] = character;
      delete state.adventures[interaction.user.id];
      await this.saveStore.save(state);

      await interaction.reply({
        embeds: [buildCharacterEmbed(character, "Character created")],
        components: [
          buttonRow([
            button(`rpg:quest:start:${character.ownerId}`, "Begin The Hollow Road", ButtonStyle.Primary)
          ])
        ]
      });
      return;
    }

    const character = state.characters[interaction.user.id];

    if (subcommand === "help") {
      await interaction.reply({ embeds: [buildHelpEmbed()] });
      return;
    }

    if (!character) {
      await interaction.reply({
        content: "Create a character first with `/rpg create`.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (subcommand === "sheet") {
      await interaction.reply({ embeds: [buildCharacterEmbed(character)] });
      return;
    }

    if (subcommand === "inventory") {
      await interaction.reply({ embeds: [buildInventoryEmbed(character)] });
      return;
    }

    if (subcommand === "rest") {
      if (state.adventures[interaction.user.id]?.phase === "combat") {
        await interaction.reply({
          content: "You cannot rest while blades are out.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      character.hp = character.maxHp;
      await this.saveStore.save(state);
      await interaction.reply({ embeds: [buildCharacterEmbed(character, "Rested")], flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === "quest") {
      await interaction.deferReply();
      const result = startQuest(state, interaction.user.id);
      await this.saveStore.save(state);
      const narrated = await this.narrator.narrateQuest(result);
      await interaction.editReply({
        embeds: [buildQuestEmbed(narrated)],
        components: buildQuestComponents(narrated.character, narrated.availableActions)
      });
    }
  }
}

export function parseCommandText(input: string): ParsedMessage {
  const lower = input.toLowerCase().trim();

  if (!lower || lower === "help" || lower === "commands") {
    return { command: "help" };
  }

  if (lower.includes("join voice") || lower.includes("join call") || lower === "join") {
    return { command: "joinVoice" };
  }

  if (lower.includes("leave voice") || lower.includes("leave call") || lower === "leave") {
    return { command: "leaveVoice" };
  }

  if (lower.includes("party") || lower.includes("players") || lower.includes("who is playing")) {
    return { command: "party" };
  }

  if (lower.startsWith("create ") || lower.startsWith("make ")) {
    return parseCreate(input);
  }

  if (lower.includes("sheet") || lower.includes("character")) {
    return { command: "sheet" };
  }

  if (lower.includes("inventory") || lower.includes("bag")) {
    return { command: "inventory" };
  }

  if (lower.includes("rest") || lower.includes("heal up")) {
    return { command: "rest" };
  }

  if (
    lower.includes("start campaign") ||
    lower.includes("start game") ||
    lower.includes("begin campaign") ||
    lower.includes("begin quest") ||
    lower === "start" ||
    lower === "quest"
  ) {
    return { command: "startCampaign" };
  }

  const action = parseQuestAction(lower);

  if (action) {
    return { command: "questAction", action };
  }

  return { command: "unknown" };
}

export function parseSpokenAddress(input: string): ParsedMessage | null {
  const cleaned = input.trim();
  const match = /^(?:hey\s+)?(?:varyix|varix|verix|dm|dungeon master)\b[\s,.:;-]*/i.exec(cleaned);

  if (!match) {
    return null;
  }

  const commandText = cleaned.slice(match[0].length).trim();
  return parseCommandText(commandText || "help");
}

function parseDmMessage(message: Message): ParsedMessage | null {
  const botId = message.client.user.id;
  const mentionPattern = new RegExp(`^<@!?${botId}>\\s*[:,]?\\s*`, "i");
  const trimmed = message.content.trim();
  const lower = trimmed.toLowerCase();
  let commandText: string | null = null;

  if (mentionPattern.test(trimmed)) {
    commandText = trimmed.replace(mentionPattern, "").trim();
  } else if (lower.startsWith("varyix ")) {
    commandText = trimmed.slice("varyix ".length).trim();
  } else if (lower.startsWith("dm ")) {
    commandText = trimmed.slice("dm ".length).trim();
  } else if (lower.startsWith("dungeon master ")) {
    commandText = trimmed.slice("dungeon master ".length).trim();
  } else if (lower.startsWith("!rpg ")) {
    commandText = trimmed.slice("!rpg ".length).trim();
  } else if (["varyix", "dm", "dungeon master", "!rpg"].includes(lower)) {
    commandText = "help";
  }

  if (!commandText) {
    return null;
  }

  return parseCommandText(commandText);
}

function parseCreate(input: string): ParsedMessage {
  const words = input.replace(/^(create|make)\s+/i, "").split(/\s+/).filter(Boolean);
  const classIndex = words.findIndex((word) => isClassKey(word.toLowerCase()));

  if (classIndex === -1) {
    return { command: "create", name: words.join(" ") || undefined };
  }

  const possibleClassKey = words[classIndex]?.toLowerCase();
  const name = words
    .filter((_, index) => index !== classIndex)
    .filter((word) => !["as", "a", "an", "called", "named"].includes(word.toLowerCase()))
    .join(" ");

  return {
    command: "create",
    name: name || undefined,
    classKey: possibleClassKey && isClassKey(possibleClassKey) ? possibleClassKey : undefined
  };
}

function parseQuestAction(lower: string): string | undefined {
  if (lower.includes("search") || lower.includes("inspect wreck") || lower.includes("look around")) {
    return "search";
  }

  if (lower.includes("track") || lower.includes("follow tracks") || lower.includes("follow the tracks")) {
    return "track";
  }

  if (lower.includes("call out") || lower.includes("shout") || lower.includes("yell")) {
    return "call";
  }

  if (lower.includes("attack") || lower.includes("strike") || lower.includes("hit it")) {
    return "attack";
  }

  if (lower.includes("defend") || lower.includes("guard") || lower.includes("brace")) {
    return "defend";
  }

  if (lower.includes("class skill") || lower.includes("special") || lower.includes("spell") || lower.includes("ability")) {
    return "skill";
  }

  if (lower.includes("potion") || lower.includes("drink")) {
    return "potion";
  }

  if (lower.includes("inspect") || lower.includes("study") || lower.includes("read the enemy")) {
    return "inspect";
  }

  return undefined;
}

function isClassKey(value: string): value is ClassKey {
  return CLASS_KEYS.includes(value as ClassKey);
}

function parseButtonId(customId: string): ButtonParts | null {
  const [namespace, scope, action, userId] = customId.split(":");

  if (!namespace || !scope || !action || !userId) {
    return null;
  }

  return { namespace, scope, action, userId };
}

function buildQuestComponents(character: Character, actions: string[]) {
  if (actions.length === 0) {
    return [];
  }

  return [
    buttonRow(
      actions.map((action) =>
        button(`rpg:quest:${action}:${character.ownerId}`, labelForAction(action), styleForAction(action))
      )
    )
  ];
}

function buttonRow(buttons: ButtonBuilder[]) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

function button(customId: string, label: string, style: ButtonStyle): ButtonBuilder {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
}

function labelForAction(action: string): string {
  const labels: Record<string, string> = {
    start: "Begin",
    search: "Search the wreck",
    track: "Follow tracks",
    call: "Call out",
    attack: "Attack",
    defend: "Defend",
    skill: "Class skill",
    potion: "Use potion",
    inspect: "Inspect"
  };

  return labels[action] || action;
}

function styleForAction(action: string): ButtonStyle {
  if (action === "attack" || action === "skill") {
    return ButtonStyle.Danger;
  }

  if (action === "potion") {
    return ButtonStyle.Success;
  }

  return ButtonStyle.Secondary;
}

function buildTextHelp(botId: string): string {
  return [
    `Call me with <@${botId}>, \`Varyix\`, \`dm\`, or \`!rpg\`.`,
    "",
    "Table flow:",
    "`Varyix join voice` - I join your voice channel and count the party.",
    "`Varyix players` - I report who is in the voice table.",
    "`Varyix create Rowan warden` - make your character.",
    "`Varyix start campaign` - begin The Hollow Road.",
    "`Varyix search`, `Varyix attack`, `Varyix class skill`, `Varyix potion` - keep the story moving in chat.",
    "`Varyix sheet`, `Varyix inventory`, `Varyix rest`, `Varyix leave voice`."
  ].join("\n");
}

function buildVoiceHelp(): string {
  return [
    "Voice commands work when you address me first:",
    `"Varyix create Rowan warden"`,
    `"Varyix start campaign"`,
    `"Varyix search the wreck"`,
    `"DM attack"`,
    `"DM use my class skill"`,
    "Normal table discussion is ignored until someone addresses me."
  ].join("\n");
}

function classList(): string {
  return CLASS_KEYS.map((key) => playableClasses[key].name.toLowerCase()).join(", ");
}

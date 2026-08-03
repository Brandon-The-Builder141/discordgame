import {
  ChannelType,
  GuildMember,
  Message,
  type MessageCreateOptions,
  type TextBasedChannel,
  type VoiceBasedChannel
} from "discord.js";
import {
  getVoiceConnection,
  joinVoiceChannel,
  type VoiceConnection
} from "@discordjs/voice";
import type { Transcriber } from "../ai/transcriber.js";
import { VoiceListener, type VoiceTranscriptEvent } from "./voice-listener.js";

type VoiceTable = {
  guildId: string;
  textChannelId: string;
  voiceChannelId: string;
};

export class VoiceTableManager {
  private readonly tables = new Map<string, VoiceTable>();
  private readonly attachedConnections = new WeakSet<VoiceConnection>();

  constructor(
    private readonly options: {
      daveEncryption: boolean;
      transcriber?: Transcriber;
      onTranscript: (
        event: VoiceTranscriptEvent & {
          guildId: string;
          textChannelId: string;
          send: (payload: string | MessageCreateOptions) => Promise<unknown>;
        }
      ) => Promise<void>;
    }
  ) {}

  joinUserVoice(message: Message): string {
    const member = message.member;

    if (!(member instanceof GuildMember)) {
      return "I can only join voice from inside a server.";
    }

    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return "Join a voice channel first, then tell me `Varyix join voice`.";
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      daveEncryption: this.options.daveEncryption
    });

    this.tables.set(voiceChannel.guild.id, {
      guildId: voiceChannel.guild.id,
      textChannelId: message.channel.id,
      voiceChannelId: voiceChannel.id
    });

    if (canSend(message.channel)) {
      this.attachListener(connection, voiceChannel.guild.id, message.channel.id, message.channel.send.bind(message.channel));
    }

    const listeningLine = this.options.transcriber
      ? "Voice listening is enabled. Address me as `Varyix` or `DM` before the move."
      : "Voice listening is not enabled; I can sit at the table, but moves still need text.";

    return `I joined **${voiceChannel.name}** as dungeon master.\n${describeVoicePlayers(voiceChannel)}\n${listeningLine}`;
  }

  leaveGuildVoice(guildId: string): string {
    const connection = getVoiceConnection(guildId);

    if (!connection) {
      this.tables.delete(guildId);
      return "I am not in a voice channel right now.";
    }

    connection.destroy();
    this.tables.delete(guildId);
    return "I left the voice table.";
  }

  describeParty(message: Message): string {
    const table = this.tables.get(message.guild?.id || "");
    const channel = table ? message.guild?.channels.cache.get(table.voiceChannelId) : undefined;

    if (channel?.type === ChannelType.GuildVoice || channel?.type === ChannelType.GuildStageVoice) {
      return describeVoicePlayers(channel);
    }

    const member = message.member;
    const memberVoice = member instanceof GuildMember ? member.voice.channel : undefined;

    if (memberVoice) {
      return describeVoicePlayers(memberVoice);
    }

    return "No active voice table yet. Join a voice channel and say `Varyix join voice`.";
  }

  private attachListener(
    connection: VoiceConnection,
    guildId: string,
    textChannelId: string,
    send: (payload: string | MessageCreateOptions) => Promise<unknown>
  ): void {
    if (!this.options.transcriber || this.attachedConnections.has(connection)) {
      return;
    }

    const listener = new VoiceListener(this.options.transcriber, async (event) => {
      await this.options.onTranscript({
        ...event,
        guildId,
        textChannelId,
        send
      });
    });

    listener.attach(connection);
    this.attachedConnections.add(connection);
  }
}

function canSend(channel: Message["channel"]): channel is TextBasedChannel & { send: (payload: string | MessageCreateOptions) => Promise<unknown> } {
  return "send" in channel && typeof channel.send === "function";
}

function describeVoicePlayers(channel: VoiceBasedChannel): string {
  const players = channel.members.filter((member) => !member.user.bot);
  const names = players.map((member) => member.displayName);

  if (players.size === 0) {
    return "No players are seated in voice yet.";
  }

  return `Players seated: ${players.size} - ${names.join(", ")}. Discuss in voice, then post the party's move in chat.`;
}

declare module "@discordjs/voice" {
  interface JoinVoiceChannelOptions {
    daveEncryption?: boolean;
  }
}

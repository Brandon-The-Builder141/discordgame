import "dotenv/config";
import path from "node:path";

export type AppConfig = {
  discordToken: string;
  discordClientId: string;
  discordGuildId?: string;
  messageContentIntent: boolean;
  daveEncryption: boolean;
  voiceTranscriptionEnabled: boolean;
  saveFile: string;
  openRouterApiKey?: string;
  openRouterModel: string;
  openRouterSttModel: string;
};

export function loadConfig(): AppConfig {
  const discordToken = process.env.DISCORD_TOKEN;
  const discordClientId = process.env.DISCORD_CLIENT_ID;

  if (!discordToken) {
    throw new Error("Missing DISCORD_TOKEN in .env.");
  }

  if (!discordClientId) {
    throw new Error("Missing DISCORD_CLIENT_ID in .env.");
  }

  return {
    discordToken,
    discordClientId,
    discordGuildId: process.env.DISCORD_GUILD_ID || undefined,
    messageContentIntent: process.env.MESSAGE_CONTENT_INTENT === "true",
    daveEncryption: process.env.DAVE_ENCRYPTION !== "false",
    voiceTranscriptionEnabled: process.env.VOICE_TRANSCRIPTION_ENABLED === "true",
    saveFile: path.resolve(process.env.SAVE_FILE || "./data/save.json"),
    openRouterApiKey: process.env.OPENROUTER_API_KEY || undefined,
    openRouterModel: process.env.OPENROUTER_MODEL || "openrouter/free",
    openRouterSttModel: process.env.OPENROUTER_STT_MODEL || "openai/whisper-1"
  };
}

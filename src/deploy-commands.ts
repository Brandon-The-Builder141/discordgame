import "dotenv/config";
import { REST, Routes } from "discord.js";
import { buildRpgCommand } from "./discord/rpg-command.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) {
  throw new Error("Missing DISCORD_TOKEN in .env.");
}

if (!clientId) {
  throw new Error("Missing DISCORD_CLIENT_ID in .env.");
}

const rest = new REST({ version: "10" }).setToken(token);
const commands = [buildRpgCommand().toJSON()];

if (guildId) {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log(`Deployed ${commands.length} guild command to ${guildId}.`);
} else {
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log(`Deployed ${commands.length} global command.`);
}

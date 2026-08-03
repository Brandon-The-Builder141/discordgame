import { Client, Events, GatewayIntentBits } from "discord.js";
import { loadConfig } from "./config.js";
import { createNarrator } from "./ai/narrator.js";
import { createTranscriber } from "./ai/transcriber.js";
import { RpgBot } from "./discord/rpg-bot.js";
import { JsonSaveStore } from "./game/save-store.js";

const config = loadConfig();
const saveStore = new JsonSaveStore(config.saveFile);
const narrator = createNarrator(config);
const transcriber = createTranscriber(config);
const rpgBot = new RpgBot(saveStore, narrator, {
  daveEncryption: config.daveEncryption,
  transcriber
});
const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildVoiceStates
];

if (config.messageContentIntent) {
  intents.push(GatewayIntentBits.MessageContent);
}

const client = new Client({
  intents
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Realmbound is online as ${readyClient.user.tag}.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    await rpgBot.handleInteraction(interaction);
  } catch (error) {
    console.error(error);

    const message = {
      content: "The realm hit a snag while resolving that action. Try again in a moment.",
      ephemeral: true
    };

    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(message).catch(() => undefined);
      } else {
        await interaction.reply(message).catch(() => undefined);
      }
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    await rpgBot.handleMessage(message);
  } catch (error) {
    console.error(error);
    await message.reply("The realm hit a snag while resolving that message. Try again in a moment.").catch(() => undefined);
  }
});

await client.login(config.discordToken);

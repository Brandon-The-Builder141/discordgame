import { SlashCommandBuilder } from "discord.js";
import { CLASS_KEYS, playableClasses } from "../game/classes.js";

export function buildRpgCommand(): SlashCommandBuilder {
  const command = new SlashCommandBuilder()
    .setName("rpg")
    .setDescription("Play Realmbound, a Discord-native fantasy RPG.");

  command.addSubcommand((subcommand) =>
    subcommand
      .setName("create")
      .setDescription("Create or reroll your character.")
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("Your character name.")
          .setMinLength(2)
          .setMaxLength(32)
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("class")
          .setDescription("Your character class.")
          .setRequired(true)
          .addChoices(
            ...CLASS_KEYS.map((key) => ({
              name: playableClasses[key].name,
              value: key
            }))
          )
      )
  );

  command.addSubcommand((subcommand) =>
    subcommand
      .setName("sheet")
      .setDescription("View your character sheet.")
  );

  command.addSubcommand((subcommand) =>
    subcommand
      .setName("quest")
      .setDescription("Start or continue The Hollow Road.")
  );

  command.addSubcommand((subcommand) =>
    subcommand
      .setName("inventory")
      .setDescription("View your inventory.")
  );

  command.addSubcommand((subcommand) =>
    subcommand
      .setName("rest")
      .setDescription("Recover HP outside of combat.")
  );

  command.addSubcommand((subcommand) =>
    subcommand
      .setName("help")
      .setDescription("Show the Realmbound command guide.")
  );

  return command;
}

import { EmbedBuilder } from "discord.js";
import { playableClasses } from "../game/classes.js";
import type { QuestResult } from "../game/quest.js";
import type { Character } from "../game/types.js";

const gold = 0xd6a73c;
const red = 0xb43b3b;
const green = 0x3b9f6f;
const blue = 0x5577d8;

export function buildCharacterEmbed(character: Character, title = "Character Sheet"): EmbedBuilder {
  const characterClass = playableClasses[character.classKey];

  return new EmbedBuilder()
    .setTitle(`${title}: ${character.name}`)
    .setColor(blue)
    .setDescription(`${characterClass.name} - Level ${character.level}`)
    .addFields(
      {
        name: "Vitals",
        value: `HP ${character.hp}/${character.maxHp}\nXP ${character.xp}/${xpToNextLevel(character.level)}\nGold ${character.gold}`,
        inline: true
      },
      {
        name: "Stats",
        value: `Might ${character.stats.might}\nFinesse ${character.stats.finesse}\nMind ${character.stats.mind}\nSpirit ${character.stats.spirit}`,
        inline: true
      },
      {
        name: "Class Feature",
        value: `${characterClass.featureName}: ${characterClass.featureDescription}`,
        inline: false
      }
    );
}

export function buildInventoryEmbed(character: Character): EmbedBuilder {
  const items = character.inventory.length > 0
    ? character.inventory.map((item) => `x${item.quantity} ${item.name}`).join("\n")
    : "Empty";

  return new EmbedBuilder()
    .setTitle(`${character.name}'s Inventory`)
    .setColor(gold)
    .setDescription(items)
    .addFields({ name: "Gold", value: String(character.gold), inline: true });
}

export function buildQuestEmbed(result: QuestResult): EmbedBuilder {
  const color = result.session.phase === "completed" ? green : result.session.phase === "combat" ? red : gold;
  const embed = new EmbedBuilder()
    .setTitle(result.title)
    .setColor(color)
    .setDescription(result.narration);

  if (result.rollSummary) {
    embed.addFields({ name: "Roll", value: result.rollSummary, inline: false });
  }

  if (result.enemy) {
    embed.addFields({
      name: result.enemy.name,
      value: `HP ${Math.max(0, result.enemy.hp)}/${result.enemy.maxHp}\nArmor ${result.enemy.armor}\nThreat ${result.enemy.threat}`,
      inline: true
    });
  }

  embed.addFields({
    name: result.character.name,
    value: `HP ${Math.max(0, result.character.hp)}/${result.character.maxHp}\nLevel ${result.character.level}\nGold ${result.character.gold}`,
    inline: true
  });

  return embed;
}

export function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Realmbound")
    .setColor(blue)
    .setDescription("A Discord-native RPG with persistent characters, dice rolls, quests, combat, loot, and server-friendly scenes.")
    .addFields(
      { name: "/rpg create", value: "Create or reroll your hero.", inline: true },
      { name: "/rpg quest", value: "Start or continue The Hollow Road.", inline: true },
      { name: "/rpg sheet", value: "View your stats and class feature.", inline: true },
      { name: "/rpg inventory", value: "Check items and gold.", inline: true },
      { name: "/rpg rest", value: "Recover HP outside combat.", inline: true }
    );
}

function xpToNextLevel(level: number): number {
  return level * 100;
}

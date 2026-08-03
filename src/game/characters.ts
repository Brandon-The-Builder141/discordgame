import { type ClassKey, playableClasses } from "./classes.js";
import type { Character, Item } from "./types.js";

export function createCharacter(ownerId: string, name: string, classKey: ClassKey): Character {
  const characterClass = playableClasses[classKey];
  const now = new Date().toISOString();

  return {
    ownerId,
    name: sanitizeName(name),
    classKey,
    level: 1,
    xp: 0,
    gold: 15,
    hp: characterClass.baseHp,
    maxHp: characterClass.baseHp,
    armor: characterClass.armor,
    stats: { ...characterClass.stats },
    inventory: [{ id: "minor-potion", name: "Minor Potion", quantity: 2 }],
    createdAt: now,
    updatedAt: now
  };
}

export function addItem(inventory: Item[], item: Item): Item[] {
  const existing = inventory.find((entry) => entry.id === item.id);

  if (existing) {
    existing.quantity += item.quantity;
    return inventory;
  }

  inventory.push({ ...item });
  return inventory;
}

export function consumeItem(inventory: Item[], itemId: string): boolean {
  const item = inventory.find((entry) => entry.id === itemId && entry.quantity > 0);

  if (!item) {
    return false;
  }

  item.quantity -= 1;

  if (item.quantity <= 0) {
    const index = inventory.findIndex((entry) => entry.id === itemId);
    inventory.splice(index, 1);
  }

  return true;
}

export function grantXp(character: Character, amount: number): string[] {
  const log = [`${character.name} gains ${amount} XP.`];
  character.xp += amount;

  while (character.xp >= xpToNextLevel(character.level)) {
    character.xp -= xpToNextLevel(character.level);
    character.level += 1;
    character.maxHp += 6;
    character.hp = character.maxHp;
    character.stats.might += character.level % 2 === 0 ? 1 : 0;
    character.stats.spirit += character.level % 2 === 1 ? 1 : 0;
    log.push(`${character.name} reaches level ${character.level}.`);
  }

  return log;
}

export function xpToNextLevel(level: number): number {
  return level * 100;
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w ',-]/g, "").trim().slice(0, 32) || "Adventurer";
}

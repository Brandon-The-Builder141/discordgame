import { consumeItem } from "./characters.js";
import { playableClasses } from "./classes.js";
import { d20Check, rollExpression, type RandomSource } from "./dice.js";
import type { Character, Enemy } from "./types.js";

export type CombatAction = "attack" | "defend" | "skill" | "potion" | "inspect";

export type CombatResult = {
  character: Character;
  enemy: Enemy;
  narration: string[];
  rollSummary?: string;
  enemyDefeated: boolean;
  characterDefeated: boolean;
};

export function resolveCombatAction(
  character: Character,
  enemy: Enemy,
  action: CombatAction,
  random: RandomSource = Math.random
): CombatResult {
  const narration: string[] = [];
  let rollSummary: string | undefined;
  let guarded = false;

  if (action === "inspect") {
    narration.push(`${enemy.name} watches from a broken angle, testing your reach before it commits.`);
    narration.push(`Threat read: ${enemy.threat}. Armor ${enemy.armor}.`);
    return { character, enemy, narration, rollSummary, enemyDefeated: false, characterDefeated: false };
  }

  if (action === "potion") {
    if (consumeItem(character.inventory, "minor-potion")) {
      const healed = Math.min(character.maxHp - character.hp, 10);
      character.hp += healed;
      narration.push(`${character.name} drinks a Minor Potion and recovers ${healed} HP.`);
    } else {
      narration.push(`${character.name} reaches for a potion, but the pouch is empty.`);
    }
  }

  if (action === "defend") {
    guarded = true;
    narration.push(`${character.name} sets their footing and reads the next strike.`);
  }

  if (action === "attack" || action === "skill") {
    const modifier = action === "skill" ? classSkillModifier(character) : character.stats.might;
    const check = d20Check(modifier, random);
    const damageRoll = rollExpression(action === "skill" ? "1d10+2" : "1d8+1", random);
    let damage = damageRoll.total;

    rollSummary = `d20 ${check.d20} + ${check.modifier} = ${check.total} (${check.tier})`;

    if (check.tier === "heroic") {
      damage += 8;
      narration.push(`${character.name} finds a perfect opening.`);
    } else if (check.tier === "strong") {
      damage += 4;
      narration.push(`${character.name} lands clean and presses the advantage.`);
    } else if (check.tier === "success") {
      narration.push(`${character.name} connects.`);
    } else if (check.tier === "disaster") {
      damage = 0;
      narration.push(`${character.name} overextends and loses ground.`);
    } else {
      damage = 0;
      narration.push(`${enemy.name} slips the strike.`);
    }

    const skillNote = applyClassSkill(character, action, check.tier, damage);
    if (skillNote.extraDamage) {
      damage += skillNote.extraDamage;
    }

    if (skillNote.narration) {
      narration.push(skillNote.narration);
    }

    if (damage > 0) {
      enemy.hp -= Math.max(1, damage - Math.floor(enemy.armor / 5));
      narration.push(`${enemy.name} takes ${Math.max(1, damage - Math.floor(enemy.armor / 5))} damage.`);
    }
  }

  if (enemy.hp <= 0) {
    return { character, enemy, narration, rollSummary, enemyDefeated: true, characterDefeated: false };
  }

  const enemyDamage = rollExpression(enemy.damage, random).total;
  const reduced = guarded ? Math.max(0, enemyDamage - 6) : Math.max(0, enemyDamage - Math.floor(character.armor / 6));
  character.hp -= reduced;
  narration.push(`${enemy.name} hits back for ${reduced} damage.`);

  return {
    character,
    enemy,
    narration,
    rollSummary,
    enemyDefeated: false,
    characterDefeated: character.hp <= 0
  };
}

function classSkillModifier(character: Character): number {
  if (character.classKey === "hexbinder") {
    return character.stats.mind;
  }

  if (character.classKey === "shade") {
    return character.stats.finesse;
  }

  if (character.classKey === "mender") {
    return character.stats.spirit;
  }

  return character.stats.might;
}

function applyClassSkill(
  character: Character,
  action: CombatAction,
  tier: "disaster" | "miss" | "success" | "strong" | "heroic",
  currentDamage: number
): { extraDamage: number; narration?: string } {
  if (action !== "skill" || currentDamage <= 0) {
    return { extraDamage: 0 };
  }

  const characterClass = playableClasses[character.classKey];

  if (character.classKey === "hexbinder" && (tier === "strong" || tier === "heroic")) {
    return { extraDamage: 4, narration: `${characterClass.featureName} leaves burning sigils in the wound.` };
  }

  if (character.classKey === "shade" && (tier === "strong" || tier === "heroic")) {
    return { extraDamage: 5, narration: `${characterClass.featureName} turns the enemy's stagger into a deep cut.` };
  }

  if (character.classKey === "mender" && (tier === "strong" || tier === "heroic")) {
    const healed = Math.min(character.maxHp - character.hp, 5);
    character.hp += healed;
    return { extraDamage: 0, narration: `${characterClass.featureName} restores ${healed} HP.` };
  }

  if (character.classKey === "warden") {
    return { extraDamage: 2, narration: `${characterClass.featureName} cracks through the guard.` };
  }

  return { extraDamage: 0 };
}

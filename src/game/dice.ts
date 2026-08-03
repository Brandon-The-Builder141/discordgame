export type DiceRoll = {
  expression: string;
  total: number;
  parts: number[];
};

export type D20Check = {
  d20: number;
  modifier: number;
  total: number;
  tier: "disaster" | "miss" | "success" | "strong" | "heroic";
};

export type RandomSource = () => number;

export function rollDie(sides: number, random: RandomSource = Math.random): number {
  return Math.floor(random() * sides) + 1;
}

export function rollExpression(expression: string, random: RandomSource = Math.random): DiceRoll {
  const match = /^(\d+)d(\d+)(?:\+(\d+))?$/.exec(expression);

  if (!match) {
    throw new Error(`Unsupported dice expression: ${expression}`);
  }

  const count = Number(match[1]);
  const sides = Number(match[2]);
  const bonus = Number(match[3] || 0);
  const parts = Array.from({ length: count }, () => rollDie(sides, random));

  return {
    expression,
    total: parts.reduce((sum, value) => sum + value, bonus),
    parts
  };
}

export function d20Check(modifier: number, random: RandomSource = Math.random): D20Check {
  const d20 = rollDie(20, random);
  const total = d20 + modifier;

  if (d20 === 20) {
    return { d20, modifier, total, tier: "heroic" };
  }

  if (d20 === 1) {
    return { d20, modifier, total, tier: "disaster" };
  }

  if (total >= 15) {
    return { d20, modifier, total, tier: "strong" };
  }

  if (total >= 10) {
    return { d20, modifier, total, tier: "success" };
  }

  return { d20, modifier, total, tier: "miss" };
}

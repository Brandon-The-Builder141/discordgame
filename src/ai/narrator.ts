import type { AppConfig } from "../config.js";
import { playableClasses } from "../game/classes.js";
import type { QuestResult } from "../game/quest.js";
import type { Character, Enemy } from "../game/types.js";

export interface Narrator {
  narrateQuest(result: QuestResult): Promise<QuestResult>;
}

type OpenRouterChoice = {
  message?: {
    content?: string;
  };
};

type OpenRouterResponse = {
  choices?: OpenRouterChoice[];
};

type FetchLike = typeof fetch;

export function createNarrator(config: AppConfig): Narrator {
  if (!config.openRouterApiKey) {
    return new StaticNarrator();
  }

  return new OpenRouterNarrator({
    apiKey: config.openRouterApiKey,
    model: config.openRouterModel,
    timeoutMs: 8000
  });
}

export class StaticNarrator implements Narrator {
  async narrateQuest(result: QuestResult): Promise<QuestResult> {
    return result;
  }
}

export class OpenRouterNarrator implements Narrator {
  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      timeoutMs?: number;
      fetchImpl?: FetchLike;
    }
  ) {}

  async narrateQuest(result: QuestResult): Promise<QuestResult> {
    const narration = await this.generateNarration(result).catch(() => undefined);

    if (!narration) {
      return result;
    }

    return {
      ...result,
      narration
    };
  }

  private async generateNarration(result: QuestResult): Promise<string | undefined> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs || 8000);

    try {
      const fetchImpl = this.options.fetchImpl || fetch;
      const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/Brandon-The-Builder141/discord-games",
          "X-OpenRouter-Title": "Realmbound Discord RPG"
        },
        body: JSON.stringify({
          model: this.options.model,
          temperature: 0.85,
          max_tokens: 220,
          messages: [
            {
              role: "system",
              content: buildSystemPrompt()
            },
            {
              role: "user",
              content: buildNarrationPrompt(result)
            }
          ]
        })
      });

      if (!response.ok) {
        return undefined;
      }

      const data = (await response.json()) as OpenRouterResponse;
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) {
        return undefined;
      }

      return normalizeNarration(content);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildSystemPrompt(): string {
  return [
    "You are the narrator for Realmbound, a Discord-first fantasy RPG.",
    "Rewrite the provided game event into immersive, punchy narration.",
    "Do not change rules, HP, XP, gold, item rewards, rolls, enemy names, player names, or available actions.",
    "Do not add mechanics, new choices, new rewards, or secret outcomes.",
    "Keep it under 900 characters and use plain text only."
  ].join(" ");
}

function buildNarrationPrompt(result: QuestResult): string {
  return [
    `Quest: ${result.title}`,
    `Original narration: ${result.narration}`,
    `Roll: ${result.rollSummary || "none"}`,
    `Character: ${describeCharacter(result.character)}`,
    `Enemy: ${result.enemy ? describeEnemy(result.enemy) : "none"}`,
    `Phase: ${result.session.phase}`,
    `Available actions: ${result.availableActions.join(", ") || "none"}`
  ].join("\n");
}

function describeCharacter(character: Character): string {
  const characterClass = playableClasses[character.classKey];

  return [
    `${character.name}, ${characterClass.name}, level ${character.level}`,
    `HP ${Math.max(0, character.hp)}/${character.maxHp}`,
    `gold ${character.gold}`,
    `stats might ${character.stats.might}, finesse ${character.stats.finesse}, mind ${character.stats.mind}, spirit ${character.stats.spirit}`
  ].join("; ");
}

function describeEnemy(enemy: Enemy): string {
  return `${enemy.name}; HP ${Math.max(0, enemy.hp)}/${enemy.maxHp}; armor ${enemy.armor}; threat ${enemy.threat}`;
}

function normalizeNarration(value: string): string {
  return value
    .replace(/^["']|["']$/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 1000)
    .trim();
}

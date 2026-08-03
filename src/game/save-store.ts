import fs from "node:fs/promises";
import path from "node:path";
import type { GameState } from "./types.js";

export interface SaveStore {
  load(): Promise<GameState>;
  save(state: GameState): Promise<void>;
}

export class JsonSaveStore implements SaveStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<GameState> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return normalize(JSON.parse(raw));
    } catch (error) {
      if (isMissingFileError(error)) {
        return emptyState();
      }

      throw error;
    }
  }

  async save(state: GameState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(normalize(state), null, 2)}\n`, "utf8");
  }
}

export function emptyState(): GameState {
  return {
    version: 1,
    characters: {},
    adventures: {}
  };
}

function normalize(value: unknown): GameState {
  const state = value as Partial<GameState>;

  return {
    version: 1,
    characters: state.characters || {},
    adventures: state.adventures || {}
  };
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

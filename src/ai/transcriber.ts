import type { AppConfig } from "../config.js";

export interface Transcriber {
  transcribeWav(audio: Buffer): Promise<string | undefined>;
}

type OpenRouterTranscriptionResponse = {
  text?: string;
};

export function createTranscriber(config: AppConfig): Transcriber | undefined {
  if (!config.voiceTranscriptionEnabled || !config.openRouterApiKey) {
    return undefined;
  }

  return new OpenRouterTranscriber({
    apiKey: config.openRouterApiKey,
    model: config.openRouterSttModel,
    timeoutMs: 20000
  });
}

export class OpenRouterTranscriber implements Transcriber {
  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    }
  ) {}

  async transcribeWav(audio: Buffer): Promise<string | undefined> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs || 20000);

    try {
      const fetchImpl = this.options.fetchImpl || fetch;
      const response = await fetchImpl("https://openrouter.ai/api/v1/audio/transcriptions", {
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
          input_audio: {
            data: audio.toString("base64"),
            format: "wav"
          },
          temperature: 0
        })
      });

      if (!response.ok) {
        return undefined;
      }

      const data = (await response.json()) as OpenRouterTranscriptionResponse;
      const text = data.text?.replace(/\s+/g, " ").trim();
      return text || undefined;
    } finally {
      clearTimeout(timeout);
    }
  }
}

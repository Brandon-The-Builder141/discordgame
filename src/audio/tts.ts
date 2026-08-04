import type { AppConfig } from "../config.js";
import { tts as edgeTts, type EdgeTtsOptions } from "edge-tts/out/index.js";

export type TtsAudio = {
  audio: Buffer;
  contentType: string;
  provider: string;
};

export type TtsProvider = {
  synthesize(text: string): Promise<TtsAudio | undefined>;
};

const maxTtsCharacters = 1200;
const maxGoogleChunkCharacters = 180;
type EdgeTts = (text: string, options?: EdgeTtsOptions) => Promise<Buffer>;

export function createTtsProvider(config: AppConfig, synthesizeImpl: EdgeTts = edgeTts, fetchImpl = fetch): TtsProvider {
  return {
    async synthesize(text: string): Promise<TtsAudio | undefined> {
      const input = normalizeTtsInput(text);

      if (!input) {
        return undefined;
      }

      try {
        const audio = await synthesizeImpl(input, {
          voice: config.ttsVoice,
          rate: config.ttsRate,
          pitch: config.ttsPitch,
          volume: config.ttsVolume
        });

        return {
          audio,
          contentType: "audio/mpeg",
          provider: "edge-tts"
        };
      } catch (error) {
        console.warn("Free Edge TTS failed:", error);
      }

      return synthesizeGoogleTranslate(input, fetchImpl);
    }
  };
}

async function synthesizeGoogleTranslate(input: string, fetchImpl: typeof fetch): Promise<TtsAudio | undefined> {
  const chunks = splitForGoogleTts(input);
  const buffers: Buffer[] = [];

  for (const chunk of chunks) {
    const url = new URL("https://translate.google.com/translate_tts");
    url.searchParams.set("ie", "UTF-8");
    url.searchParams.set("client", "tw-ob");
    url.searchParams.set("tl", "en");
    url.searchParams.set("q", chunk);

    const response = await fetchImpl(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 RealmboundTable/1.0"
      }
    }).catch((error) => {
      console.warn("Free Google TTS failed:", error);
      return undefined;
    });

    if (!response?.ok) {
      console.warn(`Free Google TTS failed: ${response?.status || "no response"}`);
      return undefined;
    }

    buffers.push(Buffer.from(await response.arrayBuffer()));
  }

  if (!buffers.length) return undefined;

  return {
    audio: Buffer.concat(buffers),
    contentType: "audio/mpeg",
    provider: "google-translate"
  };
}

function splitForGoogleTts(input: string): string[] {
  const sentences = input.match(/[^.!?]+[.!?]*/g) || [input];
  const chunks: string[] = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (trimmed.length <= maxGoogleChunkCharacters) {
      chunks.push(trimmed);
      continue;
    }

    for (let index = 0; index < trimmed.length; index += maxGoogleChunkCharacters) {
      chunks.push(trimmed.slice(index, index + maxGoogleChunkCharacters).trim());
    }
  }

  return chunks.slice(0, 8);
}

export function normalizeTtsInput(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\bHP\b/g, "health")
    .replace(/\bXP\b/g, "experience")
    .replace(/\bd20\b/gi, "dee twenty")
    .trim()
    .slice(0, maxTtsCharacters);
}

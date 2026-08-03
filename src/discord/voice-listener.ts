import { EndBehaviorType, type VoiceConnection } from "@discordjs/voice";
import prism from "prism-media";
import { pipeline } from "node:stream";
import type { Transcriber } from "../ai/transcriber.js";
import { pcmToWav } from "../audio/wav.js";

export type VoiceTranscriptEvent = {
  userId: string;
  text: string;
};

type ActiveSubscription = {
  destroy(): void;
};

export class VoiceListener {
  private readonly active = new Map<string, ActiveSubscription>();

  constructor(
    private readonly transcriber: Transcriber,
    private readonly onTranscript: (event: VoiceTranscriptEvent) => Promise<void>
  ) {}

  attach(connection: VoiceConnection): void {
    connection.receiver.speaking.on("start", (userId) => {
      this.captureUser(connection, userId);
    });
  }

  private captureUser(connection: VoiceConnection, userId: string): void {
    if (this.active.has(userId)) {
      return;
    }

    const opusStream = connection.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1200
      }
    });

    const decoder = new prism.opus.Decoder({
      channels: 2,
      rate: 48000,
      frameSize: 960
    });

    const pcmChunks: Buffer[] = [];
    const startedAt = Date.now();

    decoder.on("data", (chunk: Buffer) => {
      pcmChunks.push(chunk);

      if (Date.now() - startedAt > 12_000) {
        opusStream.destroy();
      }
    });

    const cleanup = () => {
      this.active.delete(userId);
    };

    this.active.set(userId, {
      destroy: () => {
        opusStream.destroy();
        decoder.destroy();
      }
    });

    pipeline(opusStream, decoder, (error) => {
      cleanup();

      if (error && error.name !== "AbortError" && !String(error.message).includes("Premature close")) {
        console.error(`Voice receive pipeline failed for ${userId}:`, error);
        return;
      }

      void this.finishCapture(userId, pcmChunks);
    });
  }

  private async finishCapture(userId: string, pcmChunks: Buffer[]): Promise<void> {
    const pcm = Buffer.concat(pcmChunks);

    if (pcm.length < 48000) {
      return;
    }

    const wav = pcmToWav(pcm, {
      channels: 2,
      sampleRate: 48000,
      bitsPerSample: 16
    });
    const text = await this.transcriber.transcribeWav(wav).catch((error) => {
      console.error("Voice transcription failed:", error);
      return undefined;
    });

    if (!text) {
      return;
    }

    await this.onTranscript({ userId, text });
  }
}

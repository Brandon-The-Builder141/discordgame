import test from "node:test";
import assert from "node:assert/strict";
import { createTtsProvider, normalizeTtsInput } from "../src/audio/tts.js";
import type { AppConfig } from "../src/config.js";

const baseConfig: AppConfig = {
  discordToken: "token",
  discordClientId: "client",
  messageContentIntent: false,
  daveEncryption: true,
  voiceTranscriptionEnabled: false,
  saveFile: "./data/save.json",
  openRouterModel: "openrouter/free",
  openRouterSttModel: "openai/whisper-1",
  ttsVoice: "en-US-GuyNeural",
  ttsRate: "-8%",
  ttsPitch: "-12Hz",
  ttsVolume: "+0%",
  webPort: 8787,
  webPublicUrl: "http://localhost:8787"
};

test("normalizes narration for spoken TTS", () => {
  assert.equal(normalizeTtsInput("Roll d20. HP 4/10. XP +75."), "Roll dee twenty. health 4/10. experience +75.");
});

test("skips server TTS when narration is empty", async () => {
  const provider = createTtsProvider(baseConfig, async () => {
    throw new Error("synthesizer should not be called");
  });

  assert.equal(await provider.synthesize("   "), undefined);
});

test("calls free Edge neural TTS with configured voice options", async () => {
  const provider = createTtsProvider(baseConfig, async (text, options) => {
    assert.equal(text, "Hello.");
    assert.deepEqual(options, {
      voice: "en-US-GuyNeural",
      rate: "-8%",
      pitch: "-12Hz",
      volume: "+0%"
    });

    return Buffer.from([1, 2, 3]);
  });

  const audio = await provider.synthesize("Hello.");
  assert.deepEqual([...audio!.audio], [1, 2, 3]);
  assert.equal(audio!.contentType, "audio/mpeg");
  assert.equal(audio!.provider, "edge-tts");
});

test("falls back to free Google Translate TTS when Edge TTS fails", async () => {
  const provider = createTtsProvider(
    baseConfig,
    async () => {
      throw new Error("403");
    },
    async (url) => {
      assert.match(String(url), /translate_tts/);
      assert.match(String(url), /client=tw-ob/);

      return new Response(new Uint8Array([4, 5, 6]), {
        status: 200,
        headers: { "content-type": "audio/mpeg" }
      });
    }
  );

  const audio = await provider.synthesize("The road is dark.");
  assert.deepEqual([...audio!.audio], [4, 5, 6]);
  assert.equal(audio!.provider, "google-translate");
});

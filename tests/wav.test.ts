import test from "node:test";
import assert from "node:assert/strict";
import { pcmToWav } from "../src/audio/wav.js";

test("wraps PCM audio in a valid WAV header", () => {
  const pcm = Buffer.alloc(960);
  const wav = pcmToWav(pcm, {
    channels: 2,
    sampleRate: 48000,
    bitsPerSample: 16
  });

  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.toString("ascii", 36, 40), "data");
  assert.equal(wav.readUInt32LE(40), pcm.length);
  assert.equal(wav.length, pcm.length + 44);
});

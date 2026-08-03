export type WavOptions = {
  channels: number;
  sampleRate: number;
  bitsPerSample: 16;
};

export function pcmToWav(pcm: Buffer, options: WavOptions): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = options.sampleRate * options.channels * (options.bitsPerSample / 8);
  const blockAlign = options.channels * (options.bitsPerSample / 8);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(options.channels, 22);
  header.writeUInt32LE(options.sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(options.bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

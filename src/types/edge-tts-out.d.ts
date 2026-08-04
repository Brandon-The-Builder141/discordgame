declare module "edge-tts/out/index.js" {
  import type { Buffer } from "node:buffer";

  export type EdgeTtsOptions = Partial<{
    voice: string;
    volume: string;
    rate: string;
    pitch: string;
  }>;

  export function tts(text: string, options?: EdgeTtsOptions): Promise<Buffer>;
}

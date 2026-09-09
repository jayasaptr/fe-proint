import axios from "axios";

/**
 * AI Interview API (FastAPI) used directly by the candidate interview page for text-to-speech
 * and live speech-to-text. LLM turns go through the Laravel portal instead (see interviewPortal.ts).
 *
 * Default is the same-origin path proxied by vite.config.ts in dev (`/ai-api` -> :8000) and by the
 * reverse proxy in production. Override with VITE_AI_API_URL for a dedicated HTTPS origin.
 */
const AI_API_BASE = (import.meta.env.VITE_AI_API_URL as string | undefined) || "/ai-api/api/v1";

export const aiApi = axios.create({
  baseURL: AI_API_BASE,
  timeout: 30_000,
  headers: { Accept: "application/json" },
});

/** FastAPI response envelope. */
export interface AiEnvelope<T> {
  status: boolean;
  message: string;
  remark?: string;
  data: T;
}

/**
 * Speech-to-text engines for the candidate room:
 * - "whisper": local faster-whisper on the AI server (no cloud cost, audio stays on-premise, interim text)
 * - "whisper_cloud": Whisper large-v3 via OpenRouter (no GPU needed, finals only, billed per second)
 * - "deepgram": Deepgram streaming (cloud, interim text)
 */
export type SttEngine = "whisper" | "whisper_cloud" | "deepgram";
export const STT_ENGINES: readonly SttEngine[] = ["whisper", "whisper_cloud", "deepgram"];

export const STT_ENGINE_LABELS: Record<SttEngine, string> = {
  whisper: "Whisper (lokal)",
  whisper_cloud: "Whisper Cloud (OpenRouter)",
  deepgram: "Deepgram (cloud)",
};

export interface SttConfig {
  default_engine?: SttEngine | string;
  deepgram?: { model?: string; language?: string; api_key_configured?: boolean };
  /** `enabled: false` = the server refuses engine "whisper" (WHISPER_LOCAL_ENABLED=false). */
  whisper?: { enabled?: boolean; model?: string; loaded?: boolean; fallback_reason?: string | null };
  whisper_cloud?: { model?: string; provider?: string | null; api_key_configured?: boolean };
}

export const getSttConfig = async (): Promise<SttConfig> => {
  const res = await aiApi.get<AiEnvelope<SttConfig>>("/stt/config");
  return res.data.data;
};

const isSttEngine = (value: unknown): value is SttEngine =>
  typeof value === "string" && (STT_ENGINES as readonly string[]).includes(value);

/** Build-time override (VITE_STT_ENGINE); empty = follow the server's STT_ENGINE default. */
export const STT_ENGINE_OVERRIDE: SttEngine | null = (() => {
  const raw = import.meta.env.VITE_STT_ENGINE as string | undefined;
  return isSttEngine(raw) ? raw : null;
})();

/** Is the engine usable according to the server config? Unknown config = optimistic. */
export const isSttEngineAvailable = (engine: SttEngine, config?: SttConfig | null): boolean => {
  if (!config) return true;
  if (engine === "deepgram") return Boolean(config.deepgram?.api_key_configured);
  if (engine === "whisper_cloud") return Boolean(config.whisper_cloud?.api_key_configured);
  // Local Whisper: the server can switch it off entirely; then it must never be picked, not even
  // as the fallback in resolveSttEngine.
  return config.whisper?.enabled !== false && Boolean(config.whisper?.model);
};

/**
 * Engine to use, in order of precedence: the engine HR chose on the invitation (`requested`),
 * the build-time override, the server default, then local Whisper. When the chosen engine is not
 * configured on the server, fall back to the first available one in order
 * whisper -> whisper_cloud -> deepgram, so the room still works.
 */
export const resolveSttEngine = (config?: SttConfig | null, requested?: string | null): SttEngine => {
  const preferred: SttEngine = isSttEngine(requested)
    ? requested
    : STT_ENGINE_OVERRIDE ?? (isSttEngine(config?.default_engine) ? config!.default_engine : "whisper");
  if (isSttEngineAvailable(preferred, config)) return preferred;
  const fallback = STT_ENGINES.find((engine) => isSttEngineAvailable(engine, config));
  if (fallback) return fallback;
  // Nothing usable: still never hand a disabled local engine to the room
  return preferred === "whisper" && config?.whisper?.enabled === false ? "whisper_cloud" : preferred;
};

/** Load the Whisper model ahead of the first utterance (several seconds on first use). Best-effort. */
export const warmupWhisper = async (): Promise<void> => {
  await aiApi.post("/stt/whisper/warmup", {}, { timeout: 120_000 });
};

/** Synthesize speech (MP3 blob) with the server's default TTS provider and voice. */
export const synthesizeSpeech = async (text: string): Promise<Blob> => {
  const res = await aiApi.post("/tts/speak", { text }, { responseType: "blob", timeout: 120_000 });
  return res.data as Blob;
};

/** Absolute WebSocket URL for an API path such as "/stt/live". */
export const aiWebSocketUrl = (path: string): string => {
  const base = new URL(AI_API_BASE, window.location.origin);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = `${base.pathname.replace(/\/$/, "")}${path}`;
  base.search = "";
  return base.toString();
};

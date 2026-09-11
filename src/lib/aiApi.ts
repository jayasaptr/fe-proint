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

export interface TtsConfig {
  provider?: string;
  model?: string;
  default_voice_id?: string;
  api_key_configured?: boolean;
}

export const getTtsConfig = async (): Promise<TtsConfig> => {
  const res = await aiApi.get<AiEnvelope<TtsConfig>>("/tts/config");
  return res.data.data;
};

/**
 * AI avatar shown in the candidate room. VITE_AI_AVATAR: "auto" (default: look follows the TTS
 * voice, Gadis = female, Ardi = male), "female", "male", or "off" (plain robot icon as before).
 */
export type AvatarSetting = "auto" | "female" | "male" | "off";
export const AVATAR_SETTING: AvatarSetting = (() => {
  const raw = ((import.meta.env.VITE_AI_AVATAR as string | undefined) ?? "auto").trim().toLowerCase();
  return raw === "female" || raw === "male" || raw === "off" ? raw : "auto";
})();

/** Character look for the configured voice; ElevenLabs voice ids are opaque, so those default to female. */
export const resolveAvatarVariant = (config?: TtsConfig | null): "female" | "male" | null => {
  if (AVATAR_SETTING === "off") return null;
  if (AVATAR_SETTING !== "auto") return AVATAR_SETTING;
  const voice = (config?.default_voice_id ?? "").toLowerCase();
  if (/ardi|male(?!s)|pria|laki/.test(voice) && !/female/.test(voice)) return "male";
  return "female";
};

/** Synthesize speech (MP3 blob) with the server's default TTS provider and voice. */
export const synthesizeSpeech = async (text: string): Promise<Blob> => {
  const res = await aiApi.post("/tts/speak", { text }, { responseType: "blob", timeout: 120_000 });
  return res.data as Blob;
};

/**
 * Photo avatar (talking head rendered server-side from an uploaded photo, MuseTalk on the GPU).
 * `ready` = feature on, worker up and a photo is active; otherwise the room uses the SVG avatar.
 */
export type AvatarEngine = "musetalk" | "toon" | "emoji";

/** Appearance of a parametric "emoji" avatar (drawn by EmojiAvatar.tsx). Colors are #rrggbb. */
export interface EmojiParams {
  skin: string;
  hair: string;
  hair_style: "short" | "medium" | "long" | "bun" | "tied" | "curly" | "wavy" | "spiky" | "bald";
  hijab: boolean;
  hijab_color: string;
  glasses: boolean;
  glasses_color: string;
  facial_hair: "none" | "stubble" | "mustache" | "goatee" | "beard";
  face_shape: "oval" | "round" | "square" | "heart" | "long";
  eyes: string;
  lips: string;
  clothing: string;
  accent: string;
  earrings: boolean;
  /** Feminine/masculine cues are explicit parameters (read from the photo, editable), never a guess. */
  lipstick: boolean;
  lashes: boolean;
  blush: boolean;
  brow_thickness: "thin" | "medium" | "thick";
  /** Facial structure: soft (rounded, delicate) .. angular (square jaw, heavy brow, broad neck). */
  build: "soft" | "medium" | "angular";
  /** Visible forehead / nasolabial lines. */
  age_lines: boolean;
}

export const DEFAULT_EMOJI_PARAMS: EmojiParams = {
  skin: "#e3b08a",
  hair: "#2e1f18",
  hair_style: "short",
  hijab: false,
  hijab_color: "#2b2842",
  glasses: false,
  glasses_color: "#2a2a2a",
  facial_hair: "none",
  face_shape: "oval",
  eyes: "#3b2a20",
  lips: "#b5624e",
  clothing: "#2b2842",
  accent: "#FFBE00",
  earrings: false,
  lipstick: false,
  lashes: false,
  blush: false,
  brow_thickness: "medium",
  build: "medium",
  age_lines: false,
};

export const getEmojiParams = async (avatarId: string): Promise<EmojiParams> => {
  const res = await aiApi.get<AiEnvelope<{ params: Partial<EmojiParams> }>>(`/avatar/emoji/${encodeURIComponent(avatarId)}/params`, { timeout: 10_000 });
  return { ...DEFAULT_EMOJI_PARAMS, ...(res.data.data?.params ?? {}) };
};

export interface PhotoAvatarInfo {
  id: string;
  width: number;
  height: number;
  created_at: number;
  source_name?: string;
  active?: boolean;
  /** "musetalk": GPU talking head (MP4 per utterance). "toon": CPU puppet. "emoji": parametric vector character. */
  engine?: AvatarEngine;
  /** emoji engine: appearance parameters (also available via getEmojiParams). */
  params?: Partial<EmojiParams>;
  /** toon engine: "toon" = cartoon-shaded, "photo" = original photo. */
  style?: "toon" | "photo";
  /** "image": one still photo, mouth only. "video": source frames loop (blinks, head motion, gestures). */
  kind?: "image" | "video";
  frames?: number;
  /** Length of the forward+backward loop that both idle.mp4 and every spoken clip follow. */
  cycle_frames?: number;
  fps?: number;
  duration_s?: number;
  has_idle?: boolean;
}

/**
 * A rendering utterance: the MP4 arrives as a stream of fragments while the GPU is still working,
 * plus where the clip sits in the avatar's frame cycle (for idle-loop hand-over). `body` is consumed
 * once: by MediaSource for progressive playback, or drained into a Blob where MSE is missing.
 */
export interface SpeechVideo {
  body: ReadableStream<Uint8Array>;
  /** MIME + codecs string for MediaSource.addSourceBuffer (from the worker). */
  mime: string;
  frames: number;
  startFrame: number;
  endFrame: number;
  cycleFrames: number;
  /** Stop the download (and the render on the server) when the clip is interrupted. */
  abort: () => void;
}

/** Codec string of the worker's fragmented MP4 (H.264 baseline 3.1 + AAC-LC); fallback if the header is missing. */
export const AVATAR_STREAM_MIME = 'video/mp4; codecs="avc1.42E01F, mp4a.40.2"';

export interface AvatarConfig {
  enabled: boolean;
  /** GPU worker engine (MuseTalk) switched on server-side. */
  gpu_enabled?: boolean;
  /** CPU toon engine switched on server-side. */
  toon_enabled?: boolean;
  /** Parametric emoji engine switched on server-side. */
  emoji_enabled?: boolean;
  /** CPU stylizer worker (AI restyle for the toon engine) reachable. */
  stylizer_ready?: boolean;
  ready: boolean;
  worker_ready?: boolean;
  device?: string | null;
  active: PhotoAvatarInfo | null;
  avatars: PhotoAvatarInfo[];
  error?: string | null;
}

export const getAvatarConfig = async (): Promise<AvatarConfig> => {
  const res = await aiApi.get<AiEnvelope<AvatarConfig>>("/avatar/config", { timeout: 8_000 });
  return res.data.data;
};

/** Same-origin URL of the (downscaled) photo, shown in the tile while the interviewer is silent. */
export const avatarImageUrl = (avatarId: string): string => `${AI_API_BASE}/avatar/photos/${encodeURIComponent(avatarId)}/image`;

/** Toon puppet assets served by the main API (prepared once from the HR photo on the CPU). */
export type ToonAsset = "base.png" | "toon.png" | "source.png" | "brow_left.png" | "brow_right.png" | "meta.json";
export const toonAssetUrl = (avatarId: string, asset: ToonAsset): string =>
  `${AI_API_BASE}/avatar/toon/${encodeURIComponent(avatarId)}/${asset}`;

/** Landmarks, patch positions and colors the browser needs to animate a toon avatar. */
export interface ToonMeta {
  version: number;
  width: number;
  height: number;
  face_center: [number, number];
  face_width: number;
  forehead_y: number;
  chin_y: number;
  face_oval: [number, number][];
  left_eye: [number, number][];
  right_eye: [number, number][];
  left_iris: [number, number, number];
  right_iris: [number, number, number];
  brow_left: { pos: [number, number]; size: [number, number] };
  brow_right: { pos: [number, number]; size: [number, number] };
  lips_outer: [number, number][];
  lips_inner_upper: [number, number][];
  lips_inner_lower: [number, number][];
  mouth_center: [number, number];
  mouth_width: number;
  colors: { skin: string; lip: string; mouth: string };
}

export const getToonMeta = async (avatarId: string): Promise<ToonMeta> => {
  const res = await aiApi.get<ToonMeta>(`/avatar/toon/${encodeURIComponent(avatarId)}/meta.json`, { timeout: 10_000 });
  return res.data;
};

/** Thumbnail for any avatar kind: toon.png for toon avatars, the source photo for MuseTalk ones. */
export const avatarThumbUrl = (avatar: Pick<PhotoAvatarInfo, "id" | "engine">): string =>
  avatar.engine === "toon" ? toonAssetUrl(avatar.id, "toon.png") : avatarImageUrl(avatar.id);

/** Silent looping clip of a video avatar's source frames (404 for photo avatars). */
export const avatarIdleUrl = (avatarId: string): string => `${AI_API_BASE}/avatar/photos/${encodeURIComponent(avatarId)}/idle`;

/**
 * Text -> MP4 (H.264 + AAC) of the active avatar speaking it. Slower than plain TTS (a few seconds
 * of GPU work per utterance); callers fall back to `synthesizeSpeech` when it fails. `startFrame`
 * is the cycle frame the clip should begin on so it continues the idle loop without a jump.
 */
export const synthesizeSpeechVideo = async (text: string, startFrame = 0, avatarId?: string | null): Promise<SpeechVideo> => {
  // fetch (not axios): only fetch exposes the response body as a stream while it is still arriving
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120_000);
  let res: Response;
  try {
    res = await fetch(`${AI_API_BASE}/avatar/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "video/mp4, application/json" },
      body: JSON.stringify({ text, start_frame: Math.max(0, Math.floor(startFrame)), ...(avatarId ? { avatar_id: avatarId } : {}) }),
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer); // the headers are in; the body may take as long as the clip needs
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("video/") || !res.body) {
    let message = `Avatar speak failed (HTTP ${res.status})`;
    try {
      const envelope = (await res.json()) as { message?: string; remark?: string };
      message = [envelope.message, envelope.remark].filter(Boolean).join(" - ") || message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  const num = (name: string, fallback: number) => {
    const value = Number(res.headers.get(name));
    return Number.isFinite(value) && res.headers.get(name) !== null ? value : fallback;
  };
  return {
    body: res.body,
    mime: res.headers.get("x-stream-mime") || AVATAR_STREAM_MIME,
    frames: num("x-render-frames", 0),
    startFrame: num("x-start-frame", startFrame),
    endFrame: num("x-end-frame", 0),
    cycleFrames: num("x-cycle-frames", 1),
    abort: () => controller.abort(),
  };
};

/** Absolute WebSocket URL for an API path such as "/stt/live". */
export const aiWebSocketUrl = (path: string): string => {
  const base = new URL(AI_API_BASE, window.location.origin);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = `${base.pathname.replace(/\/$/, "")}${path}`;
  base.search = "";
  return base.toString();
};

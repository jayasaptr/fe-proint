import api from "@/lib/axios";

// AI Screening kandidat (CV + data profil) — endpoint Laravel yang mem-proxy ke AI Interview API.

const localApiBaseUrl =
  import.meta.env.VITE_API_URL_LOCAL || import.meta.env.VITE_API_URL;

/** LLM provider di server AI: Gemini (Google), Ollama lokal, atau Ollama Cloud (ollama.com). */
export type LlmProvider = "gemini" | "ollama" | "ollama_cloud";

export const LLM_PROVIDER_LABELS: Record<string, string> = {
  gemini: "Gemini (cloud)",
  ollama: "Ollama (lokal)",
  ollama_cloud: "Ollama Cloud",
};

/** Label ramah untuk id provider; id yang tidak dikenal ditampilkan apa adanya. */
export const llmProviderLabel = (provider?: string | null): string =>
  provider ? LLM_PROVIDER_LABELS[provider] ?? provider : "";

export interface AiServerProvider {
  label?: string;
  model?: string;
  /** false = the AI server refuses this provider outright (e.g. OLLAMA_LOCAL_ENABLED=false). */
  enabled?: boolean;
  available?: boolean;
}

export type ScreeningRecommendation =
  | "lanjut interview"
  | "pertimbangkan"
  | "tidak lanjut";

export type RequirementFitStatus =
  | "terpenuhi"
  | "sebagian"
  | "tidak terpenuhi"
  | "tidak disebutkan";

export interface ScreeningRecentExperience {
  company?: string;
  role?: string;
  period?: string;
  highlights?: string;
}

export interface ScreeningResult {
  candidate_name?: string;
  match_score?: number;
  recommendation?: ScreeningRecommendation | string;
  summary?: string;
  profile?: {
    current_role?: string;
    total_experience_years?: number | null;
    education?: string;
    key_skills?: string[];
    certifications?: string[];
    recent_experience?: ScreeningRecentExperience[];
  };
  strengths?: string[];
  gaps?: string[];
  red_flags?: string[];
  requirements_fit?: {
    overall?: "sesuai" | "sebagian" | "tidak sesuai" | "tidak dinilai" | string;
    items?: {
      requirement?: string;
      status?: RequirementFitStatus | string;
      evidence?: string;
    }[];
  };
  suggested_questions?: string[];
  provider?: string;
  model?: string;
  source?: string;
  /** Alasan CV dilewati (mis. PDF hasil scan) saat penilaian hanya memakai data kandidat. */
  cv_error?: string | null;
  /** True bila CV hasil scan dibaca lewat OCR (nama/angka bisa salah baca). */
  cv_ocr?: boolean;
  cv_chars?: number;
  cv_truncated?: boolean;
  profile_chars?: number;
}

export interface ScreeningRecord {
  id: number;
  candidate_id: number;
  job_expected_id?: number | null;
  document_id?: number | null;
  position: string;
  requirements?: string | null;
  provider?: string | null;
  model?: string | null;
  source?: string | null;
  status: "queued" | "running" | "done" | "failed";
  match_score?: number | null;
  recommendation?: string | null;
  result?: ScreeningResult | null;
  error_message?: string | null;
  duration_ms?: number | null;
  createdAt?: string | null;
  createdBy?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export type ScreeningSummary = Omit<ScreeningRecord, "result" | "requirements" | "candidate_id">;

export interface AiServerStatus {
  enabled: boolean;
  reachable: boolean;
  default_provider?: string | null;
  providers?: Record<string, AiServerProvider>;
  error?: string;
}

export interface ScreeningIndexResponse {
  success: boolean;
  message: string;
  data: {
    latest: ScreeningRecord | null;
    history: ScreeningSummary[];
    ai_server: AiServerStatus | null;
  };
}

export interface ScreeningRunPayload {
  job_expected_id?: number | null;
  document_id?: number | null;
  position?: string;
  requirements?: string;
  provider?: LlmProvider;
}

export interface ScreeningRunResponse {
  success: boolean;
  message: string;
  data: ScreeningRecord | null;
}

export const getCandidateScreening = async (
  canId: string | number,
): Promise<ScreeningIndexResponse> => {
  const response = await api.get(
    `${localApiBaseUrl}/candidates/${canId}/ai-screening`,
  );
  return response.data;
};

export const getCandidateScreeningDetail = async (
  canId: string | number,
  screeningId: number,
): Promise<{ success: boolean; message: string; data: ScreeningRecord }> => {
  const response = await api.get(
    `${localApiBaseUrl}/candidates/${canId}/ai-screening/${screeningId}`,
  );
  return response.data;
};

/**
 * Menjalankan screening secara sinkron. LLM lokal bisa memakan waktu >1 menit,
 * jadi timeout axios dinaikkan khusus untuk request ini.
 */
export const runCandidateScreening = async (
  canId: string | number,
  payload: ScreeningRunPayload,
): Promise<ScreeningRunResponse> => {
  const body: Record<string, unknown> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") body[key] = value;
  });

  const response = await api.post(
    `${localApiBaseUrl}/candidates/${canId}/ai-screening`,
    body,
    { timeout: 330_000 },
  );
  return response.data;
};

// ---------------------------------------------------------------------------
// Bulk screening via queue (daftar kandidat)
// ---------------------------------------------------------------------------
export interface BulkScreeningResponse {
  success: boolean;
  message: string;
  data: {
    queued_count: number;
    skipped_count: number;
    screening_ids: number[];
    skipped: Record<string, string>;
    worker_hint?: string;
  };
}

export const bulkScreenCandidates = async (
  candidateIds: number[],
  options: { provider?: LlmProvider; requirements?: string } = {},
): Promise<BulkScreeningResponse> => {
  const response = await api.post(
    `${localApiBaseUrl}/candidates/ai-screening/bulk`,
    { candidate_ids: candidateIds, ...options },
  );
  return response.data;
};

export interface ScreeningStatusItem {
  CanId: number;
  latest: ScreeningSummary | null;
  latest_done: ScreeningSummary | null;
}

export const getScreeningStatuses = async (
  candidateIds: number[],
): Promise<{ success: boolean; message: string; data: { items: ScreeningStatusItem[]; queue_pending_total: number } }> => {
  const response = await api.get(
    `${localApiBaseUrl}/candidates/ai-screening/status`,
    { params: { ids: candidateIds.join(",") } },
  );
  return response.data;
};

export const isScreeningPending = (summary?: Pick<ScreeningSummary, "status"> | null) =>
  summary?.status === "queued" || summary?.status === "running";

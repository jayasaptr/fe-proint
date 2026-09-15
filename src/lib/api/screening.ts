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

/**
 * Hasil verifikasi satu dokumen pendukung: metadata deterministik dari server AI (jenis terdeteksi,
 * kecocokan label, nama kandidat tercantum) digabung dengan penilaian LLM (ai_*).
 */
export interface ScreeningDocumentCheck {
  index: number;
  id?: number | null;
  /** Label yang dipilih kandidat saat mengunggah (mis. "Sertifikat TOEFL / IELTS"). */
  label: string;
  filename?: string | null;
  detected_type?: string;
  detected_label?: string;
  label_match?: "sesuai" | "tidak sesuai" | "tidak dipastikan" | "tidak terbaca" | string;
  name_match?: boolean | null;
  /** Dokumen identitas (KTP/KK/...): isinya tidak dikirim ke LLM, hanya jenisnya dicek. */
  sensitive?: boolean;
  method?: "embedded" | "ocr" | "none" | string;
  chars?: number;
  error?: string | null;
  ai_status?: "sesuai" | "tidak sesuai" | "perlu dicek" | "tidak terbaca" | string | null;
  ai_detected?: string | null;
  ai_note?: string | null;
}

/** Verifikasi klaim yang diisi kandidat (skor TOEFL/IELTS, pendidikan, sertifikasi) terhadap dokumen & CV. */
export interface ScreeningProfileCheck {
  claim?: string;
  /** Apa yang tertulis di profil/form/CV beserta sumbernya, mis. "Form FTAP: IELTS 9.0". */
  claimed?: string | null;
  /** Apa yang benar-benar ditunjukkan dokumen yang diunggah. */
  found?: string | null;
  status?: "terbukti" | "tidak terbukti" | "bertentangan" | string;
  evidence?: string | null;
  /** true = klaim menyangkut persyaratan HR/program (bukan sekadar nilai tambah). */
  important?: boolean;
  /** Poin yang dikurangi sistem dari skor karena klaim ini (0 bila tidak ada). */
  penalty?: number;
}

/** Satu catatan perbedaan antara klaim kandidat (profil/label dokumen) dan isi dokumen yang diunggah. */
export interface ScreeningDiscrepancy {
  type: "klaim" | "dokumen" | string;
  status: string;
  important?: boolean;
  title: string;
  claimed?: string | null;
  found?: string | null;
  penalty?: number;
  document_index?: number | null;
}

export interface ScreeningScorePenalty {
  code: string;
  label: string;
  points: number;
}

export interface ScreeningScoreCap {
  code: string;
  label: string;
  max: number;
}

/**
 * Rincian skor akhir yang dihitung server AI secara deterministik:
 * base = (1-w)*llm + w*requirements, dikurangi penalti verifikasi, dibatasi cap.
 */
export interface ScreeningScoreBreakdown {
  llm_score?: number | null;
  requirements_score?: number | null;
  requirements_weight?: number;
  base_score?: number | null;
  penalties?: ScreeningScorePenalty[];
  penalty_total?: number;
  penalty_max?: number;
  caps?: ScreeningScoreCap[];
  applied_cap?: ScreeningScoreCap | null;
  final_score?: number | null;
  documents_checked?: boolean;
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
  /** Verifikasi dokumen pendukung (satu entri per dokumen yang dikirim). */
  documents?: ScreeningDocumentCheck[];
  documents_count?: number;
  profile_checks?: ScreeningProfileCheck[];
  /** Skor & rekomendasi mentah dari LLM sebelum penyesuaian sistem (match_score = skor akhir). */
  llm_score?: number | null;
  llm_recommendation?: string | null;
  score_breakdown?: ScreeningScoreBreakdown | null;
  /** Catatan perbedaan klaim vs dokumen; hasil lama (sebelum fitur ini) tidak memilikinya. */
  discrepancies?: ScreeningDiscrepancy[];
}

export interface ScreeningRecord {
  id: number;
  candidate_id: number;
  job_expected_id?: number | null;
  document_id?: number | null;
  /** Dokumen pendukung yang ikut diverifikasi pada run ini; null = tanpa dokumen pendukung. */
  supporting_document_ids?: number[] | null;
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
  /** false = jangan sertakan dokumen pendukung (ijazah, transkrip, sertifikat) pada run ini. */
  include_documents?: boolean;
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
  options: { provider?: LlmProvider; requirements?: string; include_documents?: boolean } = {},
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

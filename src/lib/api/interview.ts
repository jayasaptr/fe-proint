import api from "@/lib/axios";
import type { SttEngine } from "@/lib/aiApi";
import type { AiServerStatus, LlmProvider } from "@/lib/api/screening";

// AI Interview kandidat (sisi HR): undangan link + kode akses, status, dan hasil penilaian.
// Kandidat menjalani interview di AI Interview client; Laravel menyimpan transkrip dan laporan.

const localApiBaseUrl =
  import.meta.env.VITE_API_URL_LOCAL || import.meta.env.VITE_API_URL;

export type InterviewStatus =
  | "invited"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type InterviewRecommendation = "lanjut" | "pertimbangkan" | "tidak lanjut";

export interface InterviewHistoryItem {
  question: string;
  answer: string;
}

export interface InterviewReport {
  overall_score?: number;
  recommendation?: InterviewRecommendation | string;
  summary?: string;
  strengths?: string[];
  concerns?: string[];
  per_question?: { question?: string; score?: number; note?: string }[];
  requirements_fit?: {
    overall?: "sesuai" | "sebagian" | "tidak sesuai" | "tidak dinilai" | string;
    items?: { requirement?: string; status?: string; evidence?: string }[];
  };
  provider?: string;
  model?: string;
}

export interface InterviewSummary {
  id: number;
  candidate_id: number;
  job_expected_id?: number | null;
  position: string;
  total_questions: number;
  provider?: string | null;
  model?: string | null;
  /** Engine speech-to-text pilihan HR (whisper | whisper_cloud | deepgram); null = default server AI. */
  stt_engine?: string | null;
  status: InterviewStatus;
  overall_score?: number | null;
  recommendation?: string | null;
  question_count: number;
  error_message?: string | null;
  duration_s?: number | null;
  /** Rekaman layar+kamera di DH Asset: recording | uploaded | failed | missing; null = belum ada. */
  recording_status?: "recording" | "uploaded" | "failed" | "missing" | string | null;
  recording_url?: string | null;
  /** Lebih dari satu segmen bila kandidat me-refresh/masuk lagi di tengah sesi. */
  recording_segments?: { segment: number; file_id: string; url: string; size?: number | null }[];
  recording_size?: number | null;
  recording_error?: string | null;
  /** Berapa kali sesi terjeda: share layar dihentikan (laptop/PC) atau kandidat meninggalkan halaman (HP). */
  screen_interruptions?: number;
  expires_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
}

export interface InterviewRecord extends InterviewSummary {
  requirements?: string | null;
  transcript: InterviewHistoryItem[];
  qa_exchanges: InterviewHistoryItem[];
  report?: InterviewReport | null;
  /** Hanya terisi selama undangan masih aktif. */
  interview_link?: string | null;
  access_code?: string | null;
  access_code_attempts?: number;
}

export interface InterviewIndexResponse {
  success: boolean;
  message: string;
  data: {
    latest: InterviewRecord | null;
    history: InterviewSummary[];
    ai_server?: AiServerStatus | null;
  };
}

export interface InterviewInvitePayload {
  job_expected_id?: number | null;
  position?: string;
  requirements?: string;
  total_questions?: number;
  provider?: LlmProvider;
  stt_engine?: SttEngine;
}

export interface InterviewRecordResponse {
  success: boolean;
  message: string;
  data: InterviewRecord | null;
}

export const getCandidateInterview = async (
  canId: string | number,
): Promise<InterviewIndexResponse> => {
  const response = await api.get(`${localApiBaseUrl}/candidates/${canId}/ai-interview`);
  return response.data;
};

export const getCandidateInterviewDetail = async (
  canId: string | number,
  interviewId: number,
): Promise<InterviewRecordResponse> => {
  const response = await api.get(
    `${localApiBaseUrl}/candidates/${canId}/ai-interview/${interviewId}`,
  );
  return response.data;
};

/** Buat undangan baru (link + kode akses). Undangan aktif sebelumnya otomatis dibatalkan. */
export const inviteCandidateInterview = async (
  canId: string | number,
  payload: InterviewInvitePayload = {},
): Promise<InterviewRecordResponse> => {
  const body: Record<string, unknown> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") body[key] = value;
  });
  const response = await api.post(`${localApiBaseUrl}/candidates/${canId}/ai-interview`, body);
  return response.data;
};

export const cancelCandidateInterview = async (
  canId: string | number,
  interviewId: number,
): Promise<InterviewRecordResponse> => {
  const response = await api.post(
    `${localApiBaseUrl}/candidates/${canId}/ai-interview/${interviewId}/cancel`,
  );
  return response.data;
};

/** Buat ulang laporan dari transkrip (LLM lokal bisa >1 menit). */
export const regenerateInterviewReport = async (
  canId: string | number,
  interviewId: number,
  provider?: LlmProvider,
): Promise<InterviewRecordResponse> => {
  const response = await api.post(
    `${localApiBaseUrl}/candidates/${canId}/ai-interview/${interviewId}/report`,
    provider ? { provider } : {},
    { timeout: 330_000 },
  );
  return response.data;
};

export const isInterviewActive = (summary?: Pick<InterviewSummary, "status"> | null) =>
  summary?.status === "invited" || summary?.status === "in_progress";

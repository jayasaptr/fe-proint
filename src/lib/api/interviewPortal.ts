import axios from "axios";
import type { InterviewHistoryItem } from "./interview";

/**
 * Portal AI Interview untuk kandidat (publik, tanpa login admin).
 * Identitas: token di URL + kode akses dari HR, lalu bearer token sesi.
 * Instance axios terpisah agar JWT admin di localStorage tidak ikut terkirim.
 */
const baseURL =
  (import.meta.env.VITE_API_URL_LOCAL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "/api";

const portal = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

export interface PortalEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export type InvitationStatus = "invited" | "in_progress" | "completed" | "failed" | "cancelled" | "expired";

export interface InvitationInfo {
  status: InvitationStatus;
  position: string;
  candidate_first_name?: string | null;
  expires_at?: string | null;
  can_start: boolean;
  company: string;
}

export interface InterviewSessionConfig {
  id: number;
  position: string;
  has_requirements: boolean;
  total_questions: number;
  /** Engine speech-to-text yang dipilih HR untuk undangan ini; null = default server AI. */
  stt_engine?: string | null;
  /** true (default) = share layar wajib dan sesi direkam (layar + kamera + suara) ke DH Asset. */
  recording_required?: boolean;
  status: InvitationStatus;
  history: InterviewHistoryItem[];
  qa_exchanges: InterviewHistoryItem[];
  started_at?: string | null;
}

export interface LoginResult {
  session_token: string;
  session_expires_at: string;
  interview: InterviewSessionConfig;
}

export interface NextQuestionResult {
  finished: boolean;
  clarify?: boolean;
  reaction?: string | null;
  question?: string | null;
  number: number;
  total?: number | null;
  /** Mode persyaratan: batas maksimal pertanyaan (AI bisa selesai lebih awal). */
  max_questions?: number | null;
  provider?: string;
}

const auth = (sessionToken: string) => ({ headers: { Authorization: `Bearer ${sessionToken}` } });

export const getInvitation = async (token: string): Promise<PortalEnvelope<InvitationInfo>> => {
  const res = await portal.get(`/interview-portal/${token}`);
  return res.data;
};

export const loginInvitation = async (token: string, accessCode: string): Promise<PortalEnvelope<LoginResult>> => {
  const res = await portal.post(`/interview-portal/${token}/login`, { access_code: accessCode });
  return res.data;
};

export const fetchNextQuestion = async (
  token: string,
  sessionToken: string,
  history: InterviewHistoryItem[],
  allowClarify: boolean,
  spokenAck?: string | null,
): Promise<PortalEnvelope<NextQuestionResult>> => {
  const res = await portal.post(
    `/interview-portal/${token}/next`,
    { history, allow_clarify: allowClarify, spoken_ack: spokenAck || undefined },
    { ...auth(sessionToken), timeout: 300_000 },
  );
  return res.data;
};

export interface NextQuestionStreamHandlers {
  /** Reaction sentence(s) are complete; the question is still being generated. */
  onReaction?: (text: string) => void;
  /** Question text is complete (the final payload follows in the resolved promise). */
  onQuestion?: (text: string) => void;
}

/**
 * Streaming variant of fetchNextQuestion (Server-Sent Events over fetch). Resolves with the same
 * payload as the non-streaming call once the model has finished; `streamed` says which parts were
 * already delivered through the handlers.
 */
export const streamNextQuestion = async (
  token: string,
  sessionToken: string,
  history: InterviewHistoryItem[],
  allowClarify: boolean,
  spokenAck: string | null | undefined,
  handlers: NextQuestionStreamHandlers,
): Promise<NextQuestionResult & { streamed?: { reaction: boolean; question: boolean } }> => {
  const url = `${baseURL.replace(/\/$/, "")}/interview-portal/${token}/next/stream`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ history, allow_clarify: allowClarify, spoken_ack: spokenAck || undefined }),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message || message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  if (!res.body) throw new Error("Streaming tidak didukung browser ini.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: (NextQuestionResult & { streamed?: { reaction: boolean; question: boolean } }) | null = null;

  const handleEvent = (event: string, data: string) => {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    if (event === "reaction") handlers.onReaction?.(String((parsed as { text?: string }).text ?? ""));
    else if (event === "question") handlers.onQuestion?.(String((parsed as { text?: string }).text ?? ""));
    else if (event === "done") result = parsed as NextQuestionResult;
    else if (event === "error") {
      const e = parsed as { message?: string; remark?: string };
      throw new Error([e.message, e.remark].filter(Boolean).join(" - ") || "AI gagal menyusun pertanyaan.");
    }
  };

  // SSE frames are separated by a blank line; each frame has "event:" and "data:" lines.
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length) handleEvent(event, dataLines.join("\n"));
    }
  }
  if (!result) throw new Error("Stream berakhir tanpa hasil dari AI.");
  return result;
};

export const answerCandidateQuestion = async (
  token: string,
  sessionToken: string,
  history: InterviewHistoryItem[],
  candidateQuestion: string,
): Promise<PortalEnvelope<{ answer: string }>> => {
  const res = await portal.post(
    `/interview-portal/${token}/answer`,
    { history, candidate_question: candidateQuestion },
    { ...auth(sessionToken), timeout: 300_000 },
  );
  return res.data;
};

export const fetchClosing = async (
  token: string,
  sessionToken: string,
  history: InterviewHistoryItem[],
): Promise<PortalEnvelope<{ closing: string }>> => {
  const res = await portal.post(`/interview-portal/${token}/closing`, { history }, { ...auth(sessionToken), timeout: 300_000 });
  return res.data;
};

export const saveProgress = async (
  token: string,
  sessionToken: string,
  history: InterviewHistoryItem[],
  qaExchanges: InterviewHistoryItem[],
): Promise<PortalEnvelope<{ saved_questions: number; status: InvitationStatus }>> => {
  const res = await portal.post(
    `/interview-portal/${token}/progress`,
    { history, qa_exchanges: qaExchanges },
    auth(sessionToken),
  );
  return res.data;
};

/**
 * One ordered part of the session recording (raw WebM bytes from MediaRecorder). The server appends
 * parts to a single file and refuses gaps, so callers must send them strictly in `seq` order.
 */
export const uploadRecordingChunk = async (
  token: string,
  sessionToken: string,
  seq: number,
  part: Blob,
  screenInterruptions: number,
): Promise<PortalEnvelope<{ chunks: number; bytes: number }>> => {
  const res = await portal.post(`/interview-portal/${token}/recording`, part, {
    params: { seq, interruptions: screenInterruptions },
    headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": part.type || "video/webm" },
    timeout: 60_000,
  });
  return res.data;
};

export const completeInterview = async (
  token: string,
  sessionToken: string,
  payload: { history: InterviewHistoryItem[]; qaExchanges: InterviewHistoryItem[]; durationSeconds: number; screenInterruptions?: number },
): Promise<PortalEnvelope<{ status: InvitationStatus; question_count: number; completed_at?: string }>> => {
  const res = await portal.post(
    `/interview-portal/${token}/complete`,
    {
      history: payload.history,
      qa_exchanges: payload.qaExchanges,
      duration_s: payload.durationSeconds,
      screen_interruptions: payload.screenInterruptions ?? 0,
    },
    { ...auth(sessionToken), timeout: 330_000 }, // laporan dari LLM lokal bisa >1 menit; unggah rekaman ke DH Asset juga di sini
  );
  return res.data;
};

export const portalErrorStatus = (err: unknown): number | undefined =>
  (err as { response?: { status?: number } })?.response?.status;

export const portalErrorMessage = (err: unknown, fallback: string): string => {
  if (portalErrorStatus(err) === 429) return "Server sedang sibuk menerima permintaan Anda. Tunggu sebentar lalu coba lagi.";
  const axiosMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return axiosMessage || (err instanceof Error ? err.message : fallback);
};

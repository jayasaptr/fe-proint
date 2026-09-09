import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelCandidateInterview,
  getCandidateInterview,
  getCandidateInterviewDetail,
  inviteCandidateInterview,
  isInterviewActive,
  regenerateInterviewReport,
  type InterviewRecord,
  type InterviewReport,
  type InterviewSummary,
} from "@/lib/api/interview";
import { llmProviderLabel, type LlmProvider } from "@/lib/api/screening";
import { getSttConfig, isSttEngineAvailable, STT_ENGINE_LABELS, STT_ENGINES, type SttEngine } from "@/lib/aiApi";
import { formatInterviewScore, interviewRecommendationLabel } from "@/components/InterviewScoreChip";
import { copyToClipboard } from "@/lib/clipboard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Clock,
  Copy,
  ExternalLink,
  History,
  KeyRound,
  Link2,
  Loader2,
  MessageSquareText,
  Mic,
  MinusCircle,
  Radio,
  RefreshCw,
  Settings2,
  ThumbsDown,
  ThumbsUp,
  Video,
  XCircle,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

export interface AiInterviewJobOption {
  id: number;
  label: string;
  priority?: string | number | null;
}

interface AiInterviewPanelProps {
  candidateId: string | number;
  candidateName?: string;
  jobs: AiInterviewJobOption[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const scoreTone = (score?: number | null) => {
  if (score == null) return { text: "text-slate-500", bar: "bg-slate-400", ring: "border-slate-300 dark:border-slate-700" };
  if (score >= 7) return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", ring: "border-emerald-200 dark:border-emerald-900" };
  if (score >= 5) return { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500", ring: "border-amber-200 dark:border-amber-900" };
  return { text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500", ring: "border-rose-200 dark:border-rose-900" };
};

const recommendationBadge = (rec?: string | null) => {
  const value = (rec ?? "").toLowerCase();
  if (value.includes("tidak lanjut"))
    return { icon: ThumbsDown, cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900" };
  if (value.includes("pertimbangkan"))
    return { icon: MinusCircle, cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" };
  if (value.includes("lanjut"))
    return { icon: ThumbsUp, cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900" };
  return { icon: CircleHelp, cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700" };
};

const fitStatusIcon = (status?: string | null) => {
  const value = (status ?? "").toLowerCase();
  if (value === "terpenuhi") return { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" };
  if (value === "sebagian") return { icon: MinusCircle, cls: "text-amber-600 dark:text-amber-400" };
  if (value === "tidak terpenuhi") return { icon: XCircle, cls: "text-rose-600 dark:text-rose-400" };
  return { icon: CircleHelp, cls: "text-slate-400" };
};

const statusBadge = (status?: string | null) => {
  switch (status) {
    case "invited":
      return { label: "Diundang", cls: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900", icon: Clock };
    case "in_progress":
      return { label: "Berlangsung", cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900", icon: Radio };
    case "completed":
      return { label: "Selesai", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900", icon: CheckCircle2 };
    case "failed":
      return { label: "Laporan gagal", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900", icon: AlertTriangle };
    case "cancelled":
      return { label: "Dibatalkan", cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700", icon: Ban };
    case "expired":
      return { label: "Kedaluwarsa", cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700", icon: Clock };
    default:
      return { label: status || "-", cls: "bg-slate-50 text-slate-600 border-slate-200", icon: CircleHelp };
  }
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} mnt ${s} dtk` : `${s} dtk`;
};

const copyText = async (value: string, label: string) => {
  if (await copyToClipboard(value)) toast.success(`${label} disalin`);
  else toast.error(`Gagal menyalin ${label.toLowerCase()}. Salin manual dari kotak teks.`);
};

const formatBytes = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return null;
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
};

/**
 * Rekaman sesi yang diunggah ke DH Asset (laptop/PC: layar wajib + kamera + suara; HP: kamera +
 * suara), plus berapa kali sesi terjeda (share layar dihentikan, atau kandidat berpindah aplikasi di
 * HP). Beberapa segmen muncul bila kandidat me-refresh/masuk lagi di tengah sesi.
 */
const RecordingInfo = ({ record }: { record: InterviewSummary }) => {
  const status = record.recording_status;
  const interruptions = record.screen_interruptions ?? 0;
  if (!status && interruptions === 0) return null;
  const segments = record.recording_segments && record.recording_segments.length > 0
    ? record.recording_segments
    : record.recording_url ? [{ segment: 1, file_id: "", url: record.recording_url, size: record.recording_size }] : [];

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="flex items-center gap-1 text-slate-500"><Video className="w-3.5 h-3.5" /> Rekaman sesi</span>
      {status === "uploaded" && segments.map((seg) => (
        <a
          key={seg.segment}
          href={seg.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ExternalLink className="w-3 h-3" />
          {segments.length > 1 ? `Bagian ${seg.segment}` : "Buka video"}
          {formatBytes(seg.size) ? <span className="text-slate-400">· {formatBytes(seg.size)}</span> : null}
        </a>
      ))}
      {status === "recording" && <span className="text-sky-600">sedang direkam…</span>}
      {status === "failed" && (
        <span className="text-rose-600" title={record.recording_error ?? undefined}>
          gagal diunggah ke DH Asset (dicoba ulang otomatis)
        </span>
      )}
      {status === "missing" && <span className="text-slate-400">tidak ada rekaman dari browser kandidat</span>}
      {interruptions > 0 && (
        <Badge
          variant="outline"
          className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30"
          title="Share layar dihentikan (laptop/PC) atau kandidat berpindah aplikasi/tab (HP)"
        >
          <AlertTriangle className="w-3 h-3 mr-1" /> sesi terjeda {interruptions}×
        </Badge>
      )}
    </div>
  );
};

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 mb-2">{children}</h4>
);

const BulletList = ({ items, icon: Icon, iconClass, empty }: { items?: string[]; icon: React.ElementType; iconClass: string; empty: string }) => {
  if (!items || items.length === 0) return <p className="text-sm text-slate-400 italic">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconClass}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};

// ---------------------------------------------------------------------------
// Invitation card (link + access code) while the invitation is active
// ---------------------------------------------------------------------------
const InvitationCard = ({
  record,
  candidateName,
  onCancel,
  cancelling,
}: {
  record: InterviewRecord;
  candidateName?: string;
  onCancel: () => void;
  cancelling: boolean;
}) => {
  const badge = statusBadge(record.status);
  const BadgeIcon = badge.icon;
  const shareText = [
    `Halo ${candidateName || "Kandidat"},`,
    ``,
    `Anda diundang mengikuti AI Interview PT Darma Henwa Tbk untuk posisi ${record.position}.`,
    `Link interview: ${record.interview_link}`,
    `Kode akses: ${record.access_code}`,
    ``,
    `Gunakan laptop/HP dengan kamera dan mikrofon, di tempat yang tenang. Link berlaku sampai ${formatDateTime(record.expires_at)}.`,
  ].join("\n");

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50/40 dark:bg-violet-950/20 p-4 space-y-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`gap-1 ${badge.cls}`}>
            <BadgeIcon className={`w-3 h-3 ${record.status === "in_progress" ? "animate-pulse" : ""}`} /> {badge.label}
          </Badge>
          <span className="text-xs text-slate-500">Posisi: {record.position}</span>
        </div>
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Berlaku sampai {formatDateTime(record.expires_at)}
        </span>
      </div>

      {/* min-w-0 pada anak grid/flex wajib agar link panjang ter-truncate, bukan melebar keluar kartu */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="space-y-1 min-w-0">
          <Label className="text-[11px] text-slate-500 flex items-center gap-1"><Link2 className="w-3 h-3" /> Link interview kandidat</Label>
          <div className="flex items-center gap-1.5 min-w-0">
            <input
              readOnly
              value={record.interview_link ?? ""}
              onFocus={(e) => e.currentTarget.select()}
              title={record.interview_link ?? ""}
              className="flex-1 min-w-0 truncate font-mono text-xs px-2.5 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-slate-400"
            />
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => copyText(record.interview_link ?? "", "Link")} title="Salin link">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-2" asChild title="Buka link">
              <a href={record.interview_link ?? "#"} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a>
            </Button>
          </div>
        </div>
        <div className="space-y-1 min-w-0">
          <Label className="text-[11px] text-slate-500 flex items-center gap-1"><KeyRound className="w-3 h-3" /> Kode akses</Label>
          <div className="flex items-center gap-1.5">
            <code className="text-lg font-bold tracking-[0.2em] px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100">
              {record.access_code}
            </code>
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => copyText(record.access_code ?? "", "Kode akses")} title="Salin kode">
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-[11px] text-slate-500 max-w-xl">
          Bagikan link dan kode akses ke kandidat (sebaiknya lewat kanal berbeda). Kandidat memasukkan kode akses di halaman
          interview, lalu wawancara suara dengan AI. Skor muncul di sini otomatis setelah kandidat selesai.
          {record.access_code_attempts ? ` Percobaan kode salah: ${record.access_code_attempts}.` : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => copyText(shareText, "Pesan undangan")}>
            <MessageSquareText className="w-3.5 h-3.5 mr-1" /> Salin pesan undangan
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={onCancel} disabled={cancelling}>
            {cancelling ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Ban className="w-3.5 h-3.5 mr-1" />} Batalkan
          </Button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Result view
// ---------------------------------------------------------------------------
const InterviewResultView = ({ record }: { record: InterviewRecord }) => {
  const report: InterviewReport = record.report ?? {};
  const score = record.overall_score ?? report.overall_score ?? null;
  const tone = scoreTone(score);
  const rec = recommendationBadge(record.recommendation ?? report.recommendation);
  const RecIcon = rec.icon;
  const fit = report.requirements_fit;
  const transcript = record.transcript ?? [];
  const [showTranscript, setShowTranscript] = useState(false);

  const answerFor = (question: string | undefined, index: number) => {
    if (!question) return transcript[index]?.answer;
    if (transcript[index]?.question === question) return transcript[index].answer;
    return (transcript.find((h) => h.question === question) ?? transcript[index])?.answer;
  };

  return (
    <div className="space-y-6">
      <div className={`flex flex-col sm:flex-row gap-5 sm:items-center p-4 rounded-xl border ${tone.ring} bg-slate-50/60 dark:bg-slate-800/20`}>
        <div className="flex items-center gap-4">
          <div className="text-center min-w-[84px]">
            <div className={`text-4xl font-bold leading-none ${tone.text}`}>
              {formatInterviewScore(score)}<span className="text-base font-medium opacity-60">/10</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">Interview Score</div>
          </div>
          <div className="h-12 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`gap-1 ${rec.cls}`}>
              <RecIcon className="w-3 h-3" /> {interviewRecommendationLabel(record.recommendation ?? report.recommendation) || "-"}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-slate-200 dark:border-slate-700 text-slate-500">Posisi: {record.position}</Badge>
            <Badge variant="outline" className="text-[10px] border-slate-200 dark:border-slate-700 text-slate-500">{transcript.length} pertanyaan</Badge>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className={`h-full ${tone.bar} transition-all`} style={{ width: `${Math.max(0, Math.min(100, (score ?? 0) * 10))}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 flex flex-wrap gap-x-3">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Selesai {formatDateTime(record.completed_at)}</span>
            {formatDuration(record.duration_s) && <span>durasi {formatDuration(record.duration_s)}</span>}
            {record.provider && <span>model: {llmProviderLabel(record.provider)}{record.model ? ` / ${record.model}` : ""}</span>}
            {record.stt_engine && (
              <span>suara: {STT_ENGINE_LABELS[record.stt_engine as SttEngine] ?? record.stt_engine}</span>
            )}
          </p>
          <RecordingInfo record={record} />
        </div>
      </div>

      {report.summary && (
        <div>
          <SubHeading>Ringkasan</SubHeading>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{report.summary}</p>
        </div>
      )}

      {fit && fit.items && fit.items.length > 0 && (
        <div>
          <SubHeading>
            Kecocokan Persyaratan <span className="normal-case tracking-normal text-slate-400">— {fit.overall || "-"}</span>
          </SubHeading>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {fit.items.map((item, i) => {
              const s = fitStatusIcon(item.status);
              const SIcon = s.icon;
              return (
                <div key={i} className="p-3 flex gap-3">
                  <SIcon className={`w-4 h-4 mt-0.5 shrink-0 ${s.cls}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {item.requirement} <span className={`text-xs font-normal ${s.cls}`}>({item.status})</span>
                    </div>
                    {item.evidence && <p className="text-xs text-slate-500 mt-0.5">{item.evidence}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <SubHeading>Kekuatan</SubHeading>
          <BulletList items={report.strengths} icon={CheckCircle2} iconClass="text-emerald-500" empty="Tidak ada kekuatan spesifik yang tercatat." />
        </div>
        <div>
          <SubHeading>Perlu Diperhatikan</SubHeading>
          <BulletList items={report.concerns} icon={MinusCircle} iconClass="text-amber-500" empty="Tidak ada catatan." />
        </div>
      </div>

      {report.per_question && report.per_question.length > 0 && (
        <div>
          <SubHeading>Rincian per Pertanyaan</SubHeading>
          <div className="space-y-2">
            {report.per_question.map((item, i) => {
              const answer = answerFor(item.question, i);
              const qTone = scoreTone(item.score ?? null);
              return (
                <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.question}</p>
                    <Badge variant="outline" className={`shrink-0 ${qTone.text}`}>{item.score ?? "-"}/10</Badge>
                  </div>
                  {answer && (
                    <div className="rounded-md bg-slate-50 dark:bg-slate-800/40 border-l-2 border-slate-300 dark:border-slate-600 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Jawaban kandidat</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{answer}</p>
                    </div>
                  )}
                  {item.note && (
                    <p className="text-xs text-slate-500"><span className="font-medium text-slate-700 dark:text-slate-300">Catatan asesor: </span>{item.note}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(transcript.length > 0 || (record.qa_exchanges?.length ?? 0) > 0) && (
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <button type="button" onClick={() => setShowTranscript((v) => !v)} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5">
            <MessageSquareText className="w-3.5 h-3.5" /> Transkrip lengkap ({transcript.length} tanya-jawab
            {record.qa_exchanges?.length ? `, ${record.qa_exchanges.length} pertanyaan kandidat` : ""})
            {showTranscript ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showTranscript && (
            <div className="mt-3 space-y-3">
              {transcript.map((h, i) => (
                <div key={i} className="text-sm">
                  <p className="font-medium text-slate-800 dark:text-slate-200">{i + 1}. {h.question}</p>
                  <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap pl-4 border-l-2 border-slate-200 dark:border-slate-700 ml-1 mt-1">{h.answer}</p>
                </div>
              ))}
              {record.qa_exchanges?.length ? (
                <div className="pt-2">
                  <SubHeading>Pertanyaan kandidat ke AI</SubHeading>
                  {record.qa_exchanges.map((q, i) => (
                    <div key={i} className="text-sm mb-2">
                      <p className="font-medium text-slate-800 dark:text-slate-200">Kandidat: {q.question}</p>
                      <p className="text-slate-600 dark:text-slate-400 pl-4">AI: {q.answer}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
        Penilaian AI berbasis transkrip jawaban kandidat dan bersifat alat bantu. Keputusan seleksi tetap pada tim HR.
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------
const AiInterviewPanel = ({ candidateId, candidateName, jobs }: AiInterviewPanelProps) => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["candidate-ai-interview", String(candidateId)], [candidateId]);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => getCandidateInterview(candidateId),
    enabled: Boolean(candidateId),
    staleTime: 30 * 1000,
    // Selama undangan aktif, poll agar status "berlangsung"/skor muncul tanpa refresh.
    refetchInterval: (query) => (isInterviewActive(query.state.data?.data?.latest) ? 15_000 : false),
  });

  const latest = data?.data?.latest ?? null;
  const history: InterviewSummary[] = data?.data?.history ?? [];
  const aiServer = data?.data?.ai_server ?? null;
  const providerOptions = useMemo(() => Object.entries(aiServer?.providers ?? {}), [aiServer]);

  // Speech-to-text engines straight from the AI server (Laravel is not involved in STT)
  const { data: sttConfig } = useQuery({
    queryKey: ["ai-stt-config"],
    queryFn: getSttConfig,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const sttDefaultLabel = (() => {
    const id = sttConfig?.default_engine;
    return id && id in STT_ENGINE_LABELS ? STT_ENGINE_LABELS[id as SttEngine] : null;
  })();

  const defaultJob = useMemo(
    () => [...jobs].sort((a, b) => Number(a.priority ?? 99) - Number(b.priority ?? 99))[0] ?? null,
    [jobs],
  );

  const [showOptions, setShowOptions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [jobId, setJobId] = useState<string>("auto");
  const [totalQuestions, setTotalQuestions] = useState<string>("5");
  const [manualPosition, setManualPosition] = useState("");
  const [extraRequirements, setExtraRequirements] = useState("");
  // "auto" = provider default server (AI_INTERVIEW_PROVIDER); selain itu id provider eksplisit
  const [provider, setProvider] = useState<string>("auto");
  // "auto" = engine STT default server AI (STT_ENGINE); selain itu whisper | whisper_cloud | deepgram
  const [sttEngine, setSttEngine] = useState<string>("auto");
  const [isInviting, setIsInviting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [viewRecord, setViewRecord] = useState<InterviewRecord | null>(null);

  const shownRecord = viewRecord ?? latest;
  const hasJobs = jobs.length > 0;
  const activeInvite = latest && isInterviewActive(latest) ? latest : null;

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const extractMessage = (err: unknown, fallback: string) => {
    const axiosMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    return axiosMessage || (err instanceof Error ? err.message : fallback);
  };

  const handleInvite = async () => {
    if (!hasJobs && !manualPosition.trim()) {
      toast.error("Kandidat belum memiliki lamaran. Isi posisi secara manual di Opsi.");
      setShowOptions(true);
      return;
    }
    if (activeInvite && !window.confirm("Sudah ada undangan aktif. Buat link baru dan batalkan yang lama?")) {
      return;
    }
    setIsInviting(true);
    try {
      const res = await inviteCandidateInterview(candidateId, {
        job_expected_id: jobId === "auto" ? defaultJob?.id ?? null : Number(jobId),
        position: manualPosition.trim() || undefined,
        requirements: extraRequirements.trim() || undefined,
        total_questions: Number(totalQuestions) || undefined,
        provider: provider === "auto" ? undefined : (provider as LlmProvider),
        stt_engine: sttEngine === "auto" ? undefined : (sttEngine as SttEngine),
      });
      if (res.success && res.data) {
        toast.success("Undangan interview dibuat. Bagikan link dan kode akses ke kandidat.");
        setViewRecord(null);
        setShowOptions(false);
      } else {
        toast.error(res.message || "Gagal membuat undangan");
      }
    } catch (err) {
      toast.error(extractMessage(err, "Gagal membuat undangan interview"));
    } finally {
      setIsInviting(false);
      await refresh();
    }
  };

  const handleCancel = async () => {
    if (!activeInvite) return;
    if (!window.confirm("Batalkan undangan interview ini? Link dan kode akses tidak bisa dipakai lagi.")) return;
    setIsCancelling(true);
    try {
      const res = await cancelCandidateInterview(candidateId, activeInvite.id);
      if (res.success) toast.success("Undangan dibatalkan");
      else toast.error(res.message || "Gagal membatalkan");
    } catch (err) {
      toast.error(extractMessage(err, "Gagal membatalkan undangan"));
    } finally {
      setIsCancelling(false);
      await refresh();
    }
  };

  const handleRegenerate = async (record: InterviewRecord) => {
    setIsRegenerating(true);
    try {
      const res = await regenerateInterviewReport(candidateId, record.id);
      if (res.success && res.data) {
        toast.success(`Laporan dibuat — skor ${formatInterviewScore(res.data.overall_score)}/10`);
        setViewRecord(null);
      } else {
        toast.error(res.message || "Gagal membuat laporan");
      }
    } catch (err) {
      toast.error(extractMessage(err, "Gagal membuat laporan"));
    } finally {
      setIsRegenerating(false);
      await refresh();
    }
  };

  const openHistoryItem = async (h: InterviewSummary) => {
    if (latest && h.id === latest.id) {
      setViewRecord(null);
      return;
    }
    try {
      const res = await getCandidateInterviewDetail(candidateId, h.id);
      if (res.data) setViewRecord(res.data);
    } catch {
      toast.error("Gagal memuat detail riwayat");
    }
  };

  const latestBadge = statusBadge(shownRecord?.status);
  const LatestBadgeIcon = latestBadge.icon;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5" />
            {shownRecord ? (
              <>
                <Badge variant="outline" className={`gap-1 text-[10px] ${latestBadge.cls}`}>
                  <LatestBadgeIcon className="w-3 h-3" /> {latestBadge.label}
                </Badge>
                <span>{shownRecord.position}</span>
              </>
            ) : (
              "Belum ada undangan interview"
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-500" onClick={() => setShowOptions((v) => !v)}>
            <Settings2 className="w-3.5 h-3.5 mr-1" /> Opsi {showOptions ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-slate-900 hover:bg-slate-700 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            onClick={handleInvite}
            disabled={isInviting}
          >
            {isInviting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Mic className="w-3.5 h-3.5 mr-1.5" />}
            {activeInvite ? "Buat Link Baru" : latest ? "Undang Interview Ulang" : "Lanjutkan ke Interview"}
          </Button>
        </div>
      </div>

      {/* Options */}
      {showOptions && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Lamaran / Posisi yang diwawancara</Label>
            <Select value={jobId} onValueChange={setJobId} disabled={!hasJobs}>
              <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-900"><SelectValue placeholder="Tidak ada lamaran" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Otomatis{defaultJob ? ` (${defaultJob.label})` : ""}</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={String(j.id)}>{j.priority != null ? `Pri ${j.priority} — ` : ""}{j.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Jumlah pertanyaan (dipakai bila vacancy tanpa persyaratan)</Label>
            <Select value={totalQuestions} onValueChange={setTotalQuestions}>
              <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["3", "5", "7", "10"].map((n) => <SelectItem key={n} value={n}>{n} pertanyaan</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">
              Dengan persyaratan vacancy, AI bertanya sampai semua persyaratan tergali (maksimal sesuai AI_INTERVIEW_MAX_QUESTIONS, default 12),
              lalu membuka sesi tanya balik dan menutup sendiri.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Model AI (LLM) untuk wawancara dan laporan</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Otomatis{aiServer?.default_provider ? ` (${llmProviderLabel(aiServer.default_provider)})` : ""}
                </SelectItem>
                {providerOptions.map(([id, info]) => (
                  <SelectItem key={id} value={id} disabled={info.available === false}>
                    {llmProviderLabel(id)}{info.model ? ` — ${info.model}` : ""}
                    {info.enabled === false ? " (nonaktif di server)" : info.available === false ? " (tidak aktif)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">
              Pilihan tersimpan pada undangan ini. Ollama lokal lebih lambat menjawab, sehingga jeda antar pertanyaan lebih panjang.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Speech-to-text (pengenal suara kandidat)</Label>
            <Select value={sttEngine} onValueChange={setSttEngine}>
              <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Otomatis{sttDefaultLabel ? ` (${sttDefaultLabel})` : ""}</SelectItem>
                {STT_ENGINES.map((id) => {
                  const available = isSttEngineAvailable(id, sttConfig);
                  const model =
                    id === "whisper" ? sttConfig?.whisper?.model
                    : id === "whisper_cloud" ? sttConfig?.whisper_cloud?.model
                    : sttConfig?.deepgram?.model;
                  return (
                    <SelectItem key={id} value={id} disabled={!available}>
                      {STT_ENGINE_LABELS[id]}{model ? ` — ${model}` : ""}
                      {id === "whisper" && sttConfig?.whisper?.enabled === false
                        ? " (nonaktif di server)"
                        : !available ? " (tidak aktif)" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">
              Whisper lokal: audio tetap di server DEWA, teks muncul saat kandidat bicara. Whisper Cloud (OpenRouter): tanpa GPU,
              audio dikirim ke pihak ketiga, teks muncul setelah jeda bicara.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Posisi manual (opsional, menimpa nama posisi lamaran)</Label>
            <input
              value={manualPosition}
              onChange={(e) => setManualPosition(e.target.value)}
              maxLength={200}
              placeholder="mis. Mechanic Excavator"
              className="h-9 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Persyaratan tambahan (opsional, menimpa spesifikasi vacancy)</Label>
            <Textarea
              value={extraRequirements}
              onChange={(e) => setExtraRequirements(e.target.value)}
              maxLength={4000}
              rows={3}
              placeholder="Satu persyaratan per baris. AI akan menggali tiap persyaratan dalam wawancara."
              className="text-sm bg-white dark:bg-slate-900"
            />
          </div>
        </div>
      )}

      {/* Body */}
      {isLoading ? (
        <div className="py-10 flex items-center justify-center text-slate-400 text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat data interview…
        </div>
      ) : error ? (
        <div className="py-6 text-center text-sm text-rose-500">Gagal memuat data AI Interview.</div>
      ) : shownRecord ? (
        isInterviewActive(shownRecord) && shownRecord.interview_link ? (
          <InvitationCard record={shownRecord} candidateName={candidateName} onCancel={handleCancel} cancelling={isCancelling} />
        ) : shownRecord.status === "completed" ? (
          <InterviewResultView record={shownRecord} />
        ) : shownRecord.status === "failed" ? (
          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-sm text-rose-700 dark:text-rose-300 space-y-3">
            <div className="flex gap-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Kandidat sudah selesai, tetapi laporan penilaian gagal dibuat</div>
                <div className="text-xs mt-0.5 break-words">{shownRecord.error_message || "Tidak ada detail kesalahan."}</div>
                <div className="text-[11px] text-rose-400 mt-1">{shownRecord.question_count} jawaban tersimpan · {formatDateTime(shownRecord.completed_at)}</div>
              </div>
            </div>
            <RecordingInfo record={shownRecord} />
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleRegenerate(shownRecord)} disabled={isRegenerating || shownRecord.question_count === 0}>
              {isRegenerating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />} Buat laporan ulang
            </Button>
          </div>
        ) : (
          <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            <LatestBadgeIcon className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-slate-500 font-medium text-sm">Undangan {latestBadge.label.toLowerCase()}</p>
            <p className="text-slate-400 text-xs mt-1">
              {shownRecord.status === "expired"
                ? "Link sudah lewat masa berlaku dan kandidat belum menyelesaikan interview."
                : "Undangan ini tidak lagi berlaku."}{" "}
              Klik "Undang Interview Ulang" untuk membuat link baru.
            </p>
          </div>
        )
      ) : (
        <div className="py-10 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <Mic className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-slate-500 font-medium text-sm">Belum ada AI Interview</p>
          <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
            Klik "Lanjutkan ke Interview" untuk membuat link dan kode akses. Kandidat wawancara suara dengan AI secara online,
            lalu skor interview muncul di sini dan di daftar kandidat.
          </p>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> Riwayat interview ({history.length})
            {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showHistory && (
            <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((h) => {
                const isActive = shownRecord?.id === h.id;
                const tone = scoreTone(h.overall_score);
                const b = statusBadge(h.status);
                return (
                  <button
                    type="button"
                    key={h.id}
                    onClick={() => openHistoryItem(h)}
                    className={`w-full text-left p-3 flex items-center gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 ${isActive ? "bg-slate-50 dark:bg-slate-800/40" : ""}`}
                  >
                    <span className={`w-10 text-base font-semibold ${h.status === "completed" ? tone.text : "text-slate-400"}`}>
                      {h.status === "completed" ? formatInterviewScore(h.overall_score) : "-"}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-slate-700 dark:text-slate-300 truncate">{h.position}</span>
                      <span className="block text-slate-400">
                        {formatDateTime(h.completed_at ?? h.createdAt)}{h.createdBy ? ` · ${h.createdBy}` : ""}
                      </span>
                    </span>
                    <Badge variant="outline" className={`text-[10px] ${b.cls}`}>{b.label}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiInterviewPanel;

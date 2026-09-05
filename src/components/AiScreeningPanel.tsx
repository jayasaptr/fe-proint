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
  getCandidateScreening,
  runCandidateScreening,
  type ScreeningRecord,
  type ScreeningResult,
  type ScreeningSummary,
} from "@/lib/api/screening";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Clock,
  FileText,
  History,
  Loader2,
  MinusCircle,
  ScanSearch,
  Settings2,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types for the pieces of candidate data this panel needs (kept loose: the
// candidate payload is the raw Eloquent model, shapes vary per record).
// ---------------------------------------------------------------------------
export interface AiScreeningDocumentOption {
  id: number;
  label: string;
  filename?: string | null;
}

export interface AiScreeningJobOption {
  id: number;
  label: string;
  priority?: string | number | null;
}

interface AiScreeningPanelProps {
  candidateId: string | number;
  documents: AiScreeningDocumentOption[];
  jobs: AiScreeningJobOption[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SCREENABLE_EXT = /\.(pdf|docx|txt)$/i;
const CV_NAME = /\b(cv|resume|curriculum|riwayat)\b/i;

const pickDefaultDocument = (docs: AiScreeningDocumentOption[]) => {
  const readable = docs.filter((d) => SCREENABLE_EXT.test(d.filename ?? ""));
  const byName = readable.find((d) => CV_NAME.test(`${d.label} ${d.filename ?? ""}`));
  return byName ?? readable[0] ?? null;
};

const scoreTone = (score?: number | null) => {
  if (score == null) return { text: "text-slate-500", bar: "bg-slate-400", ring: "border-slate-300 dark:border-slate-700" };
  if (score >= 70) return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", ring: "border-emerald-200 dark:border-emerald-900" };
  if (score >= 50) return { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500", ring: "border-amber-200 dark:border-amber-900" };
  return { text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500", ring: "border-rose-200 dark:border-rose-900" };
};

const recommendationBadge = (rec?: string | null) => {
  const value = (rec ?? "").toLowerCase();
  if (value.includes("lanjut interview"))
    return { icon: ThumbsUp, cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900", label: "Lanjut Interview" };
  if (value.includes("pertimbangkan"))
    return { icon: MinusCircle, cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900", label: "Pertimbangkan" };
  if (value.includes("tidak lanjut"))
    return { icon: ThumbsDown, cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900", label: "Tidak Lanjut" };
  return { icon: CircleHelp, cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700", label: rec || "-" };
};

const fitStatusBadge = (status?: string | null) => {
  const value = (status ?? "").toLowerCase();
  if (value === "terpenuhi") return { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" };
  if (value === "sebagian") return { icon: MinusCircle, cls: "text-amber-600 dark:text-amber-400" };
  if (value === "tidak terpenuhi") return { icon: XCircle, cls: "text-rose-600 dark:text-rose-400" };
  return { icon: CircleHelp, cls: "text-slate-400" };
};

const sourceLabel = (source?: string | null) => {
  switch (source) {
    case "file":
      return "CV";
    case "file+profile":
    case "text+profile":
      return "CV + Data Kandidat";
    case "profile":
      return "Data Kandidat (tanpa CV)";
    default:
      return source || "-";
  }
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
};

const formatDuration = (ms?: number | null) => {
  if (!ms) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)} dtk` : `${ms} ms`;
};

const BulletList = ({
  items,
  icon: Icon,
  iconClass,
  empty,
}: {
  items?: string[];
  icon: React.ElementType;
  iconClass: string;
  empty: string;
}) => {
  if (!items || items.length === 0) {
    return <p className="text-sm text-slate-400 italic">{empty}</p>;
  }
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

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 mb-2">{children}</h4>
);

// ---------------------------------------------------------------------------
// Result view
// ---------------------------------------------------------------------------
const ScreeningResultView = ({ record }: { record: ScreeningRecord }) => {
  const result: ScreeningResult = record.result ?? {};
  const score = record.match_score ?? result.match_score ?? null;
  const tone = scoreTone(score);
  const rec = recommendationBadge(record.recommendation ?? result.recommendation);
  const RecIcon = rec.icon;
  const profile = result.profile ?? {};
  const fit = result.requirements_fit;

  return (
    <div className="space-y-6">
      {/* Score header */}
      <div className={`flex flex-col sm:flex-row gap-5 sm:items-center p-4 rounded-xl border ${tone.ring} bg-slate-50/60 dark:bg-slate-800/20`}>
        <div className="flex items-center gap-4">
          <div className="text-center min-w-[72px]">
            <div className={`text-4xl font-bold leading-none ${tone.text}`}>{score ?? "-"}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">Match Score</div>
          </div>
          <div className="h-12 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`gap-1 ${rec.cls}`}>
              <RecIcon className="w-3 h-3" /> {rec.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-slate-200 dark:border-slate-700 text-slate-500">
              Posisi: {record.position}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-slate-200 dark:border-slate-700 text-slate-500">
              Sumber: {sourceLabel(record.source)}
            </Badge>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className={`h-full ${tone.bar} transition-all`} style={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 flex flex-wrap gap-x-3">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDateTime(record.createdAt)}</span>
            {record.createdBy && <span>oleh {record.createdBy}</span>}
            {record.provider && <span>model: {record.provider}{record.model ? ` / ${record.model}` : ""}</span>}
            {formatDuration(record.duration_ms) && <span>{formatDuration(record.duration_ms)}</span>}
            {result.cv_truncated && <span className="text-amber-500">CV dipotong (terlalu panjang)</span>}
          </p>
        </div>
      </div>

      {/* Summary */}
      {result.summary && (
        <div>
          <SubHeading>Ringkasan</SubHeading>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{result.summary}</p>
        </div>
      )}

      {/* Profile grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Peran Terakhir</div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{profile.current_role || "-"}</div>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Total Pengalaman</div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {profile.total_experience_years != null ? `${profile.total_experience_years} tahun` : "-"}
          </div>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Pendidikan</div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{profile.education || "-"}</div>
        </div>
      </div>

      {(profile.key_skills?.length || profile.certifications?.length) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile.key_skills && profile.key_skills.length > 0 && (
            <div>
              <SubHeading>Keahlian Utama</SubHeading>
              <div className="flex flex-wrap gap-1.5">
                {profile.key_skills.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-normal">{s}</Badge>
                ))}
              </div>
            </div>
          )}
          {profile.certifications && profile.certifications.length > 0 && (
            <div>
              <SubHeading>Sertifikasi</SubHeading>
              <div className="flex flex-wrap gap-1.5">
                {profile.certifications.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-xs font-normal">{s}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Requirements fit */}
      {fit && fit.items && fit.items.length > 0 && (
        <div>
          <SubHeading>
            Kecocokan Persyaratan{" "}
            <span className="normal-case tracking-normal text-slate-400">— {fit.overall || "-"}</span>
          </SubHeading>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {fit.items.map((item, i) => {
              const s = fitStatusBadge(item.status);
              const SIcon = s.icon;
              return (
                <div key={i} className="p-3 flex gap-3">
                  <SIcon className={`w-4 h-4 mt-0.5 shrink-0 ${s.cls}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {item.requirement}{" "}
                      <span className={`text-xs font-normal ${s.cls}`}>({item.status})</span>
                    </div>
                    {item.evidence && <p className="text-xs text-slate-500 mt-0.5">{item.evidence}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strengths / gaps / red flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <SubHeading>Kekuatan</SubHeading>
          <BulletList items={result.strengths} icon={CheckCircle2} iconClass="text-emerald-500" empty="Tidak ada kekuatan spesifik yang tercatat." />
        </div>
        <div>
          <SubHeading>Celah terhadap Posisi</SubHeading>
          <BulletList items={result.gaps} icon={MinusCircle} iconClass="text-amber-500" empty="Tidak ada celah yang tercatat." />
        </div>
      </div>

      {result.red_flags && result.red_flags.length > 0 && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20">
          <SubHeading>Perlu Diverifikasi HR</SubHeading>
          <BulletList items={result.red_flags} icon={ShieldAlert} iconClass="text-rose-500" empty="" />
        </div>
      )}

      {result.suggested_questions && result.suggested_questions.length > 0 && (
        <div>
          <SubHeading>Saran Pertanyaan Interview</SubHeading>
          <ol className="space-y-2 list-decimal pl-5">
            {result.suggested_questions.map((q, i) => (
              <li key={i} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{q}</li>
            ))}
          </ol>
        </div>
      )}

      <p className="text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
        Hasil AI ini adalah alat bantu awal berbasis isi CV dan data yang diisi kandidat. Keputusan seleksi tetap
        berada pada tim HR. Atribut pribadi (usia, gender, agama, status pernikahan, alamat) tidak digunakan dalam penilaian.
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------
const AiScreeningPanel = ({ candidateId, documents, jobs }: AiScreeningPanelProps) => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["candidate-ai-screening", String(candidateId)], [candidateId]);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => getCandidateScreening(candidateId),
    enabled: Boolean(candidateId),
    staleTime: 60 * 1000,
  });

  const latest = data?.data?.latest ?? null;
  const history: ScreeningSummary[] = data?.data?.history ?? [];
  const aiServer = data?.data?.ai_server ?? null;

  const defaultDoc = useMemo(() => pickDefaultDocument(documents), [documents]);
  const defaultJob = useMemo(
    () => [...jobs].sort((a, b) => Number(a.priority ?? 99) - Number(b.priority ?? 99))[0] ?? null,
    [jobs],
  );

  const [showOptions, setShowOptions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [documentId, setDocumentId] = useState<string>("auto");
  const [jobId, setJobId] = useState<string>("auto");
  const [extraRequirements, setExtraRequirements] = useState("");
  const [manualPosition, setManualPosition] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [viewRecord, setViewRecord] = useState<ScreeningRecord | null>(null);

  // Elapsed-time ticker while a run is in flight (local LLM can take >1 minute).
  useEffect(() => {
    if (!isRunning) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const shownRecord = viewRecord ?? latest;
  const hasJobs = jobs.length > 0;
  const noReadableDoc = documents.length > 0 && !defaultDoc;

  const handleRun = async () => {
    if (!hasJobs && !manualPosition.trim()) {
      toast.error("Kandidat belum memiliki lamaran. Isi posisi secara manual di Opsi.");
      setShowOptions(true);
      return;
    }
    setIsRunning(true);
    try {
      const payload = {
        document_id: documentId === "auto" ? defaultDoc?.id ?? null : documentId === "none" ? null : Number(documentId),
        job_expected_id: jobId === "auto" ? defaultJob?.id ?? null : Number(jobId),
        position: manualPosition.trim() || undefined,
        requirements: extraRequirements.trim() || undefined,
      };
      const res = await runCandidateScreening(candidateId, payload);
      if (res.success && res.data) {
        toast.success(`AI Screening selesai — skor ${res.data.match_score ?? "-"}`);
        setViewRecord(null);
      } else {
        toast.error(res.message || "AI Screening gagal");
      }
      await queryClient.invalidateQueries({ queryKey });
    } catch (err: unknown) {
      const axiosMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg = axiosMessage || (err instanceof Error ? err.message : "AI Screening gagal");
      toast.error(msg);
      await queryClient.invalidateQueries({ queryKey });
    } finally {
      setIsRunning(false);
    }
  };

  const serverUnavailable = aiServer && (!aiServer.enabled || !aiServer.reachable);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            {documentId === "auto"
              ? defaultDoc ? `CV: ${defaultDoc.label}` : documents.length ? "CV tidak terbaca (bukan PDF/DOCX)" : "Tanpa CV — nilai dari data kandidat"
              : documentId === "none"
                ? "Tanpa CV — nilai dari data kandidat"
                : `CV: ${documents.find((d) => String(d.id) === documentId)?.label ?? "-"}`}
          </span>
          {aiServer && (
            <span className={`flex items-center gap-1.5 ${serverUnavailable ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${serverUnavailable ? "bg-rose-500" : "bg-emerald-500"}`} />
              AI server {serverUnavailable ? "tidak tersedia" : `siap${aiServer.default_provider ? ` (${aiServer.default_provider})` : ""}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-slate-500"
            onClick={() => setShowOptions((v) => !v)}
          >
            <Settings2 className="w-3.5 h-3.5 mr-1" /> Opsi {showOptions ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-slate-900 hover:bg-slate-700 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            onClick={handleRun}
            disabled={isRunning || Boolean(serverUnavailable)}
          >
            {isRunning ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            {isRunning ? `Menilai… ${elapsed}s` : latest ? "Jalankan Ulang" : "Jalankan AI Screening"}
          </Button>
        </div>
      </div>

      {/* Options */}
      {showOptions && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Dokumen CV</Label>
            <Select value={documentId} onValueChange={setDocumentId}>
              <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Otomatis{defaultDoc ? ` (${defaultDoc.label})` : ""}</SelectItem>
                {documents.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)} disabled={!SCREENABLE_EXT.test(d.filename ?? "")}>
                    {d.label}{d.filename ? ` — ${d.filename}` : ""}
                  </SelectItem>
                ))}
                <SelectItem value="none">Tanpa CV (hanya data kandidat)</SelectItem>
              </SelectContent>
            </Select>
            {noReadableDoc && (
              <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Hanya PDF, DOCX, dan TXT yang bisa dibaca.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Lamaran / Posisi yang dinilai</Label>
            <Select value={jobId} onValueChange={setJobId} disabled={!hasJobs}>
              <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-900"><SelectValue placeholder="Tidak ada lamaran" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Otomatis{defaultJob ? ` (${defaultJob.label})` : ""}</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={String(j.id)}>
                    {j.priority != null ? `Pri ${j.priority} — ` : ""}{j.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Posisi manual (opsional, menimpa nama posisi lamaran)</Label>
            <input
              value={manualPosition}
              onChange={(e) => setManualPosition(e.target.value)}
              maxLength={200}
              placeholder="mis. Officer - Recruitment"
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
              placeholder="Satu persyaratan per baris. Kosongkan untuk memakai spesifikasi vacancy dari sistem."
              className="text-sm bg-white dark:bg-slate-900"
            />
          </div>
        </div>
      )}

      {/* Body */}
      {isLoading ? (
        <div className="py-10 flex items-center justify-center text-slate-400 text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat hasil screening…
        </div>
      ) : error ? (
        <div className="py-6 text-center text-sm text-rose-500">Gagal memuat hasil AI Screening.</div>
      ) : isRunning && !shownRecord ? (
        <div className="py-10 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-slate-400 mb-2" />
          <p className="text-slate-500 text-sm">AI sedang membaca CV dan data kandidat… ({elapsed}s)</p>
          <p className="text-slate-400 text-xs mt-1">Dengan model lokal proses bisa memakan 1–2 menit.</p>
        </div>
      ) : shownRecord ? (
        shownRecord.status === "failed" ? (
          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-sm text-rose-700 dark:text-rose-300 flex gap-2">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Screening terakhir gagal</div>
              <div className="text-xs mt-0.5 break-words">{shownRecord.error_message || "Tidak ada detail kesalahan."}</div>
              <div className="text-[11px] text-rose-400 mt-1">{formatDateTime(shownRecord.createdAt)}</div>
            </div>
          </div>
        ) : (
          <ScreeningResultView record={shownRecord} />
        )
      ) : (
        <div className="py-10 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <ScanSearch className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-slate-500 font-medium text-sm">Belum ada hasil AI Screening</p>
          <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
            AI akan membaca CV dan data kandidat (pengalaman, pendidikan, jawaban kuesioner) lalu menilai kecocokan dengan posisi yang dilamar.
          </p>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5"
          >
            <History className="w-3.5 h-3.5" /> Riwayat screening ({history.length})
            {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showHistory && (
            <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((h) => {
                const isActive = shownRecord?.id === h.id;
                const tone = scoreTone(h.match_score);
                return (
                  <button
                    type="button"
                    key={h.id}
                    onClick={async () => {
                      if (latest && h.id === latest.id) {
                        setViewRecord(null);
                        return;
                      }
                      try {
                        const { getCandidateScreeningDetail } = await import("@/lib/api/screening");
                        const res = await getCandidateScreeningDetail(candidateId, h.id);
                        setViewRecord(res.data);
                      } catch {
                        toast.error("Gagal memuat detail riwayat");
                      }
                    }}
                    className={`w-full text-left p-3 flex items-center gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 ${isActive ? "bg-slate-50 dark:bg-slate-800/40" : ""}`}
                  >
                    <span className={`w-10 text-base font-semibold ${h.status === "failed" ? "text-rose-500" : tone.text}`}>
                      {h.status === "failed" ? "!" : h.match_score ?? "-"}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-slate-700 dark:text-slate-300 truncate">{h.position}</span>
                      <span className="block text-slate-400">
                        {formatDateTime(h.createdAt)}{h.createdBy ? ` · ${h.createdBy}` : ""}{h.provider ? ` · ${h.provider}` : ""}
                      </span>
                    </span>
                    <span className="text-slate-400">{h.status === "failed" ? "gagal" : h.recommendation || "-"}</span>
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

export default AiScreeningPanel;

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InterviewSummary } from "@/lib/api/interview";
import { cn } from "@/lib/utils";
import { AlertTriangle, Clock, Mic, MicOff, Radio } from "lucide-react";

interface InterviewScoreChipProps {
  /** Undangan/interview terbaru apa pun statusnya. */
  latest?: InterviewSummary | null;
  /** Interview selesai terbaru (sumber skor). */
  latestCompleted?: InterviewSummary | null;
  onClick?: () => void;
  className?: string;
}

const scoreClasses = (score?: number | null) => {
  if (score == null) return "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400";
  if (score >= 7) return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (score >= 5) return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
  return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300";
};

export const interviewRecommendationLabel = (rec?: string | null) => {
  const v = (rec ?? "").toLowerCase();
  if (v.includes("tidak lanjut")) return "Tidak Lanjut";
  if (v.includes("pertimbangkan")) return "Pertimbangkan";
  if (v.includes("lanjut")) return "Lanjut";
  return rec || "";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
};

export const formatInterviewScore = (score?: number | null) =>
  score == null ? "-" : Number.isInteger(score) ? String(score) : score.toFixed(1);

/**
 * Chip skor AI Interview untuk baris tabel kandidat: diundang / berlangsung / skor + rekomendasi /
 * gagal / belum diundang.
 */
const InterviewScoreChip = ({ latest, latestCompleted, onClick, className }: InterviewScoreChipProps) => {
  const base = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all";
  const clickable = onClick ? "hover:brightness-95 cursor-pointer" : "";

  if (latest?.status === "in_progress") {
    return (
      <button type="button" onClick={onClick} className={cn(base, "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300", clickable, className)}>
        <Radio className="w-3.5 h-3.5 animate-pulse" /> Interview berlangsung
      </button>
    );
  }

  if (latest?.status === "invited") {
    return (
      <button type="button" onClick={onClick} className={cn(base, "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300", clickable, className)}>
        <Clock className="w-3.5 h-3.5" /> Diundang interview
      </button>
    );
  }

  if (!latestCompleted) {
    return (
      <div className="flex flex-col gap-1">
        <button type="button" onClick={onClick} className={cn(base, scoreClasses(null), clickable, className)}>
          <MicOff className="w-3.5 h-3.5" /> Belum interview
        </button>
        {latest?.status === "failed" && (
          <span className="flex items-center gap-1 text-[11px] text-rose-500 max-w-[200px] truncate" title={latest.error_message ?? ""}>
            <AlertTriangle className="w-3 h-3 shrink-0" /> Laporan gagal
          </span>
        )}
        {latest?.status === "expired" && (
          <span className="text-[11px] text-slate-400">Link kedaluwarsa</span>
        )}
      </div>
    );
  }

  const score = latestCompleted.overall_score ?? null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={onClick} className={cn(base, scoreClasses(score), clickable, className)}>
            <Mic className="w-3.5 h-3.5" />
            <span className="text-sm font-bold leading-none">{formatInterviewScore(score)}</span>
            <span className="opacity-60 text-[10px] leading-none">/10</span>
            <span className="font-medium opacity-80">{interviewRecommendationLabel(latestCompleted.recommendation)}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[260px]">
          <div className="font-semibold">{latestCompleted.position}</div>
          <div className="text-slate-300 dark:text-slate-600">
            {formatDateTime(latestCompleted.completed_at)} · {latestCompleted.question_count} pertanyaan
            {latestCompleted.provider ? ` · ${latestCompleted.provider}` : ""}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default InterviewScoreChip;

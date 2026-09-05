import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ScreeningSummary } from "@/lib/api/screening";
import { AlertTriangle, Clock, Loader2, Sparkles } from "lucide-react";

interface AiScoreChipProps {
  /** Screening terbaru apa pun statusnya (queued/running/done/failed). */
  latest?: ScreeningSummary | null;
  /** Screening selesai terbaru (sumber skor). */
  latestDone?: ScreeningSummary | null;
  onClick?: () => void;
  className?: string;
}

const scoreClasses = (score?: number | null) => {
  if (score == null) return "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400";
  if (score >= 70) return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (score >= 50) return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
  return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300";
};

const recommendationLabel = (rec?: string | null) => {
  const v = (rec ?? "").toLowerCase();
  if (v.includes("lanjut interview")) return "Lanjut Interview";
  if (v.includes("pertimbangkan")) return "Pertimbangkan";
  if (v.includes("tidak lanjut")) return "Tidak Lanjut";
  return rec || "";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
};

/**
 * Chip skor AI Screening untuk baris tabel kandidat. Menampilkan antrean/proses bila ada
 * screening yang belum selesai, skor + rekomendasi bila sudah ada hasil, atau "-" bila belum.
 */
const AiScoreChip = ({ latest, latestDone, onClick, className }: AiScoreChipProps) => {
  const pending = latest?.status === "queued" || latest?.status === "running";
  const failedAfterDone = latest?.status === "failed" && (!latestDone || latest.id !== latestDone.id);

  const base = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all";

  if (pending) {
    return (
      <span className={cn(base, "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300", className)}>
        {latest?.status === "running" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
        {latest?.status === "running" ? "Menilai…" : "Antrean"}
      </span>
    );
  }

  if (!latestDone) {
    return (
      <div className="flex flex-col gap-1">
        <span className={cn(base, scoreClasses(null), className)}>
          <Sparkles className="w-3.5 h-3.5" /> Belum di-screening
        </span>
        {latest?.status === "failed" && (
          <span className="flex items-center gap-1 text-[11px] text-rose-500 max-w-[200px] truncate" title={latest.error_message ?? ""}>
            <AlertTriangle className="w-3 h-3 shrink-0" /> Gagal
          </span>
        )}
      </div>
    );
  }

  const score = latestDone.match_score ?? null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className={cn(base, scoreClasses(score), onClick && "hover:brightness-95 cursor-pointer", className)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-sm font-bold leading-none">{score ?? "-"}</span>
            <span className="font-medium opacity-80">{recommendationLabel(latestDone.recommendation)}</span>
            {failedAfterDone && <AlertTriangle className="w-3 h-3 text-rose-500" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[260px]">
          <div className="font-semibold">{latestDone.position}</div>
          <div className="text-slate-300 dark:text-slate-600">
            {formatDateTime(latestDone.createdAt)}
            {latestDone.createdBy ? ` · ${latestDone.createdBy}` : ""}
            {latestDone.provider ? ` · ${latestDone.provider}` : ""}
          </div>
          {failedAfterDone && (
            <div className="mt-1 text-rose-300">Screening terakhir gagal: {latest?.error_message || "-"}</div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AiScoreChip;

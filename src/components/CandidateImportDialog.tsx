import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  downloadCandidateImportTemplate,
  importCandidates,
  type CandidateImportData,
} from "@/lib/api/candidates";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";
import React, { useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_EXTENSIONS = [".xlsx", ".xls"];

interface CandidateImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful import so the parent can refetch the list. */
  onImported?: () => void;
}

const CandidateImportDialog: React.FC<CandidateImportDialogProps> = ({
  open,
  onOpenChange,
  onImported,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CandidateImportData | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setResult(null);
    setFileError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDialogChange = (next: boolean) => {
    if (!next && uploading) return; // Don't close mid-upload
    if (!next) resetState();
    onOpenChange(next);
  };

  const validateFile = (candidate: File): string | null => {
    const name = candidate.name.toLowerCase();
    const hasValidExt = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
    if (!hasValidExt) {
      return "Format file harus .xlsx atau .xls.";
    }
    if (candidate.size > MAX_FILE_SIZE) {
      return "Ukuran file melebihi 10 MB.";
    }
    return null;
  };

  const handleSelectFile = (selected: File | null) => {
    setResult(null);
    if (!selected) {
      setFile(null);
      setFileError(null);
      return;
    }
    const error = validateFile(selected);
    if (error) {
      setFile(null);
      setFileError(error);
      return;
    }
    setFileError(null);
    setFile(selected);
  };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      await downloadCandidateImportTemplate();
      toast.success("Template berhasil diunduh");
    } catch {
      toast.error("Gagal mengunduh template");
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const res = await importCandidates(file);
      setResult(res.data);
      if (res.data.imported > 0) {
        toast.success(res.message || `${res.data.imported} kandidat diimpor`);
        onImported?.();
      } else {
        toast.warning(res.message || "Tidak ada baris yang berhasil diimpor");
      }
    } catch (err: any) {
      const data = err?.response?.data;
      // 422 = file validation error (data is a field -> messages map)
      const fileErr = data?.data?.file?.[0];
      toast.error(fileErr ?? data?.message ?? "Gagal memproses file");
    } finally {
      setUploading(false);
    }
  };

  const failedRows =
    result?.rows.filter((r) => r.status === "failed") ?? [];
  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Import Candidate via Excel</DialogTitle>
              <DialogDescription>
                Unduh template, isi datanya, lalu unggah untuk mengimpor
                kandidat secara massal.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Step 1: Download template */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                1. Unduh Template
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Template berisi dropdown (provinsi, kota, dll) dari database.
              </span>
            </div>
            <Button
              variant="outline"
              onClick={handleDownloadTemplate}
              disabled={downloading}
              className="h-10 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 dark:hover:bg-slate-700 shadow-sm"
            >
              {downloading ? (
                <span className="flex items-center">
                  <span className="animate-spin mr-2 w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full" />
                  Mengunduh...
                </span>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" /> Download Template
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Step 2: Upload file */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-4">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              2. Unggah File Terisi
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Format .xlsx / .xls, maksimal 10 MB.
            </span>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-100 file:text-orange-700 dark:file:bg-orange-500/20 dark:file:text-orange-400 hover:file:bg-orange-200 dark:hover:file:bg-orange-500/30 file:cursor-pointer cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            onChange={(e) => handleSelectFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />

          {fileError && (
            <div className="flex items-center gap-2 text-xs font-medium text-red-600 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {fileError}
            </div>
          )}

          {file && !fileError && (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">{file.name}</span>
              <span className="text-slate-400">({formatSize(file.size)})</span>
              <button
                type="button"
                onClick={() => handleSelectFile(null)}
                disabled={uploading}
                className="ml-1 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition-colors"
                title="Hapus file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="h-10 bg-orange-500 hover:bg-orange-600 text-white font-medium px-6 shadow-sm"
            >
              {uploading ? (
                <span className="flex items-center">
                  <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Mengimpor...
                </span>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" /> Upload & Import
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Result summary */}
        {result && (
          <div className="flex flex-col gap-3">
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border p-4",
                result.failed > 0
                  ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20"
                  : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20",
              )}
            >
              {result.failed > 0 ? (
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              )}
              <div className="text-sm">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {result.total} baris diproses
                </span>{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {result.imported} berhasil
                </span>
                {result.failed > 0 && (
                  <>
                    {" · "}
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      {result.failed} gagal
                    </span>
                  </>
                )}
              </div>
            </div>

            {failedRows.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                      <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-2.5 w-20">Baris</th>
                        <th className="px-4 py-2.5">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {failedRows.map((r) => (
                        <tr key={r.row}>
                          <td className="px-4 py-2.5 align-top font-mono font-medium text-slate-600 dark:text-slate-300">
                            {r.row}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                            {r.errors &&
                              Object.entries(r.errors).map(([field, msgs]) => (
                                <div key={field} className="text-xs">
                                  <span className="font-semibold text-red-600 dark:text-red-400">
                                    {field}:
                                  </span>{" "}
                                  {msgs.join(", ")}
                                </div>
                              ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Perbaiki baris yang gagal pada file Excel, lalu unggah ulang.
              Baris yang sudah berhasil tidak akan terduplikasi.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CandidateImportDialog;

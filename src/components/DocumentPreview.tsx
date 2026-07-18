import { Button } from "@/components/ui/button";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import { renderAsync as renderDocx } from "docx-preview";
import { Download, FileText, Loader2 } from "lucide-react";
import { version as pdfjsVersion } from "pdfjs-dist";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import * as XLSX from "xlsx";

// Derive the worker URL from the installed pdfjs-dist version so the worker
// can never drift out of sync with the version @react-pdf-viewer bundles.
// A hardcoded version breaks whenever the resolved pdfjs-dist changes.
const PDFJS_WORKER_URL = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.js`;

type DocumentKind =
  | "pdf"
  | "image"
  | "docx"
  | "xlsx"
  | "text"
  | "video"
  | "audio"
  | "unsupported";

interface DocumentPreviewProps {
  blob: Blob;
  blobUrl: string;
  mimeType?: string | null;
  fileName?: string | null;
  onDownload?: () => void;
}

const TEXT_EXTENSIONS = new Set([
  "txt",
  "csv",
  "tsv",
  "json",
  "md",
  "log",
  "xml",
  "yml",
  "yaml",
]);

const getExtension = (fileName?: string | null) => {
  if (!fileName) return "";
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "";
  return fileName.slice(dot + 1).toLowerCase();
};

const detectKind = (
  mime?: string | null,
  fileName?: string | null,
): DocumentKind => {
  const m = (mime || "").toLowerCase();
  const ext = getExtension(fileName);

  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (m.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext))
    return "image";
  if (
    m === "application/msword" ||
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "doc" ||
    ext === "docx"
  )
    return "docx";
  if (
    m === "application/vnd.ms-excel" ||
    m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ext === "xls" ||
    ext === "xlsx"
  )
    return "xlsx";
  if (m.startsWith("text/") || TEXT_EXTENSIONS.has(ext)) return "text";
  if (m.startsWith("video/") || ["mp4", "webm", "ogv", "mov"].includes(ext))
    return "video";
  if (m.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a"].includes(ext))
    return "audio";

  return "unsupported";
};

const previewContainerStyle: CSSProperties = {
  width: "100%",
  height: "100%",
};

const PdfPreview = ({ blobUrl }: { blobUrl: string }) => {
  const layout = defaultLayoutPlugin();
  return (
    <div style={previewContainerStyle} className="bg-white">
      <Worker workerUrl={PDFJS_WORKER_URL}>
        <Viewer fileUrl={blobUrl} plugins={[layout]} />
      </Worker>
    </div>
  );
};

const ImagePreview = ({
  blobUrl,
  fileName,
}: {
  blobUrl: string;
  fileName?: string | null;
}) => (
  <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
    <img
      src={blobUrl}
      alt={fileName ?? "Document preview"}
      className="max-w-full max-h-full object-contain"
    />
  </div>
);

const DocxPreview = ({ blob }: { blob: Blob }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const target = containerRef.current;
    if (!target) return;

    target.innerHTML = "";
    setIsLoading(true);
    setError(null);

    renderDocx(blob, target, undefined, {
      className: "docx-preview-content",
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
    })
      .then(() => {
        if (!cancelled) setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to render DOCX");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (target) target.innerHTML = "";
    };
  }, [blob]);

  return (
    <div className="w-full h-full overflow-auto bg-slate-200 dark:bg-slate-800 p-6">
      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-slate-500 py-12">
          <Loader2 className="w-4 h-4 animate-spin" /> Rendering document…
        </div>
      )}
      {error && (
        <div className="text-center text-sm text-red-500 py-12">{error}</div>
      )}
      <div ref={containerRef} className="docx-preview-host" />
    </div>
  );
};

const XlsxPreview = ({ blob }: { blob: Blob }) => {
  const [sheets, setSheets] = useState<{ name: string; html: string }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    blob
      .arrayBuffer()
      .then((buffer) => {
        const workbook = XLSX.read(buffer, { type: "array" });
        const rendered = workbook.SheetNames.map((name) => ({
          name,
          html: XLSX.utils.sheet_to_html(workbook.Sheets[name], {
            id: `sheet-${name}`,
          }),
        }));
        if (cancelled) return;
        setSheets(rendered);
        setActiveSheet(0);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to read sheet");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-500 py-12">
        <Loader2 className="w-4 h-4 animate-spin" /> Reading spreadsheet…
      </div>
    );
  }
  if (error) {
    return <div className="text-center text-sm text-red-500 py-12">{error}</div>;
  }

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-slate-900">
      {sheets.length > 1 && (
        <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          {sheets.map((s, i) => (
            <button
              type="button"
              key={s.name}
              onClick={() => setActiveSheet(i)}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${
                i === activeSheet
                  ? "bg-orange-500 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div
        className="flex-1 overflow-auto p-4 xlsx-preview-host text-sm [&_table]:border-collapse [&_table]:w-full [&_th]:bg-slate-100 [&_th]:dark:bg-slate-800 [&_th]:px-2 [&_th]:py-1 [&_th]:border [&_th]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-slate-200 [&_td]:dark:border-slate-700"
        dangerouslySetInnerHTML={{
          __html: sheets[activeSheet]?.html ?? "",
        }}
      />
    </div>
  );
};

const TextPreview = ({ blob }: { blob: Blob }) => {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    blob
      .text()
      .then((t) => {
        if (!cancelled) setText(t);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to read text");
      });
    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (error) {
    return <div className="text-center text-sm text-red-500 py-12">{error}</div>;
  }
  if (text === null) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-500 py-12">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <pre className="w-full h-full overflow-auto p-4 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap wrap-break-word">
      {text}
    </pre>
  );
};

const MediaPreview = ({
  blobUrl,
  kind,
}: {
  blobUrl: string;
  kind: "video" | "audio";
}) => (
  <div className="w-full h-full flex items-center justify-center bg-black/90 p-4">
    {kind === "video" ? (
      <video src={blobUrl} controls className="max-w-full max-h-full" />
    ) : (
      <audio src={blobUrl} controls className="w-full max-w-md" />
    )}
  </div>
);

const UnsupportedPreview = ({
  mimeType,
  onDownload,
}: {
  mimeType?: string | null;
  onDownload?: () => void;
}) => (
  <div className="flex flex-col items-center gap-4 text-center px-6 py-12">
    <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full">
      <FileText className="w-8 h-8 text-slate-400" />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Tipe file ini tidak bisa di-preview
      </p>
      <p className="text-xs text-slate-500 mt-1">
        {mimeType || "Unknown type"} · Silakan download untuk membuka file.
      </p>
    </div>
    {onDownload && (
      <Button size="sm" onClick={onDownload}>
        <Download className="w-4 h-4 mr-2" /> Download File
      </Button>
    )}
  </div>
);

const DocumentPreview = ({
  blob,
  blobUrl,
  mimeType,
  fileName,
  onDownload,
}: DocumentPreviewProps) => {
  const kind = detectKind(mimeType, fileName);

  switch (kind) {
    case "pdf":
      return <PdfPreview blobUrl={blobUrl} />;
    case "image":
      return <ImagePreview blobUrl={blobUrl} fileName={fileName} />;
    case "docx":
      return <DocxPreview blob={blob} />;
    case "xlsx":
      return <XlsxPreview blob={blob} />;
    case "text":
      return <TextPreview blob={blob} />;
    case "video":
    case "audio":
      return <MediaPreview blobUrl={blobUrl} kind={kind} />;
    default:
      return (
        <UnsupportedPreview mimeType={mimeType} onDownload={onDownload} />
      );
  }
};

export default DocumentPreview;

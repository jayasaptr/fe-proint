import AiInterviewPanel from "@/components/AiInterviewPanel";
import AiScreeningPanel from "@/components/AiScreeningPanel";
import CandidateEditModal from "@/components/CandidateEditModal";
import DocumentPreview from "@/components/DocumentPreview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteCandidateDocument,
  downloadCandidateDocument,
  getCandidateById,
  getCandidates,
  postApplyToSqlServer,
  previewCandidateDocument,
  previewCandidatePhoto,
  toggleCandidateChecklist,
  toggleCandidatePassed,
  uploadCandidateDocuments,
  uploadCandidatePhoto,
  type CandidateDetailResponse,
  type CandidateFilters,
  type UpdateCandidateResponse,
} from "@/lib/api/candidates";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  BriefcaseBusiness,
  Building2,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  FileCheck,
  FileText,
  Fingerprint,
  GraduationCap,
  Languages,
  Loader2,
  Mail,
  MapPin,
  Mic,
  MoreHorizontal,
  Pencil,
  Phone,
  Printer,
  RefreshCw,
  ScanSearch,
  Share2,
  Trash2,
  Trophy,
  Upload,
  User,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  FTAP_INTERVIEW_LOCATION_NOTE,
  formatToeflScore,
  getToeflType,
} from "@/lib/constants/ftap";

// --- Formatter Helpers ---
const formatGender = (value?: string | null) => {
  if (!value) return "-";
  if (value === "M") return "Male";
  if (value === "F") return "Female";
  return value;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const normalized = value.replace("T", " ");
  return normalized.split(" ")[0] || value;
};

// Umur dari tanggal lahir, dihitung saat halaman dirender (tahun penuh, dikoreksi bulan/hari).
const calculateAge = (value?: string | null): number | null => {
  if (!value) return null;
  const dob = new Date(formatDate(value) + "T00:00:00");
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 120 ? age : null;
};

/** Konteks navigasi yang dikirim CandidatesPage lewat location.state saat membuka detail. */
interface ListNavState {
  from?: string;
  ids?: number[];
  page?: number;
  totalPages?: number;
  filters?: CandidateFilters;
  storagePrefix?: string;
}

const formatCurrency = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return "-";
  const amount = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(amount)) return String(value);
  return `Rp ${amount.toLocaleString("id-ID")}`;
};

const formatAvailability = (value?: string | null) => {
  if (!value) return "-";
  if (value === "I") return "Immediate";
  return value;
};

// --- Extractors & Helpers ---
const decodeHtml = (html: string) => {
  if (!html) return "";
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
};

const getJobExpectedName = (item: any) =>
  item?.vacant_position?.VacantPositionName ||
  item?.vacancy_information?.vacant_position?.name ||
  item?.vacancy_information?.vacant_position?.VacantPositionName ||
  item?.position?.PosName ||
  item?.vacancy_information?.position?.name ||
  item?.vacancy_information?.position?.PosName ||
  item?.OtherPosName ||
  item?.job_title?.name ||
  item?.OtherJobTtlName ||
  "-";

const getJobExpectedCode = (item: any) =>
  item?.vacant_position?.VacantPosCode ||
  item?.vacancy_information?.vacant_position?.code ||
  item?.position?.PosCode ||
  item?.vacancy_information?.position?.code ||
  "-";

const getJobExpectedOrganization = (item: any) =>
  item?.vacant_position?.organization_recruitment?.OrgRecName ||
  item?.vacant_position?.organization_recruitment?.name ||
  item?.vacancy_information?.organization_recruitment?.OrgRecName ||
  item?.vacancy_information?.organization_recruitment?.name ||
  "-";

// --- Reusable Components (Minimal Style) ---
const InfoRow = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: any;
  highlight?: boolean;
}) => (
  <div className="flex justify-between items-start py-3 border-b border-slate-100 dark:border-slate-800/60 last:border-0 gap-4">
    <span className="text-sm text-slate-500 min-w-[30%]">{label}</span>
    <span
      className={`text-sm text-right break-words ${highlight ? "font-medium text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}
    >
      {value || "-"}
    </span>
  </div>
);

const SectionBlock = ({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <div className="mb-8">
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-2 px-1">
        <Icon className="w-4 h-4 text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
      </div>
      {action && <div>{action}</div>}
    </div>
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  </div>
);

// --- Main Component ---
const CandidateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isPhotoError, setIsPhotoError] = useState(false);
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<
    number | null
  >(null);
  const [previewingDocumentId, setPreviewingDocumentId] = useState<
    number | null
  >(null);
  const [previewState, setPreviewState] = useState<{
    open: boolean;
    url: string | null;
    blob: Blob | null;
    mimeType: string | null;
    fileName: string | null;
  }>({
    open: false,
    url: null,
    blob: null,
    mimeType: null,
    fileName: null,
  });
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [needsSqlServerResync, setNeedsSqlServerResync] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const detailQueryKey = useMemo(() => ["candidate-detail", id], [id]);

  const { data, isLoading, error } = useQuery({
    queryKey: detailQueryKey,
    queryFn: () => getCandidateById(id as string),
    enabled: Boolean(id),
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (error) {
      const err = error as any;
      toast.error(
        err?.response?.data?.message || "Failed to fetch candidate detail",
      );
    }
  }, [error]);

  const candidate = data?.success ? data.data : null;

  // Tujuan tombol Back: list asal (dikirim lewat location.state.from oleh CandidatesPage);
  // bila dibuka langsung lewat URL, kandidat FTAP kembali ke list FTAP, lainnya ke list umum.
  const location = useLocation();
  const navState = (location.state as ListNavState | null) ?? null;
  const originList = navState?.from;
  const isFromFtap = originList ? originList === "ftap" : Boolean(candidate?.ftap);
  const backPath = isFromFtap ? "/admin/candidates/ftap" : "/admin/candidates";
  const backLabel = isFromFtap ? "Back to FTAP Candidates" : "Back to Candidates";

  // ---- Prev / Next kandidat mengikuti urutan & filter list asal ----
  const currentId = Number(id);
  const navIds = navState?.ids ?? [];
  const navIndex = navIds.indexOf(currentId);
  const navPage = navState?.page ?? 1;
  const navTotalPages = navState?.totalPages ?? 1;
  const hasNavContext = navIndex !== -1;
  const hasPrev = hasNavContext && (navIndex > 0 || navPage > 1);
  const hasNext =
    hasNavContext && (navIndex < navIds.length - 1 || navPage < navTotalPages);
  const [isNavigating, setIsNavigating] = useState<"prev" | "next" | null>(null);

  const goToSibling = async (direction: "prev" | "next") => {
    if (!navState || !hasNavContext || isNavigating) return;
    setIsNavigating(direction);
    try {
      let targetId: number | undefined;
      let nextState: ListNavState = navState;

      if (direction === "prev" && navIndex > 0) {
        targetId = navIds[navIndex - 1];
      } else if (direction === "next" && navIndex < navIds.length - 1) {
        targetId = navIds[navIndex + 1];
      } else {
        // Ujung halaman: ambil halaman list sebelum/berikutnya dengan filter yang sama.
        const targetPage = direction === "prev" ? navPage - 1 : navPage + 1;
        const res = await getCandidates({ ...(navState.filters ?? {}), page: targetPage });
        const rows = res.success ? res.data?.data ?? [] : [];
        const ids = rows.map((c) => Number(c.CanId));
        if (ids.length === 0) {
          toast.info("Tidak ada kandidat lain pada arah tersebut.");
          return;
        }
        targetId = direction === "prev" ? ids[ids.length - 1] : ids[0];
        nextState = {
          ...navState,
          ids,
          page: targetPage,
          totalPages: Math.max(1, res.data?.last_page || navTotalPages),
        };
        // Sinkronkan halaman list yang tersimpan agar tombol Back mendarat di halaman yang sama.
        if (navState.storagePrefix) {
          try {
            sessionStorage.setItem(`${navState.storagePrefix}_page`, JSON.stringify(targetPage));
          } catch {
            /* sessionStorage tidak tersedia; abaikan */
          }
        }
      }

      if (targetId !== undefined) {
        navigate(`/admin/candidates/${targetId}`, { state: nextState });
      }
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || "Gagal memuat kandidat berikutnya");
    } finally {
      setIsNavigating(null);
    }
  };

  // ---- Checked & Lolos Seleksi dari halaman detail (logika sama dengan list) ----
  const [isTogglingChecked, setIsTogglingChecked] = useState(false);
  const [isTogglingPassed, setIsTogglingPassed] = useState(false);
  const [isPassedDialogOpen, setIsPassedDialogOpen] = useState(false);
  const [passedNoteInput, setPassedNoteInput] = useState("");

  const patchDetailCache = (patch: Partial<CandidateDetailResponse["data"]>) => {
    queryClient.setQueryData<CandidateDetailResponse>(detailQueryKey, (previous) =>
      previous
        ? { ...previous, data: { ...previous.data, ...patch } }
        : previous,
    );
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
  };

  const handleToggleChecked = async () => {
    if (!candidate || isTogglingChecked) return;
    setIsTogglingChecked(true);
    try {
      const res = await toggleCandidateChecklist(candidate.CanId);
      if (res.success) {
        toast.success(res.message);
        patchDetailCache({
          is_checked: res.data.is_checked,
          checked_at: res.data.checked_at,
          checked_by: res.data.checked_by,
        });
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || "Failed to update checklist");
    } finally {
      setIsTogglingChecked(false);
    }
  };

  const callTogglePassed = async (note?: string) => {
    if (!candidate) return;
    setIsTogglingPassed(true);
    try {
      const res = await toggleCandidatePassed(candidate.CanId, note);
      if (res.success) {
        toast.success(res.message);
        patchDetailCache({
          is_passed: res.data.is_passed,
          passed_at: res.data.passed_at,
          passed_by: res.data.passed_by,
          passed_note: res.data.passed_note,
        });
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      const e = err as {
        response?: { data?: { message?: string; errors?: { note?: string[] } } };
      };
      toast.error(
        e?.response?.data?.message ||
          e?.response?.data?.errors?.note?.[0] ||
          "Failed to update selection-passed status",
      );
    } finally {
      setIsTogglingPassed(false);
    }
  };

  const handlePassedClick = () => {
    if (!candidate) return;
    if (candidate.is_passed) {
      const ok = window.confirm(
        `Cabut tanda lolos untuk "${candidate.CanName}"? Catatan yang tersimpan akan ikut terhapus.`,
      );
      if (!ok) return;
      callTogglePassed();
    } else {
      setPassedNoteInput("");
      setIsPassedDialogOpen(true);
    }
  };

  const handleConfirmMarkPassed = async () => {
    const note = passedNoteInput;
    setIsPassedDialogOpen(false);
    setPassedNoteInput("");
    await callTogglePassed(note);
  };

  const mainAddress = candidate?.addresses?.[0];
  const education = candidate?.education || [];
  const experiences =
    Array.isArray(candidate?.experiences) && candidate.experiences.length > 0
      ? candidate.experiences
      : (candidate?.work_experiences ?? []);
  const identities =
    Array.isArray(candidate?.id_cards) && candidate.id_cards.length > 0
      ? candidate.id_cards
      : Array.isArray(candidate?.identities) && candidate.identities.length > 0
        ? candidate.identities
        : (candidate?.cards ?? []);
  const documents = candidate?.documents || [];
  const jobExpected = candidate?.job_expected || [];
  const skills = candidate?.skills || [];
  const languages = candidate?.languages || [];

  // Default photo record (FgDefault = 'Y', fallback to the first one).
  const defaultPhoto = useMemo(() => {
    if (!candidate?.photos || candidate.photos.length === 0) return null;
    return (
      candidate.photos.find(
        (photo: any) => photo.FgDefault?.toUpperCase() === "Y",
      ) || candidate.photos[0]
    );
  }, [candidate?.photos]);

  // Legacy responses embedded the image as base64. New responses only expose
  // photo_url (asset service, needs the service key) and has_photo, so the
  // image must be streamed through the authenticated preview endpoint.
  const legacyPhotoSource = useMemo(() => {
    const rawPhoto = defaultPhoto?.can_photo_base64?.replace(/\s+/g, "");
    if (!rawPhoto) return null;
    return rawPhoto.startsWith("data:image")
      ? rawPhoto
      : `data:image/jpeg;base64,${rawPhoto}`;
  }, [defaultPhoto?.can_photo_base64]);

  const [photoSource, setPhotoSource] = useState<string | null>(null);

  useEffect(() => {
    if (legacyPhotoSource) {
      setPhotoSource(legacyPhotoSource);
      return;
    }

    const photoId = defaultPhoto?.CanPhotoId;
    if (
      !candidate?.CanId ||
      photoId === undefined ||
      photoId === null ||
      defaultPhoto?.has_photo === false
    ) {
      setPhotoSource(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    previewCandidatePhoto(candidate.CanId, photoId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoSource(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setPhotoSource(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    candidate?.CanId,
    defaultPhoto?.CanPhotoId,
    defaultPhoto?.has_photo,
    legacyPhotoSource,
  ]);

  const expectedSalaryFromQuestions = useMemo(() => {
    // Get first experience with questions
    const firstExperience = experiences?.[0];
    if (
      !firstExperience ||
      !Array.isArray(firstExperience.questions) ||
      firstExperience.questions.length === 0
    )
      return null;

    // Find question related to salary expectation (containing "ekspektasi")
    const questions = firstExperience.questions;
    const salaryQuestion =
      questions.find((q: any) =>
        q.question?.QuestName?.toLowerCase().includes("ekspektasi"),
      ) || questions[questions.length - 1];

    if (!salaryQuestion) return null;

    // Return numeric value if available, otherwise text answer
    return salaryQuestion.QAnsNumeric || salaryQuestion.QuestAnswer || null;
  }, [experiences]);

  useEffect(() => setIsPhotoError(false), [photoSource]);

  const closePreview = () => {
    setPreviewState((prev) => {
      if (prev.url) window.URL.revokeObjectURL(prev.url);
      return {
        open: false,
        url: null,
        blob: null,
        mimeType: null,
        fileName: null,
      };
    });
  };

  useEffect(() => {
    return () => {
      if (previewState.url) window.URL.revokeObjectURL(previewState.url);
    };
  }, [previewState.url]);

  const handlePreviewDocument = async (
    docId?: number,
    fileName?: string | null,
    fallbackMime?: string | null,
  ) => {
    if (!candidate || !docId) {
      toast.error("Dokumen tidak valid untuk dibuka.");
      return;
    }

    try {
      setPreviewingDocumentId(docId);
      const { blob, mimeType, filename } = await previewCandidateDocument(
        candidate.CanId,
        docId,
      );
      const url = window.URL.createObjectURL(blob);
      const resolvedMime = mimeType || fallbackMime || blob.type || null;

      setPreviewState({
        open: true,
        url,
        blob,
        mimeType: resolvedMime,
        fileName: filename || fileName || `document-${docId}`,
      });
    } catch (previewError) {
      const err = previewError as any;
      toast.error(
        err?.response?.data?.message || "Gagal membuka preview dokumen.",
      );
    } finally {
      setPreviewingDocumentId(null);
    }
  };

  const handleDownloadDocument = async (
    docId?: number,
    fileName?: string | null,
    dataUrl?: string | null,
  ) => {
    if (!candidate || !docId)
      return toast.error("Dokumen tidak valid untuk diunduh.");
    const safeFileName = fileName || `document-${docId}`;

    if (dataUrl) {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = safeFileName;
      link.click();
      return;
    }

    try {
      setDownloadingDocumentId(docId);
      const blob = await downloadCandidateDocument(candidate.CanId, docId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safeFileName;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Berhasil download ${safeFileName}`);
    } catch (downloadError) {
      toast.error(`Gagal download ${safeFileName}`);
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  /**
   * Response PATCH sudah membawa candidate lengkap, jadi cache langsung ditimpa
   * tanpa re-fetch (sesuai catatan pada dokumentasi API).
   */
  const handleCandidateSaved = (result: UpdateCandidateResponse["data"]) => {
    queryClient.setQueryData<CandidateDetailResponse>(
      detailQueryKey,
      (previous) => ({
        success: true,
        message: previous?.message ?? "Candidate detail",
        data: result.candidate,
      }),
    );
    // Daftar candidate ikut basi setelah edit.
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
    setNeedsSqlServerResync(Boolean(result.needs_sqlserver_resync));
  };

  const handleResyncSqlServer = async () => {
    if (!candidate) return;
    try {
      setIsResyncing(true);
      const response = await postApplyToSqlServer(candidate.CanId);
      if (response.success) {
        toast.success(
          response.message || "Data berhasil disinkronkan ke SQL Server.",
        );
        setNeedsSqlServerResync(false);
      } else {
        toast.error(response.message || "Sinkronisasi ke SQL Server gagal.");
      }
    } catch (resyncError) {
      const err = resyncError as any;
      toast.error(
        err?.response?.data?.message || "Sinkronisasi ke SQL Server gagal.",
      );
    } finally {
      setIsResyncing(false);
    }
  };

  const handlePhotoSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !candidate) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 2 MB.");
      return;
    }

    try {
      setIsUploadingPhoto(true);
      await uploadCandidatePhoto(candidate.CanId, file);
      toast.success("Foto profil berhasil diperbarui.");
      // Foto tidak ikut di response PATCH — ambil ulang detail.
      await queryClient.invalidateQueries({ queryKey: detailQueryKey });
    } catch (uploadError) {
      const err = uploadError as any;
      toast.error(err?.response?.data?.message || "Gagal mengunggah foto.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDocumentsSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0 || !candidate) return;

    const oversized = files.find((file) => file.size > 10 * 1024 * 1024);
    if (oversized) {
      toast.error(`Ukuran dokumen maksimal 10 MB (${oversized.name}).`);
      return;
    }

    try {
      setIsUploadingDocuments(true);
      // Deskripsi default memakai nama file; endpoint ini bersifat append.
      await uploadCandidateDocuments(
        candidate.CanId,
        files,
        files.map((file) => file.name),
      );
      toast.success(`${files.length} dokumen berhasil diunggah.`);
      await queryClient.invalidateQueries({ queryKey: detailQueryKey });
    } catch (uploadError) {
      const err = uploadError as any;
      toast.error(err?.response?.data?.message || "Gagal mengunggah dokumen.");
    } finally {
      setIsUploadingDocuments(false);
    }
  };

  const handleConfirmDeleteDocument = async () => {
    if (!candidate || !documentToDelete) return;

    try {
      setIsDeletingDocument(true);
      await deleteCandidateDocument(candidate.CanId, documentToDelete.id);
      toast.success(`Dokumen ${documentToDelete.name} dihapus.`);
      setDocumentToDelete(null);
      await queryClient.invalidateQueries({ queryKey: detailQueryKey });
    } catch (deleteError) {
      const err = deleteError as any;
      toast.error(err?.response?.data?.message || "Gagal menghapus dokumen.");
    } finally {
      setIsDeletingDocument(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh] flex-col gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-800 border-t-orange-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">
          Gathering candidate intel...
        </p>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center">
        <div className="p-6 bg-slate-100 dark:bg-slate-900 rounded-full mb-2">
          <User className="w-12 h-12 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Candidate Not Found
        </h2>
        <p className="text-slate-500 max-w-sm">
          The candidate data may have been removed or the ID is invalid.
        </p>
        <Button className="mt-4" onClick={() => navigate(backPath)}>
          Return to List
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-20 font-sans animate-in fade-in duration-500">
      {/* Minimalist Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pt-6 pb-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Navbar items */}
          <div className="flex flex-wrap justify-between items-center gap-3 mb-8">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                onClick={() => navigate(backPath)}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white -ml-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> {backLabel}
              </Button>
              {/* Prev/Next mengikuti urutan & filter list asal; nonaktif bila detail dibuka langsung lewat URL */}
              <div
                className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
                title={
                  hasNavContext
                    ? `Kandidat ${navIndex + 1} dari ${navIds.length} di halaman ${navPage}/${navTotalPages}`
                    : "Buka kandidat dari daftar untuk navigasi sebelum/berikutnya"
                }
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 rounded-none border-r border-slate-200 dark:border-slate-700"
                  disabled={!hasPrev || isNavigating !== null}
                  onClick={() => goToSibling("prev")}
                  aria-label="Kandidat sebelumnya"
                >
                  {isNavigating === "prev" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronLeft className="w-4 h-4" />
                  )}
                </Button>
                {hasNavContext && (
                  <span className="px-2 text-[11px] font-medium text-slate-500 tabular-nums">
                    {navIndex + 1}/{navIds.length}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 rounded-none border-l border-slate-200 dark:border-slate-700"
                  disabled={!hasNext || isNavigating !== null}
                  onClick={() => goToSibling("next")}
                  aria-label="Kandidat berikutnya"
                >
                  {isNavigating === "next" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Checked: sama dengan kolom Checked di list */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleChecked}
                disabled={isTogglingChecked}
                className={
                  candidate.is_checked
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-slate-200 dark:border-slate-700"
                }
                title={
                  candidate.is_checked && candidate.checked_by
                    ? `Dicek oleh ${candidate.checked_by}${candidate.checked_at ? ` · ${formatDate(candidate.checked_at)}` : ""}`
                    : "Tandai kandidat sudah dicek"
                }
              >
                {isTogglingChecked ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                {candidate.is_checked ? "Checked" : "Tandai Checked"}
              </Button>
              {/* Lolos seleksi: sama dengan kolom Lolos Seleksi di list */}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePassedClick}
                disabled={isTogglingPassed}
                className={
                  candidate.is_passed
                    ? "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300"
                    : "border-slate-200 dark:border-slate-700"
                }
                title={
                  candidate.is_passed
                    ? `Lolos seleksi${candidate.passed_by ? ` · ${candidate.passed_by}` : ""}${candidate.passed_note ? ` · ${candidate.passed_note}` : ""}`
                    : "Tandai kandidat lolos seleksi"
                }
              >
                {isTogglingPassed ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trophy className="w-4 h-4 mr-2" />
                )}
                {candidate.is_passed ? "Lolos Seleksi" : "Tandai Lolos"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex border-slate-200 dark:border-slate-700"
              >
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 dark:border-slate-700"
              >
                <Printer className="w-4 h-4 mr-2" /> Print
              </Button>
              <Button size="sm" onClick={() => setIsEditOpen(true)}>
                <Pencil className="w-4 h-4 mr-2" /> Edit Data
              </Button>
            </div>
          </div>

          {/* Sinkronisasi ulang ke ERP: backend sengaja tidak melakukannya
              otomatis karena menulis ke SQL Server produksi. */}
          {needsSqlServerResync && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20">
              <div className="flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Perubahan belum terdorong ke SQL Server
                  </p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                    Candidate ini sudah pernah di-apply ke ERP. Hasil edit baru
                    tersimpan di database lokal.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleResyncSqlServer}
                disabled={isResyncing}
                className="shrink-0"
              >
                {isResyncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sinkronkan ulang
              </Button>
            </div>
          )}

          {/* Header Info Banner */}
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24">
              <div
                className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer overflow-hidden"
                onClick={() =>
                  !!photoSource && !isPhotoError && setIsPhotoPreviewOpen(true)
                }
              >
                {photoSource && !isPhotoError ? (
                  <img
                    src={photoSource}
                    alt={candidate.CanName}
                    className="w-full h-full object-cover"
                    onError={() => setIsPhotoError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-8 h-8 text-slate-400" />
                  </div>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                className="hidden"
                onChange={handlePhotoSelected}
              />
              <button
                type="button"
                title="Ganti foto profil (jpg/png, maks 2 MB)"
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute -bottom-1 -right-1 p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-60"
              >
                {isUploadingPhoto ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
                  {candidate.CanName}
                </h1>
                <Badge
                  variant="secondary"
                  className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 uppercase text-[10px]"
                >
                  {candidate.CanStatus || "New Applicant"}
                </Badge>
                {candidate.FgFreshGrad === "Y" && (
                  <Badge
                    variant="secondary"
                    className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 uppercase text-[10px]"
                  >
                    Fresh Graduate
                  </Badge>
                )}
              </div>

              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                ID: {candidate.CanCode || "Unassigned"}
              </p>

              <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-slate-400" />{" "}
                  {candidate.CanEmail || "No Email"}
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Phone className="w-4 h-4 text-slate-400" />{" "}
                  {candidate.CanHandphone || "No Phone"}
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <MapPin className="w-4 h-4 text-slate-400" />{" "}
                  {mainAddress?.CanResCityName || "No Location"}
                  {mainAddress?.CanResStateName
                    ? `, ${mainAddress.CanResStateName}`
                    : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Left Column (4 Col Span) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Demographics Card */}
            <SectionBlock icon={User} title="Demographics">
              <div className="flex flex-col text-slate-600 dark:text-slate-300">
                <InfoRow
                  label="Date of Birth"
                  value={formatDate(candidate.CanDateBirth)}
                />
                <InfoRow
                  label="Age"
                  value={(() => {
                    const age = calculateAge(candidate.CanDateBirth);
                    return age !== null ? `${age} tahun` : null;
                  })()}
                  highlight
                />
                <InfoRow
                  label="Birth Place"
                  value={
                    candidate.CanCityBirthName ||
                    candidate.CanCityBirthId?.toString()
                  }
                />
                <InfoRow
                  label="Gender"
                  value={formatGender(candidate.CanSex)}
                />
                <InfoRow
                  label="Religion"
                  value={candidate.CanReligionId?.toString()}
                />
                <InfoRow
                  label="Marital Status"
                  value={candidate.CanMaritalStId?.toString()}
                />
                <InfoRow label="Blood Type" value={candidate.CanBloodType} />
                <InfoRow
                  label="Availability"
                  value={formatAvailability(candidate.CanAvailability)}
                />
                <InfoRow
                  label="Expected Salary"
                  value={formatCurrency(
                    expectedSalaryFromQuestions ??
                      candidate.experiences?.[0]?.ExpSalary ??
                      candidate.CanExpSal,
                  )}
                  highlight
                />
              </div>
            </SectionBlock>

            {/* Address */}
            <SectionBlock icon={MapPin} title="Address Information">
              {mainAddress ? (
                <div className="flex flex-col gap-6">
                  {/* Residential Address */}
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                      Residential Address (Current)
                    </h4>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {mainAddress.CanResCityName || "Unknown City"}
                      {mainAddress.CanResStateName
                        ? `, ${mainAddress.CanResStateName}`
                        : ""}
                    </p>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      {mainAddress.CanResAddress || "-"}
                      {mainAddress.CanResZipCode && (
                        <span className="block mt-1 font-semibold text-slate-600 dark:text-slate-400">
                          Zip Code: {mainAddress.CanResZipCode}
                        </span>
                      )}
                    </p>
                    {mainAddress.CanResPhone && (
                      <p className="text-sm text-slate-500 mt-2 flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5" /> Residential Phone:{" "}
                        <span className="font-semibold">
                          {mainAddress.CanResPhone}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Original / Identity Address */}
                  {(mainAddress.CanOriAddress ||
                    mainAddress.CanOriCityName) && (
                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                        Original / ID Address
                      </h4>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {mainAddress.CanOriCityName || "Unknown City"}
                        {mainAddress.CanOriStateName
                          ? `, ${mainAddress.CanOriStateName}`
                          : ""}
                      </p>
                      <p className="text-sm text-slate-500 mt-2 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        {mainAddress.CanOriAddress || "-"}
                        {mainAddress.CanOriZipCode && (
                          <span className="block mt-1 font-semibold text-slate-600 dark:text-slate-400">
                            Zip Code: {mainAddress.CanOriZipCode}
                          </span>
                        )}
                      </p>
                      {mainAddress.CanOriPhone && (
                        <p className="text-sm text-slate-500 mt-2 flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5" /> Original Phone:{" "}
                          <span className="font-semibold">
                            {mainAddress.CanOriPhone}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  No detailed address provided.
                </p>
              )}
            </SectionBlock>

            {/* Identifications */}
            <SectionBlock icon={Fingerprint} title="Identifications">
              {identities.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                  No identity data.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {identities.map((item: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div className="overflow-hidden pr-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {item.type?.CardType ||
                            item.CardTypeName ||
                            item.card_type_name}
                        </p>
                        <p className="font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                          {item.CardNumber || item.number || "-"}
                        </p>
                      </div>
                      <CreditCard className="w-5 h-5 text-slate-300 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </SectionBlock>

            {/* Skills & Languages */}
            <SectionBlock icon={Languages} title="Competencies">
              <div className="mb-5">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Professional Skills
                </h4>
                {skills.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">
                    No skills listed
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill: any, i: number) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 font-medium"
                      >
                        {skill.SkillName}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Languages
                </h4>
                {languages.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">
                    No languages listed
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {languages.map((lang: any, i: number) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium"
                      >
                        {lang.LangName}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </SectionBlock>
          </div>

          {/* Main Column (8 Col Span) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Program FTAP (mass hiring): data khusus dari form lamaran FTAP */}
            {candidate.ftap && (
              <SectionBlock icon={GraduationCap} title="Program FTAP">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  <div>
                    <InfoRow
                      label="Departemen"
                      value={candidate.ftap.department}
                      highlight
                    />
                    <InfoRow
                      label="Email"
                      value={candidate.CanEmail}
                    />
                    <InfoRow
                      label="No. HP (WhatsApp)"
                      value={candidate.ftap.whatsapp_number || candidate.CanHandphone}
                    />
                    <InfoRow
                      label="Tanggal Kelulusan"
                      value={formatDate(candidate.ftap.graduation_date)}
                    />
                  </div>
                  <div>
                    <InfoRow
                      label="Jenis Tes Inggris"
                      value={
                        getToeflType(candidate.ftap.toefl_type)?.label ||
                        candidate.ftap.toefl_type
                      }
                    />
                    <InfoRow
                      label="Skor"
                      value={
                        candidate.ftap.toefl_score !== null &&
                        candidate.ftap.toefl_score !== undefined ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="font-semibold">
                              {formatToeflScore(candidate.ftap.toefl_score)}
                            </span>
                            {candidate.ftap.toefl_passed === true ? (
                              <Badge className="h-5 px-1.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 border-transparent dark:bg-emerald-500/15 dark:text-emerald-300">
                                Memenuhi syarat
                              </Badge>
                            ) : candidate.ftap.toefl_passed === false ? (
                              <Badge className="h-5 px-1.5 text-[10px] font-semibold bg-rose-100 text-rose-700 border-transparent dark:bg-rose-500/15 dark:text-rose-300">
                                Di bawah ambang
                              </Badge>
                            ) : null}
                          </span>
                        ) : null
                      }
                    />
                    <InfoRow
                      label="Tempat Interview Offline"
                      value={candidate.ftap.interview_location}
                      highlight
                    />
                  </div>
                </div>
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {FTAP_INTERVIEW_LOCATION_NOTE}
                </p>
              </SectionBlock>
            )}

            {/* Applications */}
            {jobExpected.length > 0 && (
              <SectionBlock icon={BriefcaseBusiness} title="Job Applications">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jobExpected.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedJob(item)}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 hover:border-slate-400 dark:hover:border-slate-500 transition-all group flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight group-hover:text-slate-600 transition-colors">
                            {getJobExpectedName(item)}
                          </h3>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-medium py-0 h-5 border-slate-200 dark:border-slate-700 text-slate-500"
                          >
                            Pri {item?.Priority || "-"}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-4">
                          <Building2 className="w-3 h-3" />{" "}
                          {getJobExpectedOrganization(item)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-medium text-slate-400 tracking-wider uppercase pt-3 border-t border-slate-200/50 dark:border-slate-800">
                        <span>{getJobExpectedCode(item)}</span>
                        <span className="flex items-center gap-1 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                          Details <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionBlock>
            )}

            {/* AI Screening (CV + data kandidat) */}
            <SectionBlock icon={ScanSearch} title="AI Screening">
              <AiScreeningPanel
                candidateId={candidate.CanId ?? (id as string)}
                documents={documents.map((doc) => ({
                  id: Number(doc.CanDocId),
                  label: doc.CanDocDesc || doc.CanDocFile || `Dokumen ${doc.CanDocId}`,
                  filename: doc.CanDocFile ?? null,
                }))}
                jobs={jobExpected.map((item) => ({
                  id: Number(item.CanJobExpectedId),
                  label: getJobExpectedName(item),
                  priority: item?.Priority ?? null,
                }))}
              />
            </SectionBlock>

            {/* AI Interview (undangan link + kode akses, hasil wawancara AI) */}
            <div id="ai-interview">
              <SectionBlock icon={Mic} title="AI Interview">
                <AiInterviewPanel
                  candidateId={candidate.CanId ?? (id as string)}
                  candidateName={candidate.CanName ?? ""}
                  jobs={jobExpected.map((item) => ({
                    id: Number(item.CanJobExpectedId),
                    label: getJobExpectedName(item),
                    priority: item?.Priority ?? null,
                  }))}
                />
              </SectionBlock>
            </div>

            {/* Work Experience */}
            <SectionBlock icon={Activity} title="Work Experience">
              {experiences.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 font-medium">
                    No professional experience recorded.
                  </p>
                </div>
              ) : (
                <div className="space-y-6 border-l-2 border-slate-100 dark:border-slate-800 ml-3 pl-6 pb-2 relative">
                  {experiences.map((item: any, idx: number) => {
                    let period = item.job_period_year || item.ExpPeriod;
                    if (!period) {
                      const start = formatDate(item.JobStart);
                      const end = formatDate(item.JobEnd);
                      period =
                        start === "-" && end === "-"
                          ? "-"
                          : `${start} - ${end}`;
                    }
                    const salary =
                      item.SalaryEnd ??
                      item.salary ??
                      item.ExpSalary ??
                      item.SalaryStart;
                    return (
                      <div key={idx} className="relative">
                        <span className="absolute -left-[30px] top-1.5 w-3 h-3 bg-white dark:bg-slate-900 border-[3px] border-slate-300 dark:border-slate-600 rounded-full" />
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 mb-2">
                          <div>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                              {item.JobTtlName ||
                                item.position ||
                                item.ExpPosition ||
                                "-"}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {item.CompName ||
                                item.company_name ||
                                item.ExpCompanyName ||
                                "-"}
                            </p>
                          </div>
                          <span className="inline-flex py-1 px-2.5 rounded text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 text-xs font-medium self-start mt-1 shrink-0">
                            {period}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-4 mt-3 bg-slate-50/50 dark:bg-slate-800/20 p-3 rounded-lg border border-slate-100 dark:border-slate-800/60">
                          <div className="flex-1 min-w-30">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
                              Duration
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {item.JobPrdYear || "0"}y{" "}
                              {item.JobPrdMonth || "0"}m
                            </p>
                          </div>
                          <div className="flex-1 min-w-30">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
                              Final Salary
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {formatCurrency(salary)}
                            </p>
                          </div>
                          <div className="w-full">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
                              Reason for Leaving
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {item.TermReason || "-"}
                            </p>
                          </div>
                        </div>

                        {item.Description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-4 leading-relaxed font-medium">
                            {item.Description}
                          </p>
                        )}

                        {item.questions && item.questions.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                              Questions & Answers
                            </h4>
                            <div className="space-y-3">
                              {Object.entries(
                                item.questions.reduce((acc: any, q: any) => {
                                  const topic =
                                    q.topic?.QTopicName ||
                                    q.template?.QTempName ||
                                    "General";
                                  if (!acc[topic]) acc[topic] = [];
                                  acc[topic].push(q);
                                  return acc;
                                }, {}),
                              ).map(
                                ([topicName, qs]: [string, any], topicIdx) => (
                                  <div
                                    key={topicIdx}
                                    className="border border-slate-100 dark:border-slate-800/60 rounded-lg overflow-hidden"
                                  >
                                    <div className="bg-slate-50 dark:bg-slate-800/30 px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                                      <span className="text-[11px] font-medium text-slate-500">
                                        {topicName}
                                      </span>
                                    </div>
                                    <div className="p-3 space-y-3 bg-white dark:bg-slate-900/50">
                                      {qs.map((q: any, qi: number) => (
                                        <div key={qi}>
                                          <p className="text-xs text-slate-500 mb-0.5">
                                            {q.question?.QuestName ||
                                              "Question"}
                                          </p>
                                          <p className="text-sm text-slate-800 dark:text-slate-300">
                                            {q.FgAnsMode === "O"
                                              ? q.QAnsNumeric
                                                ? formatCurrency(q.QAnsNumeric)
                                                : q.QuestAnswer || "-"
                                              : q.QuestAnswer || "-"}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionBlock>

            {/* Education History */}
            <SectionBlock icon={GraduationCap} title="Education History">
              {education.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 font-medium">
                    No education data recorded.
                  </p>
                </div>
              ) : (
                <div className="space-y-8 border-l-2 border-slate-100 dark:border-slate-800 ml-3 pl-6 pb-2 relative">
                  {education.map((item: any, idx: number) => (
                    <div key={idx} className="relative">
                      <span className="absolute -left-[30px] top-1.5 w-3 h-3 bg-white dark:bg-slate-900 border-[3px] border-slate-300 dark:border-slate-600 rounded-full" />
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 mb-1">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            {item.EduInsName || "-"}
                            {item.FgLastEdu === "Y" && (
                              <Badge
                                variant="secondary"
                                className="bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 hover:bg-slate-200 border-0 h-5 px-2 py-0 text-[10px]"
                              >
                                Latest
                              </Badge>
                            )}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            {item.education_level?.EduLvlName ||
                              item.education_level?.EduLvlCode}{" "}
                            in {item.EduMjrName || "-"}
                          </p>
                        </div>
                        <span className="inline-flex py-1 px-2.5 rounded text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 text-xs font-medium self-start mt-1 shrink-0">
                          {item.EduPeriodStart ||
                            formatDate(item.EduStart) ||
                            "-"}{" "}
                          —{" "}
                          {item.EduPeriodEnd ||
                            formatDate(item.EduGraduate) ||
                            formatDate(item.EduEnd) ||
                            "-"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 mb-2 text-xs">
                        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <Award className="w-3.5 h-3.5" /> GPA/Grade:{" "}
                          {item.EduGrade || "-"}
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <MapPin className="w-3.5 h-3.5" />{" "}
                          {item.EduCityName || "-"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionBlock>

            {/* Attachments */}
            <SectionBlock
              icon={FileCheck}
              title="Documents & Attachments"
              action={
                <>
                  <input
                    ref={documentInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={handleDocumentsSelected}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => documentInputRef.current?.click()}
                    disabled={isUploadingDocuments}
                  >
                    {isUploadingDocuments ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Tambah Dokumen
                  </Button>
                </>
              }
            >
              {documents.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 font-medium">
                    No attached documents.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc: any, i: number) => {
                    const fileName = doc.CanDocFile || `Document ${i + 1}`;
                    const canDownload = Boolean(
                      doc.has_document || doc.can_doc_data_url || doc.CanDocId,
                    );
                    const isDownloading =
                      downloadingDocumentId === doc.CanDocId;
                    const isPreviewing = previewingDocumentId === doc.CanDocId;
                    const canOpenPreview = Boolean(
                      doc.has_document || doc.CanDocId,
                    );
                    return (
                      <div
                        key={i}
                        className="flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="overflow-hidden">
                            <p
                              className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate"
                              title={doc.CanDocDesc}
                            >
                              {doc.CanDocDesc || "Document"}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {fileName}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 mt-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() =>
                              handlePreviewDocument(
                                doc.CanDocId,
                                fileName,
                                doc.can_doc_mime_type,
                              )
                            }
                            disabled={!canOpenPreview || isPreviewing}
                          >
                            {isPreviewing ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4 mr-2" />
                            )}
                            Preview
                          </Button>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1"
                              onClick={() =>
                                handleDownloadDocument(
                                  doc.CanDocId,
                                  fileName,
                                  doc.can_doc_data_url,
                                )
                              }
                              disabled={!canDownload || isDownloading}
                            >
                              {isDownloading ? (
                                <MoreHorizontal className="w-4 h-4 animate-pulse" />
                              ) : (
                                <Download className="w-4 h-4 mr-2" />
                              )}
                              Download
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Hapus dokumen"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={() =>
                                doc.CanDocId &&
                                setDocumentToDelete({
                                  id: doc.CanDocId,
                                  name: doc.CanDocDesc || fileName,
                                })
                              }
                              disabled={!doc.CanDocId}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionBlock>
          </div>
        </div>
      </div>

      {/* Dialog catatan saat menandai lolos seleksi (sama dengan di list) */}
      <Dialog
        open={isPassedDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsPassedDialogOpen(false);
            setPassedNoteInput("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tandai Lolos Seleksi</DialogTitle>
            <DialogDescription>
              Tandai{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {candidate.CanName}
              </span>{" "}
              sebagai lolos seleksi. Catatan bersifat opsional (maks 1000 karakter).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Catatan (opsional)
            </label>
            <Textarea
              value={passedNoteInput}
              onChange={(e) => setPassedNoteInput(e.target.value)}
              placeholder="Contoh: Lolos tahap interview HR, jadwalkan psikotes"
              maxLength={1000}
              rows={4}
            />
            <span className="text-[11px] text-slate-400 self-end">
              {passedNoteInput.length} / 1000
            </span>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPassedDialogOpen(false);
                setPassedNoteInput("");
              }}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmMarkPassed}
              disabled={isTogglingPassed}
              className="bg-[#FF6905] hover:bg-[#e35e04] text-white"
            >
              Tandai Lolos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Candidate Modal — di-mount hanya saat dibuka supaya form selalu
          ter-prefill dari data candidate terbaru. */}
      {isEditOpen && (
      <CandidateEditModal
          candidate={candidate}
          open
          onOpenChange={setIsEditOpen}
          onSaved={handleCandidateSaved}
        />
      )}

      {/* Konfirmasi hapus dokumen */}
      <AlertDialog
        open={!!documentToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeletingDocument) setDocumentToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {documentToDelete?.name} akan dihapus permanen dari data
              candidate. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingDocument}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirmDeleteDocument();
              }}
              disabled={isDeletingDocument}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeletingDocument ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Photo Preview Modal */}
      <Dialog open={isPhotoPreviewOpen} onOpenChange={setIsPhotoPreviewOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-transparent border-none shadow-none">
          <DialogTitle className="sr-only">Candidate Photo Preview</DialogTitle>
          <DialogDescription className="sr-only">
            Enlarged preview of the candidate profile photo.
          </DialogDescription>
          {photoSource && (
            <img
              src={photoSource}
              alt="Preview"
              className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      <Dialog
        open={previewState.open}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
      >
        <DialogContent
          className="max-w-5xl! w-[95vw] p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          showCloseButton={false}
        >
          <DialogDescription className="sr-only">
            Preview of candidate document {previewState.fileName ?? ""}.
          </DialogDescription>
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <DialogTitle
                className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate"
                title={previewState.fileName ?? undefined}
              >
                {previewState.fileName || "Document Preview"}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {previewState.url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!previewState.url) return;
                    const a = document.createElement("a");
                    a.href = previewState.url;
                    a.download = previewState.fileName || "document";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                >
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={closePreview}>
                Close
              </Button>
            </div>
          </div>
          <div className="bg-slate-100 dark:bg-slate-950 h-[80vh] flex items-center justify-center overflow-hidden">
            {previewState.url && previewState.blob ? (
              <DocumentPreview
                blob={previewState.blob}
                blobUrl={previewState.url}
                mimeType={previewState.mimeType}
                fileName={previewState.fileName}
                onDownload={() => {
                  if (!previewState.url) return;
                  const a = document.createElement("a");
                  a.href = previewState.url;
                  a.download = previewState.fileName || "document";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
              />
            ) : (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading preview…
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Job Detail Modal */}
      <Dialog
        open={!!selectedJob}
        onOpenChange={(open) => !open && setSelectedJob(null)}
      >
        <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0 overflow-hidden flex flex-col max-h-[85vh]">
          {selectedJob && (
            <>
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between gap-4 shrink-0">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center shrink-0">
                    <BriefcaseBusiness className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <DialogDescription className="sr-only">
                      Detailed information about the expected job position.
                    </DialogDescription>
                    <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white leading-tight mb-1">
                      {getJobExpectedName(selectedJob)}
                    </DialogTitle>
                    <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" />{" "}
                      {getJobExpectedOrganization(selectedJob)}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold border-slate-200 dark:border-slate-700 text-slate-500 uppercase bg-white dark:bg-slate-800/50"
                >
                  {getJobExpectedCode(selectedJob)}
                </Badge>
              </div>

              <div className="p-6 overflow-y-auto w-full flex-1">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                      Job Specification
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {selectedJob.vacant_position?.VacantPosSpec ||
                        selectedJob.vacancy_information?.vacant_position
                          ?.specification ||
                        "No specification provided."}
                    </p>
                  </div>
                  {(selectedJob.vacant_position?.VacantNote ||
                    selectedJob.vacancy_information?.vacant_position?.note) && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 max-w-none">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                        Requirements & Description
                      </h3>
                      <div
                        className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-2 [&>ol]:list-decimal [&>ol]:ml-5 [&>ul]:list-disc [&>ul]:ml-5 [&>div>ol]:list-decimal [&>div>ol]:ml-5 [&>div>ul]:list-disc [&>div>ul]:ml-5"
                        dangerouslySetInnerHTML={{
                          __html: decodeHtml(
                            String(
                              selectedJob.vacant_position?.VacantNote ||
                                selectedJob.vacancy_information?.vacant_position
                                  ?.note,
                            ),
                          ),
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CandidateDetailPage;

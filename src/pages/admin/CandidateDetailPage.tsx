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
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteCandidateDocument,
  downloadCandidateDocument,
  getCandidateById,
  postApplyToSqlServer,
  previewCandidateDocument,
  uploadCandidateDocuments,
  uploadCandidatePhoto,
  type CandidateDetailResponse,
  type UpdateCandidateResponse,
} from "@/lib/api/candidates";
import {
  pickDefaultPhoto,
  useCandidatePhotoSrc,
} from "@/hooks/useCandidatePhotoSrc";
import { resolveUploadErrorMessage } from "@/lib/uploadError";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  BriefcaseBusiness,
  Building2,
  Camera,
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
  MoreHorizontal,
  Pencil,
  Phone,
  Printer,
  RefreshCw,
  Share2,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

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

  // Foto default: pakai photo_url dari asset service; data lama (photo_url null,
  // has_photo true) ditarik lewat endpoint preview ber-auth di dalam hook.
  const defaultPhoto = useMemo(
    () => pickDefaultPhoto(candidate?.photos),
    [candidate?.photos],
  );
  const { src: photoSource } = useCandidatePhotoSrc(
    candidate?.CanId,
    defaultPhoto,
  );

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

  /**
   * Unduh selalu lewat endpoint ber-auth: endpoint ini melayani asset baru
   * maupun blob lama, jadi tidak perlu cabang khusus per sumber file.
   */
  const handleDownloadDocument = async (
    docId?: number,
    fileName?: string | null,
  ) => {
    if (!candidate || !docId)
      return toast.error("Dokumen tidak valid untuk diunduh.");
    const safeFileName = fileName || `document-${docId}`;

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
      toast.error(
        resolveUploadErrorMessage(
          uploadError,
          "Gagal mengunggah foto. Silakan coba lagi.",
        ),
      );
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
      toast.error(
        resolveUploadErrorMessage(
          uploadError,
          "Gagal mengunggah dokumen. Silakan coba lagi.",
        ),
      );
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
        <Button className="mt-4" onClick={() => navigate("/admin/candidates")}>
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
          <div className="flex justify-between items-center mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate("/admin/candidates")}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white -ml-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Button>
            <div className="flex gap-2">
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
                    const canDownload = Boolean(doc.has_document || doc.CanDocId);
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
                                handleDownloadDocument(doc.CanDocId, fileName)
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

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  getCandidateValidationErrors,
  updateCandidate,
  type Candidate,
  type CandidateValidationErrors,
  type UpdateCandidatePayload,
  type UpdateCandidateResponse,
} from "@/lib/api/candidates";
import { getEduLevels, getMaritalStatuses, getRaces } from "@/lib/api/masters";
import {
  buildCandidateEditForm,
  buildUpdateCandidatePayload,
  createEmptyEducation,
  createEmptyExperience,
  createEmptyIdentity,
  createEmptySkill,
  isEmptyPayload,
  validateCandidateEditForm,
  type CandidateEditForm,
  type EducationForm,
  type ExperienceForm,
  type IdentityForm,
  type SkillForm,
} from "@/lib/candidateEditMapper";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

const NONE_VALUE = "__none__";

const BLOOD_TYPES = [
  "A",
  "B",
  "AB",
  "O",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];

// Dokumentasi API: 1 = KTP, 2 = Paspor, 3 = Kartu Keluarga.
const CARD_TYPES = [
  { id: "1", name: "KTP" },
  { id: "2", name: "Paspor" },
  { id: "3", name: "Kartu Keluarga" },
];

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const errorMessage = (error: unknown, fallback: string): string =>
  (error as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || fallback;

// --- Field primitives -------------------------------------------------------

const FieldError = ({ messages }: { messages?: string[] }) =>
  messages && messages.length > 0 ? (
    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
      {messages.join(" ")}
    </p>
  ) : null;

const Field = ({
  label,
  htmlFor,
  errors,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  errors?: string[];
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={className}>
    <Label htmlFor={htmlFor} className="text-xs text-slate-500 mb-1.5">
      {label}
    </Label>
    {children}
    {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    <FieldError messages={errors} />
  </div>
);

const SectionNotice = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 items-start p-3 mb-4 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20">
    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
      {children}
    </p>
  </div>
);

const RowCard = ({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
}) => (
  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
    <div className="flex justify-between items-center mb-3">
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {title}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 h-7 px-2"
        onClick={onRemove}
      >
        <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
      </Button>
    </div>
    {children}
  </div>
);

// --- Main component ---------------------------------------------------------

interface CandidateEditModalProps {
  candidate: Candidate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (result: UpdateCandidateResponse["data"]) => void;
}

/**
 * Komponen ini di-mount hanya selama modal terbuka, sehingga form selalu
 * ter-prefill dari data candidate terbaru tanpa perlu efek sinkronisasi.
 */
const CandidateEditModal: React.FC<CandidateEditModalProps> = ({
  candidate,
  open,
  onOpenChange,
  onSaved,
}) => {
  // Snapshot awal dipakai sebagai pembanding: hanya selisihnya yang dikirim.
  const [initialForm] = useState<CandidateEditForm>(() =>
    buildCandidateEditForm(candidate),
  );
  const [form, setForm] = useState<CandidateEditForm>(() =>
    deepClone(initialForm),
  );
  const [errors, setErrors] = useState<CandidateValidationErrors>({});
  const [isConfirmingDeleteAll, setIsConfirmingDeleteAll] = useState(false);

  const { data: eduLevels = [] } = useQuery({
    queryKey: ["master", "edulevels"],
    queryFn: () => getEduLevels(),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  const { data: maritalStatuses = [] } = useQuery({
    queryKey: ["master", "maritalstatuses"],
    queryFn: () => getMaritalStatuses(),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  const { data: races = [] } = useQuery({
    queryKey: ["master", "races"],
    queryFn: () => getRaces(),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  const payload = useMemo(
    () => buildUpdateCandidatePayload(initialForm, form),
    [initialForm, form],
  );
  const changedKeys = Object.keys(payload);

  const mutation = useMutation({
    mutationFn: (body: UpdateCandidatePayload) =>
      updateCandidate(candidate.CanId, body),
    onSuccess: (response) => {
      toast.success(response.message || "Data candidate berhasil diperbarui.");
      onSaved(response.data);
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const validation = getCandidateValidationErrors(error);
      if (validation) {
        setErrors(validation);
        toast.error("Validasi gagal. Periksa kembali isian yang ditandai.");
        return;
      }
      toast.error(errorMessage(error, "Gagal menyimpan perubahan candidate."));
    },
  });

  // --- Setters ---
  const setDemographic = (
    key: keyof CandidateEditForm["demographics"],
    value: string | boolean,
  ) =>
    setForm((prev) => ({
      ...prev,
      demographics: { ...prev.demographics, [key]: value },
    }));

  const setAddressField = (
    section: "residential" | "original",
    key: keyof CandidateEditForm["address"]["residential"],
    value: string,
  ) =>
    setForm((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        [section]: { ...prev.address[section], [key]: value },
      },
    }));

  const updateIdentity = (index: number, patch: Partial<IdentityForm>) =>
    setForm((prev) => ({
      ...prev,
      identities: prev.identities.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));

  const updateEducation = (index: number, patch: Partial<EducationForm>) =>
    setForm((prev) => ({
      ...prev,
      educations: prev.educations.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));

  const updateExperience = (index: number, patch: Partial<ExperienceForm>) =>
    setForm((prev) => ({
      ...prev,
      experiences: prev.experiences.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));

  const updateSkill = (index: number, patch: Partial<SkillForm>) =>
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));

  /** Hanya satu identitas yang boleh menjadi default. */
  const setDefaultIdentity = (index: number, checked: boolean) =>
    setForm((prev) => ({
      ...prev,
      identities: prev.identities.map((row, i) => ({
        ...row,
        is_default: checked ? i === index : i === index ? false : row.is_default,
      })),
    }));

  /** Backend menolak lebih dari satu pendidikan terakhir. */
  const setLastEducation = (index: number, checked: boolean) =>
    setForm((prev) => ({
      ...prev,
      educations: prev.educations.map((row, i) => ({
        ...row,
        is_last_education: checked
          ? i === index
          : i === index
            ? false
            : row.is_last_education,
      })),
    }));

  const removeRow = (
    section: "identities" | "educations" | "experiences" | "skills",
    index: number,
  ) =>
    setForm((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index),
    }));

  /**
   * Section koleksi yang dikirim sebagai array kosong = hapus semua barisnya.
   * Ini tidak bisa dibatalkan, jadi minta konfirmasi eksplisit dulu.
   */
  const emptiedSections = changedKeys.filter((key) => {
    const value = (payload as Record<string, unknown>)[key];
    return Array.isArray(value) && value.length === 0;
  });

  const submit = () => {
    setErrors({});
    mutation.mutate(payload);
  };

  const handleSave = () => {
    const clientErrors = validateCandidateEditForm(form);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      toast.error("Ada isian yang belum valid. Periksa kembali form.");
      return;
    }

    if (isEmptyPayload(payload)) {
      toast.info("Tidak ada perubahan untuk disimpan.");
      return;
    }

    if (emptiedSections.length > 0) {
      setIsConfirmingDeleteAll(true);
      return;
    }

    submit();
  };

  const isSaving = mutation.isPending;
  const { demographics, address } = form;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-5xl! w-[95vw] p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Edit Data Candidate
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-0.5">
              {candidate.CanName} &middot; {candidate.CanCode || "Unassigned"}
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Tabs defaultValue="demographics" className="w-full">
            <TabsList className="mb-5 flex-wrap h-auto">
              <TabsTrigger value="demographics">Data Diri</TabsTrigger>
              <TabsTrigger value="address">Alamat</TabsTrigger>
              <TabsTrigger value="identities">
                Identitas ({form.identities.length})
              </TabsTrigger>
              <TabsTrigger value="educations">
                Pendidikan ({form.educations.length})
              </TabsTrigger>
              <TabsTrigger value="experiences">
                Pengalaman ({form.experiences.length})
              </TabsTrigger>
              <TabsTrigger value="skills">
                Skill ({form.skills.length})
              </TabsTrigger>
            </TabsList>

            {/* --- Demographics --- */}
            <TabsContent value="demographics" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field
                  label="Gelar Depan"
                  htmlFor="front_title"
                  errors={errors.front_title}
                >
                  <Input
                    id="front_title"
                    maxLength={40}
                    value={demographics.front_title}
                    onChange={(e) =>
                      setDemographic("front_title", e.target.value)
                    }
                  />
                </Field>

                <Field
                  label="Nama Lengkap *"
                  htmlFor="full_name"
                  errors={errors.full_name}
                >
                  <Input
                    id="full_name"
                    maxLength={40}
                    value={demographics.full_name}
                    onChange={(e) => setDemographic("full_name", e.target.value)}
                  />
                </Field>

                <Field
                  label="Gelar Belakang"
                  htmlFor="end_title"
                  errors={errors.end_title}
                >
                  <Input
                    id="end_title"
                    maxLength={40}
                    value={demographics.end_title}
                    onChange={(e) => setDemographic("end_title", e.target.value)}
                  />
                </Field>

                <Field
                  label="Nama Panggilan"
                  htmlFor="nickname"
                  errors={errors.nickname}
                >
                  <Input
                    id="nickname"
                    maxLength={20}
                    value={demographics.nickname}
                    onChange={(e) => setDemographic("nickname", e.target.value)}
                  />
                </Field>

                <Field
                  label="Email *"
                  htmlFor="email"
                  errors={errors.email}
                  hint="Mengubah email juga memperbarui email login candidate."
                >
                  <Input
                    id="email"
                    type="email"
                    maxLength={60}
                    value={demographics.email}
                    onChange={(e) => setDemographic("email", e.target.value)}
                  />
                </Field>

                <Field
                  label="Nomor Handphone *"
                  htmlFor="mobile_phone"
                  errors={errors.mobile_phone}
                >
                  <Input
                    id="mobile_phone"
                    maxLength={30}
                    value={demographics.mobile_phone}
                    onChange={(e) =>
                      setDemographic("mobile_phone", e.target.value)
                    }
                  />
                </Field>

                <Field label="Jenis Kelamin *" errors={errors.gender}>
                  <Select
                    value={demographics.gender || NONE_VALUE}
                    onValueChange={(value) =>
                      setDemographic(
                        "gender",
                        value === NONE_VALUE ? "" : value,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Laki-Laki</SelectItem>
                      <SelectItem value="F">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Tanggal Lahir *"
                  htmlFor="date_of_birth"
                  errors={errors.date_of_birth}
                >
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={demographics.date_of_birth}
                    onChange={(e) =>
                      setDemographic("date_of_birth", e.target.value)
                    }
                  />
                </Field>

                <Field
                  label="Kota Lahir"
                  htmlFor="birth_city_name"
                  errors={errors.birth_city_name}
                >
                  <Input
                    id="birth_city_name"
                    maxLength={40}
                    value={demographics.birth_city_name}
                    onChange={(e) =>
                      setDemographic("birth_city_name", e.target.value)
                    }
                  />
                </Field>

                <Field label="Status Pernikahan" errors={errors.marital_status_id}>
                  <Select
                    value={demographics.marital_status_id || NONE_VALUE}
                    onValueChange={(value) =>
                      setDemographic(
                        "marital_status_id",
                        value === NONE_VALUE ? "" : value,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>-</SelectItem>
                      {maritalStatuses.map((item) => (
                        <SelectItem
                          key={item.MaritalStId}
                          value={String(item.MaritalStId)}
                        >
                          {item.MaritalSt || item.MaritalStId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Tanggal Menikah"
                  htmlFor="married_date"
                  errors={errors.married_date}
                >
                  <Input
                    id="married_date"
                    type="date"
                    value={demographics.married_date}
                    onChange={(e) =>
                      setDemographic("married_date", e.target.value)
                    }
                  />
                </Field>

                <Field label="Suku / Ras" errors={errors.race_id}>
                  <Select
                    value={demographics.race_id || NONE_VALUE}
                    onValueChange={(value) =>
                      setDemographic(
                        "race_id",
                        value === NONE_VALUE ? "" : value,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>-</SelectItem>
                      {races.map((item) => (
                        <SelectItem key={item.RaceId} value={String(item.RaceId)}>
                          {item.Race || item.RaceId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="ID Agama"
                  htmlFor="religion_id"
                  errors={errors.religion_id}
                  hint="Belum ada master agama di FE — isi dengan ID dari ERP."
                >
                  <Input
                    id="religion_id"
                    type="number"
                    value={demographics.religion_id}
                    onChange={(e) =>
                      setDemographic("religion_id", e.target.value)
                    }
                  />
                </Field>

                <Field label="Golongan Darah" errors={errors.blood_type}>
                  <Select
                    value={demographics.blood_type || NONE_VALUE}
                    onValueChange={(value) =>
                      setDemographic(
                        "blood_type",
                        value === NONE_VALUE ? "" : value,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>-</SelectItem>
                      {BLOOD_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Tinggi Badan (cm)"
                  htmlFor="height"
                  errors={errors.height}
                >
                  <Input
                    id="height"
                    type="number"
                    min={0}
                    max={999}
                    value={demographics.height}
                    onChange={(e) => setDemographic("height", e.target.value)}
                  />
                </Field>

                <Field
                  label="Berat Badan (kg)"
                  htmlFor="weight"
                  errors={errors.weight}
                >
                  <Input
                    id="weight"
                    type="number"
                    min={0}
                    max={999}
                    value={demographics.weight}
                    onChange={(e) => setDemographic("weight", e.target.value)}
                  />
                </Field>

                <Field
                  label="Ekspektasi Gaji"
                  htmlFor="expected_salary"
                  errors={errors.expected_salary}
                >
                  <Input
                    id="expected_salary"
                    type="number"
                    min={0}
                    value={demographics.expected_salary}
                    onChange={(e) =>
                      setDemographic("expected_salary", e.target.value)
                    }
                  />
                </Field>

                <Field
                  label="Ketersediaan"
                  htmlFor="availability"
                  errors={errors.availability}
                  hint='Kode 1 karakter, mis. "I" untuk Immediate.'
                >
                  <Input
                    id="availability"
                    maxLength={1}
                    value={demographics.availability}
                    onChange={(e) =>
                      setDemographic("availability", e.target.value)
                    }
                  />
                </Field>

                <Field label="NPWP" htmlFor="npwp" errors={errors.npwp}>
                  <Input
                    id="npwp"
                    maxLength={25}
                    value={demographics.npwp}
                    onChange={(e) => setDemographic("npwp", e.target.value)}
                  />
                </Field>

                <Field
                  label="No. BPJS Ketenagakerjaan"
                  htmlFor="bpjs_tk_no"
                  errors={errors.bpjs_tk_no}
                >
                  <Input
                    id="bpjs_tk_no"
                    maxLength={40}
                    value={demographics.bpjs_tk_no}
                    onChange={(e) =>
                      setDemographic("bpjs_tk_no", e.target.value)
                    }
                  />
                </Field>

                <Field
                  label="No. BPJS Kesehatan"
                  htmlFor="bpjs_kes_no"
                  errors={errors.bpjs_kes_no}
                >
                  <Input
                    id="bpjs_kes_no"
                    maxLength={40}
                    value={demographics.bpjs_kes_no}
                    onChange={(e) =>
                      setDemographic("bpjs_kes_no", e.target.value)
                    }
                  />
                </Field>

                <Field
                  label="Nama Bank"
                  htmlFor="bank_name"
                  errors={errors.bank_name}
                >
                  <Input
                    id="bank_name"
                    maxLength={30}
                    value={demographics.bank_name}
                    onChange={(e) => setDemographic("bank_name", e.target.value)}
                  />
                </Field>

                <Field
                  label="No. Rekening"
                  htmlFor="bank_account"
                  errors={errors.bank_account}
                >
                  <Input
                    id="bank_account"
                    maxLength={25}
                    value={demographics.bank_account}
                    onChange={(e) =>
                      setDemographic("bank_account", e.target.value)
                    }
                  />
                </Field>

                <div className="flex items-center gap-2 self-end pb-2">
                  <Checkbox
                    id="is_fresh_graduate"
                    checked={demographics.is_fresh_graduate}
                    onCheckedChange={(checked) =>
                      setDemographic("is_fresh_graduate", checked === true)
                    }
                  />
                  <Label
                    htmlFor="is_fresh_graduate"
                    className="text-sm text-slate-600 dark:text-slate-300"
                  >
                    Fresh Graduate
                  </Label>
                </div>
              </div>
            </TabsContent>

            {/* --- Address --- */}
            <TabsContent value="address" className="mt-0 space-y-8">
              {(
                [
                  ["residential", "Alamat Domisili"],
                  ["original", "Alamat Sesuai Identitas"],
                ] as const
              ).map(([section, title]) => (
                <div key={section}>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                    {title}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Field
                      label="Alamat"
                      className="md:col-span-2 lg:col-span-3"
                      errors={errors[`address.${section}.address`]}
                    >
                      <Textarea
                        rows={2}
                        value={address[section].address}
                        onChange={(e) =>
                          setAddressField(section, "address", e.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label="Kota"
                      errors={errors[`address.${section}.city_name`]}
                    >
                      <Input
                        maxLength={40}
                        value={address[section].city_name}
                        onChange={(e) =>
                          setAddressField(section, "city_name", e.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label="Provinsi"
                      errors={errors[`address.${section}.state_name`]}
                    >
                      <Input
                        maxLength={30}
                        value={address[section].state_name}
                        onChange={(e) =>
                          setAddressField(section, "state_name", e.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label="Kode Pos"
                      errors={errors[`address.${section}.zip_code`]}
                    >
                      <Input
                        maxLength={5}
                        value={address[section].zip_code}
                        onChange={(e) =>
                          setAddressField(section, "zip_code", e.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label="Desa / Kelurahan"
                      errors={errors[`address.${section}.desa`]}
                    >
                      <Input
                        maxLength={25}
                        value={address[section].desa}
                        onChange={(e) =>
                          setAddressField(section, "desa", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="RT" errors={errors[`address.${section}.rt`]}>
                      <Input
                        maxLength={3}
                        value={address[section].rt}
                        onChange={(e) =>
                          setAddressField(section, "rt", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="RW" errors={errors[`address.${section}.rw`]}>
                      <Input
                        maxLength={3}
                        value={address[section].rw}
                        onChange={(e) =>
                          setAddressField(section, "rw", e.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label="Telepon"
                      errors={errors[`address.${section}.phone`]}
                    >
                      <Input
                        maxLength={30}
                        value={address[section].phone}
                        onChange={(e) =>
                          setAddressField(section, "phone", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* --- Identities --- */}
            <TabsContent value="identities" className="mt-0">
              <SectionNotice>
                Menyimpan tab ini mengirim <strong>seluruh daftar identitas</strong>{" "}
                sebagai daftar final. Baris yang dihapus di sini akan ikut
                terhapus di database.
              </SectionNotice>
              <FieldError messages={errors.identities} />

              <div className="space-y-4">
                {form.identities.map((row, index) => {
                  // Pertahankan jenis kartu di luar master bawaan supaya tidak hilang.
                  const options = CARD_TYPES.some(
                    (type) => type.id === row.card_type_id,
                  )
                    ? CARD_TYPES
                    : [
                        ...CARD_TYPES,
                        ...(row.card_type_id
                          ? [
                              {
                                id: row.card_type_id,
                                name:
                                  row.card_type_name ||
                                  `Tipe ${row.card_type_id}`,
                              },
                            ]
                          : []),
                      ];

                  return (
                    <RowCard
                      key={row._key}
                      title={`Identitas ${index + 1}`}
                      onRemove={() => removeRow("identities", index)}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Field
                          label="Jenis Kartu *"
                          errors={errors[`identities.${index}.card_type_id`]}
                        >
                          <Select
                            value={row.card_type_id || NONE_VALUE}
                            onValueChange={(value) =>
                              updateIdentity(index, {
                                card_type_id:
                                  value === NONE_VALUE ? "" : value,
                              })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Pilih" />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field
                          label="Nomor *"
                          errors={errors[`identities.${index}.number`]}
                        >
                          <Input
                            maxLength={40}
                            value={row.number}
                            onChange={(e) =>
                              updateIdentity(index, { number: e.target.value })
                            }
                          />
                        </Field>
                        <Field
                          label="Penerbit"
                          errors={errors[`identities.${index}.publisher`]}
                        >
                          <Input
                            maxLength={40}
                            value={row.publisher}
                            onChange={(e) =>
                              updateIdentity(index, {
                                publisher: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field
                          label="Berlaku Sampai"
                          errors={errors[`identities.${index}.expired_at`]}
                        >
                          <Input
                            type="date"
                            value={row.expired_at}
                            onChange={(e) =>
                              updateIdentity(index, {
                                expired_at: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`identity-default-${row._key}`}
                            checked={row.is_default}
                            onCheckedChange={(checked) =>
                              setDefaultIdentity(index, checked === true)
                            }
                          />
                          <Label
                            htmlFor={`identity-default-${row._key}`}
                            className="text-sm text-slate-600 dark:text-slate-300"
                          >
                            Identitas utama
                          </Label>
                        </div>
                      </div>
                    </RowCard>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    identities: [...prev.identities, createEmptyIdentity()],
                  }))
                }
              >
                <Plus className="w-4 h-4 mr-2" /> Tambah Identitas
              </Button>
            </TabsContent>

            {/* --- Educations --- */}
            <TabsContent value="educations" className="mt-0">
              <SectionNotice>
                Menyimpan tab ini mengirim{" "}
                <strong>seluruh riwayat pendidikan</strong> sebagai daftar
                final. Hanya satu baris yang boleh ditandai sebagai pendidikan
                terakhir.
              </SectionNotice>
              <FieldError messages={errors.educations} />

              <div className="space-y-4">
                {form.educations.map((row, index) => (
                  <RowCard
                    key={row._key}
                    title={`Pendidikan ${index + 1}`}
                    onRemove={() => removeRow("educations", index)}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Field
                        label="Tingkat *"
                        errors={errors[`educations.${index}.edu_level_id`]}
                      >
                        <Select
                          value={row.edu_level_id || NONE_VALUE}
                          onValueChange={(value) =>
                            updateEducation(index, {
                              edu_level_id: value === NONE_VALUE ? "" : value,
                            })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={row.edu_level_name || "Pilih"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {eduLevels.map((level) => (
                              <SelectItem
                                key={level.EduLvlId}
                                value={String(level.EduLvlId)}
                              >
                                {level.EduLvlName || level.EduLvlCode}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field
                        label="Jurusan"
                        errors={errors[`educations.${index}.major`]}
                      >
                        <Input
                          maxLength={40}
                          value={row.major}
                          onChange={(e) =>
                            updateEducation(index, { major: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="Institusi"
                        errors={errors[`educations.${index}.institution_name`]}
                      >
                        <Input
                          maxLength={40}
                          value={row.institution_name}
                          onChange={(e) =>
                            updateEducation(index, {
                              institution_name: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Kota"
                        errors={errors[`educations.${index}.city_name`]}
                      >
                        <Input
                          maxLength={40}
                          value={row.city_name}
                          onChange={(e) =>
                            updateEducation(index, { city_name: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="IPK / Nilai"
                        errors={errors[`educations.${index}.gpa`]}
                      >
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={100}
                          value={row.gpa}
                          onChange={(e) =>
                            updateEducation(index, { gpa: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="Tahun Mulai"
                        errors={errors[`educations.${index}.period_start`]}
                      >
                        <Input
                          maxLength={4}
                          placeholder="2021"
                          value={row.period_start}
                          onChange={(e) =>
                            updateEducation(index, {
                              period_start: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Tahun Selesai"
                        errors={errors[`educations.${index}.period_end`]}
                      >
                        <Input
                          maxLength={4}
                          placeholder="2025"
                          value={row.period_end}
                          onChange={(e) =>
                            updateEducation(index, {
                              period_end: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Tanggal Lulus"
                        errors={errors[`educations.${index}.graduate_date`]}
                      >
                        <Input
                          type="date"
                          value={row.graduate_date}
                          onChange={(e) =>
                            updateEducation(index, {
                              graduate_date: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Gelar Depan"
                        errors={errors[`educations.${index}.front_title`]}
                      >
                        <Input
                          maxLength={10}
                          value={row.front_title}
                          onChange={(e) =>
                            updateEducation(index, {
                              front_title: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Gelar Belakang"
                        errors={errors[`educations.${index}.end_title`]}
                      >
                        <Input
                          maxLength={10}
                          value={row.end_title}
                          onChange={(e) =>
                            updateEducation(index, { end_title: e.target.value })
                          }
                        />
                      </Field>
                      <div className="flex items-center gap-2 self-end pb-2">
                        <Checkbox
                          id={`last-edu-${row._key}`}
                          checked={row.is_last_education}
                          onCheckedChange={(checked) =>
                            setLastEducation(index, checked === true)
                          }
                        />
                        <Label
                          htmlFor={`last-edu-${row._key}`}
                          className="text-sm text-slate-600 dark:text-slate-300"
                        >
                          Pendidikan terakhir
                        </Label>
                      </div>
                    </div>
                  </RowCard>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    educations: [...prev.educations, createEmptyEducation()],
                  }))
                }
              >
                <Plus className="w-4 h-4 mr-2" /> Tambah Pendidikan
              </Button>
            </TabsContent>

            {/* --- Experiences --- */}
            <TabsContent value="experiences" className="mt-0">
              <SectionNotice>
                Menyimpan tab ini mengirim{" "}
                <strong>seluruh pengalaman kerja</strong> sebagai daftar final.
                Menghapus baris di sini juga menghapus jawaban Q&amp;A yang
                menempel pada pengalaman tersebut.
              </SectionNotice>
              <FieldError messages={errors.experiences} />

              <div className="space-y-4">
                {form.experiences.map((row, index) => (
                  <RowCard
                    key={row._key}
                    title={`Pengalaman ${index + 1}`}
                    onRemove={() => removeRow("experiences", index)}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Field
                        label="Nama Perusahaan *"
                        errors={errors[`experiences.${index}.company_name`]}
                      >
                        <Input
                          maxLength={80}
                          value={row.company_name}
                          onChange={(e) =>
                            updateExperience(index, {
                              company_name: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Posisi *"
                        errors={errors[`experiences.${index}.position`]}
                      >
                        <Input
                          maxLength={80}
                          value={row.position}
                          onChange={(e) =>
                            updateExperience(index, { position: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="Jenis Perusahaan"
                        errors={errors[`experiences.${index}.company_type_name`]}
                      >
                        <Input
                          maxLength={80}
                          value={row.company_type_name}
                          onChange={(e) =>
                            updateExperience(index, {
                              company_type_name: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Bidang Usaha"
                        errors={errors[`experiences.${index}.business_type`]}
                      >
                        <Input
                          maxLength={80}
                          value={row.business_type}
                          onChange={(e) =>
                            updateExperience(index, {
                              business_type: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Tanggal Mulai"
                        errors={errors[`experiences.${index}.start_date`]}
                      >
                        <Input
                          type="date"
                          value={row.start_date}
                          onChange={(e) =>
                            updateExperience(index, {
                              start_date: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Tanggal Selesai"
                        errors={errors[`experiences.${index}.end_date`]}
                      >
                        <Input
                          type="date"
                          disabled={row.is_present}
                          value={row.is_present ? "" : row.end_date}
                          onChange={(e) =>
                            updateExperience(index, { end_date: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="Lama Kerja (tahun)"
                        errors={errors[`experiences.${index}.period_year`]}
                      >
                        <Input
                          type="number"
                          min={0}
                          max={99}
                          value={row.period_year}
                          onChange={(e) =>
                            updateExperience(index, {
                              period_year: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Lama Kerja (bulan)"
                        errors={errors[`experiences.${index}.period_month`]}
                      >
                        <Input
                          type="number"
                          min={0}
                          max={11}
                          value={row.period_month}
                          onChange={(e) =>
                            updateExperience(index, {
                              period_month: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Gaji Awal"
                        errors={errors[`experiences.${index}.salary_start`]}
                      >
                        <Input
                          type="number"
                          min={0}
                          value={row.salary_start}
                          onChange={(e) =>
                            updateExperience(index, {
                              salary_start: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Gaji Akhir"
                        errors={errors[`experiences.${index}.salary_end`]}
                      >
                        <Input
                          type="number"
                          min={0}
                          value={row.salary_end}
                          onChange={(e) =>
                            updateExperience(index, {
                              salary_end: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Jumlah Karyawan"
                        errors={errors[`experiences.${index}.total_employee`]}
                      >
                        <Input
                          type="number"
                          min={0}
                          value={row.total_employee}
                          onChange={(e) =>
                            updateExperience(index, {
                              total_employee: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Melapor Kepada"
                        errors={errors[`experiences.${index}.report_to`]}
                      >
                        <Input
                          maxLength={40}
                          value={row.report_to}
                          onChange={(e) =>
                            updateExperience(index, {
                              report_to: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Telepon Perusahaan"
                        errors={errors[`experiences.${index}.company_phone`]}
                      >
                        <Input
                          maxLength={30}
                          value={row.company_phone}
                          onChange={(e) =>
                            updateExperience(index, {
                              company_phone: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Kode Pos Perusahaan"
                        errors={errors[`experiences.${index}.company_zip_code`]}
                      >
                        <Input
                          maxLength={5}
                          value={row.company_zip_code}
                          onChange={(e) =>
                            updateExperience(index, {
                              company_zip_code: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Alasan Keluar"
                        errors={errors[`experiences.${index}.termination_reason`]}
                      >
                        <Input
                          maxLength={60}
                          value={row.termination_reason}
                          onChange={(e) =>
                            updateExperience(index, {
                              termination_reason: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <div className="flex items-center gap-2 self-end pb-2">
                        <Checkbox
                          id={`is-present-${row._key}`}
                          checked={row.is_present}
                          onCheckedChange={(checked) =>
                            updateExperience(index, {
                              is_present: checked === true,
                            })
                          }
                        />
                        <Label
                          htmlFor={`is-present-${row._key}`}
                          className="text-sm text-slate-600 dark:text-slate-300"
                        >
                          Masih bekerja di sini
                        </Label>
                      </div>
                      <Field
                        label="Alamat Perusahaan"
                        className="md:col-span-2 lg:col-span-4"
                        errors={errors[`experiences.${index}.company_address`]}
                      >
                        <Textarea
                          rows={2}
                          value={row.company_address}
                          onChange={(e) =>
                            updateExperience(index, {
                              company_address: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Deskripsi Pekerjaan"
                        className="md:col-span-2 lg:col-span-4"
                        errors={errors[`experiences.${index}.description`]}
                      >
                        <Textarea
                          rows={3}
                          value={row.description}
                          onChange={(e) =>
                            updateExperience(index, {
                              description: e.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>
                  </RowCard>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    experiences: [...prev.experiences, createEmptyExperience()],
                  }))
                }
              >
                <Plus className="w-4 h-4 mr-2" /> Tambah Pengalaman
              </Button>
            </TabsContent>

            {/* --- Skills --- */}
            <TabsContent value="skills" className="mt-0">
              <SectionNotice>
                Menyimpan tab ini mengirim <strong>seluruh daftar skill</strong>{" "}
                sebagai daftar final.
              </SectionNotice>
              <FieldError messages={errors.skills} />

              <div className="space-y-4">
                {form.skills.map((row, index) => (
                  <RowCard
                    key={row._key}
                    title={`Skill ${index + 1}`}
                    onRemove={() => removeRow("skills", index)}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field
                        label="Nama Skill *"
                        errors={errors[`skills.${index}.name`]}
                      >
                        <Input
                          maxLength={60}
                          value={row.name}
                          onChange={(e) =>
                            updateSkill(index, { name: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="Keterangan"
                        errors={errors[`skills.${index}.description`]}
                      >
                        <Input
                          value={row.description}
                          onChange={(e) =>
                            updateSkill(index, { description: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                  </RowCard>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    skills: [...prev.skills, createEmptySkill()],
                  }))
                }
              >
                <Plus className="w-4 h-4 mr-2" /> Tambah Skill
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 shrink-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {changedKeys.length === 0 ? (
              <span className="text-xs text-slate-400">Belum ada perubahan</span>
            ) : (
              <>
                <span className="text-xs text-slate-500">Akan dikirim:</span>
                {changedKeys.map((key) => (
                  <Badge
                    key={key}
                    variant="secondary"
                    className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono text-[10px]"
                  >
                    {key}
                  </Badge>
                ))}
              </>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Batal
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || changedKeys.length === 0}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Simpan Perubahan
            </Button>
          </div>
        </div>
        {/* Konfirmasi hapus seluruh isi section */}
        <AlertDialog
          open={isConfirmingDeleteAll}
          onOpenChange={setIsConfirmingDeleteAll}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus semua data section ini?</AlertDialogTitle>
              <AlertDialogDescription>
                Section {emptiedSections.join(", ")} akan dikirim sebagai daftar
                kosong, sehingga seluruh barisnya dihapus dari data candidate.
                Tindakan ini tidak bisa dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  setIsConfirmingDeleteAll(false);
                  submit();
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Ya, hapus dan simpan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};

export default CandidateEditModal;

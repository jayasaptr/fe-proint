import type { Vacancy } from "@/lib/api/vacancies";

/**
 * Konstanta program mass hiring FTAP (Future Talent Acceleration Program).
 * Cermin dari App\Support\FtapProgram di api-erecruitment-dh; backend tetap
 * memvalidasi ulang, nilai di sini hanya untuk tampilan form dan filter.
 */

/** Tempat interview offline yang bisa dipilih kandidat (terkunci setelah lamaran dikirim). */
export const FTAP_INTERVIEW_LOCATIONS = [
  "Recruitment FTAP - Bandung",
  "Recruitment FTAP - Yogyakarta",
  "Recruitment FTAP - Surabaya",
  "Recruitment FTAP - Balikpapan",
] as const;

export const FTAP_INTERVIEW_LOCATION_NOTE =
  "Tempat interview offline yang dipilih tidak dapat diganti setelah lamaran dikirim. Pastikan Anda memilih kota yang dapat Anda hadiri.";

export interface FtapToeflType {
  value: string;
  label: string;
  minPass: number;
  scaleMin: number;
  scaleMax: number;
  step: number;
}

/** Jenis tes bahasa Inggris yang diterima + ambang lolos FTAP (ITP 500 / iBT 60 / IELTS 5.5). */
export const FTAP_TOEFL_TYPES: FtapToeflType[] = [
  { value: "ITP", label: "TOEFL ITP", minPass: 500, scaleMin: 310, scaleMax: 677, step: 1 },
  { value: "iBT", label: "TOEFL iBT", minPass: 60, scaleMin: 0, scaleMax: 120, step: 1 },
  { value: "IELTS", label: "IELTS", minPass: 5.5, scaleMin: 0, scaleMax: 9, step: 0.5 },
];

export const getToeflType = (value?: string | null): FtapToeflType | undefined =>
  FTAP_TOEFL_TYPES.find((t) => t.value.toLowerCase() === String(value ?? "").toLowerCase());

/** Ringkasan syarat untuk ditampilkan di form: "TOEFL ITP ≥ 500 / TOEFL iBT ≥ 60 / IELTS ≥ 5.5". */
export const FTAP_TOEFL_REQUIREMENT_LABEL = FTAP_TOEFL_TYPES.map(
  (t) => `${t.label} ≥ ${t.minPass}`,
).join(" / ");

/**
 * Dokumen yang wajib diunggah pelamar lowongan FTAP. Baris dokumen ini dibuat otomatis
 * dan terkunci di form (pola yang sama dengan SIMPER/Mine Permit untuk Operator).
 * Cermin FtapProgram::REQUIRED_DOCUMENTS; backend memvalidasi ulang dari deskripsi dokumen.
 */
export const FTAP_REQUIRED_DOCUMENTS = [
  "CV",
  "KTP",
  "Kartu Keluarga (KK)",
  "Ijazah / SKL Legalisir",
  "Transkrip Nilai",
  "Sertifikat TOEFL / IELTS",
] as const;

export interface FtapMandarinLevel {
  value: string;
  label: string;
  hint: string;
  /** Urutan tingkat: none 0 < basic 1 < intermediate 2 < advanced 3. */
  rank: number;
}

/**
 * Tingkat kemampuan bahasa Mandarin (nilai tambah, bukan syarat lolos FTAP).
 * Cermin FtapProgram::MANDARIN_LEVELS di backend.
 */
export const FTAP_MANDARIN_LEVELS: FtapMandarinLevel[] = [
  { value: "none", label: "Tidak bisa", hint: "Belum menguasai bahasa Mandarin.", rank: 0 },
  { value: "basic", label: "Dasar", hint: "Percakapan sederhana, setara HSK 1-2.", rank: 1 },
  {
    value: "intermediate",
    label: "Menengah",
    hint: "Percakapan sehari-hari dan kerja, setara HSK 3-4.",
    rank: 2,
  },
  { value: "advanced", label: "Mahir", hint: "Lancar lisan dan tulisan, setara HSK 5-6.", rank: 3 },
];

export const getMandarinLevel = (value?: string | null): FtapMandarinLevel | undefined =>
  FTAP_MANDARIN_LEVELS.find((l) => l.value === String(value ?? "").toLowerCase());

/** Level sertifikat HSK (Hanyu Shuiping Kaoshi) yang diakui: 1 s.d. 6. */
export const FTAP_HSK_LEVELS = [1, 2, 3, 4, 5, 6] as const;

export const formatHskLevel = (level?: number | string | null) => {
  if (level === null || level === undefined || level === "") return null;
  const n = Number(level);
  return Number.isInteger(n) && n >= 1 && n <= 6 ? `HSK ${n}` : null;
};

/**
 * Departemen FTAP yang dibuka (nama lowongan di karir web: "FTAP - <Departemen>").
 * Dipakai sebagai fallback filter bila master lowongan FTAP dari backend belum termuat.
 */
export const FTAP_DEPARTMENTS = [
  "Operation",
  "Engineering",
  "Project Control",
  "Construction",
  "Plant & Maintenance",
  "Supply Chain Management",
  "HSE",
  "HCM",
  "DT/IT",
] as const;

/**
 * Lowongan dianggap FTAP bila grup atributnya bernama "FTAP - ..." / tipe
 * "Future Talent ..." atau nama posisinya mengandung "FTAP" (pola yang sama
 * dengan deteksi level Operator/Mechanic di ApplyJobModal).
 */
export const isFtapVacancy = (vacancy: Pick<Vacancy, "VacantPositionName" | "PosAdtGroups">) => {
  const fromGroups = (vacancy.PosAdtGroups ?? []).some(
    (g) =>
      /^\s*ftap/i.test(g.PosAdtGrpName ?? "") ||
      /future\s+talent/i.test(g.PosAdtName ?? ""),
  );
  return fromGroups || /\bftap\b/i.test(vacancy.VacantPositionName ?? "");
};

/** "FTAP - Supply Chain Management" -> "Supply Chain Management". */
export const ftapDepartmentFromName = (name?: string | null) => {
  const trimmed = (name ?? "").trim();
  const match = trimmed.match(/^\s*FTAP\s*[-–:]\s*(.+)$/i);
  return match ? match[1].trim() : trimmed;
};

export const formatToeflScore = (score?: number | string | null) => {
  if (score === null || score === undefined || score === "") return "-";
  const n = Number(score);
  if (Number.isNaN(n)) return String(score);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

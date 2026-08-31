export interface OperatorUnitGroup {
  category: string;
  units: string[];
}

/**
 * Daftar unit alat berat, dikelompokkan per kategori. Dipakai sebagai pilihan
 * Posisi/Jabatan pada riwayat pengalaman kerja untuk lowongan level Operator.
 */
export const OPERATOR_UNIT_GROUPS: OperatorUnitGroup[] = [
  {
    category: "Excavator",
    units: [
      "EX2000",
      "R9200",
      "SY2000H",
      "XE2000",
      "PC1250",
      "SY500H",
      "SY365H",
      "SY215H",
      "PC200",
      "SY215H_LA",
    ],
  },
  {
    category: "Hauler",
    units: ["RTH100", "HD785", "SRT100s", "DW105A", "Howo 40Ton", "F3000", "P360"],
  },
  {
    category: "Dozer",
    units: ["D375-6", "D155A", "D9", "PR756", "SD-22"],
  },
  {
    category: "Grader",
    units: ["16H", "STG230C", "GD705A-4"],
  },
  {
    category: "Compact",
    units: ["CS10GC"],
  },
  {
    category: "Drill Machine",
    units: ["DM30"],
  },
  {
    category: "Water Truck",
    units: ["HD465_WT", "CMS50", "CWB45AL", "Iveco_WT", "CF43", "CP150SS"],
  },
  {
    category: "Water Pump",
    units: ["DND200", "MF420EX-HV", "CF28M"],
  },
];

/** Dokumen yang wajib diunggah pelamar pada lowongan level Operator. */
export const REQUIRED_OPERATOR_DOCUMENTS = ["SIMPER", "Mine Permit"];

/** Nilai yang tersimpan, mis. "Operator - EX2000". */
export const buildOperatorPosition = (unit: string) => `Operator - ${unit}`;

/** Semua nilai posisi operator yang valid, untuk mengenali input dari dropdown. */
export const OPERATOR_POSITION_VALUES = new Set(
  OPERATOR_UNIT_GROUPS.flatMap((group) =>
    group.units.map((unit) => buildOperatorPosition(unit)),
  ),
);

/** Dokumen yang wajib diunggah pelamar pada lowongan level Mechanic/Mekanik. */
export const REQUIRED_MECHANIC_DOCUMENTS = ["BMC"];

/**
 * Kepanjangan dokumen yang namanya berupa singkatan. Hanya untuk ditampilkan ke
 * pelamar; nilai yang dikirim ke API tetap singkatannya agar data rekruter
 * konsisten dengan lamaran yang sudah masuk.
 */
export const DOCUMENT_FULL_NAMES: Record<string, string> = {
  BMC: "Basic Mechanic Course",
};

/**
 * Dokumen wajib berdasarkan level lowongan. Operator dan Mechanic punya
 * daftar berkas wajib yang berbeda; level lain tidak mewajibkan apa pun.
 */
export const getRequiredDocuments = (opts: {
  isOperator: boolean;
  isMechanic: boolean;
}): string[] => {
  if (opts.isOperator) return REQUIRED_OPERATOR_DOCUMENTS;
  if (opts.isMechanic) return REQUIRED_MECHANIC_DOCUMENTS;
  return [];
};

/** Ekstensi berkas yang diterima pada unggahan dokumen lamaran. */
export const ALLOWED_DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx"];

/**
 * MIME type yang sah untuk PDF/Word. Sebagian browser mengirim string kosong
 * atau "application/octet-stream" untuk .doc/.docx, jadi MIME saja tidak cukup
 * dan pengecekan tetap digabung dengan ekstensi.
 */
const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/** Label ekstensi untuk pesan error, mis. ".pdf, .doc, .docx". */
export const ALLOWED_DOCUMENT_LABEL = ALLOWED_DOCUMENT_EXTENSIONS.map(
  (ext) => `.${ext}`,
).join(", ");

/**
 * Memastikan berkas benar-benar PDF/Word. Atribut `accept` pada input hanya
 * menyaring dialog pemilih berkas — pelamar masih bisa menembusnya lewat
 * drag-and-drop atau opsi "All Files", jadi validasinya diulang di sini.
 */
export const isAllowedDocumentFile = (file: File): boolean => {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extension)) return false;
  // MIME hanya divalidasi bila browser mengisinya dengan nilai yang bermakna.
  const mimeType = file.type.toLowerCase();
  if (!mimeType || mimeType === "application/octet-stream") return true;
  return ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType);
};

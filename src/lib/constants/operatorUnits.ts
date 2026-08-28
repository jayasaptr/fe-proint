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

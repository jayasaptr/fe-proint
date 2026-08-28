import type {
  Candidate,
  CandidateAddressPayload,
  CandidateEducationPayload,
  CandidateExperiencePayload,
  CandidateIdentityPayload,
  CandidateSkillPayload,
  CandidateValidationErrors,
  UpdateCandidatePayload,
} from "./api/candidates";

// ============================================================================
// Jembatan antara respons GET /candidates/{id} (PascalCase kolom database) dan
// payload PATCH /candidates/{id} (snake_case). Nama field kedua sisi berbeda,
// jadi respons GET tidak bisa dikirim balik apa adanya.
// ============================================================================

/** "2004-12-30 00:00:00" | "2004-12-30T00:00:00Z" -> "2004-12-30" */
export const toDateInput = (value?: string | null): string =>
  value ? String(value).replace("T", " ").slice(0, 10) : "";

/** Flag "Y"/"N" dari GET -> boolean untuk PATCH. */
export const toBool = (flag?: unknown): boolean =>
  String(flag ?? "").toUpperCase() === "Y";

const toText = (value?: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const textOrNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const numberOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

const dateOrNull = (value: string): string | null => textOrNull(value);

/** id numerik baris yang sudah ada di database; undefined untuk baris baru. */
const existingId = (value?: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

let rowCounter = 0;
/** Key stabil untuk React — baris baru belum punya id dari database. */
const nextRowKey = () => `row-${(rowCounter += 1)}`;

// ---------------------------------------------------------------------------
// Bentuk state form
// ---------------------------------------------------------------------------

export interface DemographicsForm {
  full_name: string;
  nickname: string;
  front_title: string;
  end_title: string;
  email: string;
  mobile_phone: string;
  gender: string;
  date_of_birth: string;
  birth_city_name: string;
  marital_status_id: string;
  married_date: string;
  religion_id: string;
  race_id: string;
  blood_type: string;
  height: string;
  weight: string;
  npwp: string;
  expected_salary: string;
  availability: string;
  is_fresh_graduate: boolean;
  bpjs_tk_no: string;
  bpjs_kes_no: string;
  bank_name: string;
  bank_account: string;
}

export interface AddressForm {
  address: string;
  city_name: string;
  state_name: string;
  zip_code: string;
  phone: string;
  rt: string;
  rw: string;
  desa: string;
}

export interface IdentityForm {
  _key: string;
  id?: number;
  card_type_id: string;
  card_type_name: string;
  number: string;
  publisher: string;
  expired_at: string;
  is_default: boolean;
}

export interface EducationForm {
  _key: string;
  id?: number;
  edu_level_id: string;
  edu_level_name: string;
  major: string;
  institution_name: string;
  city_name: string;
  gpa: string;
  period_start: string;
  period_end: string;
  start_date: string;
  graduate_date: string;
  front_title: string;
  end_title: string;
  is_last_education: boolean;
}

export interface ExperienceForm {
  _key: string;
  id?: number;
  company_name: string;
  position: string;
  company_type_name: string;
  business_type: string;
  company_address: string;
  company_zip_code: string;
  company_phone: string;
  start_date: string;
  end_date: string;
  period_year: string;
  period_month: string;
  salary_start: string;
  salary_end: string;
  termination_reason: string;
  total_employee: string;
  report_to: string;
  description: string;
  is_present: boolean;
}

export interface SkillForm {
  _key: string;
  id?: number;
  name: string;
  description: string;
}

export interface CandidateEditForm {
  demographics: DemographicsForm;
  address: { residential: AddressForm; original: AddressForm };
  identities: IdentityForm[];
  educations: EducationForm[];
  experiences: ExperienceForm[];
  skills: SkillForm[];
}

// ---------------------------------------------------------------------------
// GET detail -> state form
// ---------------------------------------------------------------------------

const emptyAddress = (): AddressForm => ({
  address: "",
  city_name: "",
  state_name: "",
  zip_code: "",
  phone: "",
  rt: "",
  rw: "",
  desa: "",
});

export const createEmptyIdentity = (): IdentityForm => ({
  _key: nextRowKey(),
  card_type_id: "",
  card_type_name: "",
  number: "",
  publisher: "",
  expired_at: "",
  is_default: false,
});

export const createEmptyEducation = (): EducationForm => ({
  _key: nextRowKey(),
  edu_level_id: "",
  edu_level_name: "",
  major: "",
  institution_name: "",
  city_name: "",
  gpa: "",
  period_start: "",
  period_end: "",
  start_date: "",
  graduate_date: "",
  front_title: "",
  end_title: "",
  is_last_education: false,
});

export const createEmptyExperience = (): ExperienceForm => ({
  _key: nextRowKey(),
  company_name: "",
  position: "",
  company_type_name: "",
  business_type: "",
  company_address: "",
  company_zip_code: "",
  company_phone: "",
  start_date: "",
  end_date: "",
  period_year: "",
  period_month: "",
  salary_start: "",
  salary_end: "",
  termination_reason: "",
  total_employee: "",
  report_to: "",
  description: "",
  is_present: false,
});

export const createEmptySkill = (): SkillForm => ({
  _key: nextRowKey(),
  name: "",
  description: "",
});

/** Sumber identitas berbeda-beda tergantung relasi yang ter-load backend. */
const pickIdentities = (candidate: Candidate) => {
  const sources = [candidate.id_cards, candidate.identities, candidate.cards];
  return sources.find((list) => Array.isArray(list) && list.length > 0) ?? [];
};

const pickExperiences = (candidate: Candidate) =>
  Array.isArray(candidate.experiences) && candidate.experiences.length > 0
    ? candidate.experiences
    : (candidate.work_experiences ?? []);

export const buildCandidateEditForm = (
  candidate: Candidate,
): CandidateEditForm => {
  const mainAddress = candidate.addresses?.[0];

  return {
    demographics: {
      full_name: toText(candidate.CanName),
      nickname: toText(candidate.CanNickName),
      front_title: toText(candidate.CanFrontTitle),
      end_title: toText(candidate.CanEndTitle),
      email: toText(candidate.CanEmail),
      mobile_phone: toText(candidate.CanHandphone),
      gender: toText(candidate.CanSex),
      date_of_birth: toDateInput(candidate.CanDateBirth),
      birth_city_name: toText(candidate.CanCityBirthName),
      marital_status_id: toText(candidate.CanMaritalStId),
      married_date: toDateInput(candidate.CanMarriedDate),
      religion_id: toText(candidate.CanReligionId),
      race_id: toText(candidate.CanRaceId),
      blood_type: toText(candidate.CanBloodType),
      height: toText(candidate.CanHeight),
      weight: toText(candidate.CanWeight),
      npwp: toText(candidate.CanNPWP),
      expected_salary: toText(candidate.CanExpSal),
      availability: toText(candidate.CanAvailability),
      is_fresh_graduate: toBool(candidate.FgFreshGrad),
      bpjs_tk_no: toText(candidate.CanBPJSTKNo),
      bpjs_kes_no: toText(candidate.CanBPJSKesNo),
      bank_name: toText(candidate.CanBankName),
      bank_account: toText(candidate.CanBankAcc),
    },
    address: {
      residential: mainAddress
        ? {
            address: toText(mainAddress.CanResAddress),
            city_name: toText(mainAddress.CanResCityName),
            state_name: toText(mainAddress.CanResStateName),
            zip_code: toText(mainAddress.CanResZipCode),
            phone: toText(mainAddress.CanResPhone),
            rt: toText(mainAddress.CanResRT),
            rw: toText(mainAddress.CanResRW),
            desa: toText(mainAddress.CanResDesa),
          }
        : emptyAddress(),
      original: mainAddress
        ? {
            address: toText(mainAddress.CanOriAddress),
            city_name: toText(mainAddress.CanOriCityName),
            state_name: toText(mainAddress.CanOriStateName),
            zip_code: toText(mainAddress.CanOriZipCode),
            phone: toText(mainAddress.CanOriPhone),
            rt: toText(mainAddress.CanOriRT),
            rw: toText(mainAddress.CanOriRW),
            desa: toText(mainAddress.CanOriDesa),
          }
        : emptyAddress(),
    },
    identities: pickIdentities(candidate).map((item) => ({
      _key: nextRowKey(),
      id: existingId(item.CanCardId),
      card_type_id: toText(item.CardTypeId ?? item.type?.CardTypeId),
      card_type_name: toText(
        item.type?.CardType ?? item.CardTypeName ?? item.card_type_name,
      ),
      number: toText(item.CardNumber ?? item.number),
      publisher: toText(item.CardPublisher),
      expired_at: toDateInput(item.CardExpired),
      is_default: toBool(item.CardFgDefault),
    })),
    educations: (candidate.education ?? []).map((item) => ({
      _key: nextRowKey(),
      id: existingId(item.CanEduId),
      edu_level_id: toText(item.EduLvlId ?? item.education_level?.EduLvlId),
      edu_level_name: toText(
        item.education_level?.EduLvlName ?? item.education_level?.EduLvlCode,
      ),
      major: toText(item.EduMjrName),
      institution_name: toText(item.EduInsName),
      city_name: toText(item.EduCityName),
      gpa: toText(item.EduGrade),
      period_start: toText(item.EduPeriodStart),
      period_end: toText(item.EduPeriodEnd),
      start_date: toDateInput(item.EduStart),
      graduate_date: toDateInput(item.EduGraduate),
      front_title: toText(item.EduFrontTitle),
      end_title: toText(item.EduEndTitle),
      is_last_education: toBool(item.FgLastEdu),
    })),
    experiences: pickExperiences(candidate).map((item) => ({
      _key: nextRowKey(),
      id: existingId(item.CanExpId),
      company_name: toText(item.CompName ?? item.company_name),
      position: toText(item.JobTtlName ?? item.position),
      company_type_name: toText(item.CompTypeName),
      business_type: toText(item.BusinessType),
      company_address: toText(item.CompAddress),
      company_zip_code: toText(item.CompZipCode),
      company_phone: toText(item.CompPhone),
      start_date: toDateInput(item.JobStart),
      end_date: toDateInput(item.JobEnd),
      period_year: toText(item.JobPrdYear),
      period_month: toText(item.JobPrdMonth),
      salary_start: toText(item.SalaryStart),
      salary_end: toText(item.SalaryEnd),
      termination_reason: toText(item.TermReason),
      total_employee: toText(item.TotalEmp),
      report_to: toText(item.CanReportTo),
      description: toText(item.Description),
      is_present: toBool(item.FgPresent),
    })),
    skills: (candidate.skills ?? []).map((item) => ({
      _key: nextRowKey(),
      id: existingId(item.CanSkillId),
      name: toText(item.SkillName),
      description: toText(item.SkillDesc),
    })),
  };
};

// ---------------------------------------------------------------------------
// State form -> payload PATCH
// ---------------------------------------------------------------------------

/**
 * Field demographics: form key -> payload key + cara konversi.
 * Hanya field yang berubah yang ikut dikirim (Aturan 1 — partial update).
 */
const DEMOGRAPHIC_FIELDS: {
  form: keyof DemographicsForm;
  payload: keyof UpdateCandidatePayload;
  type: "text" | "number" | "boolean";
}[] = [
  { form: "full_name", payload: "full_name", type: "text" },
  { form: "nickname", payload: "nickname", type: "text" },
  { form: "front_title", payload: "front_title", type: "text" },
  { form: "end_title", payload: "end_title", type: "text" },
  { form: "email", payload: "email", type: "text" },
  { form: "mobile_phone", payload: "mobile_phone", type: "text" },
  { form: "gender", payload: "gender", type: "text" },
  { form: "date_of_birth", payload: "date_of_birth", type: "text" },
  { form: "birth_city_name", payload: "birth_city_name", type: "text" },
  { form: "marital_status_id", payload: "marital_status_id", type: "number" },
  { form: "married_date", payload: "married_date", type: "text" },
  { form: "religion_id", payload: "religion_id", type: "number" },
  { form: "race_id", payload: "race_id", type: "number" },
  { form: "blood_type", payload: "blood_type", type: "text" },
  { form: "height", payload: "height", type: "number" },
  { form: "weight", payload: "weight", type: "number" },
  { form: "npwp", payload: "npwp", type: "text" },
  { form: "expected_salary", payload: "expected_salary", type: "number" },
  { form: "availability", payload: "availability", type: "text" },
  { form: "is_fresh_graduate", payload: "is_fresh_graduate", type: "boolean" },
  { form: "bpjs_tk_no", payload: "bpjs_tk_no", type: "text" },
  { form: "bpjs_kes_no", payload: "bpjs_kes_no", type: "text" },
  { form: "bank_name", payload: "bank_name", type: "text" },
  { form: "bank_account", payload: "bank_account", type: "text" },
];

const ADDRESS_FIELDS: (keyof AddressForm)[] = [
  "address",
  "city_name",
  "state_name",
  "zip_code",
  "phone",
  "rt",
  "rw",
  "desa",
];

const buildAddressSection = (
  initial: AddressForm,
  current: AddressForm,
): CandidateAddressPayload | undefined => {
  const changed: CandidateAddressPayload = {};
  let hasChange = false;

  ADDRESS_FIELDS.forEach((field) => {
    if (initial[field] === current[field]) return;
    hasChange = true;
    (changed as Record<string, unknown>)[field] = textOrNull(current[field]);
  });

  return hasChange ? changed : undefined;
};

const buildIdentities = (rows: IdentityForm[]): CandidateIdentityPayload[] =>
  rows.map((row) => ({
    ...(row.id ? { id: row.id } : {}),
    card_type_id: Number(row.card_type_id),
    number: row.number.trim(),
    publisher: textOrNull(row.publisher),
    expired_at: dateOrNull(row.expired_at),
    is_default: Boolean(row.is_default),
  }));

const buildEducations = (rows: EducationForm[]): CandidateEducationPayload[] =>
  rows.map((row) => ({
    ...(row.id ? { id: row.id } : {}),
    edu_level_id: Number(row.edu_level_id),
    major: textOrNull(row.major),
    institution_name: textOrNull(row.institution_name),
    city_name: textOrNull(row.city_name),
    gpa: numberOrNull(row.gpa),
    period_start: textOrNull(row.period_start),
    period_end: textOrNull(row.period_end),
    start_date: dateOrNull(row.start_date),
    graduate_date: dateOrNull(row.graduate_date),
    front_title: textOrNull(row.front_title),
    end_title: textOrNull(row.end_title),
    is_last_education: Boolean(row.is_last_education),
  }));

const buildExperiences = (
  rows: ExperienceForm[],
): CandidateExperiencePayload[] =>
  rows.map((row) => ({
    ...(row.id ? { id: row.id } : {}),
    company_name: row.company_name.trim(),
    position: row.position.trim(),
    company_type_name: textOrNull(row.company_type_name),
    business_type: textOrNull(row.business_type),
    company_address: textOrNull(row.company_address),
    company_zip_code: textOrNull(row.company_zip_code),
    company_phone: textOrNull(row.company_phone),
    start_date: dateOrNull(row.start_date),
    // Backend menolak end_date kalau masih bekerja di sana.
    end_date: row.is_present ? null : dateOrNull(row.end_date),
    period_year: numberOrNull(row.period_year),
    period_month: numberOrNull(row.period_month),
    salary_start: numberOrNull(row.salary_start),
    salary_end: numberOrNull(row.salary_end),
    termination_reason: textOrNull(row.termination_reason),
    total_employee: numberOrNull(row.total_employee),
    report_to: textOrNull(row.report_to),
    description: textOrNull(row.description),
    is_present: Boolean(row.is_present),
  }));

const buildSkills = (rows: SkillForm[]): CandidateSkillPayload[] =>
  rows.map((row) => ({
    ...(row.id ? { id: row.id } : {}),
    name: row.name.trim(),
    description: textOrNull(row.description),
  }));

/** Section koleksi hanya ikut dikirim kalau isinya benar-benar berubah. */
const sectionIfChanged = <TRow, TPayload>(
  initialRows: TRow[],
  currentRows: TRow[],
  build: (rows: TRow[]) => TPayload[],
): TPayload[] | undefined => {
  const next = build(currentRows);
  const previous = build(initialRows);
  return JSON.stringify(previous) === JSON.stringify(next) ? undefined : next;
};

/**
 * Bangun payload PATCH dari selisih form awal dan form saat ini.
 * Section yang tidak disentuh sengaja dihilangkan dari payload — mengirimnya
 * sebagai array kosong berarti menghapus semua barisnya.
 */
export const buildUpdateCandidatePayload = (
  initial: CandidateEditForm,
  current: CandidateEditForm,
): UpdateCandidatePayload => {
  const payload: Record<string, unknown> = {};

  DEMOGRAPHIC_FIELDS.forEach(({ form, payload: key, type }) => {
    const before = initial.demographics[form];
    const after = current.demographics[form];
    if (before === after) return;

    if (type === "boolean") {
      payload[key] = Boolean(after);
    } else if (type === "number") {
      payload[key] = numberOrNull(String(after ?? ""));
    } else {
      payload[key] = textOrNull(String(after ?? ""));
    }
  });

  const residential = buildAddressSection(
    initial.address.residential,
    current.address.residential,
  );
  const original = buildAddressSection(
    initial.address.original,
    current.address.original,
  );
  if (residential || original) {
    payload.address = {
      ...(residential ? { residential } : {}),
      ...(original ? { original } : {}),
    };
  }

  const identities = sectionIfChanged(
    initial.identities,
    current.identities,
    buildIdentities,
  );
  if (identities) payload.identities = identities;

  const educations = sectionIfChanged(
    initial.educations,
    current.educations,
    buildEducations,
  );
  if (educations) payload.educations = educations;

  const experiences = sectionIfChanged(
    initial.experiences,
    current.experiences,
    buildExperiences,
  );
  if (experiences) payload.experiences = experiences;

  const skills = sectionIfChanged(initial.skills, current.skills, buildSkills);
  if (skills) payload.skills = skills;

  return payload as UpdateCandidatePayload;
};

export const isEmptyPayload = (payload: UpdateCandidatePayload): boolean =>
  Object.keys(payload).length === 0;

/**
 * Validasi sisi klien untuk aturan yang pasti ditolak backend. Formatnya
 * mengikuti bentuk `errors` pada response 422, supaya UI cukup punya satu
 * cara menampilkan error.
 */
export const validateCandidateEditForm = (
  form: CandidateEditForm,
): CandidateValidationErrors => {
  const errors: CandidateValidationErrors = {};
  const push = (key: string, message: string) => {
    errors[key] = [...(errors[key] ?? []), message];
  };

  const { demographics } = form;
  if (demographics.full_name.trim() === "") {
    push("full_name", "Nama lengkap wajib diisi.");
  }
  if (demographics.email.trim() === "") {
    push("email", "Email wajib diisi.");
  }
  if (demographics.mobile_phone.trim() === "") {
    push("mobile_phone", "Nomor handphone wajib diisi.");
  }
  if (demographics.gender.trim() === "") {
    push("gender", "Jenis kelamin wajib diisi.");
  }
  if (demographics.date_of_birth.trim() === "") {
    push("date_of_birth", "Tanggal lahir wajib diisi.");
  }

  form.identities.forEach((row, index) => {
    if (row.card_type_id.trim() === "") {
      push(`identities.${index}.card_type_id`, "Jenis kartu wajib dipilih.");
    }
    if (row.number.trim() === "") {
      push(`identities.${index}.number`, "Nomor kartu wajib diisi.");
    }
  });

  let lastEducationCount = 0;
  form.educations.forEach((row, index) => {
    if (row.edu_level_id.trim() === "") {
      push(
        `educations.${index}.edu_level_id`,
        "Tingkat pendidikan wajib dipilih.",
      );
    }
    if (row.is_last_education) lastEducationCount += 1;
  });
  if (lastEducationCount > 1) {
    push(
      "educations",
      "Hanya boleh ada satu riwayat pendidikan yang ditandai sebagai pendidikan terakhir.",
    );
  }

  form.experiences.forEach((row, index) => {
    if (row.company_name.trim() === "") {
      push(`experiences.${index}.company_name`, "Nama perusahaan wajib diisi.");
    }
    if (row.position.trim() === "") {
      push(`experiences.${index}.position`, "Posisi wajib diisi.");
    }
    if (
      !row.is_present &&
      row.start_date &&
      row.end_date &&
      row.end_date < row.start_date
    ) {
      push(
        `experiences.${index}.end_date`,
        "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.",
      );
    }
  });

  form.skills.forEach((row, index) => {
    if (row.name.trim() === "") {
      push(`skills.${index}.name`, "Nama skill wajib diisi.");
    }
  });

  return errors;
};

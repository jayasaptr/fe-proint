// Apply candidate ke SQL Server
export const postApplyToSqlServer = async (
  canId: string | number,
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post(
    `${localApiBaseUrl}/candidates/${canId}/apply-sqlserver`,
  );
  return response.data;
};
import api from "../axios";

export interface CandidateAddress {
  CanId?: string;
  CanResAddress?: string;
  CanResCityId?: string;
  CanResCityName?: string;
  CanResStateName?: string;
  CanResZipCode?: string;
  CanResStatusId?: string | null;
  CanResStatusName?: string | null;
  CanResStart?: string | null;
  CanResPhone?: string;
  CanOriAddress?: string;
  CanOriCityId?: string;
  CanOriCityName?: string;
  CanOriStateName?: string;
  CanOriZipCode?: string;
  CanOriStatusId?: string | null;
  CanOriStatusName?: string | null;
  CanOriStart?: string | null;
  CanOriPhone?: string | null;
  UpdDate?: string;
  UpdUser?: string;
  UpdFlag?: string;
  CanResRT?: string | null;
  CanOriRT?: string | null;
  CanResRW?: string | null;
  CanOriRW?: string | null;
  CanResKecId?: string | null;
  CanOriKecId?: string | null;
  CanResDesa?: string | null;
  CanOriDesa?: string | null;
  CanOriAreaId?: string | null;
  CanOriAreaCode?: string | null;
  CanOriPhoneNmbr?: string | null;
}

export interface CandidateEducation {
  CanEduId?: number;
  CanId?: string;
  EduStatus?: string;
  EduLvlId?: string | number;
  EduMjrId?: string | null;
  EduMjrName?: string;
  EduInsId?: string | null;
  EduInsName?: string | null;
  EduCityId?: string | null;
  EduCityName?: string | null;
  EduGrade?: string;
  EduStart?: string | null;
  EduGraduate?: string | null;
  EduGraduateId?: string | null;
  EduFrontTitle?: string | null;
  EduEndTitle?: string | null;
  FgLastEdu?: "Y" | "N" | null;
  UpdDate?: string;
  UpdUser?: string;
  UpdFlag?: string;
  CanEdufunded?: string | null;
  CanEduName?: string | null;
  EduPeriodStart?: string | null;
  EduPeriodEnd?: string | null;
  FgCertificate?: string | null;
  EduEnd?: string | null;
  education_level?: CandidateEducationLevel | null;
}

export interface CandidateEducationLevel {
  EduLvlId: number;
  EduLvlCode?: string;
  EduLvlName?: string;
  EduLvlStatus?: string;
  EduLevel?: string;
  EduParent?: string | null;
  UpdDate?: string;
  UpdUser?: string;
  UpdFlag?: string;
  FgRpt?: string | null;
  FgSeq?: string | null;
  FgActive?: string;
  InActDate?: string | null;
  InActByUserId?: string | null;
  InActByEmpId?: string | null;
}

export interface CandidateExperience {
  CanExpId?: number | string;
  CanId?: string;
  company_name?: string;
  position?: string;
  job_period_year?: string;
  salary?: number | string | null;
  ExpCompanyName?: string;
  ExpPosition?: string;
  ExpPeriod?: string;
  ExpSalary?: number | string | null;
  CompName?: string;
  CompTypeId?: string | number | null;
  CompTypeName?: string | null;
  CompAddress?: string | null;
  CompCityId?: string | null;
  CompZipCode?: string | null;
  CompPhone?: string | null;
  JobStart?: string | null;
  JobEnd?: string | null;
  JobTitleId?: string | number | null;
  JobTtlName?: string | null;
  SalaryStart?: string | number | null;
  SalaryEnd?: string | number | null;
  TermReason?: string | null;
  Description?: string | null;
  CanSeq?: string | null;
  JobPrdMonth?: string | null;
  JobPrdYear?: string | null;
  TotalEmp?: string | number | null;
  CanReportTo?: string | null;
  BusinessTypeId?: string | number | null;
  BusinessType?: string | null;
  FgPresent?: string | null;
  UpdDate?: string;
  UpdUser?: string;
  UpdFlag?: string;
  questions?: any[];
}

export interface CandidateIdentity {
  CardTypeId?: number | string;
  CardTypeName?: string;
  CardNumber?: string;
  number?: string;
  card_type_name?: string;
  type?: {
    CardType?: string;
    CardTypeId?: number | string;
  };
}

export interface CandidateDocument {
  CanDocId?: number;
  CanId?: number;
  CanDocDesc?: string | null;
  CanDocFile?: string | null;
  CanDoc?: string | null;
  CanDocTypeId?: string | number | null;
  UpdDate?: string | null;
  UpdUser?: string | null;
  UpdFlag?: string | null;
  has_document?: boolean;
  can_doc_mime_type?: string | null;
  can_doc_data_url?: string | null;
}

export interface CandidateJobExpectedOrganizationRecruitment {
  id?: number;
  code?: string;
  name?: string;
  OrgRecId?: number;
  OrgRecCode?: string;
  OrgRecName?: string;
}

export interface CandidateJobExpectedPosition {
  id?: number;
  code?: string;
  name?: string;
  PositionId?: number;
  PosCode?: string;
  PosName?: string;
  company?: {
    id?: number;
    code?: string;
    name?: string;
  } | null;
  job_title?: {
    id?: number;
    code?: string;
    name?: string;
  } | null;
}

export interface CandidateJobExpectedVacantPosition {
  id?: number;
  code?: string;
  name?: string;
  specification?: string | null;
  note?: string | null;
  expires_at?: string | null;
  VacantPosId?: number;
  VacantPosCode?: string;
  VacantPostionId?: string | number | null;
  VacantPositionName?: string;
  VacantPosSpec?: string | null;
  VacantExpDate?: string | null;
  VacantNote?: string | null;
  organization_recruitment?: CandidateJobExpectedOrganizationRecruitment | null;
  position?: CandidateJobExpectedPosition | null;
}

export interface CandidateJobExpectedVacancyInformation {
  source?: string | null;
  vacant_position?: CandidateJobExpectedVacantPosition | null;
  vacant_job?: {
    id?: number;
    code?: string;
    name?: string;
  } | null;
  position?: CandidateJobExpectedPosition | null;
  job_title?: {
    id?: number;
    code?: string;
    name?: string;
  } | null;
  organization_recruitment?: CandidateJobExpectedOrganizationRecruitment | null;
}

export interface CandidateJobExpected {
  CanJobExpectedId?: number;
  CanId?: number;
  Priority?: string | number | null;
  JobTtlId?: string | number | null;
  UpdDate?: string | null;
  UpdUser?: string | null;
  UpdFlag?: string | null;
  VacantId?: string | number | null;
  OtherJobTtlName?: string | null;
  PositionId?: string | number | null;
  OtherPosName?: string | null;
  VacantPosId?: string | number | null;
  vacancy_information?: CandidateJobExpectedVacancyInformation | null;
  job_title?: {
    id?: number;
    code?: string;
    name?: string;
  } | null;
  position?: CandidateJobExpectedPosition | null;
  vacant_job?: {
    id?: number;
    code?: string;
    name?: string;
  } | null;
  vacant_position?: CandidateJobExpectedVacantPosition | null;
}

export interface CandidateSkill {
  SkillName?: string;
  SkillLevel?: string | null;
  [key: string]: unknown;
}

export interface CandidateLanguage {
  LangName?: string;
  LangLevel?: string | null;
  [key: string]: unknown;
}

export interface CandidatePhoto {
  CanPhotoId?: number | string;
  CanId?: string;
  FgDefault?: string | null;
  UpdDate?: string;
  UpdUser?: string;
  Updflag?: string;
  can_photo_base64?: string | null;
}

export interface Candidate {
  CanId: number;
  CanCode: string;
  CanName: string;
  CanNickName?: string | null;
  CanDateBirth?: string | null;
  CanIsFore?: string | null;
  CanCityBirthId?: string | number | null;
  CanCityBirthName?: string | null;
  CanSex?: string | null;
  CanReligionId?: string | number | null;
  CanHeight?: string | null;
  CanWeight?: string | null;
  CanHandphone?: string | null;
  CanEmail?: string | null;
  CanBloodType?: string | null;
  CanStatus?: string | null;
  CanMaritalStId?: string | number | null;
  CanRaceId?: string | number | null;
  CanCitizenId?: string | number | null;
  CanSourceId?: string | number | null;
  CanSource?: string | null;
  CanSourceNote?: string | null;
  CanExpSal?: number | string | null;
  CanExpType?: string | null;
  CanAvailability?: string | null;
  CanCurrId?: string | number | null;
  CanAdvId?: string | number | null;
  CanOrgId?: string | number | null;
  CanNPWP?: string | null;
  CanMarriedDate?: string | null;
  CanFrontTitle?: string | null;
  CanEndTitle?: string | null;
  CanInstId?: string | number | null;
  CanInstName?: string | null;
  CanBPJSTKNo?: string | null;
  CanBPJSKesNo?: string | null;
  CanFaskesId?: string | number | null;
  CanBankAcc?: string | null;
  CanBankName?: string | null;
  CanBankId?: string | number | null;
  FgCanCategory?: string | null;
  CanLocRecruitId?: string | number | null;
  CanBankAttach?: string | null;
  CanBankAttachFile?: string | null;
  PPhPTKP?: string | null;
  FgChanges?: string | null;
  FgFreshGrad?: string | null;
  RefTypeId?: string | number | null;
  RefTypeName?: string | null;
  CanEntryDate?: string | null;
  CanApplyDate?: string | null;
  UpdDate?: string | null;
  UpdUser?: string | null;
  UpdFlag?: string | null;
  status_apply?: string | null;
  addresses?: CandidateAddress[];
  education?: CandidateEducation[];
  experiences?: CandidateExperience[];
  work_experiences?: CandidateExperience[];
  identities?: CandidateIdentity[];
  id_cards?: CandidateIdentity[];
  cards?: CandidateIdentity[];
  documents?: CandidateDocument[];
  job_expected?: CandidateJobExpected[];
  skills?: CandidateSkill[];
  languages?: CandidateLanguage[];
  photos?: CandidatePhoto[];
  is_checked?: boolean;
  checked_at?: string | null;
  checked_by?: string | null;
  is_passed?: boolean;
  passed_at?: string | null;
  passed_by?: string | null;
  passed_note?: string | null;
}

export interface CandidatePaginationData {
  current_page: number;
  data: Candidate[];
  from: number | null;
  to: number | null;
  last_page: number;
  per_page: number;
  total: number;
}

export interface CandidatesResponse {
  success: boolean;
  message: string;
  data: CandidatePaginationData;
}

export interface CandidateDetailResponse {
  success: boolean;
  message: string;
  data: Candidate;
}

export interface CandidateFilters {
  name?: string;
  vacancy_name?: string;
  status_apply?: string;
  start_date?: string;
  end_date?: string;
  position_id?: string | number;
  job_title_id?: string | number;
  job_id?: string | number;
  search?: string;
  sort_by?: string;
  sort_direction?: string;
  page?: number;
  per_page?: number;
  EduLevel?: string | number | (string | number)[];
  CanOriStateName?: string | string[];
  CanOriCityName?: string | string[];
  EduMjrName?: string | string[];
  is_checked?: string | boolean | number;
  is_passed?: string | boolean | number;
  [key: string]: any; // Allow dynamic column filters
}

const localApiBaseUrl =
  import.meta.env.VITE_API_URL_LOCAL || import.meta.env.VITE_API_URL;

export const getCandidates = async (
  filters: CandidateFilters = {},
): Promise<CandidatesResponse> => {
  const params: Record<string, any> = {};

  // Helper function to add parameters, handling arrays with [] notation
  const addParam = (key: string, value: any) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params[`${key}[]`] = value;
      }
    } else if (value !== "all") {
      params[key] = value;
    }
  };

  // Add standard filters
  if (filters.name) addParam("name", filters.name);
  if (filters.vacancy_name) addParam("vacancy_name", filters.vacancy_name);
  if (filters.status_apply) addParam("status_apply", filters.status_apply);
  if (filters.start_date) addParam("start_date", filters.start_date);
  if (filters.end_date) addParam("end_date", filters.end_date);
  if (filters.position_id) addParam("position_id", filters.position_id);
  if (filters.job_title_id) addParam("job_title_id", filters.job_title_id);
  if (filters.job_id) addParam("job_id", filters.job_id);
  if (filters.search) addParam("search", filters.search);
  if (filters.sort_by) addParam("sort_by", filters.sort_by);
  if (filters.sort_direction)
    addParam("sort_direction", filters.sort_direction);
  if (filters.page) addParam("page", filters.page);
  if (filters.per_page) addParam("per_page", filters.per_page);
  if (filters.is_checked !== undefined)
    addParam("is_checked", filters.is_checked);
  if (filters.is_passed !== undefined) addParam("is_passed", filters.is_passed);

  // Multi-value filters
  if (filters.EduLevel) addParam("EduLevel", filters.EduLevel);
  if (filters.CanOriStateName)
    addParam("CanOriStateName", filters.CanOriStateName);
  if (filters.CanOriCityName)
    addParam("CanOriCityName", filters.CanOriCityName);
  if (filters.EduMjrName) addParam("EduMjrName", filters.EduMjrName);

  // Add dynamic filters
  const standardKeys = [
    "name",
    "vacancy_name",
    "status_apply",
    "start_date",
    "end_date",
    "position_id",
    "job_title_id",
    "job_id",
    "search",
    "sort_by",
    "sort_direction",
    "page",
    "per_page",
    "EduLevel",
    "CanOriStateName",
    "CanOriCityName",
    "EduMjrName",
    "is_checked",
    "is_passed",
  ];

  Object.keys(filters).forEach((key) => {
    if (!standardKeys.includes(key) && filters[key] !== undefined) {
      addParam(key, filters[key]);
    }
  });

  const response = await api.get<CandidatesResponse>(
    `${localApiBaseUrl}/candidates`,
    {
      params,
    },
  );

  return response.data;
};

export const getCandidateById = async (
  canId: string | number,
): Promise<CandidateDetailResponse> => {
  const response = await api.get<CandidateDetailResponse>(
    `${localApiBaseUrl}/candidates/${canId}`,
  );
  return response.data;
};

export const downloadCandidateDocument = async (
  canId: string | number,
  canDocId: number,
): Promise<Blob> => {
  const response = await api.get(
    `${localApiBaseUrl}/candidates/${canId}/documents/${canDocId}/download`,
    {
      responseType: "blob",
    },
  );

  return response.data;
};

export const previewCandidateDocument = async (
  canId: string | number,
  canDocId: number,
): Promise<{ blob: Blob; mimeType: string; filename: string | null }> => {
  const response = await api.get(
    `${localApiBaseUrl}/candidates/${canId}/documents/${canDocId}/preview`,
    {
      responseType: "blob",
    },
  );

  const blob: Blob = response.data;
  const mimeType =
    response.headers["content-type"]?.split(";")[0]?.trim() ||
    blob.type ||
    "application/octet-stream";

  const disposition = response.headers["content-disposition"] ?? "";
  const match = disposition.match(/filename\*?="?([^";]+)"?/i);
  const filename = match?.[1] ? decodeURIComponent(match[1]) : null;

  return { blob, mimeType, filename };
};

export const downloadCandidateAttachments = async (
  canId: string | number,
): Promise<{ blob: Blob; filename: string }> => {
  const response = await api.get(
    `${localApiBaseUrl}/candidates/${canId}/attachments/download`,
    {
      responseType: "blob",
      headers: {
        Accept: "application/zip",
      },
    },
  );

  // Extract filename from Content-Disposition header
  const disposition = response.headers["content-disposition"] ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? `candidate-${canId}-attachments.zip`;

  return {
    blob: response.data,
    filename,
  };
};

// ---- Bulk Import via Excel ----

export interface CandidateImportRow {
  row: number;
  status: "imported" | "failed";
  candidate_id?: number;
  email?: string;
  errors?: Record<string, string[]>;
}

export interface CandidateImportData {
  total: number;
  imported: number;
  failed: number;
  rows: CandidateImportRow[];
}

export interface CandidateImportResponse {
  success: boolean;
  message: string;
  data: CandidateImportData;
}

/**
 * Download the Excel import template (.xlsx) and trigger a browser download.
 * The response is a binary file, so it MUST be requested as a blob.
 */
export const downloadCandidateImportTemplate = async (): Promise<void> => {
  const response = await api.get(
    `${localApiBaseUrl}/candidates/import/template`,
    { responseType: "blob" },
  );

  // Prefer the filename provided by the backend via Content-Disposition.
  const disposition = response.headers["content-disposition"] ?? "";
  const match = disposition.match(/filename\*?="?([^";]+)"?/i);
  const filename = match?.[1]
    ? decodeURIComponent(match[1])
    : "template_import_candidate.xlsx";

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Upload an Excel file and import candidates row by row.
 * Import is partial: valid rows are saved even if others fail.
 */
export const importCandidates = async (
  file: File,
): Promise<CandidateImportResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<CandidateImportResponse>(
    `${localApiBaseUrl}/candidates/import`,
    formData,
    {
      // Let axios set the multipart boundary automatically; only override
      // the JSON default from the shared instance.
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return response.data;
};

export const toggleCandidateChecklist = async (
  canId: string | number,
): Promise<{
  success: boolean;
  message: string;
  data: {
    CanId: number;
    is_checked: boolean;
    checked_at: string | null;
    checked_by: string | null;
  };
}> => {
  const response = await api.post(
    `${localApiBaseUrl}/candidates/${canId}/toggle-checklist`,
  );
  return response.data;
};

export const toggleCandidatePassed = async (
  canId: string | number,
  note?: string,
): Promise<{
  success: boolean;
  message: string;
  data: {
    CanId: number;
    is_passed: boolean;
    passed_at: string | null;
    passed_by: string | null;
    passed_note: string | null;
  };
}> => {
  const body = note && note.trim() !== "" ? { note: note.trim() } : {};
  const response = await api.post(
    `${localApiBaseUrl}/candidates/${canId}/toggle-passed`,
    body,
  );
  return response.data;
};

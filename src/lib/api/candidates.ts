import api from '../axios';

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
  FgLastEdu?: 'Y' | 'N' | null;
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
}

export interface CandidateIdentity {
  CardTypeId?: number | string;
  CardTypeName?: string;
  CardNumber?: string;
  number?: string;
  card_type_name?: string;
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
  addresses?: CandidateAddress[];
  education?: CandidateEducation[];
  experiences?: CandidateExperience[];
  work_experiences?: CandidateExperience[];
  identities?: CandidateIdentity[];
  cards?: CandidateIdentity[];
  documents?: CandidateDocument[];
  job_expected?: CandidateJobExpected[];
  skills?: CandidateSkill[];
  languages?: CandidateLanguage[];
  photos?: CandidatePhoto[];
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
  search?: string;
  page?: number;
}

const localApiBaseUrl = import.meta.env.VITE_API_URL_LOCAL || import.meta.env.VITE_API_URL;

export const getCandidates = async (filters: CandidateFilters = {}): Promise<CandidatesResponse> => {
  const params: Record<string, string | number> = {
    search: filters.search ?? '',
    page: filters.page ?? 1,
  };

  const response = await api.get<CandidatesResponse>(`${localApiBaseUrl}/candidates`, {
    params,
  });

  return response.data;
};

export const getCandidateById = async (canId: string | number): Promise<CandidateDetailResponse> => {
  const response = await api.get<CandidateDetailResponse>(`${localApiBaseUrl}/candidates/${canId}`);
  return response.data;
};

export const downloadCandidateDocument = async (canId: string | number, canDocId: number): Promise<Blob> => {
  const response = await api.get(`${localApiBaseUrl}/candidates/${canId}/documents/${canDocId}/download`, {
    responseType: 'blob',
  });

  return response.data;
};

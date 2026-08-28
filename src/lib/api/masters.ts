import api from "../axios";

// Master data dilayani oleh endpoint publik (VITE_API_URL), bukan API lokal
// admin — pola yang sama sudah dipakai ApplyJobModal dan CandidatesPage.
const masterApiBaseUrl = import.meta.env.VITE_API_URL;

interface MasterListResponse<T> {
  data?: T[];
  pagination?: { has_next?: boolean };
}

const fetchMasterList = async <T>(
  resource: string,
  params: Record<string, string | number> = {},
): Promise<T[]> => {
  const response = await api.get<MasterListResponse<T>>(
    `${masterApiBaseUrl}/${resource}`,
    { params: { per_page: 200, ...params } },
  );
  return response.data?.data ?? [];
};

export interface EduLevelMaster {
  EduLvlId: number;
  EduLvlCode?: string;
  EduLvlName?: string;
}

export interface MaritalStatusMaster {
  MaritalStId: number;
  MaritalSt?: string;
}

export interface RaceMaster {
  RaceId: number;
  Race?: string;
}

export const getEduLevels = (search?: string) =>
  fetchMasterList<EduLevelMaster>("edulevels", search ? { search } : {});

export const getMaritalStatuses = (search?: string) =>
  fetchMasterList<MaritalStatusMaster>(
    "maritalstatuses",
    search ? { search } : {},
  );

export const getRaces = (search?: string) =>
  fetchMasterList<RaceMaster>("races", search ? { search } : {});

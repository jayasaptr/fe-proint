import api from '../axios';

export interface PosAdtGrpHd {
  PosAdtTypeId: number;
  PosAdtType: string;
  PosAdtName: string;
  FgShowOnSummary: string;
  GrpIcoFileName: string | null;
  GrpIcon: string | null;
  FgActive: string;
  FgStyle: string;
  UpdDate: string;
  UpdUser: string;
  UpdFlag: string;
}

export interface PosAdtGrpDt {
  PosAdtGrpId: number;
  PosAdtTypeId: number;
  PosAdtGrpCode: string;
  PosAdtGrpName: string;
  UpdDate: string;
  UpdUser: string;
  UpdFlag: string;
  PosAdtGrpHd?: Partial<PosAdtGrpHd>;
}

export interface PosAdtGroup {
  PosAdtMbrId: number;
  PosAdtGrpId: number;
  PosAdtTypeId: number;
  PosAdtGrpCode: string;
  PosAdtGrpName: string;
  PosAdtType: string;
  PosAdtName: string;
  FgShowOnSummary: string;
}

export interface Vacancy {
  VacantPosId: number;
  VacantPosCode: string;
  VacantPostionId: number;
  VacantPositionName: string;
  VacantPosSpec: string;
  FgActive: string;
  OrgRecId: number;
  FgOtherPos: string | null;
  VacantExpDate: string;
  VacantNote: string;
  FgShowVacant: string;
  VacantCompGrpId: number | null;
  UpdDate: string;
  UpdUser: string;
  UpdFlag: string;
  RequestNo: string | null;
  PosAdtGroups?: PosAdtGroup[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
  total?: number;
}

export interface VacancyFilters {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  search?: string;
  posadt_grp_id?: number | number[];
  posadt_type_id?: number | number[];
  include_relations?: boolean;
}

export const positionAuditService = {
  getCategories: async (): Promise<ApiResponse<PosAdtGrpHd[]>> => {
    const response = await api.get('/posadtgrphd', { baseURL: import.meta.env.VITE_API_URL });
    return response.data;
  },

  getCategoryById: async (id: number): Promise<ApiResponse<PosAdtGrpHd>> => {
    const response = await api.get(`/posadtgrphd/${id}`, { baseURL: import.meta.env.VITE_API_URL });
    return response.data;
  },

  getOptionsByCategory: async (categoryIds: number | number[], includeHeader = false): Promise<PaginatedResponse<PosAdtGrpDt>> => {
    const response = await api.get('/posadtgrpdt', {
      baseURL: import.meta.env.VITE_API_URL,
      params: {
        posadt_type_id: categoryIds,
        include_header: includeHeader,
      },
      paramsSerializer: {
        indexes: null
      }
    });
    return response.data;
  },

  getOptionById: async (id: number, includeHeader = false): Promise<ApiResponse<PosAdtGrpDt>> => {
    const response = await api.get(`/posadtgrpdt/${id}`, {
      baseURL: import.meta.env.VITE_API_URL,
      params: { include_header: includeHeader },
    });
    return response.data;
  },
};

export const vacancyService = {
  getVacancies: async (filters: VacancyFilters = {}): Promise<PaginatedResponse<Vacancy>> => {
    const response = await api.get('/vacancies', { 
      baseURL: import.meta.env.VITE_API_URL,
      params: filters,
      paramsSerializer: {
        indexes: null
      }
    });
    return response.data;
  },

  getVacancyById: async (id: number, includeRelations = true): Promise<ApiResponse<Vacancy>> => {
    const response = await api.get(`/vacancies/${id}`, {
      baseURL: import.meta.env.VITE_API_URL,
      params: { include_relations: includeRelations },
    });
    return response.data;
  },
};

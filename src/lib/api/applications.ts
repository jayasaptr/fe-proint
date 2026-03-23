import axiosInstance from '../axios';
import { type Job } from './jobs';

export interface Identity {
  id: number;
  application_id: string;
  identity_type: string;
  number: string;
  created_at: string;
}

export interface Education {
  id: number;
  application_id: string;
  degree: string;
  major: string;
  institution: string;
  gpa: number;
  is_last_education: boolean;
  created_at: string;
}

export interface Experience {
  id: number;
  application_id: string;
  company_name: string;
  position: string;
  job_period_year: string;
  salary: number;
  created_at: string;
}

export interface ApplicationDocument {
  id: number;
  application_id: string;
  file_path: string;
  description: string;
  doc_url: string;
  created_at: string;
}

export interface Application {
  id: string;
  job_id: string;
  full_name: string;
  gender?: string;
  place_of_birth?: string;
  date_of_birth?: string;
  marital_status?: string;
  blood_type?: string;
  email: string;
  ethnicity?: string;
  photo_path?: string;
  photo_url?: string;
  id_card_address?: string;
  province?: string;
  city?: string;
  zip_code?: string;
  mobile_phone?: string;
  current_benefit?: string;
  current_salary?: number;
  salary_expectation?: number;
  availability?: string;
  has_worked_in_company?: boolean;
  worked_in_company_desc?: string | null;
  has_family_in_company?: boolean;
  family_in_company_desc?: string | null;
  has_followed_recruitment?: boolean;
  followed_recruitment_desc?: string | null;
  is_declared_true?: boolean;
  status: 'New' | 'Review' | 'Rejected' | 'Hired';
  submitted_at: string;
  created_at: string;
  updated_at: string;
  job?: Job;
  identities?: Identity[];
  educations?: Education[];
  experiences?: Experience[];
  documents?: ApplicationDocument[];
}

export interface ApplicationListResponse {
  success: boolean;
  data: Application[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  }
}

export interface ApplicationDetailResponse {
  success: boolean;
  message?: string;
  data: Application;
}

export interface SubmitApplicationResponse {
  success: boolean;
  message: string;
  data: {
    candidate_id: number;
    candidate_code: string;
  };
  errors?: Record<string, string[]>;
}

export interface CheckApplicationResponse {
  success: boolean;
  exists: boolean;
  message: string;
}

export interface CaptchaConfigResponse {
  success: boolean;
  data: {
    site_key: string;
    verify_url: string;
  }
}

export interface CaptchaVerifyResponse {
  success: boolean;
  message: string;
  debug_info?: any;
}

export interface ApplicationStatisticsResponse {
  success: boolean;
  data: {
    total: number;
    by_status: {
      New: number;
      Review: number;
      Rejected: number;
      Hired: number;
    };
    by_job: {
      job_id: string;
      job_title: string;
      count: number;
    }[];
    recent_applications: number;
  }
}

/**
 * Submit a new application (Public)
 */
export const submitApplication = async (formData: FormData): Promise<SubmitApplicationResponse> => {
  const response = await axiosInstance.post<SubmitApplicationResponse>('http://api-career.ptdh.co.id/api/candidates/apply-job', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Check if candidate already applied to a specific job (Recommended pre-submit check)
 */
export const checkApplication = async (email: string, jobId: number): Promise<CheckApplicationResponse> => {
  const response = await axiosInstance.post<CheckApplicationResponse>('/candidates/check-application', {
    email,
    job_id: jobId,
  });
  return response.data;
};

/**
 * Check if email has been used before (informational only)
 */
export const checkEmail = async (email: string): Promise<CheckApplicationResponse> => {
  const response = await axiosInstance.post<CheckApplicationResponse>('/candidates/check-email', { email });
  return response.data;
};

/**
 * Check if identity number has been used before (informational only)
 */
export const checkIdentity = async (identityNumber: string): Promise<CheckApplicationResponse> => {
  const response = await axiosInstance.post<CheckApplicationResponse>('/candidates/check-identity', {
    identity_number: identityNumber,
  });
  return response.data;
};

/**
 * Get all applications (Admin)
 */
export const getApplications = async (params?: { search?: string; job_id?: string; status?: string; location?: string; site?: string; start_date?: string; end_date?: string }): Promise<ApplicationListResponse> => {
  const response = await axiosInstance.get<ApplicationListResponse>('/applications', { params });
  return response.data;
};

/**
 * Get application details by ID (Admin)
 */
export const getApplicationById = async (id: string): Promise<ApplicationDetailResponse> => {
  const response = await axiosInstance.get<ApplicationDetailResponse>(`/applications/${id}`);
  return response.data;
};

/**
 * Export applications to Excel (HR & Admin only)
 */
export const exportApplications = async (params?: { search?: string; job_id?: string; status?: string; location?: string; site?: string; start_date?: string; end_date?: string }): Promise<Blob> => {
  const response = await axiosInstance.get('/applications/export', {
    params,
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Export application attachments to ZIP (HR & Admin only)
 */
export const exportAttachments = async (params?: { search?: string; job_id?: string; status?: string; location?: string; site?: string; start_date?: string; end_date?: string }): Promise<Blob> => {
  const response = await axiosInstance.get('/applications/export-attachments', {
    params,
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Get Captcha Config
 */
export const getCaptchaConfig = async (): Promise<CaptchaConfigResponse> => {
  const response = await axiosInstance.get<CaptchaConfigResponse>('/candidates/captcha-config');
  return response.data;
};

/**
 * Test Captcha (Development Only)
 */
export const testCaptcha = async (token: string): Promise<CaptchaVerifyResponse> => {
  const response = await axiosInstance.post<CaptchaVerifyResponse>('/applications/test-captcha', { captcha_token: token });
  return response.data;
};

/**
 * Download Application Photo
 */
export const downloadPhoto = async (applicationId: string): Promise<Blob> => {
  const response = await axiosInstance.get(`/applications/${applicationId}/download-photo`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Update Application Status (HR & Admin only)
 */
export const updateApplicationStatus = async (id: string, status: string): Promise<any> => {
  const response = await axiosInstance.put(`/applications/${id}/status`, { status });
  return response.data;
};

/**
 * Get Applications Statistics (HR & Admin only)
 */
export const getApplicationStatistics = async (job_id?: string): Promise<ApplicationStatisticsResponse> => {
  const response = await axiosInstance.get<ApplicationStatisticsResponse>('/applications/statistics', {
    params: { job_id },
  });
  return response.data;
};

/**
 * Download Application Document (HR & Admin only)
 */
export const downloadDocument = async (applicationId: string, documentId: number): Promise<Blob> => {
  const response = await axiosInstance.get(`/applications/${applicationId}/documents/${documentId}/download`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Delete Application (Admin only)
 */
export const deleteApplication = async (id: string): Promise<any> => {
  const response = await axiosInstance.delete(`/applications/${id}`);
  return response.data;
};

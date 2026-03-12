import api from '../axios';

export interface Job {
  id: string;
  title: string;
  level: string;
  location: string;
  site?: string;
  description: string;
  requirements: string;
  start_date: string | null;
  end_date: string | null;
  status: 'Draft' | 'Open' | 'Closed';
  created_at?: string;
  updated_at?: string;
  created_by?: {
    id: string;
    username: string;
    name: string;
    roles: string[];
  };
  updated_by?: {
    id: string;
    username: string;
    name: string;
    roles: string[];
  };
  deleted_at?: string;
  deleted_by?: {
    id: string;
    username: string;
    name: string;
    roles: string[];
  };
}

export interface JobsResponse {
  success: boolean;
  data: Job[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface JobResponse {
  success: boolean;
  data: Job;
}

export interface JobFilters {
  page?: number;
  per_page?: number;
  title?: string;
  location?: string;
  site?: string;
  level?: string;
  status?: string;
  public?: boolean;
}

export const getJobs = async (filters: JobFilters = {}): Promise<JobsResponse> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.append(key, value.toString());
    }
  });

  const response = await api.get(`/jobs?${params.toString()}`);
  return response.data;
};

export const getJobById = async (id: string): Promise<JobResponse> => {
  const response = await api.get(`/jobs/${id}`);
  return response.data;
};

export const createJob = async (jobData: Partial<Job>): Promise<JobResponse> => {
  const response = await api.post('/jobs', jobData);
  return response.data;
};

export const updateJob = async (id: string, jobData: Partial<Job>): Promise<JobResponse> => {
  const response = await api.put(`/jobs/${id}`, jobData);
  return response.data;
};

export const deleteJob = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/jobs/${id}`);
  return response.data;
};

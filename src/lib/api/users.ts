import api from '../axios';

export interface User {
  id: string;
  username: string;
  name: string;
  roles: string[];
  must_change_password?: boolean;
  is_admin?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

export interface RegisterUserRequest {
  username: string;
  name: string;
  password?: string;
  role_ids?: string[];
}

export interface UpdateUserRequest {
  username?: string;
  name?: string;
  password?: string;
}

export interface ChangePasswordRequest {
  old_password?: string;
  new_password?: string;
}

export const registerUser = async (data: RegisterUserRequest): Promise<ApiResponse<User>> => {
  const response = await api.post('/auth/register', data);
  return response.data;
};

export const getCurrentUser = async (): Promise<ApiResponse<User>> => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const logoutUser = async (): Promise<ApiResponse<void>> => {
  const response = await api.post('/logout');
  return response.data;
};

export const getUsers = async (params?: { role?: string; name?: string; page?: number; per_page?: number }): Promise<ApiResponse<User[]>> => {
  const response = await api.get('/auth/users', { params });
  return response.data;
};

export const getUser = async (id: string): Promise<ApiResponse<User>> => {
  const response = await api.get(`/auth/users/${id}`);
  return response.data;
};

export const updateUser = async (id: string, data: UpdateUserRequest): Promise<ApiResponse<User>> => {
  const response = await api.put(`/auth/users/${id}`, data);
  return response.data;
};

export const assignRole = async (id: string, roleId: string): Promise<ApiResponse<User>> => {
  const response = await api.post(`/auth/users/${id}/roles`, { role_id: roleId });
  return response.data;
};

export const removeRole = async (id: string, roleId: string): Promise<ApiResponse<User>> => {
  const response = await api.delete(`/auth/users/${id}/roles/${roleId}`);
  return response.data;
};

export const deleteUser = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete(`/auth/users/${id}`);
  return response.data;
};

export const getRoles = async (): Promise<ApiResponse<Role[]>> => {
  const response = await api.get('/roles');
  return response.data;
};

export const changePassword = async (data: ChangePasswordRequest): Promise<ApiResponse<void>> => {
  const response = await api.post('/auth/change-password', data);
  return response.data;
};

// --- New /admin/users Endpoints ---

export interface AdminUser {
  id: number;
  jde: string;
  name?: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export const getAdminUsers = async (): Promise<AdminUser[]> => {
  const response = await api.get('/admin/users');
  return response.data.data || response.data;
};

export const createAdminUser = async (data: { jde: string; name?: string; is_admin: boolean; password?: string }): Promise<any> => {
  const response = await api.post('/admin/users/store', data);
  return response.data;
};

export const updateAdminUser = async (jde: string, data: { jde: string; name?: string; password?: string }): Promise<any> => {
  const response = await api.put(`/admin/users/${jde}`, data);
  return response.data;
};

export const deleteAdminUser = async (jde: string): Promise<any> => {
  const response = await api.delete(`/admin/users/${jde}`);
  return response.data;
};

export const setAdminUser = async (jde: string, data: { is_admin: boolean }): Promise<any> => {
  const response = await api.post(`/admin/users/${jde}/set-admin`, data);
  return response.data;
};


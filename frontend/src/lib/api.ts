// ============================================================
// API CLIENT - TypeScript con tipos estrictos
// ============================================================

import type { ApiError, RequestOptions, ApiClient } from '../types/api';

// API URL: use environment variable in production, fallback to localhost for development
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const API_URL = `${API_BASE}/api`;

export const getHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const error: ApiError = await res.json().catch(() => ({
      error: 'Error desconocido',
      code: 'UNKNOWN_ERROR'
    }));
    throw error;
  }
  return res.json();
};

export const api: ApiClient = {
  get: async <T>(url: string, options?: RequestOptions): Promise<T> => {
    const searchParams = options?.params
      ? '?' + new URLSearchParams(
          Object.entries(options.params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';

    const res = await fetch(`${API_URL}${url}${searchParams}`, {
      headers: getHeaders()
    });
    return handleResponse<T>(res);
  },

  post: async <T>(url: string, body: unknown, options?: RequestOptions): Promise<T> => {
    const res = await fetch(`${API_URL}${url}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse<T>(res);
  },

  put: async <T>(url: string, body: unknown, options?: RequestOptions): Promise<T> => {
    const res = await fetch(`${API_URL}${url}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse<T>(res);
  },

  delete: async <T>(url: string, options?: RequestOptions): Promise<T> => {
    const res = await fetch(`${API_URL}${url}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse<T>(res);
  }
};
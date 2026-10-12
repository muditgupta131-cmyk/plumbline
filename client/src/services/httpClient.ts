import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { ApiFailure, ApiSuccess } from '@/types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiFailure['details'];

  constructor(message: string, status: number, code: string, details?: ApiFailure['details']) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  fieldError(field: string): string | undefined {
    return this.details?.find((detail) => detail.field === field)?.message;
  }
}

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export const session = {
  setAccessToken(token: string | null): void {
    accessToken = token;
  },
  getAccessToken(): string | null {
    return accessToken;
  },
  onExpired(handler: () => void): void {
    onSessionExpired = handler;
  },
};

const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 20_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const refreshClient: AxiosInstance = axios.create({
  baseURL: instance.defaults.baseURL,
  timeout: 20_000,
  withCredentials: true,
});

instance.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/google', '/auth/refresh', '/auth/logout'];

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  refreshPromise ??= refreshClient
    .post<ApiSuccess<{ accessToken: string }>>('/auth/refresh')
    .then((response) => {
      const token = response.data.data.accessToken;
      accessToken = token;
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function toApiError(error: AxiosError<ApiFailure>): ApiError {
  if (!error.response) {
    return new ApiError('Cannot reach Plumbline servers. Check your connection and retry.', 0, 'NETWORK_ERROR');
  }

  const { status, data } = error.response;
  return new ApiError(
    data?.message ?? 'Something went wrong while talking to the server.',
    status,
    data?.code ?? 'UNKNOWN_ERROR',
    data?.details,
  );
}

instance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiFailure>) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const path = config?.url ?? '';

    const shouldRefresh =
      status === 401 && config && !config._retried && !NO_REFRESH_PATHS.some((entry) => path.includes(entry));

    if (shouldRefresh) {
      config._retried = true;
      try {
        const token = await refreshAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return await instance.request(config);
      } catch {
        accessToken = null;
        onSessionExpired?.();
        return Promise.reject(new ApiError('Your session expired. Sign in again.', 401, 'UNAUTHORIZED'));
      }
    }

    return Promise.reject(toApiError(error));
  },
);

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await instance.request<ApiSuccess<T>>(config);
  return response.data.data;
}

export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, url, method: 'GET' }),
  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url, method: 'POST', data: body }),
  patch: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url, method: 'PATCH', data: body }),
  put: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url, method: 'PUT', data: body }),
  delete: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, url, method: 'DELETE' }),
  raw: instance,
};

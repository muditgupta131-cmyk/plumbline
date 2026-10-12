export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  message: string;
  code: string;
  details?: Array<{ field: string; message: string }>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  uptime: number;
  environment: string;
  version: string;
  services: {
    database: 'connected' | 'disconnected';
  };
}

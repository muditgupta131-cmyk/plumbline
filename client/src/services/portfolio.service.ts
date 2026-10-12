import { http } from './httpClient';
import type {
  ImportStrategy,
  CandleRange,
  ImportCommitRow,
  ImportCommitTransaction,
  ImportPreview,
  ImportResult,
  PortfolioTransaction,
  PositionState,
  CreateTransactionPayload,
  CreateHoldingPayload,
  CreatePortfolioPayload,
  PerformanceResponse,
  PortfolioSummary,
  PortfolioValuation,
  UpdateHoldingPayload,
} from '@/types';

export const portfolioService = {
  list: () => http.get<{ portfolios: PortfolioSummary[] }>('/portfolio'),

  create: (payload: CreatePortfolioPayload) => http.post<PortfolioSummary>('/portfolio', payload),

  detail: (id: string) => http.get<PortfolioValuation>(`/portfolio/${id}`),

  update: (id: string, payload: Partial<CreatePortfolioPayload>) =>
    http.patch<PortfolioSummary>(`/portfolio/${id}`, payload),

  remove: (id: string) => http.delete<null>(`/portfolio/${id}`),

  addHolding: (id: string, payload: CreateHoldingPayload) => http.post<unknown>(`/portfolio/${id}/holdings`, payload),

  updateHolding: (id: string, holdingId: string, payload: UpdateHoldingPayload) =>
    http.patch<unknown>(`/portfolio/${id}/holdings/${holdingId}`, payload),

  removeHolding: (id: string, holdingId: string) => http.delete<null>(`/portfolio/${id}/holdings/${holdingId}`),

  transactions: (id: string) =>
    http.get<{ transactions: PortfolioTransaction[] }>(`/portfolio/${id}/transactions`),

  addTransaction: (id: string, payload: CreateTransactionPayload) =>
    http.post<{ transaction: PortfolioTransaction; position: PositionState }>(`/portfolio/${id}/transactions`, payload),

  removeTransaction: (id: string, transactionId: string) =>
    http.delete<null>(`/portfolio/${id}/transactions/${transactionId}`),

  importPreview: (id: string, content: string) =>
    http.post<ImportPreview>(`/portfolio/${id}/import/preview`, { content }),

  // CAS PDFs travel as base64 so the statement rides the same JSON transport as every other call.
  importStatement: (id: string, file: string, password?: string) =>
    http.post<ImportPreview & { pages: number }>(`/portfolio/${id}/import/statement`, { file, password }),

  importCommit: (id: string, rows: ImportCommitRow[], strategy: ImportStrategy = 'add') =>
    http.post<ImportResult>(`/portfolio/${id}/import/commit`, { rows, strategy }),

  importCommitTransactions: (id: string, rows: ImportCommitTransaction[]) =>
    http.post<ImportResult>(`/portfolio/${id}/import/commit`, { mode: 'transactions', rows }),

  performance: (id: string, range: CandleRange) =>
    http.get<PerformanceResponse>(`/portfolio/${id}/performance`, { params: { range } }),
};

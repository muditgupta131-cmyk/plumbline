import { http } from './httpClient';
import type {
  AuthSession,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  User,
} from '@/types';

export const authService = {
  register: (payload: RegisterPayload) => http.post<AuthSession>('/auth/register', payload),
  login: (payload: LoginPayload) => http.post<AuthSession>('/auth/login', payload),
  google: (credential: string) => http.post<AuthSession>('/auth/google', { credential }),
  refresh: () => http.post<AuthSession>('/auth/refresh'),
  logout: () => http.post<null>('/auth/logout'),
  me: () => http.get<User>('/auth/me'),
  updateProfile: (payload: UpdateProfilePayload) => http.patch<User>('/auth/me', payload),
  changePassword: (payload: ChangePasswordPayload) => http.post<null>('/auth/change-password', payload),
};

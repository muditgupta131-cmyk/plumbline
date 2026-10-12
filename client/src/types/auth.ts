import type { Currency, Market } from './market';

export type Role = 'user' | 'admin';
export type AuthProvider = 'email' | 'google';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  baseCurrency: Currency;
  defaultMarket: Market;
  emailAlerts: boolean;
  pushAlerts: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: Role;
  providers: AuthProvider[];
  emailVerified: boolean;
  preferences: UserPreferences;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  expiresIn: number;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  baseCurrency?: Currency;
  defaultMarket?: Market;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  name?: string;
  avatarUrl?: string;
  preferences?: Partial<UserPreferences>;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

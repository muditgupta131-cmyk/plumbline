import { z } from 'zod';
import { CURRENCIES, MARKETS } from '../../types/market.js';

const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Keep it under 128 characters')
  .refine((value) => /[a-z]/.test(value), 'Include a lowercase letter')
  .refine((value) => /[A-Z]/.test(value), 'Include an uppercase letter')
  .refine((value) => /\d/.test(value), 'Include a number');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password,
  baseCurrency: z.enum(CURRENCIES).optional(),
  defaultMarket: z.enum(MARKETS).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const googleSchema = z.object({
  credential: z.string().min(1, 'Google did not return a credential'),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    avatarUrl: z.string().url().optional(),
    preferences: z
      .object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        baseCurrency: z.enum(CURRENCIES).optional(),
        defaultMarket: z.enum(MARKETS).optional(),
        emailAlerts: z.boolean().optional(),
        pushAlerts: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to update');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleInput = z.infer<typeof googleSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Client-side login schema — mirrors server/src/modules/auth/auth.validation.js.
 * This copy gives instant feedback in the form; the server copy is the one
 * that actually protects the API (never trust the client).
 */
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Enter a valid email address.').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required.').max(128),
});

/** Mirrors auth.validation.js's changePasswordSchema, plus a confirm field
 *  that only exists client-side (the server never sees it). */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.').max(128),
    newPassword: z
      .string()
      .min(12, 'New password must be at least 12 characters.')
      .regex(/[A-Za-z]/, 'New password must contain at least one letter.')
      .regex(/[0-9]/, 'New password must contain at least one number.')
      .regex(/[^A-Za-z0-9]/, 'New password must contain at least one symbol.')
      .max(128),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const emptyChangePasswordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

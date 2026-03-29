import { z } from "zod";
import {
  containsControlChars,
  normalizeEmail,
  sanitizePlainText,
  sanitizeRedirectPath,
} from "../security/input";

export const signupSchema = z.object({
  name: z
    .string()
    .transform((value) => sanitizePlainText(value, 60))
    .pipe(z.string().min(1, "Enter your name to create an account.")),
  email: z
    .string()
    .transform((value) => normalizeEmail(value))
    .pipe(z.email("Enter a valid email address.")),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .max(128, "Password is too long.")
    .refine((value) => !containsControlChars(value), "Password cannot contain hidden control characters."),
  isNative: z.boolean().optional().default(false),
});

export const loginSchema = z.object({
  email: z
    .string()
    .transform((value) => normalizeEmail(value))
    .pipe(z.email("Enter a valid email address.")),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .max(128, "Password is too long.")
    .refine((value) => !containsControlChars(value), "Password cannot contain hidden control characters."),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .transform((value) => normalizeEmail(value))
    .pipe(z.email("Enter a valid email address.")),
  isNative: z.boolean().optional().default(false),
});

export const authCallbackSchema = z.object({
  code: z.string().trim().min(1).optional(),
  next: z.string().trim().optional().transform((value) => sanitizeRedirectPath(value, "/")),
});

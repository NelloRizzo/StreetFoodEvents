import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),

    PORT: z.coerce
        .number()
        .int()
        .positive()
        .default(4000),

    AUTH_SESSION_COOKIE_NAME: z
        .string()
        .min(1)
        .default('sid'),

    AUTH_SESSION_TTL_HOURS: z.coerce
        .number()
        .int()
        .positive()
        .default(12),

    CLIENT_URL: z
        .string()
        .url(),

    MONGODB_URI: z
        .string()
        .min(1, 'MONGODB_URI is required'),

    MONGODB_DB_NAME: z
        .string()
        .min(1)
        .default('street-food-events'),

    CLOUDINARY_CLOUD_NAME: z
        .string()
        .min(1, 'CLOUDINARY_CLOUD_NAME is required'),

    CLOUDINARY_API_KEY: z
        .string()
        .min(1, 'CLOUDINARY_API_KEY is required'),

    CLOUDINARY_API_SECRET: z
        .string()
        .min(1, 'CLOUDINARY_API_SECRET is required'),

    BREVO_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().email('EMAIL_FROM must be a valid email').optional(),
    EMAIL_MESSAGE_TEMPLATE: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error('Invalid environment variables');

    console.error(
        parsedEnv.error.flatten().fieldErrors
    );

    process.exit(1);
}

export const env = parsedEnv.data;

export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
export const isProduction = env.NODE_ENV === 'production';

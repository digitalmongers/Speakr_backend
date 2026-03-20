const { z } = require('zod');
const Logger = require('../utils/logger');


const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default('5000'),
    MONGODB_URI: z.string().url('MONGODB_URI must be a valid connection string'),
    ALLOWED_ORIGINS: z.string().default(''), // Comma separated CORS whitelist
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
    SENDGRID_API_KEY: z.string().optional(),
    SENDGRID_FROM_EMAIL: z.string().email().default('info@digitalmongers.com'),
    SENDGRID_FROM_NAME: z.string().default('Speakr'),
    OWNER_EMAIL: z.string().email().default('info@digitalmongers.com'),
    MAILGUN_API_KEY: z.string().optional(),
    MAILGUN_DOMAIN: z.string().optional(),
    MAILGUN_HOST: z.string().default('api.mailgun.net'), // 'api.eu.mailgun.net' for EU
    AWS_ACCESS_KEY_ID: z.string().optional().default(''),
    AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),
    AWS_REGION: z.string().optional().default(''),
    AWS_S3_BUCKET_NAME: z.string().optional().default(''),
    AWS_S3_SIGNED_URL_EXPIRES: z.string().transform(Number).default('3600'),
});


const parseEnv = () => {
    try {
        const parsed = envSchema.safeParse(process.env);

        if (!parsed.success) {
            Logger.error('❌ Invalid environment variables:', parsed.error.format());
            process.exit(1);
        }

        return parsed.data;
    } catch (error) {
        Logger.error('Failed to parse environment variables', error);
        process.exit(1);
    }
};

const env = parseEnv();

module.exports = env;

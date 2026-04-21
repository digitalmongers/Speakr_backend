const Redis = require('ioredis');
const { URL } = require('url');
const env = require('./env');
const Logger = require('../utils/logger');

// Base config for Redis operations (Enterprise standard)
const redisConfig = {
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        // Use debug to prevent massive log spam in local dev without Redis
        Logger.debug(`Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
    },
    maxRetriesPerRequest: env.REDIS_MAX_RETRIES_PER_REQUEST,
    connectTimeout: env.REDIS_CONNECT_TIMEOUT,
    enableReadyCheck: true,
    enableOfflineQueue: true,
    lazyConnect: true, // Connect when needed or manually
    reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
            Logger.warn('Redis READONLY error, reconnecting...');
            return true;
        }
        return false;
    },
};

let cachedOptions = null;

/**
 * Get Redis Connection Options
 * Enterprise Pattern: Centralized connection logic
 */
const getRedisConnection = () => {
    if (cachedOptions) {
        return cachedOptions;
    }

    let redisUrl = env.REDIS_URL;

    // Extra safety: Strip literal quotes that might be passed from some deployment platforms
    if (redisUrl && typeof redisUrl === 'string') {
        redisUrl = redisUrl.replace(/['"]/g, '').trim();
    }

    const isTls = redisUrl ? redisUrl.startsWith('rediss://') : false;

    let options = {};

    try {
        const parsedUrl = new URL(redisUrl);
        options = {
            host: parsedUrl.hostname,
            port: parseInt(parsedUrl.port) || 6379,
            password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
            tls: isTls ? { rejectUnauthorized: false } : undefined,
            connectTimeout: env.REDIS_CONNECT_TIMEOUT,
        };
        Logger.info(`Redis Config: host=${options.host}, port=${options.port}, tls=${!!options.tls}`);
    } catch (err) {
        Logger.error('Failed to parse REDIS_URL', { error: err.message });
        // Default fallback if URL parsing fails
        options = {
            host: '127.0.0.1',
            port: 6379,
            connectTimeout: env.REDIS_CONNECT_TIMEOUT,
        };
    }

    // Log connection target (sanitized)
    const target = redisUrl ? redisUrl.replace(/:[^:]*@/, ':***@') : 'unknown';
    Logger.info(`Redis connection target: ${target}`);

    cachedOptions = options;
    return options;
};

const connectionOptions = getRedisConnection();

const redisClient = new Redis({ ...redisConfig, ...connectionOptions });

redisClient.on('error', (err) => {
    Logger.error('REDIS_ERROR', { error: err.message });
});

redisClient.on('connect', () => {
    Logger.info('REDIS_CONNECTED');
});

redisClient.on('ready', () => {
    Logger.info('REDIS_READY');
});

redisClient.on('reconnecting', (delay) => {
    Logger.warn('REDIS_RECONNECTING', { delay });
});

redisClient.on('close', () => {
    Logger.warn('REDIS_CONNECTION_CLOSED');
});

/**
 * Handle Redis Shutdown
 */
const closeRedis = async () => {
    if (redisClient) {
        Logger.info('Closing Redis connection...');
        await redisClient.quit();
    }
};

module.exports = {
    redisClient,
    getRedisConnection,
    closeRedis,
};

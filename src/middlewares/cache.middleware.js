const { redisClient } = require('../configs/redis');
const Logger = require('../utils/logger');

/**
 * Enterprise-grade cache middleware with deterministic query sorting and fail-open resilience.
 * @param {number} ttlInSeconds - Time to live in seconds
 */
const cacheMiddleware = (ttlInSeconds = 60) => {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Generate dynamic cache key sorted deterministically by query keys
        const sortedQuery = Object.entries(req.query)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, val]) => `${key}=${val}`)
            .join('&');
            
        const cacheKey = `cache:${req.baseUrl || req.path}:${sortedQuery}`;

        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                Logger.info(`Cache HIT for key: ${cacheKey}`);
                const parsed = JSON.parse(cachedData);
                return res.status(200).json(parsed);
            }

            Logger.info(`Cache MISS for key: ${cacheKey}`);

            // Intercept res.json to cache response before sending to client
            const originalJson = res.json;
            res.json = function (body) {
                res.json = originalJson; // Restore original json method

                // Cache response if request succeeded (2xx)
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    redisClient.set(cacheKey, JSON.stringify(body), 'EX', ttlInSeconds)
                        .catch((err) => Logger.error(`Redis cache write failure for key ${cacheKey}:`, err));
                }

                return originalJson.call(this, body);
            };

            next();
        } catch (error) {
            // Fail-open: Proceed to database if Redis has issues
            Logger.error(`Redis caching error on key ${cacheKey}, failing open:`, error);
            next();
        }
    };
};

/**
 * Invalidate Redis cache keys matching a pattern (uses SCAN to prevent blocking the Redis event loop)
 * @param {string} pattern - Wildcard pattern (e.g. "cache:/api/v1/posts*")
 */
const invalidateCacheByPattern = async (pattern) => {
    try {
        let cursor = '0';
        let totalPurged = 0;
        
        do {
            const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                await redisClient.del(...keys);
                totalPurged += keys.length;
            }
        } while (cursor !== '0');

        if (totalPurged > 0) {
            Logger.info(`Purged ${totalPurged} keys from cache matching pattern: ${pattern}`);
        }
    } catch (error) {
        Logger.error(`Cache invalidation failed for pattern: ${pattern}`, error);
    }
};

module.exports = {
    cacheMiddleware,
    invalidateCacheByPattern,
};

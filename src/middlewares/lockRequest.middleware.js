const crypto = require('crypto');
const httpStatus = require('http-status');
const { redisClient } = require('../configs/redis');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const Logger = require('../utils/logger');

/**
 * Middleware to prevent duplicate concurrent requests (Idempotency)
 * Uses Redis with a TTL of 5 seconds to lock a request based on:
 * - User ID (or IP if unauthenticated)
 * - Request Path
 * - Request Body Hash
 */
const lockRequestMiddleware = catchAsync(async (req, res, next) => {
    // Only apply to state-changing methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return next();
    }

    const identifier = req.user ? req.user._id.toString() : req.ip;
    const bodyHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(req.body || {}))
        .digest('hex');

    const lockKey = `lock:${req.method}:${req.originalUrl}:${identifier}:${bodyHash}`;

    try {
        // Set NX (Not Exists) with EX (Expire) 5 seconds
        const result = await redisClient.set(lockKey, 'locked', 'NX', 'EX', 5);

        if (!result) {
            Logger.warn(`Duplicate request blocked: ${lockKey}`);
            throw new AppError(
                httpStatus.TOO_MANY_REQUESTS,
                'This request is already being processed. Please wait a moment.'
            );
        }

        // Attach cleanup function to response finished event
        // This ensures the lock is released as soon as the request is done,
        // or expires automatically after 5s if the process crashes.
        res.on('finish', async () => {
            try {
                await redisClient.del(lockKey);
            } catch (err) {
                Logger.error(`Failed to release lock: ${lockKey}`, err);
            }
        });

        next();
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        // Fail-open strategy: If Redis is down, log error and proceed
        // This prevents high-priority user actions from failing due to infra issues.
        Logger.error('Redis lock-request failure, failing open:', error);
        next();
    }
});

module.exports = lockRequestMiddleware;

const { Queue } = require('bullmq');
const { getRedisConnection } = require('../configs/redis');
const Logger = require('../utils/logger');

const connectionOptions = getRedisConnection();

// Initialize the email queue
const emailQueue = new Queue('email-queue', {
    connection: {
        ...connectionOptions,
        // BullMQ specific optimization: disable offline queue for worker safety
        enableOfflineQueue: false,
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000, // 5 seconds initial delay
        },
        removeOnComplete: true, // Keep DB clean
        removeOnFail: { age: 24 * 3600 }, // Keep failed jobs for 24h for debugging
    }
});

// Event listeners for debugging
emailQueue.on('error', (err) => {
    Logger.error('Email Queue Error:', err);
});

module.exports = emailQueue;

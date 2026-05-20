const { Worker } = require('bullmq');
const { getRedisConnection } = require('../configs/redis');
const emailProviderService = require('../services/emailProvider.service');
const Logger = require('../utils/logger');

// Initialize the Worker
const initEmailWorker = () => {
    const connectionOptions = getRedisConnection();

    const worker = new Worker('email-queue', async (job) => {
        Logger.info(`Processing Email Job: ${job.id} for ${job.data.to}`);
        
        try {
            await emailProviderService.sendEmail(job.data);
            Logger.info(`Successfully processed email job ${job.id}`);
        } catch (error) {
            Logger.error(`Failed to process email job ${job.id}:`, error);
            throw error; // Re-throw to trigger BullMQ retry
        }
    }, {
        connection: connectionOptions,
        concurrency: 5, // Process 5 emails at a time
    });

    worker.on('failed', (job, err) => {
        Logger.error(`Job ${job.id} failed after retries:`, err);
    });

    Logger.info('🚀 Email Worker Initialized and Ready');
    return worker;
};

module.exports = { initEmailWorker };

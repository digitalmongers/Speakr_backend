const { Worker } = require('bullmq');
const CircuitBreaker = require('opossum');
const sgMail = require('@sendgrid/mail');
const { getRedisConnection } = require('../configs/redis');
const Logger = require('../utils/logger');

// SendGrid API Key setup
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// 1. Define the actual send function (The task to be guarded)
const actualSend = async (jobData) => {
    const { to, subject, text, html } = jobData;
    const msg = {
        from: {
            email: process.env.SENDGRID_FROM_EMAIL,
            name: process.env.SENDGRID_FROM_NAME || 'Speakr'
        },
        to,
        subject,
        text,
        html,
    };
    return await sgMail.send(msg);
};

// 2. Setup Circuit Breaker options
const breakerOptions = {
    timeout: 10000, // If SendGrid takes >10s, fail
    errorThresholdPercentage: 50, // If 50% calls fail, open circuit
    resetTimeout: 30000, // Try again after 30s
};

const breaker = new CircuitBreaker(actualSend, breakerOptions);

// Circuit Breaker Events
breaker.on('open', () => Logger.warn('⚠️ Email Circuit Breaker: OPEN (SendGrid might be down)'));
breaker.on('halfOpen', () => Logger.info('🔍 Email Circuit Breaker: HALF_OPEN (Trying SendGrid again...)'));
breaker.on('close', () => Logger.info('✅ Email Circuit Breaker: CLOSED (SendGrid is back online)'));
breaker.on('fallback', (data) => Logger.error('❌ Email Circuit Breaker: FALLBACK triggered', data));

// 3. Initialize the Worker
const initEmailWorker = () => {
    const connectionOptions = getRedisConnection();

    const worker = new Worker('email-queue', async (job) => {
        Logger.info(`Processing Email Job: ${job.id} for ${job.data.to}`);
        
        try {
            // Execute via breaker
            await breaker.fire(job.data);
            Logger.info(`Successfully sent email for job ${job.id}`);
        } catch (error) {
            // Check if it's a circuit maker error
            if (breaker.opened) {
                Logger.error(`Skipping email send for job ${job.id} - Circuit is OPEN`);
                throw new Error('Circuit Breaker is OPEN');
            }
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

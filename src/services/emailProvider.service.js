const sgMail = require('@sendgrid/mail');
const CircuitBreaker = require('opossum');
const env = require('../configs/env');
const Logger = require('../utils/logger');

let sendGridBreaker = null;

// Initialize SendGrid if its API key is configured
if (env.SENDGRID_API_KEY) {
    try {
        sgMail.setApiKey(env.SENDGRID_API_KEY);
        
        // Define the SendGrid calling method
        const sendGridSend = async ({ to, subject, text, html }) => {
            const msg = {
                from: {
                    email: env.SENDGRID_FROM_EMAIL,
                    name: env.SENDGRID_FROM_NAME || 'Speakr'
                },
                to,
                subject,
                text,
                html,
            };
            return await sgMail.send(msg);
        };

        // Setup Circuit Breaker for SendGrid
        const breakerOptions = {
            timeout: 10000, // Timeout after 10 seconds
            errorThresholdPercentage: 50, // Open circuit if 50% fails
            resetTimeout: 30000, // Try to close circuit after 30 seconds
        };

        sendGridBreaker = new CircuitBreaker(sendGridSend, breakerOptions);

        // Circuit Breaker Event Listeners
        sendGridBreaker.on('open', () => Logger.warn('⚠️ SendGrid Circuit Breaker: OPEN (SendGrid might be down)'));
        sendGridBreaker.on('halfOpen', () => Logger.info('🔍 SendGrid Circuit Breaker: HALF_OPEN (Trying SendGrid again...)'));
        sendGridBreaker.on('close', () => Logger.info('✅ SendGrid Circuit Breaker: CLOSED (SendGrid is back online)'));
        sendGridBreaker.on('fallback', (err) => Logger.error('❌ SendGrid Circuit Breaker: Fallback triggered due to failure:', err));

    } catch (err) {
        Logger.error('Failed to initialize SendGrid Provider:', err);
    }
} else {
    Logger.warn('⚠️ SendGrid is not configured. Email service will skip SendGrid.');
}

/**
 * Send email using Brevo HTTP API
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 * @returns {Promise<any>}
 */
const sendWithBrevo = async (to, subject, text, html) => {
    const brevoApiKey = env.BREVO_API_KEY;
    if (!brevoApiKey) {
        throw new Error('Brevo API key is not configured');
    }

    const fromEmail = env.BREVO_FROM_EMAIL || env.SENDGRID_FROM_EMAIL;
    const fromName = env.BREVO_FROM_NAME || env.SENDGRID_FROM_NAME || 'Speakr';

    Logger.debug(`Sending email to ${to} via Brevo API: sender ${fromEmail}`);

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: {
                name: fromName,
                email: fromEmail
            },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: text
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Brevo API error: ${response.statusText} (${response.status}). Details: ${JSON.stringify(errorData)}`);
    }

    return await response.json().catch(() => ({}));
};

/**
 * Abstracted unified sendEmail function with fallback
 * @param {Object} emailData
 * @param {string} emailData.to
 * @param {string} emailData.subject
 * @param {string} emailData.text
 * @param {string} emailData.html
 * @returns {Promise<void>}
 */
const sendEmail = async ({ to, subject, text, html }) => {
    // 1. Try SendGrid if it's configured
    if (sendGridBreaker) {
        try {
            Logger.info(`[Email Service] Attempting SendGrid for: ${to}`);
            await sendGridBreaker.fire({ to, subject, text, html });
            Logger.info(`[Email Service] Successfully sent to ${to} via SendGrid`);
            return;
        } catch (error) {
            Logger.error(`[Email Service] SendGrid failed to send to ${to}: ${error.message}`);
            // Check fallback
        }
    } else {
        Logger.info(`[Email Service] SendGrid not configured. Bypassing to Brevo fallback.`);
    }

    // 2. Fallback to Brevo
    try {
        Logger.info(`[Email Service] Attempting Brevo Fallback for: ${to}`);
        await sendWithBrevo(to, subject, text, html);
        Logger.info(`[Email Service] Successfully sent to ${to} via Brevo Fallback`);
    } catch (error) {
        Logger.error(`[Email Service] Both SendGrid and Brevo failed to send to ${to}. Error: ${error.message}`);
        throw new Error(`Email sending failed for all providers. Last error: ${error.message}`);
    }
};

module.exports = {
    sendEmail,
    sendWithBrevo,
};

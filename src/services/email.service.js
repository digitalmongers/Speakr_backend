const sgMail = require('@sendgrid/mail');
const Logger = require('../utils/logger');

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Send an email
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 * @returns {Promise}
 */
const sendEmail = async (to, subject, text, html) => {
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
    
    try {
        await sgMail.send(msg);
        Logger.info(`Email sent to ${to}`);
    } catch (error) {
        Logger.error(`Email failed to send to ${to}: ${error.message}`);
        // In production, we might want to throw this or handle it with a queue
        // For now, we log it and keep the system moving
    }
};

/**
 * Send OTP email
 * @param {string} to
 * @param {string} otp
 * @returns {Promise}
 */
const sendOTPEmail = async (to, otp) => {
    const subject = 'Your Verification Code - Speakr';
    const text = `Your verification code is ${otp}. It will expire in 10 minutes.`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
        <h2 style="color: #ff4500; text-align: center;">Speakr Verification</h2>
        <p style="font-size: 16px; color: #333;">Welcome! Use the following code to complete your signup. This code is valid for 10 minutes.</p>
        <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #ff4500; background: #fff; padding: 10px 20px; border: 2px dashed #ff4500; border-radius: 5px;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #777;">If you did not request this code, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin-top: 20px;">
        <p style="font-size: 12px; color: #aaa; text-align: center;">© ${new Date().getFullYear()} Speakr Inc.</p>
    </div>
    `;
    
    await sendEmail(to, subject, text, html);
};

module.exports = {
    sendEmail,
    sendOTPEmail,
};

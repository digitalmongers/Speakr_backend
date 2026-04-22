const mongoose = require('mongoose');
const httpStatus = require('http-status');
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const tokenService = require('./token.service');
const emailService = require('./email.service');
const AppError = require('../utils/AppError');
const User = require('../models/user.model');
const PendingUser = require('../models/pendingUser.model');
const { ERROR_MESSAGES, ROLES } = require('../constants');
const { redisClient } = require('../configs/redis');
const Logger = require('../utils/logger');
const AuditService = require('./audit.service');

/**
 * Helper to manage idempotency locks via Redis
 * @param {string} key 
 * @param {number} ttlSeconds 
 * @returns {Promise<boolean>} - true if lock acquired, false otherwise
 */
const acquireLock = async (key, ttlSeconds = 10) => {
    try {
        const result = await redisClient.set(`lock:auth:${key}`, 'locked', 'NX', 'EX', ttlSeconds);
        return result === 'OK';
    } catch (err) {
        Logger.error('Redis Lock Error, failing open:', err);
        return true; // Fail open to maintain availability
    }
};

const releaseLock = async (key) => {
    try {
        await redisClient.del(`lock:auth:${key}`);
    } catch (err) {
        Logger.error('Redis Unlock Error:', err);
    }
};

/**
 * Initiate signup (OTP phase)
 * @param {Object} userBody
 * @returns {Promise<Object>}
 */
const initiateSignup = async (userBody) => {
    const email = userBody.email.toLowerCase();
    const username = userBody.username.toLowerCase();

    // Acquire lock on email to prevent concurrent registration attempts
    const lockAcquired = await acquireLock(`signup:${email}`);
    if (!lockAcquired) {
        throw new AppError(httpStatus.TOO_MANY_REQUESTS, 'Registration is already in progress for this email.');
    }

    try {
        if (await User.isEmailTaken(email)) {
            await AuditService.record({
                action: 'AUTH_SIGNUP_BLOCKED',
                status: 'FAILURE',
                metadata: { email, reason: 'Email already taken' }
            });
            throw new AppError(httpStatus.BAD_REQUEST, 'Email already taken');
        }
        if (await User.isUsernameTaken(username)) {
            await AuditService.record({
                action: 'AUTH_SIGNUP_BLOCKED',
                status: 'FAILURE',
                metadata: { username, reason: 'Username already taken' }
            });
            throw new AppError(httpStatus.BAD_REQUEST, 'Username already taken');
        }

        // Clear any existing pending registration for this email
        await PendingUser.deleteMany({ email });

        const otp = tokenService.generateOTP();
        
        // Hash password here so it's not stored in plain text in PendingUser
        const hashedPassword = await bcrypt.hash(userBody.password, 12);

        // Create pending user record
        await PendingUser.create({
            ...userBody,
            email,
            username,
            password: hashedPassword,
            otp,
        });

        // Send OTP email in background
        emailService.sendOTPEmail(email, otp).catch((err) => {
            Logger.error(`Failed to send OTP email to ${email}:`, err);
        });

        return { message: 'OTP sent to your email' };
    } finally {
        await releaseLock(`signup:${email}`);
    }
};

/**
 * Verify OTP and complete signup
 * @param {string} email
 * @param {string} otp
 * @returns {Promise<User>}
 */
const verifyOTPAndCreateUser = async (email, otp) => {
    const normalizedEmail = email.toLowerCase();

    // Lock verification to prevent race checks
    const lockAcquired = await acquireLock(`verify:${normalizedEmail}`);
    if (!lockAcquired) {
        throw new AppError(httpStatus.TOO_MANY_REQUESTS, 'Verification is already in progress.');
    }

    try {
        const pendingUser = await PendingUser.findOne({ email: normalizedEmail }).lean();

        if (!pendingUser) {
            throw new AppError(httpStatus.BAD_REQUEST, 'No pending registration found or code expired');
        }

        // Check if OTP matches
        if (pendingUser.otp !== otp) {
            // Increment attempts
            await PendingUser.findByIdAndUpdate(pendingUser._id, { $inc: { otpAttempts: 1 } });
            
            if (pendingUser.otpAttempts + 1 >= 5) {
                await AuditService.record({
                    action: 'AUTH_OTP_MAX_ATTEMPTS',
                    status: 'FAILURE',
                    metadata: { email: normalizedEmail, attempts: pendingUser.otpAttempts + 1 }
                });
                await PendingUser.deleteOne({ _id: pendingUser._id });
                throw new AppError(httpStatus.BAD_REQUEST, 'Too many failed attempts. Registration cancelled.');
            }
            
            await AuditService.record({
                action: 'AUTH_OTP_MISMATCH',
                status: 'FAILURE',
                metadata: { email: normalizedEmail, attempt: pendingUser.otpAttempts + 1 }
            });

            throw new AppError(httpStatus.BAD_REQUEST, `Invalid verification code. ${4 - pendingUser.otpAttempts} attempts remaining.`);
        }

        // OTP is correct. Proceed with atomic user creation using a transaction if possible
        let user;
        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                const userData = { ...pendingUser };
                delete userData.otp;
                delete userData.otpAttempts;
                delete userData.expiresAt;
                delete userData._id;
                delete userData.createdAt;
                delete userData.updatedAt;

                user = await User.create([
                    {
                        ...userData,
                        role: ROLES.USER,
                        isEmailVerified: true,
                    }
                ], { session });

                // Clean up pending user
                await PendingUser.deleteOne({ _id: pendingUser._id }, { session });
            });
        } finally {
            await session.endSession();
        }

        return Array.isArray(user) ? user[0] : user;
    } finally {
        await releaseLock(`verify:${normalizedEmail}`);
    }
};

/**
 * Login with username/email and password
 * @param {string} identifier (email or username)
 * @param {string} password
 * @returns {Promise<User>}
 */
const login = async (identifier, password) => {
    const normalizedIdentifier = identifier.toLowerCase();
    
    // Check if identifier is email or username
    // Use selective projection to get only what's needed for login and the response
    const query = normalizedIdentifier.includes('@') 
        ? { email: normalizedIdentifier } 
        : { username: normalizedIdentifier };
    
    const user = await User.findOne(query).select('+password').lean();

    const isMatch = user ? await bcrypt.compare(password, user.password) : false;

    // Timing attack protection: even if user doesn't exist, we've already done a bcrypt comparison if user was found.
    // If user was NOT found, we do a dummy comparison to normalize response time.
    if (!user) {
        // Dummy hash derived from a constant to maintain consistent timing
        const dummyHash = '$2b$12$L8S.vG3H.tU8O.zP8S.vG3H.tU8O.zP8S.vG3H.tU8O.zP8S.vG';
        await bcrypt.compare(password, dummyHash);
    }

    if (!isMatch) {
        throw new AppError(httpStatus.UNAUTHORIZED, ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    if (!user.isEmailVerified) {
        throw new AppError(httpStatus.FORBIDDEN, 'Please verify your email before logging in');
    }

    return user;
};

/**
 * Logout - Global invalidation of all tokens
 * @param {ObjectId} userId
 * @returns {Promise}
 */
const logout = async (userId) => {
    await User.findByIdAndUpdate(userId, {
        $inc: { tokenVersion: 1 },
    });
};

/**
 * Resend OTP to user email
 * @param {string} email
 * @returns {Promise<Object>}
 */
const resendOTP = async (email) => {
    const normalizedEmail = email.toLowerCase();

    const pendingUser = await PendingUser.findOne({ email: normalizedEmail });

    if (!pendingUser) {
        throw new AppError(httpStatus.BAD_REQUEST, 'No pending registration found or session expired. Please signup again.');
    }

    // Rate Limiting: 60 seconds cooldown between resends
    const lastSent = pendingUser.updatedAt;
    const now = new Date();
    const diffInSeconds = Math.floor((now - lastSent) / 1000);
    const COOLDOWN = 60;

    if (diffInSeconds < COOLDOWN) {
        throw new AppError(httpStatus.TOO_MANY_REQUESTS, `Please wait ${COOLDOWN - diffInSeconds} seconds before requesting another code.`);
    }

    const otp = tokenService.generateOTP();
    
    // Update pending user with new OTP and reset attempts
    pendingUser.otp = otp;
    pendingUser.otpAttempts = 0;
    // We update expiresAt to give user another 10 minutes
    pendingUser.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pendingUser.save();

    // Send OTP email
    emailService.sendOTPEmail(normalizedEmail, otp).catch((err) => {
        Logger.error(`Failed to resend OTP email to ${normalizedEmail}:`, err);
    });

    await AuditService.record({
        action: 'AUTH_OTP_RESENT',
        metadata: { email: normalizedEmail }
    });

    return { message: 'New OTP sent successfully' };
};

module.exports = {
    initiateSignup,
    verifyOTPAndCreateUser,
    resendOTP,
    login,
    logout,
};

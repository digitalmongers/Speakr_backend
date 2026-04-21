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
            throw new AppError(httpStatus.BAD_REQUEST, 'Email already taken');
        }
        if (await User.isUsernameTaken(username)) {
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
        const pendingUser = await PendingUser.findOne({ email: normalizedEmail });

        if (!pendingUser) {
            throw new AppError(httpStatus.BAD_REQUEST, 'No pending registration found or code expired');
        }

        // Check if OTP matches
        if (pendingUser.otp !== otp) {
            // Increment attempts
            await PendingUser.findByIdAndUpdate(pendingUser._id, { $inc: { otpAttempts: 1 } });
            
            if (pendingUser.otpAttempts + 1 >= 5) {
                await PendingUser.deleteOne({ _id: pendingUser._id });
                throw new AppError(httpStatus.BAD_REQUEST, 'Too many failed attempts. Registration cancelled.');
            }
            
            throw new AppError(httpStatus.BAD_REQUEST, `Invalid verification code. ${4 - pendingUser.otpAttempts} attempts remaining.`);
        }

        // OTP is correct. Proceed with atomic user creation using a transaction if possible
        let user;
        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                const userData = pendingUser.toObject();
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
    const user = normalizedIdentifier.includes('@') 
        ? await User.findOne({ email: normalizedIdentifier }) 
        : await User.findOne({ username: normalizedIdentifier });

    const isMatch = user ? await user.isPasswordMatch(password) : false;

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

module.exports = {
    initiateSignup,
    verifyOTPAndCreateUser,
    login,
    logout,
};

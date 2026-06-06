const httpStatus = require('http-status').default;
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Admin = require('../../models/admin/admin.model');
const tokenService = require('../token.service');
const UploadService = require('../upload.service');
const emailService = require('../email.service');
const { redisClient } = require('../../configs/redis');
const Logger = require('../../utils/logger');
const AppError = require('../../utils/AppError');
const { ERROR_MESSAGES } = require('../../constants');

/**
 * Service for Admin Authentication operations.
 */
const login = async (email, password) => {
    const normalizedEmail = email.toLowerCase();
    
    // Find admin by email, select hidden password and tokenVersion fields
    const admin = await Admin.findOne({ email: normalizedEmail }).select('+password +tokenVersion').lean();

    const isMatch = admin ? await bcrypt.compare(password, admin.password) : false;

    // Timing attack mitigation: do a dummy comparison if admin doesn't exist
    if (!admin) {
        const dummyHash = '$2b$12$L8S.vG3H.tU8O.zP8S.vG3H.tU8O.zP8S.vG3H.tU8O.zP8S.vG';
        await bcrypt.compare(password, dummyHash);
    }

    if (!isMatch) {
        throw new AppError(httpStatus.UNAUTHORIZED, ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    // Generate token set
    const tokens = await tokenService.generateAuthTokens(admin);

    return {
        admin: {
            id: admin._id,
            email: admin.email,
            fullName: admin.fullName,
        },
        tokens,
    };
};

/**
 * Global session logout by incrementing token version.
 * @param {ObjectId} adminId 
 */
const logout = async (adminId) => {
    await Admin.findByIdAndUpdate(adminId, {
        $inc: { tokenVersion: 1 },
    });
};

/**
 * Update Admin Profile details (fullName, gender, phoneNumber, profilePic).
 * Automatically cleans up old profile images from Cloudinary storage.
 */
const updateProfile = async (adminId, updateData) => {
    // Sanitize input to prevent sensitive/internal fields from being updated here (Mass Assignment protection)
    const safeUpdate = { ...updateData };
    delete safeUpdate.password;
    delete safeUpdate.tokenVersion;

    // Check for email uniqueness if email is being updated
    if (safeUpdate.email !== undefined) {
        const normalizedEmail = safeUpdate.email.toLowerCase();
        const emailTaken = await Admin.findOne({ email: normalizedEmail, _id: { $ne: adminId } });
        if (emailTaken) {
            throw new AppError(httpStatus.BAD_REQUEST, 'Email already taken by another admin');
        }
        safeUpdate.email = normalizedEmail;
    }

    // If admin is updating their profile picture, handle old file cleanup
    if (safeUpdate.profilePic !== undefined) {
        const existingAdmin = await Admin.findById(adminId).lean();
        if (!existingAdmin) {
            throw new AppError(httpStatus.NOT_FOUND, 'Admin not found');
        }

        const oldPic = existingAdmin.profilePic;
        const newPic = safeUpdate.profilePic;

        // Check if admin is replacing an existing photo
        if (oldPic && oldPic !== newPic) {
            const oldKey = UploadService.extractKeyFromUrl(oldPic);
            if (oldKey) {
                try {
                    Logger.info('Cleaning up old admin profile picture from storage', { adminId, oldKey });
                    await UploadService.deleteFromS3(oldKey);
                } catch (storageError) {
                    // Log the error but do not block the profile update
                    Logger.error('Failed to delete old admin profile picture from storage', {
                        adminId,
                        oldKey,
                        error: storageError.message,
                    });
                }
            }
        }
    }

    // Perform atomic update
    const updatedAdmin = await Admin.findByIdAndUpdate(
        adminId,
        {
            $set: safeUpdate,
        },
        {
            new: true,
            runValidators: true,
        }
    ).lean();

    if (!updatedAdmin) {
        throw new AppError(httpStatus.NOT_FOUND, 'Admin not found');
    }

    return {
        id: updatedAdmin._id,
        email: updatedAdmin.email,
        fullName: updatedAdmin.fullName,
        gender: updatedAdmin.gender,
        phoneNumber: updatedAdmin.phoneNumber,
        profilePic: updatedAdmin.profilePic,
    };
};

/**
 * Request a password reset OTP code.
 * Implements email enumeration defense.
 */
const requestForgotPassword = async (email) => {
    const normalizedEmail = email.toLowerCase();
    const admin = await Admin.findOne({ email: normalizedEmail });

    // Email enumeration defense: always return generic success message
    const responseMessage = 'If the email is registered, a 6-digit verification code has been sent.';

    if (!admin) {
        Logger.warn(`Forgot password requested for non-existent admin email: ${normalizedEmail}`);
        return { message: responseMessage };
    }

    const otpKey = `admin:otp:${normalizedEmail}`;
    const attemptsKey = `admin:otp-attempts:${normalizedEmail}`;

    // OTP Bombing Defense: Enforce 60-second cooldown period between requests
    const existingTtl = await redisClient.ttl(otpKey);
    if (existingTtl > 540) { // 600s total TTL - 540s threshold = 60 seconds cooldown
        throw new AppError(
            httpStatus.TOO_MANY_REQUESTS,
            `Please wait ${existingTtl - 540} seconds before requesting another verification code.`
        );
    }

    const otp = tokenService.generateOTP();

    // Save OTP and attempt counter in Redis with 10-minute TTL
    await redisClient.set(otpKey, otp, 'EX', 600);
    await redisClient.set(attemptsKey, 0, 'EX', 600);

    // Send OTP email in background
    await emailService.sendOTPEmail(normalizedEmail, otp);

    Logger.info(`Forgot password OTP successfully generated & sent to admin: ${normalizedEmail}`);
    return { message: responseMessage };
};

/**
 * Verify forgot password OTP and issue a single-use 5-minute reset token.
 */
const verifyForgotPasswordOtp = async (email, otp) => {
    const normalizedEmail = email.toLowerCase();
    const otpKey = `admin:otp:${normalizedEmail}`;
    const attemptsKey = `admin:otp-attempts:${normalizedEmail}`;

    const storedOtp = await redisClient.get(otpKey);
    if (!storedOtp) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Verification code expired or invalid');
    }

    // Increment attempt count
    const attempts = await redisClient.incr(attemptsKey);
    if (attempts > 5) {
        await redisClient.del(otpKey);
        await redisClient.del(attemptsKey);
        throw new AppError(httpStatus.BAD_REQUEST, 'Too many failed attempts. Please request a new code.');
    }

    if (storedOtp !== otp) {
        throw new AppError(httpStatus.BAD_REQUEST, `Invalid verification code. ${5 - attempts} attempts remaining.`);
    }

    // Clean up OTP and attempts keys
    await redisClient.del(otpKey);
    await redisClient.del(attemptsKey);

    // Generate secure 5-minute single-use reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetKey = `admin:reset-token:${normalizedEmail}`;
    await redisClient.set(resetKey, resetToken, 'EX', 300);

    Logger.info(`Forgot password OTP successfully verified for admin: ${normalizedEmail}`);
    return { resetToken };
};

/**
 * Reset password using validation token.
 * Invalidates all active admin JWT sessions globally by incrementing token version.
 */
const resetPassword = async (email, resetToken, newPassword) => {
    const normalizedEmail = email.toLowerCase();
    const resetKey = `admin:reset-token:${normalizedEmail}`;

    // Anti-Replay & Double Reset Attack protection: Get and delete the key atomically
    const txResults = await redisClient.multi().get(resetKey).del(resetKey).exec();
    const storedResetToken = txResults && txResults[0] ? txResults[0][1] : null;

    if (!storedResetToken || storedResetToken !== resetToken) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired reset session');
    }

    const admin = await Admin.findOne({ email: normalizedEmail }).select('+tokenVersion');
    if (!admin) {
        throw new AppError(httpStatus.NOT_FOUND, 'Admin account not found');
    }

    // Update password and increment token version to log out all other devices/sessions
    admin.password = newPassword;
    admin.tokenVersion += 1;
    await admin.save();

    Logger.info(`Admin password successfully reset and sessions invalidated: ${normalizedEmail}`);
    return { message: 'Password has been reset successfully. Please log in with your new credentials.' };
};

/**
 * Change Admin Password from dashboard (authenticated).
 * Validates current password, updates it, and invalidates all current token sessions.
 */
const changePassword = async (adminId, currentPassword, newPassword) => {
    const admin = await Admin.findById(adminId).select('+password +tokenVersion');
    if (!admin) {
        throw new AppError(httpStatus.NOT_FOUND, 'Admin account not found');
    }

    // Verify current password matches
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Incorrect current password');
    }

    // Security check: Prevent changing to the same password
    if (currentPassword === newPassword) {
        throw new AppError(httpStatus.BAD_REQUEST, 'New password cannot be the same as the current password');
    }

    // Set new password (will be hashed automatically by pre-save hook)
    admin.password = newPassword;
    admin.tokenVersion = (admin.tokenVersion || 0) + 1; // Invalidate all active sessions globally with safe fallback
    await admin.save();

    Logger.info(`Admin password successfully changed and sessions invalidated for admin: ${admin.email}`);
    return { message: 'Password changed successfully. All active sessions have been invalidated. Please log in again.' };
};

module.exports = {
    login,
    logout,
    updateProfile,
    requestForgotPassword,
    verifyForgotPasswordOtp,
    resetPassword,
    changePassword,
};

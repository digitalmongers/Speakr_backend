const { z } = require('zod');
const { REGEX, GENDER } = require('../constants');

/**
 * Validation schemas for Admin actions.
 */
const login = z.object({
    body: z.object({
        email: z.string().email('Please enter a valid email address'),
        password: z.string().min(1, 'Password is required'),
    }),
});

const updateProfile = z.object({
    body: z.object({
        fullName: z.string().min(1, "Name cannot be empty").max(100).optional(),
        email: z.string().email('Please enter a valid email address').optional(),
        gender: z.enum(Object.values(GENDER)).optional(),
        phoneNumber: z.string().regex(REGEX.PHONE, "Invalid phone number format").optional(),
        profilePic: z.string().optional(),
    }),
});

const forgotPassword = z.object({
    body: z.object({
        email: z.string().email('Please enter a valid email address'),
    }),
});

const verifyOtp = z.object({
    body: z.object({
        email: z.string().email('Please enter a valid email address'),
        otp: z.string().length(6).regex(/^\d+$/, 'OTP must be 6 digits'),
    }),
});

const resetPassword = z.object({
    body: z.object({
        email: z.string().email('Please enter a valid email address'),
        resetToken: z.string().min(1, 'Reset token is required'),
        newPassword: z.string()
            .min(8)
            .regex(REGEX.PASSWORD, 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
        confirmPassword: z.string().min(1, 'Password confirmation is required'),
    }).refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    }),
});

const changePassword = z.object({
    body: z.object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z.string()
            .min(8)
            .regex(REGEX.PASSWORD, 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
        confirmPassword: z.string().min(1, 'Password confirmation is required'),
    }).refine((data) => data.newPassword === data.confirmPassword, {
        message: "New passwords don't match",
        path: ["confirmPassword"],
    }),
});

module.exports = {
    login,
    updateProfile,
    forgotPassword,
    verifyOtp,
    resetPassword,
    changePassword,
};

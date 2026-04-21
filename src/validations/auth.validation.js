const { z } = require('zod');
const { GENDER, REGEX } = require('../constants');

const signup = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string()
            .min(8)
            .regex(REGEX.PASSWORD, 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
        firstName: z.string().min(1).max(50),
        lastName: z.string().min(1).max(50),
        username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'),
        dob: z.string().refine((val) => !isNaN(Date.parse(val)), {
            message: "Invalid date format",
        }),
        gender: z.nativeEnum(GENDER),
    }),
});

const login = z.object({
    body: z.object({
        identifier: z.string().min(1), // Can be email or username
        password: z.string().min(1),
    }),
});

const verifyOtp = z.object({
    body: z.object({
        email: z.string().email(),
        otp: z.string().length(6).regex(/^\d+$/, 'OTP must be 6 digits'),
    }),
});

const logout = z.object({});

module.exports = {
    signup,
    login,
    verifyOtp,
    logout,
};

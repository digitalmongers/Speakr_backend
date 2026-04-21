const mongoose = require('mongoose');
const { GENDER } = require('../constants');

const pendingUserSchema = mongoose.Schema(
    {
        firstName: {
            type: String,
            required: true,
            trim: true,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
        },
        username: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
            trim: true,
        },
        dob: {
            type: Date,
            required: true,
        },
        gender: {
            type: String,
            enum: Object.values(GENDER),
            required: true,
        },
        otp: {
            type: String,
            required: true,
        },
        otpAttempts: {
            type: Number,
            default: 0,
        },
        expiresAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
            index: { expires: 0 }, // TTL Index: record deleted when expiresAt is reached
        },
    },
    {
        timestamps: true,
    }
);

/**
 * @typedef PendingUser
 */
const PendingUser = mongoose.model('PendingUser', pendingUserSchema);

module.exports = PendingUser;

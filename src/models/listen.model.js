const mongoose = require('mongoose');

const listenSchema = new mongoose.Schema(
    {
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
            required: [true, 'Post reference is required'],
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
        guestId: {
            type: String,
            required: false,
            trim: true,
        },
        ipAddress: {
            type: String,
            required: false,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes to enforce deduplication of listens on a post

// 1. Logged-in users can only listen to a post once
listenSchema.index(
    { post: 1, user: 1 },
    { unique: true, partialFilterExpression: { user: { $exists: true } } }
);

// 2. Guests using a guestId can only listen to a post once
listenSchema.index(
    { post: 1, guestId: 1 },
    { unique: true, partialFilterExpression: { guestId: { $exists: true } } }
);

// 3. Fallback: unique per IP address if guestId is not present
listenSchema.index(
    { post: 1, ipAddress: 1 },
    { unique: true, partialFilterExpression: { ipAddress: { $exists: true } } }
);

// Optimize query performance when checking a user's listened posts
listenSchema.index({ user: 1 });

const Listen = mongoose.model('Listen', listenSchema);

module.exports = {
    Listen,
};

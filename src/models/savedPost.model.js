const mongoose = require('mongoose');

const savedPostSchema = new mongoose.Schema(
    {
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
            required: [true, 'Post reference is required'],
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User reference is required'],
        },
    },
    {
        timestamps: true,
    }
);

// Compound Index to prevent duplicate saves on a single post by the same user
savedPostSchema.index({ post: 1, user: 1 }, { unique: true });

// Optimize query performance when checking a user's saved posts
savedPostSchema.index({ user: 1, createdAt: -1 });

const SavedPost = mongoose.model('SavedPost', savedPostSchema);

module.exports = {
    SavedPost,
};

const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema(
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

// Compound Index to prevent duplicate likes on a single post by the same user
likeSchema.index({ post: 1, user: 1 }, { unique: true });

// Optimize query performance when checking a user's liked posts
likeSchema.index({ user: 1 });

const Like = mongoose.model('Like', likeSchema);

module.exports = {
    Like,
};

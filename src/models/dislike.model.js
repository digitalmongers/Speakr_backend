const mongoose = require('mongoose');

const dislikeSchema = new mongoose.Schema(
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

// Compound Index to prevent duplicate dislikes on a single post by the same user
dislikeSchema.index({ post: 1, user: 1 }, { unique: true });

// Optimize query performance when checking a user's disliked posts
dislikeSchema.index({ user: 1 });

const Dislike = mongoose.model('Dislike', dislikeSchema);

module.exports = {
    Dislike,
};

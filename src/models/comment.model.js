const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
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
        content: {
            type: String,
            required: [true, 'Comment content is required'],
            trim: true,
            minlength: [1, 'Comment must not be empty'],
            maxlength: [1000, 'Comment cannot exceed 1000 characters'],
        },
        audioRepliesCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// High-performance compound index for fetching a post's comments sorted by newest first
commentSchema.index({ post: 1, createdAt: -1 });

const Comment = mongoose.model('Comment', commentSchema);

module.exports = {
    Comment,
};

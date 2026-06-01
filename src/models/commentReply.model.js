const mongoose = require('mongoose');

const commentReplySchema = new mongoose.Schema(
    {
        comment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Comment',
            required: [true, 'Comment reference is required'],
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User reference is required'],
        },
        audioUrl: {
            type: String,
            required: [true, 'Audio URL is required'],
        },
        audioKey: {
            type: String,
            required: [true, 'Audio key is required'],
        },
    },
    {
        timestamps: true,
    }
);

// High-performance compound index for fetching comment replies sorted by oldest first
commentReplySchema.index({ comment: 1, createdAt: 1 });

const CommentReply = mongoose.model('CommentReply', commentReplySchema);

module.exports = {
    CommentReply,
};

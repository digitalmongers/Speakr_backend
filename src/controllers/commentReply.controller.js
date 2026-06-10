const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const commentReplyService = require('../services/commentReply.service');
const { invalidateCacheByPattern } = require('../middlewares/cache.middleware');
const AppError = require('../utils/AppError');

/**
 * Controller to add a new audio reply on a comment
 */
const addReply = catchAsync(async (req, res) => {
    const { postId, commentId } = req.params;
    const userId = req.user._id;

    if (!req.file) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Please upload an audio file for the reply');
    }

    const reply = await commentReplyService.addReply(postId, commentId, userId, req.file);

    // Invalidate cached lists relating to this post (single details, comments, replies)
    await invalidateCacheByPattern(`cache:*:*/posts/${postId}*`).catch((err) => {
        console.error('Failed to invalidate caches on reply add:', err);
    });

    res.status(httpStatus.CREATED).json({
        status: 'success',
        message: 'Reply posted successfully',
        data: {
            reply,
        },
    });
});

/**
 * Controller to fetch all replies for a specific comment using cursor-based pagination
 */
const getReplies = catchAsync(async (req, res) => {
    const { postId, commentId } = req.params;
    const { limit, cursor } = req.query;

    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    const data = await commentReplyService.getRepliesByCommentId(postId, commentId, {
        limit: parsedLimit,
        cursor,
    });

    res.status(httpStatus.OK).json({
        status: 'success',
        data,
    });
});

/**
 * Controller to delete an audio reply from a comment
 */
const deleteReply = catchAsync(async (req, res) => {
    const { postId, commentId, replyId } = req.params;
    const userId = req.user._id;

    await commentReplyService.deleteReply(postId, commentId, replyId, userId);

    // Invalidate cached lists relating to this post (single details, comments, replies)
    await invalidateCacheByPattern(`cache:*:*/posts/${postId}*`).catch((err) => {
        console.error('Failed to invalidate caches on reply delete:', err);
    });

    res.status(httpStatus.OK).json({
        status: 'success',
        message: 'Reply deleted successfully',
    });
});

module.exports = {
    addReply,
    getReplies,
    deleteReply,
};

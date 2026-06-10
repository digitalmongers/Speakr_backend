const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const commentService = require('../services/comment.service');
const { invalidateCacheByPattern } = require('../middlewares/cache.middleware');

/**
 * Controller to add a new comment on an audio post
 */
const addComment = catchAsync(async (req, res) => {
    const { postId } = req.params;
    const userId = req.user._id;
    const { content } = req.body;

    const comment = await commentService.addComment(postId, userId, content);

    // Invalidate caches related to this post (single details, comments) and general posts lists (commentsCount change)
    await Promise.all([
        invalidateCacheByPattern(`cache:*:*/posts/${postId}*`),
        invalidateCacheByPattern('cache:*:/api/v1/posts*'),
    ]).catch((err) => console.error('Failed to invalidate caches on comment add:', err));

    res.status(httpStatus.CREATED).json({
        status: 'success',
        message: 'Comment published successfully',
        data: {
            comment,
        },
    });
});

/**
 * Controller to get all comments of an audio post using cursor-based pagination
 */
const getComments = catchAsync(async (req, res) => {
    const { postId } = req.params;
    const { limit, cursor } = req.query;

    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    const data = await commentService.getCommentsByPostId(postId, { limit: parsedLimit, cursor });

    res.status(httpStatus.OK).json({
        status: 'success',
        data,
    });
});

/**
 * Controller to delete a comment from an audio post
 */
const deleteComment = catchAsync(async (req, res) => {
    const { postId, commentId } = req.params;
    const userId = req.user._id;

    await commentService.deleteComment(commentId, postId, userId);

    // Invalidate caches related to this post (single details, comments) and general posts lists (commentsCount change)
    await Promise.all([
        invalidateCacheByPattern(`cache:*:*/posts/${postId}*`),
        invalidateCacheByPattern('cache:*:/api/v1/posts*'),
    ]).catch((err) => console.error('Failed to invalidate caches on comment delete:', err));

    res.status(httpStatus.OK).json({
        status: 'success',
        message: 'Comment deleted successfully',
    });
});

module.exports = {
    addComment,
    getComments,
    deleteComment,
};

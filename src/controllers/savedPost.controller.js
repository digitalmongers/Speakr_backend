const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const savedPostService = require('../services/savedPost.service');
const { invalidateCacheByPattern } = require('../middlewares/cache.middleware');

/**
 * Controller to toggle save status on a post
 */
const toggleSave = catchAsync(async (req, res) => {
    const { postId } = req.params;
    const userId = req.user._id;

    const result = await savedPostService.toggleSave(postId, userId);

    // Invalidate post-specific cache and user's personal list feeds (including saved list)
    await Promise.all([
        invalidateCacheByPattern(`cache:*:*/posts/${postId}*`),
        invalidateCacheByPattern(`cache:user:${userId}:/api/v1/posts*`),
    ]).catch((err) => {
        console.error('Failed to invalidate caches on save toggle:', err);
    });

    res.status(httpStatus.OK).json({
        status: 'success',
        message: result.saved ? 'Post saved successfully' : 'Post unsaved successfully',
        data: result,
    });
});

/**
 * Controller to retrieve authenticated user's saved posts
 */
const getMySavedPosts = catchAsync(async (req, res) => {
    const { page, limit, cursor } = req.query;
    const userId = req.user._id;

    const result = await savedPostService.getSavedPosts(userId, { page, limit, cursor });

    res.status(httpStatus.OK).json({
        status: 'success',
        data: result,
    });
});

module.exports = {
    toggleSave,
    getMySavedPosts,
};

const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const likeService = require('../services/like.service');

/**
 * Controller to toggle like on a post
 */
const toggleLike = catchAsync(async (req, res) => {
    const { postId } = req.params;
    const userId = req.user._id;

    const result = await likeService.toggleLike(postId, userId);

    res.status(httpStatus.OK).json({
        status: 'success',
        message: result.liked ? 'Post liked successfully' : 'Post unliked successfully',
        data: result,
    });
});

/**
 * Controller to toggle dislike on a post
 */
const toggleDislike = catchAsync(async (req, res) => {
    const { postId } = req.params;
    const userId = req.user._id;

    const result = await likeService.toggleDislike(postId, userId);

    res.status(httpStatus.OK).json({
        status: 'success',
        message: result.disliked ? 'Post disliked successfully' : 'Post undisliked successfully',
        data: result,
    });
});

module.exports = {
    toggleLike,
    toggleDislike,
};

const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const postService = require('../services/post.service');
const { invalidateCacheByPattern } = require('../middlewares/cache.middleware');
const Logger = require('../utils/logger');

/**
 * Controller to create a new audio post
 */
const createPost = catchAsync(async (req, res) => {
    // req.body has already been verified and validated by validate(postValidation.createPost) middleware
    const post = await postService.createPost(req.user._id, req.body);

    // Convert Mongoose doc to plain JS object to delete internal keys before response
    const postObj = post.toObject ? post.toObject() : { ...post };
    delete postObj.audioKey;
    delete postObj.thumbnailKey;

    // Invalidate cached lists (Homepage, Creator feeds)
    // Ensures homepage updates instantly when a new post is published!
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    res.status(httpStatus.CREATED).json({
        status: 'success',
        message: 'Post published successfully',
        data: {
            post: postObj,
        },
    });
});

/**
 * Controller to fetch post details by ID
 */
const getPost = catchAsync(async (req, res) => {
    const userId = req.user ? req.user._id : null;
    const post = await postService.getPostById(req.params.postId, userId);

    // Sanitize internal keys to prevent storage detail leakage
    const postObj = { ...post };
    delete postObj.audioKey;
    delete postObj.thumbnailKey;

    res.status(httpStatus.OK).json({
        status: 'success',
        data: {
            post: postObj,
        },
    });
});

/**
 * Controller to retrieve all public posts (supports filters & pagination)
 */
const queryPosts = catchAsync(async (req, res) => {
    const { page, limit, category, language, isKidsContent, creator, cursor, search } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (language) filter.language = language;
    // Default to false (exclude kids content) in general feed if not explicitly requested
    filter.isKidsContent = isKidsContent !== undefined ? isKidsContent : false;
    if (creator) filter.creator = creator;

    // Hybrid Search Optimization: Uses MongoDB Full-Text Index ($text) for O(1) searches on full phrases/words (>= 3 chars),
    // and falls back to optimized regex for short partial keywords to prevent COLLSCAN query bottlenecking.
    if (search) {
        if (search.trim().length >= 3) {
            filter.$text = { $search: search };
        } else {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } },
                { language: { $regex: search, $options: 'i' } },
            ];
        }
    }

    const userId = req.user ? req.user._id : null;
    const result = await postService.queryPosts(filter, { page, limit, cursor }, userId);

    res.status(httpStatus.OK).json({
        status: 'success',
        data: result,
    });
});

/**
 * Controller to retrieve posts created by the authenticated user
 */
const getMyPosts = catchAsync(async (req, res) => {
    const { page, limit, category, language, isKidsContent, cursor, search } = req.query;

    // Restrict filter strictly to authenticated user's ID
    const filter = { creator: req.user._id };
    if (category) filter.category = category;
    if (language) filter.language = language;
    if (isKidsContent !== undefined) filter.isKidsContent = isKidsContent;

    // Hybrid Search Optimization: Uses MongoDB Full-Text Index ($text) for O(1) searches on full phrases/words (>= 3 chars),
    // and falls back to optimized regex for short partial keywords within user's personal scope.
    if (search) {
        if (search.trim().length >= 3) {
            filter.$text = { $search: search };
        } else {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } },
                { language: { $regex: search, $options: 'i' } },
            ];
        }
    }

    const userId = req.user ? req.user._id : null;
    const result = await postService.queryPosts(filter, { page, limit, cursor }, userId);

    res.status(httpStatus.OK).json({
        status: 'success',
        data: result,
    });
});

/**
 * Controller to delete an audio post
 */
const deletePost = catchAsync(async (req, res) => {
    const { postId } = req.params;

    await postService.deletePost(postId, req.user._id);

    // Invalidate caches instantly so deleted content stops appearing in feeds
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    res.status(httpStatus.OK).json({
        status: 'success',
        message: 'Post deleted successfully',
    });
});

module.exports = {
    createPost,
    getPost,
    queryPosts,
    getMyPosts,
    deletePost,
};

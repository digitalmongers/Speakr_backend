const httpStatus = require('http-status').default;
const catchAsync = require('../../utils/catchAsync');
const postService = require('../../services/post.service');
const ApiResponse = require('../../utils/ApiResponse');
const AuditService = require('../../services/audit.service');
const { invalidateCacheByPattern } = require('../../middlewares/cache.middleware');
const { Post } = require('../../models/post.model');

/**
 * Retrieve all posts for admin (with moderation status filtering)
 */
const queryAdminPosts = catchAsync(async (req, res) => {
    const { page, limit, category, language, creator, status, cursor, search } = req.query;

    const filter = {};
    filter.status = status !== undefined ? status : 'pending';
    filter.isKidsContent = true;
    if (category) filter.category = category;
    if (language) filter.language = language;
    if (creator) filter.creator = creator;

    if (search) {
        if (search.trim().length >= 3) {
            filter.$text = { $search: search };
        } else {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { title: { $regex: escapedSearch, $options: 'i' } },
                { category: { $regex: escapedSearch, $options: 'i' } },
                { language: { $regex: escapedSearch, $options: 'i' } },
            ];
        }
    }

    const result = await postService.queryPosts(filter, { page, limit, cursor }, null);

    if (result && result.results) {
        await Post.populate(result.results, { path: 'creator', select: 'firstName lastName username' });
    }

    AuditService.record({
        action: 'ADMIN_QUERY_POSTS',
        entity: 'Admin',
        entityId: req.admin._id,
        userId: req.admin._id,
        metadata: { filter },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            result,
            'Admin posts list retrieved successfully.'
        )
    );
});

/**
 * Retrieve all general posts for admin (excludes Kids Zone posts)
 */
const queryAdminGeneralPosts = catchAsync(async (req, res) => {
    const { page, limit, category, language, creator, status, cursor, search } = req.query;

    const filter = {};
    if (status) filter.status = status;
    filter.isKidsContent = false; // Strictly retrieve general posts only
    if (category) filter.category = category;
    if (language) filter.language = language;
    if (creator) filter.creator = creator;

    if (search) {
        if (search.trim().length >= 3) {
            filter.$text = { $search: search };
        } else {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { title: { $regex: escapedSearch, $options: 'i' } },
                { category: { $regex: escapedSearch, $options: 'i' } },
                { language: { $regex: escapedSearch, $options: 'i' } },
            ];
        }
    }

    const result = await postService.queryPosts(filter, { page, limit, cursor }, null);

    if (result && result.results) {
        await Post.populate(result.results, { path: 'creator', select: 'firstName lastName username' });
    }

    AuditService.record({
        action: 'ADMIN_QUERY_GENERAL_POSTS',
        entity: 'Admin',
        entityId: req.admin._id,
        userId: req.admin._id,
        metadata: { filter },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            result,
            'Admin general posts list retrieved successfully.'
        )
    );
});

/**
 * Get post details for admin (including pending/rejected posts)
 */
const getAdminPost = catchAsync(async (req, res) => {
    const { postId } = req.params;
    const post = await postService.getPostById(postId, null, true);

    if (post) {
        await Post.populate(post, { path: 'creator', select: 'firstName lastName username' });
    }

    AuditService.record({
        action: 'ADMIN_GET_POST',
        entity: 'Post',
        entityId: postId,
        userId: req.admin._id,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            post,
            'Admin post details retrieved successfully.'
        )
    );
});

/**
 * Approve a pending post
 */
const approvePost = catchAsync(async (req, res) => {
    const { postId } = req.params;

    const post = await postService.updatePostStatus(postId, 'approved', req.admin._id);

    // Invalidate public caches since post status/visibility changed
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            post,
            'Post approved successfully.'
        )
    );
});

/**
 * Reject a pending or approved post
 */
const rejectPost = catchAsync(async (req, res) => {
    const { postId } = req.params;
    const { reason } = req.body;

    const post = await postService.updatePostStatus(postId, 'rejected', req.admin._id);

    // Invalidate public caches since post status/visibility changed
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            post,
            'Post rejected successfully.'
        )
    );
});

/**
 * Delete a post by admin (bypasses ownership check, deletes cascade files/records)
 */
const deleteAdminPost = catchAsync(async (req, res) => {
    const { postId } = req.params;

    await postService.deletePost(postId, req.admin._id, true);

    // Invalidate public caches since post was deleted
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    AuditService.record({
        action: 'ADMIN_DELETE_POST',
        entity: 'Post',
        entityId: postId,
        userId: req.admin._id,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            null,
            'Post deleted successfully by admin.'
        )
    );
});

/**
 * Update a post by admin (title, category, language)
 */
const updateAdminPost = catchAsync(async (req, res) => {
    const { postId } = req.params;

    const updatedPost = await postService.updatePostByAdmin(postId, req.body, req.admin._id);

    // Invalidate public caches since post details changed
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            updatedPost,
            'Post updated successfully by admin.'
        )
    );
});

module.exports = {
    queryAdminPosts,
    queryAdminGeneralPosts,
    getAdminPost,
    approvePost,
    rejectPost,
    deleteAdminPost,
    updateAdminPost,
};

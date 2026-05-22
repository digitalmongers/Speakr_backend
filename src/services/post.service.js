const postRepository = require('../repositories/post.repository');
const userRepository = require('../repositories/user.repository');
const likeRepository = require('../repositories/like.repository');
const dislikeRepository = require('../repositories/dislike.repository');
const savedPostRepository = require('../repositories/savedPost.repository');
const listenRepository = require('../repositories/listen.repository');
const UploadService = require('./upload.service');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');
const httpStatus = require('http-status').default;

/**
 * Create a new audio post
 * @param {ObjectId} userId - Creator ID
 * @param {Object} postData - Post metadata and file details
 * @returns {Promise<Object>}
 */
const createPost = async (userId, postData) => {
    const user = await userRepository.getUserById(userId);
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'Creator user not found');
    }

    const postBody = {
        ...postData,
        creator: userId,
        creatorUsername: user.username,
    };
    const post = await postRepository.create(postBody);
    Logger.info('Post created successfully', { postId: post._id, creator: userId });
    return post;
};

/**
 * Retrieve a post by ID
 * @param {ObjectId} postId
 * @param {ObjectId} [userId]
 * @returns {Promise<Object>}
 */
const getPostById = async (postId, userId = null) => {
    const post = await postRepository.findById(postId);
    if (!post) {
        throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
    }

    if (userId) {
        const [isLiked, isDisliked, isSaved, isListened] = await Promise.all([
            likeRepository.exists(postId, userId),
            dislikeRepository.exists(postId, userId),
            savedPostRepository.exists(postId, userId),
            listenRepository.existsByUser(postId, userId)
        ]);
        post.isLiked = isLiked;
        post.isDisliked = isDisliked;
        post.isSaved = isSaved;
        post.isListened = isListened;
    } else {
        post.isLiked = false;
        post.isDisliked = false;
        post.isSaved = false;
        post.isListened = false;
    }

    return post;
};

/**
 * Paginated query for public posts (Supports both cursor-based infinite scroll and offset-based paging)
 * @param {Object} filter - Database query filters
 * @param {Object} paginationOptions
 * @param {number} [paginationOptions.page]
 * @param {number} paginationOptions.limit
 * @param {string} [paginationOptions.cursor]
 * @param {ObjectId} [userId] - Optional authenticated user ID for reaction status hydration
 * @returns {Promise<Object>}
 */
const queryPosts = async (filter, { page, limit = 10, cursor }, userId = null) => {
    // Helper function to hydrate a list of posts in bulk (N+1 query optimization)
    const hydratePosts = async (postsList) => {
        if (!postsList || postsList.length === 0) return postsList;
        
        if (!userId) {
            postsList.forEach(post => {
                post.isLiked = false;
                post.isDisliked = false;
                post.isSaved = false;
                post.isListened = false;
            });
            return postsList;
        }

        const postIds = postsList.map(post => post._id);
        const [likes, dislikes, saves, listens] = await Promise.all([
            likeRepository.findByUserAndPostIds(postIds, userId),
            dislikeRepository.findByUserAndPostIds(postIds, userId),
            savedPostRepository.findByUserAndPostIds(postIds, userId),
            listenRepository.findByUserAndPostIds(postIds, userId)
        ]);

        const likedPostIdsSet = new Set(likes.map(l => l.post.toString()));
        const dislikedPostIdsSet = new Set(dislikes.map(d => d.post.toString()));
        const savedPostIdsSet = new Set(saves.map(s => s.post.toString()));
        const listenedPostIdsSet = new Set(listens.map(li => li.post.toString()));

        postsList.forEach(post => {
            const postIdStr = post._id.toString();
            post.isLiked = likedPostIdsSet.has(postIdStr);
            post.isDisliked = dislikedPostIdsSet.has(postIdStr);
            post.isSaved = savedPostIdsSet.has(postIdStr);
            post.isListened = listenedPostIdsSet.has(postIdStr);
        });

        return postsList;
    };

    // If cursor is provided or page is not provided, use Cursor-Based pagination (Infinite Scroll optimized)
    if (cursor !== undefined || !page) {
        const posts = await postRepository.findWithCursor(filter, { limit, cursor });
        
        let hasNextPage = false;
        let nextCursor = null;

        if (posts.length > limit) {
            hasNextPage = true;
            const nextItem = posts[limit - 1]; // Get the last item of the requested limit
            nextCursor = nextItem.createdAt.toISOString();
            // Trim the array to the requested limit
            posts.splice(limit);
        }

        await hydratePosts(posts);

        return {
            results: posts,
            limit,
            hasNextPage,
            nextCursor,
        };
    }

    // Fallback to Offset-Based pagination if page is explicitly requested
    const skip = (page - 1) * limit;

    const [posts, totalResults] = await Promise.all([
        postRepository.find(filter, { limit, skip }),
        postRepository.count(filter),
    ]);

    await hydratePosts(posts);

    const totalPages = Math.ceil(totalResults / limit);

    return {
        results: posts,
        page,
        limit,
        totalPages,
        totalResults,
    };
};

/**
 * Delete a post (with associated storage files cleanup)
 * @param {ObjectId} postId
 * @param {ObjectId} userId - Demarcates requester for ownership validation
 * @returns {Promise<boolean>}
 */
const deletePost = async (postId, userId) => {
    const post = await postRepository.findById(postId);
    if (!post) {
        throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
    }

    // Verify creator ownership (strict RBAC check)
    if (post.creator.toString() !== userId.toString()) {
        throw new AppError(httpStatus.FORBIDDEN, 'You do not have permission to delete this post');
    }

    // Storage assets deletion (conforms to Staff-level error-resilient guidelines)
    try {
        Logger.info('Initiating post asset cleanup from storage', { postId, audioKey: post.audioKey, thumbnailKey: post.thumbnailKey });
        
        // Execute storage deletions concurrently
        await Promise.all([
            UploadService.deleteFromS3(post.audioKey),
            UploadService.deleteFromS3(post.thumbnailKey)
        ]);
        
        Logger.info('Post assets purged from storage successfully');
    } catch (storageError) {
        // Log failure but proceed with database deletion so records don't get orphaned/stuck.
        Logger.error('Failure during post asset cleanup, proceeding with DB removal:', { postId, error: storageError.message });
    }

    // Delete post record from DB
    await postRepository.deleteById(postId);
    Logger.info('Post removed from database successfully', { postId });
    return true;
};

module.exports = {
    createPost,
    getPostById,
    queryPosts,
    deletePost,
};

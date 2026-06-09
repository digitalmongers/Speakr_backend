const mongoose = require('mongoose');
const httpStatus = require('http-status').default;
const postRepository = require('../repositories/post.repository');
const savedPostRepository = require('../repositories/savedPost.repository');
const likeRepository = require('../repositories/like.repository');
const dislikeRepository = require('../repositories/dislike.repository');
const listenRepository = require('../repositories/listen.repository');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');
const { runTransaction } = require('../utils/transaction');

/**
 * Toggle save status on a post for a given user.
 * Runs atomically inside a Mongoose ACID Transaction.
 * @param {ObjectId} postId - ID of the post to save/unsave
 * @param {ObjectId} userId - ID of the user performing the action
 * @returns {Promise<Object>} Object containing saved status and the new saves count
 */
const toggleSave = async (postId, userId) => {
    let result = null;

    try {
        await runTransaction(async (session) => {
            // 1. Verify post existence and is approved
            const post = await postRepository.findById(postId, session);
            if (!post || post.status !== 'approved') {
                throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
            }

            // 2. Check if a saved record already exists
            const existingSave = await savedPostRepository.findOneByPostAndUser(postId, userId, session);

            let saved = false;
            let saveInc = 0;

            if (existingSave) {
                // Unsave: Delete the record and decrement count
                await savedPostRepository.deleteById(existingSave._id, session);
                saveInc = -1;
                saved = false;
                Logger.info('Post unsaved successfully', { postId, userId });
            } else {
                // Save: Create the record and increment count
                await savedPostRepository.create({ post: postId, user: userId }, session);
                saveInc = 1;
                saved = true;
                Logger.info('Post saved successfully', { postId, userId });
            }

            // Apply atomic savesCount update on the post
            const updatedPost = await postRepository.updateSavesCount(postId, saveInc, session);
            
            if (!updatedPost) {
                throw new AppError(httpStatus.NOT_FOUND, 'Post not found or was deleted');
            }

            result = {
                saved,
                savesCount: Math.max(0, updatedPost.savesCount || 0),
            };
        });

        return result;
    } catch (error) {
        Logger.error('Error during post save toggling transaction:', { postId, userId, error: error.message });
        throw error;
    }
};

/**
 * Get paginated list of saved posts for a user with reaction hydration (N+1 query optimized)
 * @param {ObjectId} userId - ID of the user retrieving their saved posts
 * @param {Object} paginationOptions
 * @param {number} [paginationOptions.page]
 * @param {number} paginationOptions.limit
 * @param {string} [paginationOptions.cursor]
 * @returns {Promise<Object>}
 */
const getSavedPosts = async (userId, { page, limit = 10, cursor }) => {
    let savedRecords = [];
    let hasNextPage = false;
    let nextCursor = null;
    let totalResults = 0;
    let totalPages = 0;

    // Use cursor-based pagination if requested (Infinite scroll optimized)
    if (cursor !== undefined || !page) {
        savedRecords = await savedPostRepository.findSavedPostsByUserWithCursor(userId, { limit, cursor });
        if (savedRecords.length > limit) {
            hasNextPage = true;
            const nextItem = savedRecords[limit - 1]; // Get last item of requested limit
            nextCursor = nextItem.createdAt.toISOString();
            savedRecords.splice(limit);
        }
    } else {
        // Fallback to offset-based paging
        const skip = (page - 1) * limit;
        [savedRecords, totalResults] = await Promise.all([
            savedPostRepository.findSavedPostsByUser(userId, { limit, skip }),
            savedPostRepository.countSavedPosts(userId),
        ]);
        totalPages = Math.ceil(totalResults / limit);
    }

    // Extract populated post documents and filter out orphaned/unapproved posts
    const posts = savedRecords
        .map(record => record.post)
        .filter(post => post !== null && post !== undefined && post.status === 'approved');

    // Optimize Query: Fetch reactions in bulk to prevent N+1 query loops
    const postIds = posts.map(p => p._id);
    const [likes, dislikes, listens] = await Promise.all([
        likeRepository.findByUserAndPostIds(postIds, userId),
        dislikeRepository.findByUserAndPostIds(postIds, userId),
        listenRepository.findByUserAndPostIds(postIds, userId)
    ]);

    const likedPostIdsSet = new Set(likes.map(l => l.post.toString()));
    const dislikedPostIdsSet = new Set(dislikes.map(d => d.post.toString()));
    const listenedPostIdsSet = new Set(listens.map(li => li.post.toString()));

    posts.forEach(post => {
        const postIdStr = post._id.toString();
        post.isLiked = likedPostIdsSet.has(postIdStr);
        post.isDisliked = dislikedPostIdsSet.has(postIdStr);
        post.isSaved = true; // All items in this list are saved posts!
        post.isListened = listenedPostIdsSet.has(postIdStr);

        // Sanitize internal/heavy fields to prevent data leakage in response
        delete post.audioKey;
        delete post.thumbnailKey;
    });

    if (cursor !== undefined || !page) {
        return {
            results: posts,
            limit,
            hasNextPage,
            nextCursor,
        };
    }

    return {
        results: posts,
        page,
        limit,
        totalPages,
        totalResults,
    };
};

module.exports = {
    toggleSave,
    getSavedPosts,
};

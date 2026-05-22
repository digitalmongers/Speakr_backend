const mongoose = require('mongoose');
const httpStatus = require('http-status').default;
const postRepository = require('../repositories/post.repository');
const likeRepository = require('../repositories/like.repository');
const dislikeRepository = require('../repositories/dislike.repository');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');

/**
 * Toggle like status on a post for a given user.
 * Runs atomically inside a Mongoose ACID Transaction.
 * If user has disliked the post, it undislikes it.
 * @param {ObjectId} postId - ID of the post to like/unlike
 * @param {ObjectId} userId - ID of the user performing the action
 * @returns {Promise<Object>} Object containing liked, disliked status and the new counts
 */
const toggleLike = async (postId, userId) => {
    const session = await mongoose.startSession();
    let result = null;

    try {
        await session.withTransaction(async () => {
            // 1. Verify post existence
            const post = await postRepository.findById(postId);
            if (!post) {
                throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
            }

            // 2. Check if a like record already exists
            const existingLike = await likeRepository.findOneByPostAndUser(postId, userId, session);
            // Check if a dislike record already exists
            const existingDislike = await dislikeRepository.findOneByPostAndUser(postId, userId, session);

            let liked = false;
            let disliked = false;
            let likeInc = 0;
            let dislikeInc = 0;

            if (existingLike) {
                // Unlike: Delete the like record and decrement the post's likesCount
                await likeRepository.deleteById(existingLike._id, session);
                likeInc = -1;
                liked = false;
                Logger.info('Post unliked successfully', { postId, userId });
            } else {
                // Like: Create the like record and increment the post's likesCount
                await likeRepository.create({ post: postId, user: userId }, session);
                likeInc = 1;
                liked = true;
                Logger.info('Post liked successfully', { postId, userId });

                // If user previously disliked the post, remove the dislike
                if (existingDislike) {
                    await dislikeRepository.deleteById(existingDislike._id, session);
                    dislikeInc = -1;
                    Logger.info('Post undisliked automatically due to like action', { postId, userId });
                }
            }

            // Apply atomic likesCount and dislikesCount update on the post
            const updatedPost = await postRepository.updateLikesAndDislikesCount(postId, likeInc, dislikeInc, session);
            
            // Handle potential case where post was deleted mid-transaction
            if (!updatedPost) {
                throw new AppError(httpStatus.NOT_FOUND, 'Post not found or was deleted');
            }

            result = {
                liked,
                disliked, // will be false since user has liked/unliked the post
                likesCount: Math.max(0, updatedPost.likesCount || 0),
                dislikesCount: Math.max(0, updatedPost.dislikesCount || 0),
            };
        });

        return result;
    } catch (error) {
        Logger.error('Error during post like toggling transaction:', { postId, userId, error: error.message });
        throw error;
    } finally {
        session.endSession();
    }
};

/**
 * Toggle dislike status on a post for a given user.
 * Runs atomically inside a Mongoose ACID Transaction.
 * If user has liked the post, it unlikes it.
 * @param {ObjectId} postId - ID of the post to dislike/undislike
 * @param {ObjectId} userId - ID of the user performing the action
 * @returns {Promise<Object>} Object containing liked, disliked status and the new counts
 */
const toggleDislike = async (postId, userId) => {
    const session = await mongoose.startSession();
    let result = null;

    try {
        await session.withTransaction(async () => {
            // 1. Verify post existence
            const post = await postRepository.findById(postId);
            if (!post) {
                throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
            }

            // 2. Check if a dislike record already exists
            const existingDislike = await dislikeRepository.findOneByPostAndUser(postId, userId, session);
            // Check if a like record already exists
            const existingLike = await likeRepository.findOneByPostAndUser(postId, userId, session);

            let liked = false;
            let disliked = false;
            let likeInc = 0;
            let dislikeInc = 0;

            if (existingDislike) {
                // Remove dislike: Delete the dislike record and decrement the post's dislikesCount
                await dislikeRepository.deleteById(existingDislike._id, session);
                dislikeInc = -1;
                disliked = false;
                Logger.info('Post undisliked successfully', { postId, userId });
            } else {
                // Dislike: Create the dislike record and increment the post's dislikesCount
                await dislikeRepository.create({ post: postId, user: userId }, session);
                dislikeInc = 1;
                disliked = true;
                Logger.info('Post disliked successfully', { postId, userId });

                // If user previously liked the post, remove the like
                if (existingLike) {
                    await likeRepository.deleteById(existingLike._id, session);
                    likeInc = -1;
                    Logger.info('Post unliked automatically due to dislike action', { postId, userId });
                }
            }

            // Apply atomic likesCount and dislikesCount update on the post
            const updatedPost = await postRepository.updateLikesAndDislikesCount(postId, likeInc, dislikeInc, session);
            
            // Handle potential case where post was deleted mid-transaction
            if (!updatedPost) {
                throw new AppError(httpStatus.NOT_FOUND, 'Post not found or was deleted');
            }

            result = {
                liked, // will be false since user has disliked/undisliked the post
                disliked,
                likesCount: Math.max(0, updatedPost.likesCount || 0),
                dislikesCount: Math.max(0, updatedPost.dislikesCount || 0),
            };
        });

        return result;
    } catch (error) {
        Logger.error('Error during post dislike toggling transaction:', { postId, userId, error: error.message });
        throw error;
    } finally {
        session.endSession();
    }
};

module.exports = {
    toggleLike,
    toggleDislike,
};

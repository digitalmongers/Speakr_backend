const mongoose = require('mongoose');
const httpStatus = require('http-status').default;
const postRepository = require('../repositories/post.repository');
const likeRepository = require('../repositories/like.repository');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');

/**
 * Toggle like status on a post for a given user.
 * Runs atomically inside a Mongoose ACID Transaction.
 * @param {ObjectId} postId - ID of the post to like/unlike
 * @param {ObjectId} userId - ID of the user performing the action
 * @returns {Promise<Object>} Object containing liked status and the new likesCount
 */
const toggleLike = async (postId, userId) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Verify post existence
        const post = await postRepository.findById(postId);
        if (!post) {
            throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
        }

        // 2. Check if a like record already exists
        const existingLike = await likeRepository.findOneByPostAndUser(postId, userId, session);

        let liked = false;
        let increment = 0;

        if (existingLike) {
            // Unlike: Delete the like record and decrement the post's likesCount
            await likeRepository.deleteById(existingLike._id, session);
            increment = -1;
            liked = false;
            Logger.info('Post unliked successfully', { postId, userId });
        } else {
            // Like: Create the like record and increment the post's likesCount
            await likeRepository.create({ post: postId, user: userId }, session);
            increment = 1;
            liked = true;
            Logger.info('Post liked successfully', { postId, userId });
        }

        // Apply atomic likesCount update on the post
        const updatedPost = await postRepository.updateLikesCount(postId, increment, session);
        
        // Handle potential case where post was deleted mid-transaction
        if (!updatedPost) {
            throw new AppError(httpStatus.NOT_FOUND, 'Post not found or was deleted');
        }

        await session.commitTransaction();
        session.endSession();

        return {
            liked,
            likesCount: Math.max(0, updatedPost.likesCount || 0),
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        Logger.error('Error during post like toggling transaction:', { postId, userId, error: error.message });
        throw error;
    }
};

module.exports = {
    toggleLike,
};

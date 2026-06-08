const mongoose = require('mongoose');
const httpStatus = require('http-status').default;
const postRepository = require('../repositories/post.repository');
const commentRepository = require('../repositories/comment.repository');
const { getRelativeTimeAgo } = require('../utils/time');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');
const { runTransaction } = require('../utils/transaction');

/**
 * Add a new comment to an audio post
 * Runs atomically inside a Mongoose ACID transaction.
 * @param {ObjectId} postId - ID of the post
 * @param {ObjectId} userId - ID of the user commenting
 * @param {string} content - Comment content
 * @returns {Promise<Object>} The newly created comment
 */
const addComment = async (postId, userId, content) => {
    let commentResult = null;

    try {
        await runTransaction(async (session) => {
            // 1. Verify post exists
            const post = await postRepository.findById(postId);
            if (!post) {
                throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
            }

            // 2. Create comment
            const newComment = await commentRepository.create(
                {
                    post: postId,
                    user: userId,
                    content,
                },
                session
            );

            // 3. Atomically increment commentsCount on the post
            const updatedPost = await postRepository.incrementCommentsCount(postId, session);
            if (!updatedPost) {
                throw new AppError(httpStatus.NOT_FOUND, 'Post not found or was deleted');
            }

            Logger.info('Comment added successfully', { postId, userId, commentId: newComment._id });
            commentResult = newComment;
        });

        // Hydrate the created comment object before returning it (e.g. dynamic timeAgo)
        const commentObj = commentResult.toObject ? commentResult.toObject() : { ...commentResult };
        commentObj.timeAgo = getRelativeTimeAgo(commentObj.createdAt);

        return commentObj;
    } catch (error) {
        Logger.error('Error during add comment transaction:', { postId, userId, error: error.message });
        throw error;
    }
};

/**
 * Get comments for a post with cursor-based pagination, relative time ago, and populated user info
 * @param {ObjectId} postId - ID of the post
 * @param {Object} options
 * @param {number} [options.limit] - Max records to fetch
 * @param {string} [options.cursor] - ISO timestamp cursor
 * @returns {Promise<Object>} Hydrated list of comments with pagination info
 */
const getCommentsByPostId = async (postId, { limit = 10, cursor } = {}) => {
    // 1. Verify post exists
    const post = await postRepository.findById(postId);
    if (!post) {
        throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
    }

    // 2. Retrieve comments using cursor pagination
    const comments = await commentRepository.findWithCursor({ post: postId }, { limit, cursor });

    let hasNextPage = false;
    let nextCursor = null;

    if (comments.length > limit) {
        hasNextPage = true;
        const nextItem = comments[limit - 1]; // Get the last item of the requested limit
        nextCursor = nextItem.createdAt.toISOString();
        // Trim the array to the requested limit
        comments.splice(limit);
    }

    // 3. Hydrate comments with dynamic relative timeAgo
    const results = comments.map((comment) => {
        const commentObj = { ...comment };
        commentObj.timeAgo = getRelativeTimeAgo(comment.createdAt);
        return commentObj;
    });

    return {
        results,
        limit,
        hasNextPage,
        nextCursor,
    };
};

/**
 * Delete a comment from an audio post
 * Runs atomically inside a Mongoose ACID transaction.
 * Only the owner of the comment is permitted to delete it.
 * @param {ObjectId} commentId - ID of the comment to delete
 * @param {ObjectId} postId - ID of the post context
 * @param {ObjectId} userId - ID of the user requesting deletion
 * @returns {Promise<boolean>} True if comment deleted
 */
const deleteComment = async (commentId, postId, userId) => {
    try {
        await runTransaction(async (session) => {
            // 1. Find comment and check existence
            const comment = await commentRepository.findById(commentId, session);
            if (!comment) {
                throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
            }

            // 2. Strict authorization: check comment owner
            if (comment.user.toString() !== userId.toString()) {
                throw new AppError(httpStatus.FORBIDDEN, 'You do not have permission to delete this comment');
            }

            // 3. Post context verification
            if (comment.post.toString() !== postId.toString()) {
                throw new AppError(httpStatus.BAD_REQUEST, 'Comment does not belong to this post');
            }

            // 4. Delete the comment
            const deletedComment = await commentRepository.deleteById(commentId, session);

            if (deletedComment) {
                // 5. Decrement commentsCount on the post atomically
                const updatedPost = await postRepository.decrementCommentsCount(postId, session);
                if (!updatedPost) {
                    Logger.warn('Post not found during comment deletion post update', { postId });
                }
            }

            Logger.info('Comment deleted successfully', { commentId, postId, userId });
        });

        return true;
    } catch (error) {
        Logger.error('Error during comment deletion transaction:', { commentId, postId, userId, error: error.message });
        throw error;
    }
};

module.exports = {
    addComment,
    getCommentsByPostId,
    deleteComment,
};

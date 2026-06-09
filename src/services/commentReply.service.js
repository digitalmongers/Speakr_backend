const mongoose = require('mongoose');
const httpStatus = require('http-status').default;
const commentRepository = require('../repositories/comment.repository');
const commentReplyRepository = require('../repositories/commentReply.repository');
const postRepository = require('../repositories/post.repository');
const UploadService = require('./upload.service');
const { getRelativeTimeAgo } = require('../utils/time');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');
const { runTransaction } = require('../utils/transaction');

/**
 * Add a new audio reply to a comment
 * Runs atomically inside a Mongoose ACID transaction.
 * Automatically cleans up the uploaded file if database actions fail.
 * @param {ObjectId} postId - ID of the post context
 * @param {ObjectId} commentId - ID of the comment being replied to
 * @param {ObjectId} userId - ID of the user replying
 * @param {Object} file - The uploaded file object from multer
 * @returns {Promise<Object>} The newly created reply
 */
const addReply = async (postId, commentId, userId, file) => {
    if (!file) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Audio reply file is required');
    }

    let replyResult = null;

    try {
        await runTransaction(async (session) => {
            // 1. Verify parent comment exists
            const comment = await commentRepository.findById(commentId, session);
            if (!comment) {
                throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
            }

            // 2. Verify comment context matches the post
            if (comment.post.toString() !== postId.toString()) {
                throw new AppError(httpStatus.BAD_REQUEST, 'Comment does not belong to this post');
            }

            // Verify post exists and is approved
            const post = await postRepository.findById(postId, session);
            if (!post || post.status !== 'approved') {
                throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
            }

            // 3. Spam Prevention: Limit to 10 replies per user on a single comment
            const userReplyCount = await commentReplyRepository.countByCommentAndUser(commentId, userId, session);
            if (userReplyCount >= 10) {
                throw new AppError(httpStatus.TOO_MANY_REQUESTS, 'You have exceeded the maximum limit of 10 replies on this comment');
            }

            // 4. Create the reply
            replyResult = await commentReplyRepository.create(
                {
                    comment: commentId,
                    user: userId,
                    audioUrl: file.location,
                    audioKey: file.key,
                },
                session
            );

            // 4. Atomically increment the audioRepliesCount on the parent comment
            await commentRepository.incrementAudioRepliesCount(commentId, session);

            Logger.info('Comment reply added successfully', { commentId, userId, replyId: replyResult._id });
        });

        // Hydrate the created reply object before returning it (e.g. dynamic timeAgo)
        const replyObj = replyResult.toObject ? replyResult.toObject() : { ...replyResult };
        delete replyObj.audioKey;
        replyObj.timeAgo = getRelativeTimeAgo(replyObj.createdAt);

        return replyObj;
    } catch (error) {
        Logger.error('Error during add comment reply transaction, cleaning up file:', { commentId, userId, error: error.message });
        
        // Storage asset cleanup safeguard
        if (file && file.key) {
            try {
                await UploadService.deleteFromS3(file.key);
                Logger.info('Successfully cleaned up uploaded file on transaction failure', { key: file.key });
            } catch (cleanupError) {
                Logger.error('Failed to clean up uploaded file on transaction failure', { key: file.key, error: cleanupError.message });
            }
        }
        throw error;
    }
};

/**
 * Get all audio replies for a specific comment with user profiles using cursor-based pagination
 * @param {ObjectId} postId - ID of the post
 * @param {ObjectId} commentId - ID of the parent comment
 * @param {Object} options
 * @param {number} [options.limit] - Max records to fetch
 * @param {string} [options.cursor] - ISO timestamp cursor
 * @returns {Promise<Object>} Hydrated list of replies with pagination metadata
 */
const getRepliesByCommentId = async (postId, commentId, { limit = 10, cursor } = {}) => {
    // 1. Verify comment exists and matches post context
    const comment = await commentRepository.findById(commentId);
    if (!comment) {
        throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
    }
    if (comment.post.toString() !== postId.toString()) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Comment does not belong to this post');
    }

    // Verify post exists and is approved
    const post = await postRepository.findById(postId);
    if (!post || post.status !== 'approved') {
        throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
    }

    // 2. Retrieve replies using cursor pagination
    const replies = await commentReplyRepository.findWithCursor({ comment: commentId }, { limit, cursor });

    let hasNextPage = false;
    let nextCursor = null;

    if (replies.length > limit) {
        hasNextPage = true;
        const nextItem = replies[limit - 1]; // Get the last item of the requested limit
        nextCursor = nextItem.createdAt.toISOString();
        // Trim the array to the requested limit
        replies.splice(limit);
    }

    // 3. Hydrate with dynamic relative timeAgo
    const results = replies.map((reply) => {
        const replyObj = { ...reply };
        replyObj.timeAgo = getRelativeTimeAgo(reply.createdAt);
        return replyObj;
    });

    return {
        results,
        limit,
        hasNextPage,
        nextCursor,
    };
};

/**
 * Delete a comment reply
 * Runs atomically inside a Mongoose ACID transaction.
 * Deletes the storage asset post-commit.
 * @param {ObjectId} postId - ID of the post context
 * @param {ObjectId} commentId - ID of the comment context
 * @param {ObjectId} replyId - ID of the reply to delete
 * @param {ObjectId} userId - ID of the requesting user
 * @returns {Promise<boolean>} True if delete completes
 */
const deleteReply = async (postId, commentId, replyId, userId) => {
    let replyToDelete = null;

    try {
        await runTransaction(async (session) => {
            // 1. Verify parent comment exists and matches post context
            const comment = await commentRepository.findById(commentId, session);
            if (!comment) {
                throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
            }
            if (comment.post.toString() !== postId.toString()) {
                throw new AppError(httpStatus.BAD_REQUEST, 'Comment does not belong to this post');
            }

            // 2. Find reply
            const reply = await commentReplyRepository.findById(replyId, session);
            if (!reply) {
                throw new AppError(httpStatus.NOT_FOUND, 'Comment reply not found');
            }

            // 3. Strict authorization: check reply owner
            if (reply.user.toString() !== userId.toString()) {
                throw new AppError(httpStatus.FORBIDDEN, 'You do not have permission to delete this reply');
            }

            // 4. Verify reply belongs to comment
            if (reply.comment.toString() !== commentId.toString()) {
                throw new AppError(httpStatus.BAD_REQUEST, 'Reply does not belong to this comment');
            }

            // 5. Delete reply record
            const deletedReply = await commentReplyRepository.deleteById(replyId, session);

            if (deletedReply) {
                // 6. Decrement counter on parent comment
                await commentRepository.decrementAudioRepliesCount(commentId, session);
                replyToDelete = deletedReply;
            }
            Logger.info('Comment reply deleted successfully', { replyId, commentId, userId });
        });

        // 7. After successful transaction commit, delete storage asset in the background asynchronously
        if (replyToDelete && replyToDelete.audioKey) {
            UploadService.deleteFromS3(replyToDelete.audioKey)
                .then(() => {
                    Logger.info('Successfully deleted reply audio asset from storage in background', { key: replyToDelete.audioKey });
                })
                .catch((storageError) => {
                    Logger.error('Failed to delete reply audio asset from storage during background post-commit', {
                        key: replyToDelete.audioKey,
                        error: storageError.message,
                    });
                });
        }

        return true;
    } catch (error) {
        Logger.error('Error during comment reply deletion transaction:', { replyId, commentId, userId, error: error.message });
        throw error;
    }
};

module.exports = {
    addReply,
    getRepliesByCommentId,
    deleteReply,
};

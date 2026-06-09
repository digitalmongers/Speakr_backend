const mongoose = require('mongoose');
const httpStatus = require('http-status').default;
const postRepository = require('../repositories/post.repository');
const listenRepository = require('../repositories/listen.repository');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');
const { runTransaction } = require('../utils/transaction');

/**
 * Record a unique listen for a post.
 * Runs atomically inside a Mongoose ACID Transaction.
 * @param {ObjectId} postId - ID of the post
 * @param {Object} identity - Object representing the listener's identity
 * @param {ObjectId} [identity.userId] - Optional ID of the logged-in user
 * @param {string} [identity.guestId] - Optional guest identifier
 * @param {string} [identity.ipAddress] - Optional client IP address
 * @returns {Promise<Object>} Result containing listensCount and whether it was newly registered
 */
const recordListen = async (postId, { userId = null, guestId = null, ipAddress = null }) => {
    let result = null;

    try {
        await runTransaction(async (session) => {
            // 1. Verify post existence and is approved
            const post = await postRepository.findById(postId, session);
            if (!post || post.status !== 'approved') {
                throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
            }

            // 2. Build identity criteria
            const criteria = { post: postId };
            const listenData = { post: postId };

            if (userId) {
                criteria.user = userId;
                listenData.user = userId;
            } else if (guestId) {
                criteria.guestId = guestId;
                listenData.guestId = guestId;
            } else if (ipAddress) {
                criteria.ipAddress = ipAddress;
                listenData.ipAddress = ipAddress;
            } else {
                throw new AppError(httpStatus.BAD_REQUEST, 'Unable to identify listener identity (requires user, guestId, or IP)');
            }

            // 3. Check for existing unique listen record
            const existingListen = await listenRepository.findOne(criteria, session);

            if (existingListen) {
                Logger.info('Post already listened by this user/guest, skipping counter increment', { postId, ...listenData });
                result = {
                    newlyListened: false,
                    listensCount: post.listensCount || 0,
                };
                return;
            }

            // 4. Register new listen record
            await listenRepository.create(listenData, session);

            // 5. Atomic increment of listensCount
            const updatedPost = await postRepository.incrementListensCount(postId, session);
            if (!updatedPost) {
                throw new AppError(httpStatus.NOT_FOUND, 'Post not found or was deleted');
            }

            Logger.info('Post listened successfully', { postId, ...listenData });
            result = {
                newlyListened: true,
                listensCount: updatedPost.listensCount || 0,
            };
        });

        return result;
    } catch (error) {
        Logger.error('Error during post listen recording transaction:', { postId, userId, guestId, ipAddress, error: error.message });
        throw error;
    }
};

module.exports = {
    recordListen,
};

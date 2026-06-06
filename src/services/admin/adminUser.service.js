const mongoose = require('mongoose');
const User = require('../../models/user.model');
const { Post } = require('../../models/post.model');
const { Comment } = require('../../models/comment.model');
const { CommentReply } = require('../../models/commentReply.model');
const { Like } = require('../../models/like.model');
const { Dislike } = require('../../models/dislike.model');
const { SavedPost } = require('../../models/savedPost.model');
const { Listen } = require('../../models/listen.model');
const { runTransaction } = require('../../utils/transaction');
const UploadService = require('../upload.service');
const httpStatus = require('http-status').default;
const AppError = require('../../utils/AppError');
const { redisClient } = require('../../configs/redis');
const Logger = require('../../utils/logger');

/**
 * Get list of registered users with verified OTP using cursor-based pagination
 * @param {Object} queryOptions
 * @param {number} queryOptions.limit
 * @param {string} [queryOptions.cursor]
 * @param {string} [queryOptions.search]
 * @returns {Promise<Object>}
 */
const listVerifiedUsers = async ({ limit, cursor, search }) => {
    const filter = { isEmailVerified: true };

    if (search) {
        const searchRegex = new RegExp(search, 'i');
        filter.$or = [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
            { username: searchRegex }
        ];
    }

    if (cursor) {
        filter.createdAt = { $lt: new Date(cursor) };
    }

    const users = await User.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit + 1) // Fetch limit + 1 to check if there is a next page
        .select('firstName lastName username email dob gender isBlocked isEmailVerified profilePic lastLogin createdAt')
        .lean();

    let hasNextPage = false;
    let nextCursor = null;

    if (users.length > limit) {
        hasNextPage = true;
        const nextItem = users[limit - 1]; // Get the last item of the requested limit
        nextCursor = nextItem.createdAt.toISOString();
        // Trim the array to the requested limit
        users.splice(limit);
    }

    // Map post counts to postsCount on each user object
    if (users.length > 0) {
        const userIds = users.map(user => user._id);
        const postCounts = await Post.aggregate([
            { $match: { creator: { $in: userIds } } },
            { $group: { _id: '$creator', count: { $sum: 1 } } }
        ]);

        const postCountsMap = {};
        postCounts.forEach(pc => {
            postCountsMap[pc._id.toString()] = pc.count;
        });

        users.forEach(user => {
            user.postsCount = postCountsMap[user._id.toString()] || 0;
        });
    }

    return {
        results: users,
        limit,
        hasNextPage,
        nextCursor,
    };
};

const toggleUserBlock = async (userId) => {
    const lockKey = `lock:user-block:${userId}`;
    let lockAcquired = false;
    try {
        const result = await redisClient.set(lockKey, 'locked', 'NX', 'EX', 5);
        lockAcquired = result === 'OK';
    } catch (redisError) {
        Logger.error('Redis lock error in toggleUserBlock, failing open:', redisError);
        lockAcquired = true; // Fail open to maintain availability
    }

    if (!lockAcquired) {
        throw new AppError(httpStatus.TOO_MANY_REQUESTS, 'This user is currently being updated. Please try again.');
    }

    try {
        const user = await User.findById(userId).select('+tokenVersion');
        if (!user) {
            throw new AppError(httpStatus.NOT_FOUND, 'User not found');
        }

        user.isBlocked = !user.isBlocked;

        // If we block the user, invalidate all their active JWT token sessions immediately
        if (user.isBlocked) {
            user.tokenVersion = (user.tokenVersion || 0) + 1;
        }

        await user.save();
        return {
            userId: user._id,
            isBlocked: user.isBlocked,
        };
    } finally {
        if (lockAcquired) {
            await redisClient.del(lockKey).catch((err) => Logger.error(`Failed to release user block lock: ${lockKey}`, err));
        }
    }
};

const deleteUser = async (userId) => {
    const lockKey = `lock:user-block:${userId}`;
    let lockAcquired = false;
    try {
        const result = await redisClient.set(lockKey, 'locked', 'NX', 'EX', 10);
        lockAcquired = result === 'OK';
    } catch (redisError) {
        Logger.error('Redis lock error in deleteUser, failing open:', redisError);
        lockAcquired = true; // Fail open
    }

    if (!lockAcquired) {
        throw new AppError(httpStatus.TOO_MANY_REQUESTS, 'This user is currently being updated. Please try again.');
    }

    let s3KeysToDelete = [];

    try {
        await runTransaction(async (session) => {
            const user = await User.findById(userId).session(session);
            if (!user) {
                throw new AppError(httpStatus.NOT_FOUND, 'User not found');
            }

            // --- 1. Find all Posts created by the user ---
            const userPosts = await Post.find({ creator: userId }).session(session).lean();
            const userPostIds = userPosts.map(p => p._id);

            if (userPostIds.length > 0) {
                // Collect post audioKeys and thumbnailKeys for S3 deletion
                userPosts.forEach(post => {
                    if (post.audioKey) s3KeysToDelete.push(post.audioKey);
                    if (post.thumbnailKey) s3KeysToDelete.push(post.thumbnailKey);
                });

                // Find comments on the user's posts to delete their replies
                const postComments = await Comment.find({ post: { $in: userPostIds } }).session(session).lean();
                const postCommentIds = postComments.map(c => c._id);

                if (postCommentIds.length > 0) {
                    // Find comment replies to those comments to collect S3 audio keys
                    const postReplies = await CommentReply.find({ comment: { $in: postCommentIds } }).session(session).lean();
                    postReplies.forEach(reply => {
                        if (reply.audioKey) s3KeysToDelete.push(reply.audioKey);
                    });

                    // Delete replies to those comments
                    await CommentReply.deleteMany({ comment: { $in: postCommentIds } }).session(session);
                }

                // Delete comments on user's posts
                await Comment.deleteMany({ post: { $in: userPostIds } }).session(session);

                // Delete reactions, saves, and listens on user's posts
                await Like.deleteMany({ post: { $in: userPostIds } }).session(session);
                await Dislike.deleteMany({ post: { $in: userPostIds } }).session(session);
                await SavedPost.deleteMany({ post: { $in: userPostIds } }).session(session);
                await Listen.deleteMany({ post: { $in: userPostIds } }).session(session);

                // Delete the posts themselves
                await Post.deleteMany({ creator: userId }).session(session);
            }

            // --- 2. Handle Comments created by the user on OTHER users' posts ---
            // Find comments created by this user
            const userComments = await Comment.find({ user: userId }).session(session).lean();
            const userCommentIds = userComments.map(c => c._id);

            if (userCommentIds.length > 0) {
                // Find replies to these comments to collect their S3 keys and delete them
                const commentReplies = await CommentReply.find({ comment: { $in: userCommentIds } }).session(session).lean();
                commentReplies.forEach(reply => {
                    if (reply.audioKey) s3KeysToDelete.push(reply.audioKey);
                });
                await CommentReply.deleteMany({ comment: { $in: userCommentIds } }).session(session);

                // Decrement commentsCount on parent posts
                const commentCountsByPost = {};
                userComments.forEach(comment => {
                    const postIdStr = comment.post.toString();
                    commentCountsByPost[postIdStr] = (commentCountsByPost[postIdStr] || 0) + 1;
                });

                const postCommentBulkOps = Object.entries(commentCountsByPost)
                    .filter(([postIdStr]) => !userPostIds.some(id => id.toString() === postIdStr))
                    .map(([postIdStr, count]) => ({
                        updateOne: {
                            filter: { _id: new mongoose.Types.ObjectId(postIdStr) },
                            update: { $inc: { commentsCount: -count } }
                        }
                    }));

                if (postCommentBulkOps.length > 0) {
                    await Post.bulkWrite(postCommentBulkOps, { session });
                }

                // Delete comments created by the user
                await Comment.deleteMany({ user: userId }).session(session);
            }

            // --- 3. Handle Comment Replies created by the user ---
            const userReplies = await CommentReply.find({ user: userId }).session(session).lean();
            if (userReplies.length > 0) {
                userReplies.forEach(reply => {
                    if (reply.audioKey) s3KeysToDelete.push(reply.audioKey);
                });

                // Decrement audioRepliesCount on parent comments
                const replyCountsByComment = {};
                userReplies.forEach(reply => {
                    const commentIdStr = reply.comment.toString();
                    replyCountsByComment[commentIdStr] = (replyCountsByComment[commentIdStr] || 0) + 1;
                });

                const commentReplyBulkOps = Object.entries(replyCountsByComment)
                    .map(([commentIdStr, count]) => ({
                        updateOne: {
                            filter: { _id: new mongoose.Types.ObjectId(commentIdStr) },
                            update: { $inc: { audioRepliesCount: -count } }
                        }
                    }));

                if (commentReplyBulkOps.length > 0) {
                    await Comment.bulkWrite(commentReplyBulkOps, { session });
                }

                // Delete replies created by the user
                await CommentReply.deleteMany({ user: userId }).session(session);
            }

            // --- 4. Handle Likes created by the user ---
            const userLikes = await Like.find({ user: userId }).session(session).lean();
            if (userLikes.length > 0) {
                const likeCountsByPost = {};
                userLikes.forEach(like => {
                    const postIdStr = like.post.toString();
                    likeCountsByPost[postIdStr] = (likeCountsByPost[postIdStr] || 0) + 1;
                });

                const postLikeBulkOps = Object.entries(likeCountsByPost)
                    .filter(([postIdStr]) => !userPostIds.some(id => id.toString() === postIdStr))
                    .map(([postIdStr, count]) => ({
                        updateOne: {
                            filter: { _id: new mongoose.Types.ObjectId(postIdStr) },
                            update: { $inc: { likesCount: -count } }
                        }
                    }));

                if (postLikeBulkOps.length > 0) {
                    await Post.bulkWrite(postLikeBulkOps, { session });
                }

                await Like.deleteMany({ user: userId }).session(session);
            }

            // --- 5. Handle Dislikes created by the user ---
            const userDislikes = await Dislike.find({ user: userId }).session(session).lean();
            if (userDislikes.length > 0) {
                const dislikeCountsByPost = {};
                userDislikes.forEach(dislike => {
                    const postIdStr = dislike.post.toString();
                    dislikeCountsByPost[postIdStr] = (dislikeCountsByPost[postIdStr] || 0) + 1;
                });

                const postDislikeBulkOps = Object.entries(dislikeCountsByPost)
                    .filter(([postIdStr]) => !userPostIds.some(id => id.toString() === postIdStr))
                    .map(([postIdStr, count]) => ({
                        updateOne: {
                            filter: { _id: new mongoose.Types.ObjectId(postIdStr) },
                            update: { $inc: { dislikesCount: -count } }
                        }
                    }));

                if (postDislikeBulkOps.length > 0) {
                    await Post.bulkWrite(postDislikeBulkOps, { session });
                }

                await Dislike.deleteMany({ user: userId }).session(session);
            }

            // --- 6. Handle SavedPosts created by the user ---
            const userSaved = await SavedPost.find({ user: userId }).session(session).lean();
            if (userSaved.length > 0) {
                const saveCountsByPost = {};
                userSaved.forEach(save => {
                    const postIdStr = save.post.toString();
                    saveCountsByPost[postIdStr] = (saveCountsByPost[postIdStr] || 0) + 1;
                });

                const postSaveBulkOps = Object.entries(saveCountsByPost)
                    .filter(([postIdStr]) => !userPostIds.some(id => id.toString() === postIdStr))
                    .map(([postIdStr, count]) => ({
                        updateOne: {
                            filter: { _id: new mongoose.Types.ObjectId(postIdStr) },
                            update: { $inc: { savesCount: -count } }
                        }
                    }));

                if (postSaveBulkOps.length > 0) {
                    await Post.bulkWrite(postSaveBulkOps, { session });
                }

                await SavedPost.deleteMany({ user: userId }).session(session);
            }

            // --- 7. Handle Listens created by the user ---
            const userListens = await Listen.find({ user: userId }).session(session).lean();
            if (userListens.length > 0) {
                const listenCountsByPost = {};
                userListens.forEach(listen => {
                    const postIdStr = listen.post.toString();
                    listenCountsByPost[postIdStr] = (listenCountsByPost[postIdStr] || 0) + 1;
                });

                const postListenBulkOps = Object.entries(listenCountsByPost)
                    .filter(([postIdStr]) => !userPostIds.some(id => id.toString() === postIdStr))
                    .map(([postIdStr, count]) => ({
                        updateOne: {
                            filter: { _id: new mongoose.Types.ObjectId(postIdStr) },
                            update: { $inc: { listensCount: -count } }
                        }
                    }));

                if (postListenBulkOps.length > 0) {
                    await Post.bulkWrite(postListenBulkOps, { session });
                }

                await Listen.deleteMany({ user: userId }).session(session);
            }

            // --- 8. Finally, delete the User itself ---
            await User.findByIdAndDelete(userId).session(session);

            Logger.info(`User ${userId} and all associated cascade data deleted successfully from DB.`);
        });

        // Clean up collected S3 files post-commit
        if (s3KeysToDelete.length > 0) {
            Logger.info(`Initiating post-commit asset cleanup from S3: ${s3KeysToDelete.length} files`);
            await Promise.all(
                s3KeysToDelete.map(key =>
                    UploadService.deleteFromS3(key)
                        .catch(err => Logger.error(`Failed to delete S3 asset ${key} post-commit:`, err))
                )
            );
        }

        return true;
    } finally {
        if (lockAcquired) {
            await redisClient.del(lockKey).catch((err) => Logger.error(`Failed to release user block lock: ${lockKey}`, err));
        }
    }
};

const getUserDetails = async (userId) => {
    const user = await User.findById(userId)
        .select('firstName lastName username email dob gender isBlocked isEmailVerified profilePic bio city lastLogin createdAt')
        .lean();

    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    const totalPosts = await Post.countDocuments({ creator: userId });
    return {
        ...user,
        totalPosts,
        postsCount: totalPosts,
    };
};

const getUserPosts = async (userId, { limit, cursor }) => {
    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    const filter = { creator: userId };
    if (cursor) {
        filter.createdAt = { $lt: new Date(cursor) };
    }

    const posts = await Post.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .select('title description audioUrl thumbnailUrl category language duration likesCount dislikesCount savesCount listensCount commentsCount createdAt')
        .lean();

    let hasNextPage = false;
    let nextCursor = null;

    if (posts.length > limit) {
        hasNextPage = true;
        const nextItem = posts[limit - 1];
        nextCursor = nextItem.createdAt.toISOString();
        posts.splice(limit);
    }

    return {
        results: posts,
        limit,
        hasNextPage,
        nextCursor,
    };
};

module.exports = {
    listVerifiedUsers,
    toggleUserBlock,
    deleteUser,
    getUserDetails,
    getUserPosts,
};

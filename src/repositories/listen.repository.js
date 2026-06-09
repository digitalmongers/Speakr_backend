const { Listen } = require('../models/listen.model');

/**
 * Find a single listen record by criteria
 * @param {Object} criteria - Search criteria (e.g., { post, user }, { post, guestId }, or { post, ipAddress })
 * @param {ClientSession} [session] - Optional Mongoose session
 * @returns {Promise<Listen|null>}
 */
const findOne = async (criteria, session = null) => {
    return Listen.findOne(criteria).session(session).lean();
};

/**
 * Save a listen record to the database
 * @param {Object} listenBody
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Listen>}
 */
const create = async (listenBody, session = null) => {
    const listen = new Listen(listenBody);
    return listen.save({ session });
};

/**
 * Check if a logged-in user has listened to a post
 * @param {ObjectId} postId
 * @param {ObjectId} userId
 * @returns {Promise<boolean>}
 */
const existsByUser = async (postId, userId) => {
    const count = await Listen.countDocuments({ post: postId, user: userId });
    return count > 0;
};

/**
 * Find listen records by post IDs for a specific user (N+1 query optimization)
 * @param {Array<ObjectId>} postIds
 * @param {ObjectId} userId
 * @returns {Promise<Array<Object>>}
 */
const findByUserAndPostIds = async (postIds, userId) => {
    return Listen.find({ user: userId, post: { $in: postIds } }).select('post').lean();
};

const deleteManyByPostId = async (postId, session = null) => {
    return Listen.deleteMany({ post: postId }).session(session);
};

module.exports = {
    findOne,
    create,
    existsByUser,
    findByUserAndPostIds,
    deleteManyByPostId,
};

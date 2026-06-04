const { Dislike } = require('../models/dislike.model');

/**
 * Find a dislike by post and user
 * @param {ObjectId} postId
 * @param {ObjectId} userId
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Dislike|null>}
 */
const findOneByPostAndUser = async (postId, userId, session = null) => {
    return Dislike.findOne({ post: postId, user: userId }).session(session);
};

/**
 * Save dislike record to the database
 * @param {Object} dislikeBody
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Dislike>}
 */
const create = async (dislikeBody, session = null) => {
    const dislike = new Dislike(dislikeBody);
    return dislike.save({ session });
};

/**
 * Delete a dislike record by ID
 * @param {ObjectId} id
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Object|null>}
 */
const deleteById = async (id, session = null) => {
    return Dislike.findByIdAndDelete(id).session(session).lean();
};

/**
 * Check if a user has disliked a post (fast boolean check)
 * @param {ObjectId} postId
 * @param {ObjectId} userId
 * @returns {Promise<boolean>}
 */
const exists = async (postId, userId) => {
    const count = await Dislike.countDocuments({ post: postId, user: userId });
    return count > 0;
};

/**
 * Find dislikes by post IDs for a specific user
 * @param {Array<ObjectId>} postIds
 * @param {ObjectId} userId
 * @returns {Promise<Array<Object>>}
 */
const findByUserAndPostIds = async (postIds, userId) => {
    return Dislike.find({ user: userId, post: { $in: postIds } }).select('post').lean();
};

const deleteManyByPostId = async (postId, session = null) => {
    return Dislike.deleteMany({ post: postId }).session(session);
};

module.exports = {
    findOneByPostAndUser,
    create,
    deleteById,
    exists,
    findByUserAndPostIds,
    deleteManyByPostId,
};

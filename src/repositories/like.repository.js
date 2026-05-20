const { Like } = require('../models/like.model');

/**
 * Find a like by post and user
 * @param {ObjectId} postId
 * @param {ObjectId} userId
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Like|null>}
 */
const findOneByPostAndUser = async (postId, userId, session = null) => {
    return Like.findOne({ post: postId, user: userId }).session(session);
};

/**
 * Save like record to the database
 * @param {Object} likeBody
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Like>}
 */
const create = async (likeBody, session = null) => {
    const like = new Like(likeBody);
    return like.save({ session });
};

/**
 * Delete a like record by ID
 * @param {ObjectId} id
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Object|null>}
 */
const deleteById = async (id, session = null) => {
    return Like.findByIdAndDelete(id).session(session).lean();
};

/**
 * Check if a user has liked a post (fast boolean check)
 * @param {ObjectId} postId
 * @param {ObjectId} userId
 * @returns {Promise<boolean>}
 */
const exists = async (postId, userId) => {
    const count = await Like.countDocuments({ post: postId, user: userId });
    return count > 0;
};

module.exports = {
    findOneByPostAndUser,
    create,
    deleteById,
    exists,
};

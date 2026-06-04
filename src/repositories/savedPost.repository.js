const { SavedPost } = require('../models/savedPost.model');

/**
 * Find a saved post record by post and user
 * @param {ObjectId} postId
 * @param {ObjectId} userId
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<SavedPost|null>}
 */
const findOneByPostAndUser = async (postId, userId, session = null) => {
    return SavedPost.findOne({ post: postId, user: userId }).session(session);
};

/**
 * Save saved post record to the database
 * @param {Object} saveBody
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<SavedPost>}
 */
const create = async (saveBody, session = null) => {
    const saved = new SavedPost(saveBody);
    return saved.save({ session });
};

/**
 * Delete a saved post record by ID
 * @param {ObjectId} id
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Object|null>}
 */
const deleteById = async (id, session = null) => {
    return SavedPost.findByIdAndDelete(id).session(session).lean();
};

/**
 * Check if a user has saved a post (fast boolean check)
 * @param {ObjectId} postId
 * @param {ObjectId} userId
 * @returns {Promise<boolean>}
 */
const exists = async (postId, userId) => {
    const count = await SavedPost.countDocuments({ post: postId, user: userId });
    return count > 0;
};

/**
 * Find saved post records by post IDs for a specific user
 * @param {Array<ObjectId>} postIds
 * @param {ObjectId} userId
 * @returns {Promise<Array<Object>>}
 */
const findByUserAndPostIds = async (postIds, userId) => {
    return SavedPost.find({ user: userId, post: { $in: postIds } }).select('post').lean();
};

/**
 * Find paginated saved posts for a user, sorting by save date (newest first)
 * @param {ObjectId} userId
 * @param {Object} options
 * @param {number} options.limit
 * @param {number} options.skip
 * @returns {Promise<Array<Object>>}
 */
const findSavedPostsByUser = async (userId, { limit, skip }) => {
    return SavedPost.find({ user: userId })
        .populate('post') // Populate the actual post details
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
};

/**
 * Find cursor-paginated saved posts for a user, sorting by save date (newest first)
 * @param {ObjectId} userId
 * @param {Object} options
 * @param {number} options.limit
 * @param {string} options.cursor - ISO date string of the cursor
 * @returns {Promise<Array<Object>>}
 */
const findSavedPostsByUserWithCursor = async (userId, { limit, cursor }) => {
    const query = { user: userId };
    if (cursor) {
        query.createdAt = { $lt: new Date(cursor) };
    }
    return SavedPost.find(query)
        .populate('post')
        .sort({ createdAt: -1 })
        .limit(limit + 1) // Fetch limit + 1 to check if there is a next page
        .lean();
};

/**
 * Count total saved posts for a user
 * @param {ObjectId} userId
 * @returns {Promise<number>}
 */
const countSavedPosts = async (userId) => {
    return SavedPost.countDocuments({ user: userId });
};

const deleteManyByPostId = async (postId, session = null) => {
    return SavedPost.deleteMany({ post: postId }).session(session);
};

module.exports = {
    findOneByPostAndUser,
    create,
    deleteById,
    exists,
    findByUserAndPostIds,
    findSavedPostsByUser,
    findSavedPostsByUserWithCursor,
    countSavedPosts,
    deleteManyByPostId,
};

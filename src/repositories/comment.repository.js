const { Comment } = require('../models/comment.model');

/**
 * Save a comment record to the database
 * @param {Object} commentBody
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Comment>}
 */
const create = async (commentBody, session = null) => {
    const comment = new Comment(commentBody);
    return comment.save({ session });
};

/**
 * Retrieve all comments for a specific post
 * Populates the user information (specifically username and profile details)
 * Sorted by newest first (descending order)
 * @param {ObjectId} postId - ID of the post
 * @returns {Promise<Array<Object>>}
 */
const findByPostId = async (postId) => {
    return Comment.find({ post: postId })
        .populate('user', 'username profilePic firstName lastName')
        .sort({ createdAt: -1 })
        .lean();
};

/**
 * Find a comment by ID
 * @param {ObjectId} commentId
 * @param {ClientSession} [session] - Optional session
 * @returns {Promise<Object|null>}
 */
const findById = async (commentId, session = null) => {
    return Comment.findById(commentId).session(session).lean();
};

/**
 * Delete a comment by ID
 * @param {ObjectId} commentId
 * @param {ClientSession} [session] - Optional session
 * @returns {Promise<Object|null>}
 */
const deleteById = async (commentId, session = null) => {
    return Comment.findByIdAndDelete(commentId).session(session).lean();
};

/**
 * Increment audioRepliesCount on a comment atomically
 * @param {ObjectId} commentId
 * @param {ClientSession} [session] - Optional session
 * @returns {Promise<Object|null>}
 */
const incrementAudioRepliesCount = async (commentId, session = null) => {
    return Comment.findByIdAndUpdate(
        commentId,
        { $inc: { audioRepliesCount: 1 } },
        { new: true, session }
    ).lean();
};

/**
 * Decrement audioRepliesCount on a comment atomically
 * @param {ObjectId} commentId
 * @param {ClientSession} [session] - Optional session
 * @returns {Promise<Object|null>}
 */
const decrementAudioRepliesCount = async (commentId, session = null) => {
    return Comment.findByIdAndUpdate(
        commentId,
        { $inc: { audioRepliesCount: -1 } },
        { new: true, session }
    ).lean();
};

/**
 * Retrieve comments for a specific post using cursor-based pagination
 * Populates user information
 * Sorted by newest first (descending order)
 * @param {Object} filter - Query filter
 * @param {Object} options
 * @param {number} options.limit - Max records to fetch
 * @param {string} options.cursor - ISO date string of the cursor
 * @returns {Promise<Array<Object>>}
 */
const findWithCursor = async (filter, { limit, cursor }) => {
    const query = { ...filter };
    if (cursor) {
        query.createdAt = { $lt: new Date(cursor) };
    }

    return Comment.find(query)
        .populate('user', 'username profilePic firstName lastName')
        .sort({ createdAt: -1 })
        .limit(limit + 1) // Fetch limit + 1 to check if there is a next page
        .lean();
};

module.exports = {
    create,
    findByPostId,
    findById,
    deleteById,
    incrementAudioRepliesCount,
    decrementAudioRepliesCount,
    findWithCursor,
};

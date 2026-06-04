const { CommentReply } = require('../models/commentReply.model');

/**
 * Save a comment reply record to the database
 * @param {Object} replyBody
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<CommentReply>}
 */
const create = async (replyBody, session = null) => {
    const reply = new CommentReply(replyBody);
    return reply.save({ session });
};

/**
 * Retrieve all replies for a specific comment
 * Populates the user information (specifically username and profile details)
 * Sorted by oldest first (natural conversation order)
 * @param {ObjectId} commentId - ID of the comment
 * @returns {Promise<Array<Object>>}
 */
const findByCommentId = async (commentId) => {
    return CommentReply.find({ comment: commentId })
        .populate('user', 'username profilePic firstName lastName')
        .sort({ createdAt: 1 })
        .lean();
};

/**
 * Find a reply by ID
 * @param {ObjectId} replyId
 * @param {ClientSession} [session] - Optional session
 * @returns {Promise<Object|null>}
 */
const findById = async (replyId, session = null) => {
    return CommentReply.findById(replyId).session(session).lean();
};

/**
 * Delete a reply by ID
 * @param {ObjectId} replyId
 * @param {ClientSession} [session] - Optional session
 * @returns {Promise<Object|null>}
 */
const deleteById = async (replyId, session = null) => {
    return CommentReply.findByIdAndDelete(replyId).session(session).lean();
};

/**
 * Count the number of replies a specific user has made on a specific comment
 * @param {ObjectId} commentId
 * @param {ObjectId} userId
 * @param {ClientSession} [session] - Optional session
 * @returns {Promise<number>}
 */
const countByCommentAndUser = async (commentId, userId, session = null) => {
    return CommentReply.countDocuments({ comment: commentId, user: userId }).session(session);
};

/**
 * Retrieve replies for a specific comment using cursor-based pagination
 * Populates user information
 * Sorted by oldest first (ascending order) for natural conversational flow
 * @param {Object} filter - Query filter
 * @param {Object} options
 * @param {number} options.limit - Max records to fetch
 * @param {string} options.cursor - ISO date string of the cursor
 * @returns {Promise<Array<Object>>}
 */
const findWithCursor = async (filter, { limit, cursor }) => {
    const query = { ...filter };
    if (cursor) {
        query.createdAt = { $gt: new Date(cursor) };
    }

    return CommentReply.find(query)
        .select('-audioKey')
        .populate('user', 'username profilePic firstName lastName')
        .sort({ createdAt: 1 })
        .limit(limit + 1) // Fetch limit + 1 to check if there is a next page
        .lean();
};

const findManyByCommentIds = async (commentIds, session = null) => {
    return CommentReply.find({ comment: { $in: commentIds } }).session(session).lean();
};

const deleteManyByCommentIds = async (commentIds, session = null) => {
    return CommentReply.deleteMany({ comment: { $in: commentIds } }).session(session);
};

module.exports = {
    create,
    findByCommentId,
    findById,
    deleteById,
    countByCommentAndUser,
    findWithCursor,
    findManyByCommentIds,
    deleteManyByCommentIds,
};

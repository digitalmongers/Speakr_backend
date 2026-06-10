const { PostReport } = require('../models/postReport.model');

/**
 * Check whether a specific user has already reported a given post.
 * Uses countDocuments for an efficient, non-hydrating boolean check.
 *
 * @param {ObjectId} postId
 * @param {ObjectId} reporterId
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<boolean>}
 */
const existsByPostAndReporter = async (postId, reporterId, session = null) => {
    const count = await PostReport.countDocuments({ post: postId, reporter: reporterId }).session(session);
    return count > 0;
};

/**
 * Persist a new post report document.
 *
 * @param {Object} reportBody - { post, reporter, reason }
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<PostReport>}
 */
const create = async (reportBody, session = null) => {
    const report = new PostReport(reportBody);
    return report.save({ session });
};

module.exports = {
    existsByPostAndReporter,
    create,
};

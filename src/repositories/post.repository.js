const { Post } = require('../models/post.model');

/**
 * Save post to database
 * @param {Object} postBody
 * @returns {Promise<Post>}
 */
const create = async (postBody) => {
    return Post.create(postBody);
};

/**
 * Find post by ID with optimized selection and lean serialization
 * @param {ObjectId} id
 * @returns {Promise<Object|null>}
 */
const findById = async (id, session = null) => {
    return Post.findById(id).session(session).lean();
};

/**
 * Paginated queries on public posts with lightweight selective projection (excludes heavy/internal fields)
 * @param {Object} filter - Database query filters
 * @param {Object} options - Query pagination and projection options
 * @param {number} options.limit - Max records to fetch
 * @param {number} options.skip - Number of records to bypass
 * @returns {Promise<Array<Object>>}
 */
const find = async (filter, { limit, skip }) => {
    return Post.find(filter)
        .select('-description -audioKey -thumbnailKey')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
};

/**
 * Count total number of documents matching a filter
 * @param {Object} filter
 * @returns {Promise<number>}
 */
const count = async (filter) => {
    return Post.countDocuments(filter);
};

/**
 * Paginated queries on public posts using cursor-based pagination (Infinite Scroll optimized with lightweight projection)
 * @param {Object} filter - Database query filters
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

    return Post.find(query)
        .select('-description -audioKey -thumbnailKey')
        .sort({ createdAt: -1 })
        .limit(limit + 1) // Fetch limit + 1 to check if there is a next page
        .lean();
};

/**
 * Remove post document from database by ID
 * @param {ObjectId} id
 * @returns {Promise<Object|null>}
 */
const deleteById = async (id, session = null) => {
    return Post.findByIdAndDelete(id).session(session).lean();
};

/**
 * Update post likes and/or dislikes count atomically
 * @param {ObjectId} id
 * @param {number} likeInc
 * @param {number} dislikeInc
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Object|null>}
 */
const updateLikesAndDislikesCount = async (id, likeInc, dislikeInc, session = null) => {
    const update = {};
    if (likeInc !== 0) update.likesCount = likeInc;
    if (dislikeInc !== 0) update.dislikesCount = dislikeInc;
    return Post.findByIdAndUpdate(
        id,
        { $inc: update },
        { new: true, session }
    ).lean();
};

/**
 * Update post saves count atomically
 * @param {ObjectId} id
 * @param {number} saveInc
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Object|null>}
 */
const updateSavesCount = async (id, saveInc, session = null) => {
    return Post.findByIdAndUpdate(
        id,
        { $inc: { savesCount: saveInc } },
        { new: true, session }
    ).lean();
};

/**
 * Increment post listens count atomically
 * @param {ObjectId} id
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Object|null>}
 */
const incrementListensCount = async (id, session = null) => {
    return Post.findByIdAndUpdate(
        id,
        { $inc: { listensCount: 1 } },
        { new: true, session }
    ).lean();
};

/**
 * Increment post comments count atomically
 * @param {ObjectId} id
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Object|null>}
 */
const incrementCommentsCount = async (id, session = null) => {
    return Post.findByIdAndUpdate(
        id,
        { $inc: { commentsCount: 1 } },
        { new: true, session }
    ).lean();
};

/**
 * Decrement post comments count atomically
 * @param {ObjectId} id
 * @param {ClientSession} [session] - Optional Mongoose session for transaction scope
 * @returns {Promise<Object|null>}
 */
const decrementCommentsCount = async (id, session = null) => {
    return Post.findByIdAndUpdate(
        id,
        { $inc: { commentsCount: -1 } },
        { new: true, session }
    ).lean();
};

/**
 * Update post document by ID
 * @param {ObjectId} id
 * @param {Object} updateBody
 * @param {ClientSession} [session]
 * @returns {Promise<Object|null>}
 */
const updateById = async (id, updateBody, session = null) => {
    return Post.findByIdAndUpdate(id, updateBody, { new: true, session }).lean();
};

module.exports = {
    create,
    findById,
    find,
    findWithCursor,
    count,
    deleteById,
    updateLikesAndDislikesCount,
    updateSavesCount,
    incrementListensCount,
    incrementCommentsCount,
    decrementCommentsCount,
    updateById,
};

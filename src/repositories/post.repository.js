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
const findById = async (id) => {
    return Post.findById(id).lean();
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
const deleteById = async (id) => {
    return Post.findByIdAndDelete(id).lean();
};

module.exports = {
    create,
    findById,
    find,
    findWithCursor,
    count,
    deleteById,
};

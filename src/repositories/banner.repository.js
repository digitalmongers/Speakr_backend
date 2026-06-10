const Banner = require('../models/banner.model');

/**
 * Create a new banner
 * @param {Object} bannerBody
 * @param {ClientSession} [session]
 * @returns {Promise<Banner>}
 */
const create = async (bannerBody, session = null) => {
    const results = await Banner.create([bannerBody], { session });
    return results[0];
};

/**
 * Find banner by ID
 * @param {ObjectId} id
 * @param {ClientSession} [session]
 * @returns {Promise<Banner|null>}
 */
const findById = async (id, session = null) => {
    return Banner.findById(id).session(session);
};

/**
 * Find all banners (Admin view)
 * @returns {Promise<Array<Banner>>}
 */
const findAll = async () => {
    return Banner.find({}).sort({ createdAt: -1 }).lean();
};

/**
 * Find active banners (Public view)
 * @returns {Promise<Array<Banner>>}
 */
const findActive = async () => {
    return Banner.find({ isActive: true }, 'imageUrl redirectUrl').sort({ createdAt: -1 }).lean();
};

/**
 * Update a banner by ID
 * @param {ObjectId} id
 * @param {Object} updateBody
 * @param {ClientSession} [session]
 * @returns {Promise<Banner|null>}
 */
const updateById = async (id, updateBody, session = null) => {
    return Banner.findByIdAndUpdate(
        id,
        { $set: updateBody },
        { new: true, runValidators: true, session }
    );
};

/**
 * Delete a banner by ID
 * @param {ObjectId} id
 * @param {ClientSession} [session]
 * @returns {Promise<Banner|null>}
 */
const deleteById = async (id, session = null) => {
    return Banner.findByIdAndDelete(id).session(session);
};

module.exports = {
    create,
    findById,
    findAll,
    findActive,
    updateById,
    deleteById,
};

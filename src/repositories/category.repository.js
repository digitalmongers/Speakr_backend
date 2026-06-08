const Category = require('../models/category.model');

/**
 * Create a new category
 * @param {Object} categoryBody
 * @param {ClientSession} [session]
 * @returns {Promise<Category>}
 */
const create = async (categoryBody, session = null) => {
    // Category.create returns an array when session option is passed
    const results = await Category.create([categoryBody], { session });
    return results[0];
};

/**
 * Find category by ID
 * @param {ObjectId} id
 * @param {ClientSession} [session]
 * @returns {Promise<Category|null>}
 */
const findById = async (id, session = null) => {
    return Category.findById(id).session(session);
};

const titleCase = (str) => {
    if (!str) return str;
    return str
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Find category by name (exact match, index-optimized)
 * @param {string} name
 * @param {ClientSession} [session]
 * @returns {Promise<Category|null>}
 */
const findByName = async (name, session = null) => {
    return Category.findOne({ name: titleCase(name) }).session(session).lean();
};

/**
 * Find all categories
 * @returns {Promise<Array<Category>>}
 */
const findAll = async () => {
    return Category.find({}).sort({ name: 1 }).lean();
};

/**
 * Find only active categories (optimized with selective projection)
 * @returns {Promise<Array<Category>>}
 */
const findActive = async () => {
    return Category.find({ isActive: true }, 'name').sort({ name: 1 }).lean();
};

/**
 * Update a category by ID
 * @param {ObjectId} id
 * @param {Object} updateBody
 * @param {ClientSession} [session]
 * @returns {Promise<Category|null>}
 */
const updateById = async (id, updateBody, session = null) => {
    return Category.findByIdAndUpdate(id, { $set: updateBody }, { new: true, runValidators: true, session });
};

/**
 * Delete a category by ID
 * @param {ObjectId} id
 * @param {ClientSession} [session]
 * @returns {Promise<Category|null>}
 */
const deleteById = async (id, session = null) => {
    return Category.findByIdAndDelete(id).session(session);
};

module.exports = {
    create,
    findById,
    findByName,
    findAll,
    findActive,
    updateById,
    deleteById,
};

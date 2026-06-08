const Language = require('../models/language.model');

/**
 * Create a new language
 * @param {Object} languageBody
 * @param {ClientSession} [session]
 * @returns {Promise<Language>}
 */
const create = async (languageBody, session = null) => {
    const results = await Language.create([languageBody], { session });
    return results[0];
};

/**
 * Find language by ID
 * @param {ObjectId} id
 * @param {ClientSession} [session]
 * @returns {Promise<Language|null>}
 */
const findById = async (id, session = null) => {
    return Language.findById(id).session(session);
};

const titleCase = (str) => {
    if (!str) return str;
    return str
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Find language by name (exact match, index-optimized)
 * @param {string} name
 * @param {ClientSession} [session]
 * @returns {Promise<Language|null>}
 */
const findByName = async (name, session = null) => {
    return Language.findOne({ name: titleCase(name) }).session(session).lean();
};

/**
 * Find all languages
 * @returns {Promise<Array<Language>>}
 */
const findAll = async () => {
    return Language.find({}).sort({ name: 1 }).lean();
};

/**
 * Find only active languages (optimized with selective projection)
 * @returns {Promise<Array<Language>>}
 */
const findActive = async () => {
    return Language.find({ isActive: true }, 'name').sort({ name: 1 }).lean();
};

/**
 * Update a language by ID
 * @param {ObjectId} id
 * @param {Object} updateBody
 * @param {ClientSession} [session]
 * @returns {Promise<Language|null>}
 */
const updateById = async (id, updateBody, session = null) => {
    return Language.findByIdAndUpdate(id, { $set: updateBody }, { new: true, runValidators: true, session });
};

/**
 * Delete a language by ID
 * @param {ObjectId} id
 * @param {ClientSession} [session]
 * @returns {Promise<Language|null>}
 */
const deleteById = async (id, session = null) => {
    return Language.findByIdAndDelete(id).session(session);
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

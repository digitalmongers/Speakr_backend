const httpStatus = require('http-status').default;
const languageRepository = require('../repositories/language.repository');
const { Post } = require('../models/post.model');
const { runTransaction } = require('../utils/transaction');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');

/**
 * Handle duplicate key index violations gracefully
 */
const handleDuplicateKey = (error) => {
    if (error.code === 11000) {
        throw new AppError(httpStatus.CONFLICT, 'Language name already exists');
    }
    throw error;
};

/**
 * Create a new language
 * @param {string} name
 * @returns {Promise<Object>}
 */
const createLanguage = async (name) => {
    const normalizedName = name.trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    const existing = await languageRepository.findByName(normalizedName);
    if (existing) {
        throw new AppError(httpStatus.CONFLICT, 'Language already exists');
    }

    try {
        const language = await languageRepository.create({ name: normalizedName });
        Logger.info('Language created successfully', { languageId: language._id, name: normalizedName });
        return language;
    } catch (error) {
        handleDuplicateKey(error);
    }
};

/**
 * Get all languages (Admin)
 * @returns {Promise<Array<Object>>}
 */
const getAllLanguages = async () => {
    return languageRepository.findAll();
};

/**
 * Get active languages only (Public)
 * @returns {Promise<Array<Object>>}
 */
const getActiveLanguages = async () => {
    return languageRepository.findActive();
};

/**
 * Update a language name
 * @param {ObjectId} languageId
 * @param {string} newName
 * @returns {Promise<Object>}
 */
const updateLanguage = async (languageId, newName) => {
    const normalizedNewName = newName.trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    return runTransaction(async (session) => {
        const language = await languageRepository.findById(languageId, session);
        if (!language) {
            throw new AppError(httpStatus.NOT_FOUND, 'Language not found');
        }

        const oldName = language.name;

        // Check if new name is already taken by another language (session aware)
        const existing = await languageRepository.findByName(normalizedNewName, session);
        if (existing && existing._id.toString() !== languageId.toString()) {
            throw new AppError(httpStatus.CONFLICT, 'Language name already exists');
        }

        language.name = normalizedNewName;
        try {
            await language.save({ session });
        } catch (error) {
            handleDuplicateKey(error);
        }

        // Propagate the name update to all posts that use this language (session aware)
        if (oldName !== normalizedNewName) {
            const updateResult = await Post.updateMany(
                { language: oldName },
                { language: normalizedNewName }
            ).session(session);
            
            Logger.info('Language name updated and propagated to posts', {
                languageId,
                oldName,
                newName: normalizedNewName,
                modifiedPostsCount: updateResult.modifiedCount,
            });
        }

        return language;
    });
};

/**
 * Toggle language active status
 * @param {ObjectId} languageId
 * @returns {Promise<Object>}
 */
const toggleLanguageStatus = async (languageId) => {
    const language = await languageRepository.findById(languageId);
    if (!language) {
        throw new AppError(httpStatus.NOT_FOUND, 'Language not found');
    }

    language.isActive = !language.isActive;
    await language.save();

    Logger.info('Language active status toggled', { languageId, isActive: language.isActive });
    return language;
};

/**
 * Delete a language
 * @param {ObjectId} languageId
 * @returns {Promise<boolean>}
 */
const deleteLanguage = async (languageId) => {
    return runTransaction(async (session) => {
        const language = await languageRepository.findById(languageId, session);
        if (!language) {
            throw new AppError(httpStatus.NOT_FOUND, 'Language not found');
        }

        // Check if any posts are associated with this language name (session aware)
        const postExists = await Post.exists({ language: language.name }).session(session);
        if (postExists) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                'Cannot delete language. There are active posts associated with this language.'
            );
        }

        await languageRepository.deleteById(languageId, session);
        Logger.info('Language deleted successfully', { languageId, name: language.name });
        return true;
    });
};

module.exports = {
    createLanguage,
    getAllLanguages,
    getActiveLanguages,
    updateLanguage,
    toggleLanguageStatus,
    deleteLanguage,
};

const httpStatus = require('http-status').default;
const categoryRepository = require('../repositories/category.repository');
const { Post } = require('../models/post.model');
const { runTransaction } = require('../utils/transaction');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');

/**
 * Handle duplicate key index violations gracefully
 */
const handleDuplicateKey = (error) => {
    if (error.code === 11000) {
        throw new AppError(httpStatus.CONFLICT, 'Category name already exists');
    }
    throw error;
};

/**
 * Create a new category
 * @param {string} name
 * @returns {Promise<Object>}
 */
const createCategory = async (name) => {
    const normalizedName = name.trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    const existing = await categoryRepository.findByName(normalizedName);
    if (existing) {
        throw new AppError(httpStatus.CONFLICT, 'Category already exists');
    }

    try {
        const category = await categoryRepository.create({ name: normalizedName });
        Logger.info('Category created successfully', { categoryId: category._id, name: normalizedName });
        return category;
    } catch (error) {
        handleDuplicateKey(error);
    }
};

/**
 * Get all categories (Admin)
 * @returns {Promise<Array<Object>>}
 */
const getAllCategories = async () => {
    return categoryRepository.findAll();
};

/**
 * Get active categories only (Public)
 * @returns {Promise<Array<Object>>}
 */
const getActiveCategories = async () => {
    return categoryRepository.findActive();
};

/**
 * Update a category name
 * @param {ObjectId} categoryId
 * @param {string} newName
 * @returns {Promise<Object>}
 */
const updateCategory = async (categoryId, newName) => {
    const normalizedNewName = newName.trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    return runTransaction(async (session) => {
        const category = await categoryRepository.findById(categoryId, session);
        if (!category) {
            throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
        }

        const oldName = category.name;

        // Check if new name is already taken by another category (session aware)
        const existing = await categoryRepository.findByName(normalizedNewName, session);
        if (existing && existing._id.toString() !== categoryId.toString()) {
            throw new AppError(httpStatus.CONFLICT, 'Category name already exists');
        }

        category.name = normalizedNewName;
        try {
            await category.save({ session });
        } catch (error) {
            handleDuplicateKey(error);
        }

        // Propagate the name update to all posts that use this category (session aware)
        if (oldName !== normalizedNewName) {
            const updateResult = await Post.updateMany(
                { category: oldName },
                { category: normalizedNewName }
            ).session(session);
            
            Logger.info('Category name updated and propagated to posts', {
                categoryId,
                oldName,
                newName: normalizedNewName,
                modifiedPostsCount: updateResult.modifiedCount,
            });
        }

        return category;
    });
};

/**
 * Toggle category active status
 * @param {ObjectId} categoryId
 * @returns {Promise<Object>}
 */
const toggleCategoryStatus = async (categoryId) => {
    const category = await categoryRepository.findById(categoryId);
    if (!category) {
        throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
    }

    category.isActive = !category.isActive;
    await category.save();

    Logger.info('Category active status toggled', { categoryId, isActive: category.isActive });
    return category;
};

/**
 * Delete a category
 * @param {ObjectId} categoryId
 * @returns {Promise<boolean>}
 */
const deleteCategory = async (categoryId) => {
    return runTransaction(async (session) => {
        const category = await categoryRepository.findById(categoryId, session);
        if (!category) {
            throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
        }

        // Check if any posts are associated with this category name (session aware)
        const postExists = await Post.exists({ category: category.name }).session(session);
        if (postExists) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                'Cannot delete category. There are active posts associated with this category.'
            );
        }

        await categoryRepository.deleteById(categoryId, session);
        Logger.info('Category deleted successfully', { categoryId, name: category.name });
        return true;
    });
};

module.exports = {
    createCategory,
    getAllCategories,
    getActiveCategories,
    updateCategory,
    toggleCategoryStatus,
    deleteCategory,
};

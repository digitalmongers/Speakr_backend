const httpStatus = require('http-status').default;
const catchAsync = require('../../utils/catchAsync');
const categoryService = require('../../services/category.service');
const ApiResponse = require('../../utils/ApiResponse');
const AuditService = require('../../services/audit.service');
const { invalidateCacheByPattern } = require('../../middlewares/cache.middleware');

/**
 * Create a new category
 */
const createCategory = catchAsync(async (req, res) => {
    const { name } = req.body;
    const category = await categoryService.createCategory(name);

    // Invalidate public category list cache
    await invalidateCacheByPattern('cache:*:/api/v1/categories*');

    AuditService.record({
        action: 'ADMIN_CREATE_CATEGORY',
        entity: 'Category',
        entityId: category._id,
        userId: req.admin._id,
        metadata: { name: category.name },
    });

    return res.status(httpStatus.CREATED).json(
        new ApiResponse(
            httpStatus.CREATED,
            category,
            'Category created successfully.'
        )
    );
});

/**
 * Get all categories
 */
const getAllCategories = catchAsync(async (req, res) => {
    const categories = await categoryService.getAllCategories();

    AuditService.record({
        action: 'ADMIN_GET_CATEGORIES_LIST',
        entity: 'Admin',
        entityId: req.admin._id,
        userId: req.admin._id,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            categories,
            'Categories list retrieved successfully.'
        )
    );
});

/**
 * Update a category name
 */
const updateCategory = catchAsync(async (req, res) => {
    const { categoryId } = req.params;
    const { name } = req.body;

    const category = await categoryService.updateCategory(categoryId, name);

    // Invalidate public categories list & posts feeds (since post category name changes)
    await invalidateCacheByPattern('cache:*:/api/v1/categories*');
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    AuditService.record({
        action: 'ADMIN_UPDATE_CATEGORY',
        entity: 'Category',
        entityId: category._id,
        userId: req.admin._id,
        metadata: { name: category.name },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            category,
            'Category updated successfully.'
        )
    );
});

/**
 * Toggle category active/inactive status
 */
const toggleCategoryStatus = catchAsync(async (req, res) => {
    const { categoryId } = req.params;
    const category = await categoryService.toggleCategoryStatus(categoryId);

    // Invalidate public category list cache & posts feeds
    await invalidateCacheByPattern('cache:*:/api/v1/categories*');
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    AuditService.record({
        action: 'ADMIN_TOGGLE_CATEGORY_STATUS',
        entity: 'Category',
        entityId: category._id,
        userId: req.admin._id,
        metadata: { isActive: category.isActive },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            category,
            `Category has been successfully marked as ${category.isActive ? 'active' : 'inactive'}.`
        )
    );
});

/**
 * Delete category
 */
const deleteCategory = catchAsync(async (req, res) => {
    const { categoryId } = req.params;
    await categoryService.deleteCategory(categoryId);

    // Invalidate public category list cache & posts feeds
    await invalidateCacheByPattern('cache:*:/api/v1/categories*');
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    AuditService.record({
        action: 'ADMIN_DELETE_CATEGORY',
        entity: 'Category',
        entityId: categoryId,
        userId: req.admin._id,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            null,
            'Category deleted successfully.'
        )
    );
});

module.exports = {
    createCategory,
    getAllCategories,
    updateCategory,
    toggleCategoryStatus,
    deleteCategory,
};

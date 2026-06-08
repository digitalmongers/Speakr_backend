const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const categoryService = require('../services/category.service');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Get active categories for public homepage
 */
const getActiveCategories = catchAsync(async (req, res) => {
    const categories = await categoryService.getActiveCategories();

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            categories,
            'Active categories list retrieved successfully.'
        )
    );
});

module.exports = {
    getActiveCategories,
};

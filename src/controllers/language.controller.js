const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const languageService = require('../services/language.service');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Get active languages for public view
 */
const getActiveLanguages = catchAsync(async (req, res) => {
    const languages = await languageService.getActiveLanguages();

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            languages,
            'Active languages list retrieved successfully.'
        )
    );
});

module.exports = {
    getActiveLanguages,
};

const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const systemSettingService = require('../services/systemSetting.service');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Get public app configurations (e.g. upload size limits)
 */
const getPublicSettings = catchAsync(async (req, res) => {
    const maxAudioSizeMB = await systemSettingService.getSetting('maxAudioSizeMB', 50);
    
    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            {
                maxAudioSizeMB,
                maxImageSizeMB: 10 // static limit
            },
            'Public settings retrieved successfully.'
        )
    );
});

module.exports = {
    getPublicSettings,
};

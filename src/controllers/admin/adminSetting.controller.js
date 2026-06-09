const httpStatus = require('http-status').default;
const catchAsync = require('../../utils/catchAsync');
const systemSettingService = require('../../services/systemSetting.service');
const ApiResponse = require('../../utils/ApiResponse');
const AuditService = require('../../services/audit.service');
const { SUPPORTED_AUDIO_FORMATS } = require('../../validations/systemSetting.validation');

/**
 * Get all system settings
 */
const getSettings = catchAsync(async (req, res) => {
    const settings = await systemSettingService.getAllSettings();

    // Set defaults in response if they don't exist in DB yet
    const responseData = {
        maxAudioSizeMB: settings.maxAudioSizeMB !== undefined ? settings.maxAudioSizeMB : 50,
        allowedAudioFormats: settings.allowedAudioFormats !== undefined ? settings.allowedAudioFormats : ['mp3'],
        supportedAudioFormats: SUPPORTED_AUDIO_FORMATS, // let frontend know what options are available
        ...settings
    };

    AuditService.record({
        action: 'ADMIN_GET_SYSTEM_SETTINGS',
        entity: 'Admin',
        entityId: req.admin._id,
        userId: req.admin._id,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            responseData,
            'System settings retrieved successfully.'
        )
    );
});

/**
 * Update system settings
 */
const updateSettings = catchAsync(async (req, res) => {
    const updatedSettings = await systemSettingService.updateSettings(req.body);

    AuditService.record({
        action: 'ADMIN_UPDATE_SYSTEM_SETTINGS',
        entity: 'Admin',
        entityId: req.admin._id,
        userId: req.admin._id,
        metadata: { updatedKeys: Object.keys(req.body) },
        newData: updatedSettings,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            updatedSettings,
            'System settings updated successfully.'
        )
    );
});

module.exports = {
    getSettings,
    updateSettings,
};

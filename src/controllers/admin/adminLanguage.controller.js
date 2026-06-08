const httpStatus = require('http-status').default;
const catchAsync = require('../../utils/catchAsync');
const languageService = require('../../services/language.service');
const ApiResponse = require('../../utils/ApiResponse');
const AuditService = require('../../services/audit.service');
const { invalidateCacheByPattern } = require('../../middlewares/cache.middleware');

/**
 * Create a new language
 */
const createLanguage = catchAsync(async (req, res) => {
    const { name } = req.body;
    const language = await languageService.createLanguage(name);

    // Invalidate public language list cache
    await invalidateCacheByPattern('cache:*:/api/v1/languages*');

    AuditService.record({
        action: 'ADMIN_CREATE_LANGUAGE',
        entity: 'Language',
        entityId: language._id,
        userId: req.admin._id,
        metadata: { name: language.name },
    });

    return res.status(httpStatus.CREATED).json(
        new ApiResponse(
            httpStatus.CREATED,
            language,
            'Language created successfully.'
        )
    );
});

/**
 * Get all languages
 */
const getAllLanguages = catchAsync(async (req, res) => {
    const languages = await languageService.getAllLanguages();

    AuditService.record({
        action: 'ADMIN_GET_LANGUAGES_LIST',
        entity: 'Admin',
        entityId: req.admin._id,
        userId: req.admin._id,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            languages,
            'Languages list retrieved successfully.'
        )
    );
});

/**
 * Update a language name
 */
const updateLanguage = catchAsync(async (req, res) => {
    const { languageId } = req.params;
    const { name } = req.body;

    const language = await languageService.updateLanguage(languageId, name);

    // Invalidate public languages list & posts feeds (since post language name changes)
    await invalidateCacheByPattern('cache:*:/api/v1/languages*');
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    AuditService.record({
        action: 'ADMIN_UPDATE_LANGUAGE',
        entity: 'Language',
        entityId: language._id,
        userId: req.admin._id,
        metadata: { name: language.name },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            language,
            'Language updated successfully.'
        )
    );
});

/**
 * Toggle language active/inactive status
 */
const toggleLanguageStatus = catchAsync(async (req, res) => {
    const { languageId } = req.params;
    const language = await languageService.toggleLanguageStatus(languageId);

    // Invalidate public language list cache & posts feeds
    await invalidateCacheByPattern('cache:*:/api/v1/languages*');
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    AuditService.record({
        action: 'ADMIN_TOGGLE_LANGUAGE_STATUS',
        entity: 'Language',
        entityId: language._id,
        userId: req.admin._id,
        metadata: { isActive: language.isActive },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            language,
            `Language has been successfully marked as ${language.isActive ? 'active' : 'inactive'}.`
        )
    );
});

/**
 * Delete language
 */
const deleteLanguage = catchAsync(async (req, res) => {
    const { languageId } = req.params;
    await languageService.deleteLanguage(languageId);

    // Invalidate public language list cache & posts feeds
    await invalidateCacheByPattern('cache:*:/api/v1/languages*');
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    AuditService.record({
        action: 'ADMIN_DELETE_LANGUAGE',
        entity: 'Language',
        entityId: languageId,
        userId: req.admin._id,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            null,
            'Language deleted successfully.'
        )
    );
});

module.exports = {
    createLanguage,
    getAllLanguages,
    updateLanguage,
    toggleLanguageStatus,
    deleteLanguage,
};

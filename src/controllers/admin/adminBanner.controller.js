const httpStatus = require('http-status').default;
const catchAsync = require('../../utils/catchAsync');
const bannerService = require('../../services/banner.service');
const ApiResponse = require('../../utils/ApiResponse');
const AuditService = require('../../services/audit.service');
const AppError = require('../../utils/AppError');
const { invalidateCacheByPattern } = require('../../middlewares/cache.middleware');

/**
 * Create a new banner
 */
const createBanner = catchAsync(async (req, res) => {
    if (!req.file) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Please upload a banner image file');
    }

    const bannerData = {
        imageUrl: req.file.location,
        imageKey: req.file.key,
        redirectUrl: req.body.redirectUrl,
        isActive: req.body.isActive,
    };

    const banner = await bannerService.createBanner(bannerData);

    // Invalidate public feed cache
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    AuditService.record({
        action: 'ADMIN_CREATE_BANNER',
        entity: 'Banner',
        entityId: banner._id,
        userId: req.admin._id,
        metadata: { redirectUrl: banner.redirectUrl },
    });

    return res.status(httpStatus.CREATED).json(
        new ApiResponse(
            httpStatus.CREATED,
            banner,
            'Banner created successfully.'
        )
    );
});

/**
 * Get all banners
 */
const getAllBanners = catchAsync(async (req, res) => {
    const banners = await bannerService.getAllBanners();

    AuditService.record({
        action: 'ADMIN_GET_BANNERS_LIST',
        entity: 'Admin',
        entityId: req.admin._id,
        userId: req.admin._id,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            banners,
            'Banners list retrieved successfully.'
        )
    );
});

/**
 * Update banner details
 */
const updateBanner = catchAsync(async (req, res) => {
    const { bannerId } = req.params;

    const updateBody = { ...req.body };
    if (req.file) {
        updateBody.imageUrl = req.file.location;
        updateBody.imageKey = req.file.key;
    }

    const banner = await bannerService.updateBanner(bannerId, updateBody);

    // Invalidate public feed cache
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    AuditService.record({
        action: 'ADMIN_UPDATE_BANNER',
        entity: 'Banner',
        entityId: banner._id,
        userId: req.admin._id,
        metadata: { redirectUrl: banner.redirectUrl },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            banner,
            'Banner updated successfully.'
        )
    );
});

/**
 * Toggle banner active status
 */
const toggleBannerStatus = catchAsync(async (req, res) => {
    const { bannerId } = req.params;
    const banner = await bannerService.toggleBannerStatus(bannerId);

    // Invalidate public feed cache
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    AuditService.record({
        action: 'ADMIN_TOGGLE_BANNER_STATUS',
        entity: 'Banner',
        entityId: banner._id,
        userId: req.admin._id,
        metadata: { isActive: banner.isActive },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            banner,
            `Banner has been successfully marked as ${banner.isActive ? 'active' : 'inactive'}.`
        )
    );
});

/**
 * Delete a banner
 */
const deleteBanner = catchAsync(async (req, res) => {
    const { bannerId } = req.params;
    await bannerService.deleteBanner(bannerId);

    // Invalidate public feed cache
    await invalidateCacheByPattern('cache:*:/api/v1/posts*');

    AuditService.record({
        action: 'ADMIN_DELETE_BANNER',
        entity: 'Banner',
        entityId: bannerId,
        userId: req.admin._id,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            null,
            'Banner deleted successfully.'
        )
    );
});

module.exports = {
    createBanner,
    getAllBanners,
    updateBanner,
    toggleBannerStatus,
    deleteBanner,
};

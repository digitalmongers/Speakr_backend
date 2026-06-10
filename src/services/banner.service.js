const httpStatus = require('http-status').default;
const bannerRepository = require('../repositories/banner.repository');
const UploadService = require('./upload.service');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');

/**
 * Create a new banner
 * @param {Object} bannerBody
 * @returns {Promise<Object>}
 */
const createBanner = async (bannerBody) => {
    const banner = await bannerRepository.create(bannerBody);
    Logger.info('Banner created successfully', { bannerId: banner._id });
    return banner;
};

/**
 * Get all banners (Admin)
 * @returns {Promise<Array<Object>>}
 */
const getAllBanners = async () => {
    return bannerRepository.findAll();
};

/**
 * Get active banners only (Public)
 * @returns {Promise<Array<Object>>}
 */
const getActiveBanners = async () => {
    return bannerRepository.findActive();
};

/**
 * Update a banner
 * @param {ObjectId} bannerId
 * @param {Object} updateBody
 * @returns {Promise<Object>}
 */
const updateBanner = async (bannerId, updateBody) => {
    const banner = await bannerRepository.findById(bannerId);
    if (!banner) {
        throw new AppError(httpStatus.NOT_FOUND, 'Banner not found');
    }

    const oldImageKey = banner.imageKey;

    // Update banner
    const updatedBanner = await bannerRepository.updateById(bannerId, updateBody);

    // If banner update succeeds and we provided a new image key, delete the old image in background
    if (updateBody.imageKey && updateBody.imageKey !== oldImageKey) {
        Logger.info('Old banner image replaced, deleting from storage', { oldImageKey });
        UploadService.deleteFromS3(oldImageKey).catch((err) => {
            Logger.error('Failed to delete old banner image key from storage:', err);
        });
    }

    Logger.info('Banner updated successfully', { bannerId });
    return updatedBanner;
};

/**
 * Toggle banner active status
 * @param {ObjectId} bannerId
 * @returns {Promise<Object>}
 */
const toggleBannerStatus = async (bannerId) => {
    const banner = await bannerRepository.findById(bannerId);
    if (!banner) {
        throw new AppError(httpStatus.NOT_FOUND, 'Banner not found');
    }

    banner.isActive = !banner.isActive;
    await banner.save();

    Logger.info('Banner active status toggled', { bannerId, isActive: banner.isActive });
    return banner;
};

/**
 * Delete a banner
 * @param {ObjectId} bannerId
 * @returns {Promise<boolean>}
 */
const deleteBanner = async (bannerId) => {
    const banner = await bannerRepository.findById(bannerId);
    if (!banner) {
        throw new AppError(httpStatus.NOT_FOUND, 'Banner not found');
    }

    await bannerRepository.deleteById(bannerId);

    // Delete image from storage in background
    Logger.info('Deleting banner image from storage', { imageKey: banner.imageKey });
    UploadService.deleteFromS3(banner.imageKey).catch((err) => {
        Logger.error('Failed to delete banner image key from storage on deletion:', err);
    });

    Logger.info('Banner deleted successfully', { bannerId });
    return true;
};

module.exports = {
    createBanner,
    getAllBanners,
    getActiveBanners,
    updateBanner,
    toggleBannerStatus,
    deleteBanner,
};

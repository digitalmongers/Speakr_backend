const express = require('express');
const validate = require('../../../middlewares/validate.middleware');
const adminAuth = require('../../../middlewares/adminAuth.middleware');
const lockRequest = require('../../../middlewares/lockRequest.middleware');
const { uploadImage, multerErrorHandler } = require('../../../middlewares/upload.middleware');
const bannerValidation = require('../../../validations/banner.validation');
const adminBannerController = require('../../../controllers/admin/adminBanner.controller');

const router = express.Router();

router.route('/')
    .post(adminAuth, uploadImage.single('file'), multerErrorHandler, lockRequest, validate(bannerValidation.createBanner), adminBannerController.createBanner)
    .get(adminAuth, adminBannerController.getAllBanners);

router.route('/:bannerId')
    .patch(adminAuth, uploadImage.single('file'), multerErrorHandler, lockRequest, validate(bannerValidation.updateBanner), adminBannerController.updateBanner)
    .delete(adminAuth, lockRequest, validate(bannerValidation.bannerIdParam), adminBannerController.deleteBanner);

router.post('/:bannerId/toggle-status', adminAuth, lockRequest, validate(bannerValidation.bannerIdParam), adminBannerController.toggleBannerStatus);

module.exports = router;

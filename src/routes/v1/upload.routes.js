const express = require('express');
const uploadController = require('../../controllers/upload.controller');
const uploadValidation = require('../../validations/upload.validation');
const { uploadAudio, uploadImage, multerErrorHandler } = require('../../middlewares/upload.middleware');
const validate = require('../../middlewares/validate.middleware');
const userAuth = require('../../middlewares/userAuth.middleware');
const lockRequest = require('../../middlewares/lockRequest.middleware');

const router = express.Router();

/**
 * Route: Upload Audio
 * Restricted to authenticated USERS only
 */
router.post(
    '/audio',
    userAuth,
    lockRequest, // Prevent concurrent uploads of the same file
    uploadAudio.single('file'),
    multerErrorHandler,
    uploadController.uploadAudioFile
);

/**
 * Route: Upload Image
 * Restricted to authenticated USERS only
 */
router.post(
    '/image',
    userAuth,
    lockRequest, // Prevent concurrent uploads
    uploadImage.single('file'),
    multerErrorHandler,
    uploadController.uploadImageFile
);

// Route: Get Presigned URL (GET /api/v1/upload/presigned-url?key=...)
router.get(
    '/presigned-url',
    validate(uploadValidation.getPresignedUrl),
    uploadController.getPresignedUrl
);

// Route: Delete File (DELETE /api/v1/upload)
router.delete(
    '/',
    validate(uploadValidation.deleteFile),
    uploadController.deleteFile
);

module.exports = router;

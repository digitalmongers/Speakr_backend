const express = require('express');
const uploadController = require('../../controllers/upload.controller');
const uploadValidation = require('../../validations/upload.validation');
const { uploadAudio, uploadImage, multerErrorHandler } = require('../../middlewares/upload.middleware');
const validate = require('../../middlewares/validate.middleware');
const userAuth = require('../../middlewares/userAuth.middleware');
const adminAuth = require('../../middlewares/adminAuth.middleware');
const lockRequest = require('../../middlewares/lockRequest.middleware');

// Combined Auth Middleware allowing both Users and Admins to perform uploads
const uploadAuth = (req, res, next) => {
    userAuth(req, res, (err) => {
        if (!err) {
            return next();
        }
        // Fallback to Admin Authentication if User Authentication fails
        adminAuth(req, res, (adminErr) => {
            if (!adminErr) {
                return next();
            }
            // Return authorization error if both failed
            next(err);
        });
    });
};

const router = express.Router();

/**
 * Route: Upload Audio
 * Restricted to authenticated USERS and ADMINS
 */
router.post(
    '/audio',
    uploadAuth,
    lockRequest, // Prevent concurrent uploads of the same file
    uploadAudio.single('file'),
    multerErrorHandler,
    uploadController.uploadAudioFile
);

/**
 * Route: Upload Image
 * Restricted to authenticated USERS and ADMINS
 */
router.post(
    '/image',
    uploadAuth,
    lockRequest, // Prevent concurrent uploads
    uploadImage.single('file'),
    multerErrorHandler,
    uploadController.uploadImageFile
);

// Route: Get Presigned URL (GET /api/v1/upload/presigned-url?key=...)
router.get(
    '/presigned-url',
    uploadAuth,
    validate(uploadValidation.getPresignedUrl),
    uploadController.getPresignedUrl
);

// Route: Delete File (DELETE /api/v1/upload)
router.delete(
    '/',
    uploadAuth,
    validate(uploadValidation.deleteFile),
    uploadController.deleteFile
);

module.exports = router;

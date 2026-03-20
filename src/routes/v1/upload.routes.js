const express = require('express');
const uploadController = require('../../controllers/upload.controller');
const uploadValidation = require('../../validations/upload.validation');
const { uploadAudio, uploadImage, multerErrorHandler } = require('../../middlewares/upload.middleware');
const validate = require('../../middlewares/validate.middleware');
// Assuming auth middleware exists, you would add it here if needed:
// const auth = require('../../middlewares/auth.middleware');

const router = express.Router();

// Route: Upload Audio
// For production auth would go here: router.post('/audio', auth(), uploadAudio.single('file'), ...)
router.post(
    '/audio',
    uploadAudio.single('file'),
    multerErrorHandler,
    uploadController.uploadAudioFile
);

// Route: Upload Image
router.post(
    '/image',
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

const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const UploadService = require('../services/upload.service');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');

/**
 * Controller for handling audio uploads
 * Expects file to be in req.file (handled by multer middleware)
 */
const uploadAudioFile = catchAsync(async (req, res) => {
    if (!req.file) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Please upload an audio file');
    }

    const fileData = UploadService.buildFileResponse(req.file);
    
    Logger.info('Audio file uploaded to S3 successfully', {
        userId: req.user ? req.user.id : 'anonymous',
        key: fileData.key,
        size: fileData.size,
        mimeType: fileData.mimeType
    });

    res.status(httpStatus.CREATED).json({
        status: 'success',
        message: 'Audio file uploaded successfully',
        data: {
            file: fileData
        }
    });
});

/**
 * Controller for handling image/photo uploads
 * Expects file to be in req.file (handled by multer middleware)
 */
const uploadImageFile = catchAsync(async (req, res) => {
    if (!req.file) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Please upload an image file');
    }

    const fileData = UploadService.buildFileResponse(req.file);
    
    Logger.info('Image file uploaded to S3 successfully', {
        userId: req.user ? req.user.id : 'anonymous',
        key: fileData.key,
        size: fileData.size,
        mimeType: fileData.mimeType
    });

    res.status(httpStatus.CREATED).json({
        status: 'success',
        message: 'Image uploaded successfully',
        data: {
            file: fileData
        }
    });
});

/**
 * Generate a pre-signed URL for direct S3 upload (if needed in the future) or access.
 * Currently exposing read access URL generation.
 */
const getPresignedUrl = catchAsync(async (req, res) => {
    const { key } = req.query; // Validated by zod
    
    const signedUrl = await UploadService.getSignedUrl(key);

    res.status(httpStatus.OK).json({
        status: 'success',
        data: {
            signedUrl
        }
    });
});

/**
 * Delete a file from S3
 */
const deleteFile = catchAsync(async (req, res) => {
    const { key } = req.body; // Validated by zod

    await UploadService.deleteFromS3(key);

    res.status(httpStatus.OK).json({
        status: 'success',
        message: 'File deleted successfully'
    });
});


module.exports = {
    uploadAudioFile,
    uploadImageFile,
    getPresignedUrl,
    deleteFile
};

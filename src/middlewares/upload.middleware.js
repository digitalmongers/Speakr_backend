const multer = require('multer');
const multerS3 = require('multer-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const s3Client = require('../configs/s3.config');
const env = require('../configs/env');
const AppError = require('../utils/AppError');

const createUploadMiddleware = (allowedMimeTypes, maxFileSizeMB, folderPrefix) => {
    // If S3 is not configured, return a middleware that throws an error when called
    if (!s3Client || !env.AWS_S3_BUCKET_NAME) {
        return {
            single: (fieldname) => (req, res, next) => {
                next(new AppError(503, 'AWS S3 is not configured. File uploads are disabled.'));
            }
        };
    }

    return multer({
        storage: multerS3({
            s3: s3Client,
            bucket: env.AWS_S3_BUCKET_NAME,
            contentType: multerS3.AUTO_CONTENT_TYPE,
            metadata: (req, file, cb) => {
                cb(null, { fieldName: file.fieldname });
            },
            key: (req, file, cb) => {
                const ext = path.extname(file.originalname) || '';
                const baseFolder = folderPrefix;
                const userId = req.user ? req.user.id : 'anonymous';
                const fileKey = `${baseFolder}/${userId}/${uuidv4()}-${Date.now()}${ext}`;
                cb(null, fileKey);
            }
        }),
        limits: {
            fileSize: maxFileSizeMB * 1024 * 1024,
        },
        fileFilter: (req, file, cb) => {
            if (allowedMimeTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new AppError(415, `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`));
            }
        }
    });
};

const audioMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'];
const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const uploadAudio = createUploadMiddleware(audioMimeTypes, 50, 'uploads/audio');
const uploadImage = createUploadMiddleware(imageMimeTypes, 10, 'uploads/images');

const multerErrorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new AppError(413, 'File size limit exceeded'));
        }
        return next(new AppError(400, `Upload error: ${err.message}`));
    }
    next(err);
};

module.exports = {
    uploadAudio,
    uploadImage,
    multerErrorHandler
};

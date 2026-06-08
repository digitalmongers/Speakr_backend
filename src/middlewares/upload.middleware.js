const multer = require('multer');
const multerS3 = require('multer-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const s3Client = require('../configs/s3.config');
const cloudinaryClient = require('../configs/cloudinary.config');
const env = require('../configs/env');
const AppError = require('../utils/AppError');

const getStorageProvider = () => {
    if (s3Client && env.AWS_S3_BUCKET_NAME) {
        return 's3';
    } else if (cloudinaryClient) {
        return 'cloudinary';
    }
    return null;
};

const createUploadMiddleware = (allowedMimeTypes, maxFileSizeMB, folderPrefix) => {
    const provider = getStorageProvider();

    if (!provider) {
        return {
            single: (fieldname) => (req, res, next) => {
                next(new AppError(503, 'No storage provider configured. Please configure AWS S3 or Cloudinary.'));
            }
        };
    }

    if (provider === 's3') {
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
                    const userId = req.user ? (req.user.id || req.user._id) : (req.admin ? (req.admin.id || req.admin._id) : 'anonymous');
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
    }

    // Fallback: Cloudinary using memory storage & direct stream upload
    const memoryMulter = multer({
        storage: multer.memoryStorage(),
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

    return {
        single: (fieldname) => {
            const parseMiddleware = memoryMulter.single(fieldname);
            return (req, res, next) => {
                parseMiddleware(req, res, async (err) => {
                    if (err) {
                        return next(err);
                    }
                    if (!req.file) {
                        return next();
                    }

                    try {
                        const baseFolder = folderPrefix;
                        const userId = req.user ? (req.user.id || req.user._id) : (req.admin ? (req.admin.id || req.admin._id) : 'anonymous');
                        const publicId = `${baseFolder}/${userId}/${uuidv4()}-${Date.now()}`;

                        let resourceType = 'auto';
                        if (req.file.mimetype.startsWith('image/')) {
                            resourceType = 'image';
                        } else if (req.file.mimetype.startsWith('audio/')) {
                            resourceType = 'video';
                        }

                        const uploadStream = () => {
                            return new Promise((resolve, reject) => {
                                const stream = cloudinaryClient.uploader.upload_stream(
                                    {
                                        public_id: publicId,
                                        resource_type: resourceType,
                                    },
                                    (error, result) => {
                                        if (error) {
                                            reject(error);
                                        } else {
                                            resolve(result);
                                        }
                                    }
                                );
                                stream.end(req.file.buffer);
                            });
                        };

                        const result = await uploadStream();

                        // Mutate req.file to match S3 properties for complete controllers transparency
                        req.file.location = result.secure_url;
                        req.file.key = result.public_id;

                        next();
                    } catch (uploadError) {
                        next(new AppError(500, `Cloudinary upload failed: ${uploadError.message}`));
                    }
                });
            };
        }
    };
};

const systemSettingService = require('../services/systemSetting.service');

const audioMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'];
const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const uploadAudio = {
    single: (fieldname) => {
        return async (req, res, next) => {
            try {
                const maxAudioSizeMB = await systemSettingService.getSetting('maxAudioSizeMB', 50);
                const multerInstance = createUploadMiddleware(audioMimeTypes, maxAudioSizeMB, 'uploads/audio');
                multerInstance.single(fieldname)(req, res, next);
            } catch (err) {
                next(err);
            }
        };
    }
};

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

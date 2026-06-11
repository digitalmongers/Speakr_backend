const multer = require('multer');
const multerS3 = require('multer-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const s3Client = require('../configs/s3.config');
const cloudinaryClient = require('../configs/cloudinary.config');
const env = require('../configs/env');
const AppError = require('../utils/AppError');
const UploadService = require('../services/upload.service');

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

const createPostUploadMiddleware = (allowedAudioMimes, maxAudioSizeMB) => {
    const provider = getStorageProvider();

    if (!provider) {
        return (req, res, next) => {
            next(new AppError(503, 'No storage provider configured. Please configure AWS S3 or Cloudinary.'));
        };
    }

    const maxImageSizeMB = 10;
    const maxAudioSizeBytes = maxAudioSizeMB * 1024 * 1024;
    const maxImageSizeBytes = maxImageSizeMB * 1024 * 1024;

    const fileFilter = (req, file, cb) => {
        if (file.fieldname === 'audio' || file.fieldname === 'file') {
            if (allowedAudioMimes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new AppError(415, `Invalid audio type. Allowed types: ${allowedAudioMimes.join(', ')}`));
            }
        } else if (file.fieldname === 'thumbnail' || file.fieldname === 'image') {
            if (imageMimeTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new AppError(415, `Invalid image type. Allowed types: ${imageMimeTypes.join(', ')}`));
            }
        } else {
            cb(new AppError(400, `Unexpected field: ${file.fieldname}`));
        }
    };

    if (provider === 's3') {
        const upload = multer({
            storage: multerS3({
                s3: s3Client,
                bucket: env.AWS_S3_BUCKET_NAME,
                contentType: multerS3.AUTO_CONTENT_TYPE,
                metadata: (req, file, cb) => {
                    cb(null, { fieldName: file.fieldname });
                },
                key: (req, file, cb) => {
                    const ext = path.extname(file.originalname) || '';
                    const baseFolder = (file.fieldname === 'audio' || file.fieldname === 'file') ? 'uploads/audio' : 'uploads/images';
                    const userId = req.user ? (req.user.id || req.user._id) : (req.admin ? (req.admin.id || req.admin._id) : 'anonymous');
                    const fileKey = `${baseFolder}/${userId}/${uuidv4()}-${Date.now()}${ext}`;
                    cb(null, fileKey);
                }
            }),
            limits: {
                fileSize: Math.max(maxAudioSizeBytes, maxImageSizeBytes),
            },
            fileFilter
        });

        const fieldsMiddleware = upload.fields([
            { name: 'audio', maxCount: 1 },
            { name: 'file', maxCount: 1 },
            { name: 'thumbnail', maxCount: 1 },
            { name: 'image', maxCount: 1 }
        ]);

        return (req, res, next) => {
            fieldsMiddleware(req, res, async (err) => {
                if (err) {
                    return next(err);
                }

                try {
                    const audioFile = req.files && (req.files.audio?.[0] || req.files.file?.[0]);
                    const thumbnailFile = req.files && (req.files.thumbnail?.[0] || req.files.image?.[0]);

                    if (audioFile && audioFile.size > maxAudioSizeBytes) {
                        await UploadService.deleteFromS3(audioFile.key).catch(() => {});
                        return next(new AppError(413, 'Audio file size limit exceeded'));
                    }

                    if (thumbnailFile && thumbnailFile.size > maxImageSizeBytes) {
                        await UploadService.deleteFromS3(thumbnailFile.key).catch(() => {});
                        return next(new AppError(413, 'Thumbnail image size limit exceeded'));
                    }

                    next();
                } catch (cleanupErr) {
                    next(cleanupErr);
                }
            });
        };
    }

    // Cloudinary using memory storage
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: Math.max(maxAudioSizeBytes, maxImageSizeBytes),
        },
        fileFilter
    });

    const fieldsMiddleware = upload.fields([
        { name: 'audio', maxCount: 1 },
        { name: 'file', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
        { name: 'image', maxCount: 1 }
    ]);

    return (req, res, next) => {
        fieldsMiddleware(req, res, async (err) => {
            if (err) {
                return next(err);
            }

            const audioFile = req.files && (req.files.audio?.[0] || req.files.file?.[0]);
            const thumbnailFile = req.files && (req.files.thumbnail?.[0] || req.files.image?.[0]);

            if (audioFile && audioFile.size > maxAudioSizeBytes) {
                return next(new AppError(413, 'Audio file size limit exceeded'));
            }

            if (thumbnailFile && thumbnailFile.size > maxImageSizeBytes) {
                return next(new AppError(413, 'Thumbnail image size limit exceeded'));
            }

            try {
                const userId = req.user ? (req.user.id || req.user._id) : (req.admin ? (req.admin.id || req.admin._id) : 'anonymous');

                const uploadToCloudinary = (file, baseFolder, resourceType) => {
                    return new Promise((resolve, reject) => {
                        const publicId = `${baseFolder}/${userId}/${uuidv4()}-${Date.now()}`;
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
                        stream.end(file.buffer);
                    });
                };

                if (audioFile) {
                    const result = await uploadToCloudinary(audioFile, 'uploads/audio', 'video');
                    audioFile.location = result.secure_url;
                    audioFile.key = result.public_id;
                }

                if (thumbnailFile) {
                    const result = await uploadToCloudinary(thumbnailFile, 'uploads/images', 'image');
                    thumbnailFile.location = result.secure_url;
                    thumbnailFile.key = result.public_id;
                }

                next();
            } catch (uploadError) {
                next(new AppError(500, `Cloudinary upload failed: ${uploadError.message}`));
            }
        });
    };
};

const systemSettingService = require('../services/systemSetting.service');

// Map of format shortname -> MIME types (a format can map to multiple MIME types)
const FORMAT_TO_MIME = {
    mp3:  ['audio/mpeg', 'audio/mp3'],
    wav:  ['audio/wav', 'audio/x-wav'],
    ogg:  ['audio/ogg'],
    webm: ['audio/webm'],
    m4a:  ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
    aac:  ['audio/aac', 'audio/x-aac'],
    flac: ['audio/flac', 'audio/x-flac'],
};

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Resolve allowed MIME types from the allowedAudioFormats system setting.
 * Falls back to mp3 only when the setting is missing.
 */
const resolveAllowedAudioMimes = async () => {
    const formats = await systemSettingService.getSetting('allowedAudioFormats', ['mp3']);
    const mimes = new Set();
    for (const fmt of formats) {
        const mapped = FORMAT_TO_MIME[fmt];
        if (mapped) mapped.forEach((m) => mimes.add(m));
    }
    return mimes.size > 0 ? Array.from(mimes) : FORMAT_TO_MIME.mp3;
};

const uploadAudio = {
    single: (fieldname) => {
        return async (req, res, next) => {
            try {
                const [maxAudioSizeMB, allowedMimes] = await Promise.all([
                    systemSettingService.getSetting('maxAudioSizeMB', 50),
                    resolveAllowedAudioMimes(),
                ]);
                const multerInstance = createUploadMiddleware(allowedMimes, maxAudioSizeMB, 'uploads/audio');
                multerInstance.single(fieldname)(req, res, next);
            } catch (err) {
                next(err);
            }
        };
    }
};

const uploadImage = createUploadMiddleware(imageMimeTypes, 10, 'uploads/images');

const uploadPostFiles = {
    fields: () => {
        return async (req, res, next) => {
            try {
                const [maxAudioSizeMB, allowedMimes] = await Promise.all([
                    systemSettingService.getSetting('maxAudioSizeMB', 50),
                    resolveAllowedAudioMimes(),
                ]);
                const middleware = createPostUploadMiddleware(allowedMimes, maxAudioSizeMB);
                middleware(req, res, next);
            } catch (err) {
                next(err);
            }
        };
    }
};

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
    uploadPostFiles,
    multerErrorHandler
};

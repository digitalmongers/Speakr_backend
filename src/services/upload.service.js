const { DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: awsGetSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3Client = require('../configs/s3.config');
const cloudinaryClient = require('../configs/cloudinary.config');
const env = require('../configs/env');
const Logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const getStorageProvider = () => {
    if (s3Client && env.AWS_S3_BUCKET_NAME) {
        return 's3';
    } else if (cloudinaryClient) {
        return 'cloudinary';
    }
    return null;
};

class UploadService {
    /**
     * Map upload response to our clean API format.
     */
    static buildFileResponse(file) {
        return {
            url: file.location, // S3 Object URL / Cloudinary Secure URL
            key: file.key,     // S3 Object Key / Cloudinary Public ID
            size: file.size,
            mimeType: file.mimetype,
            originalName: file.originalname
        };
    }

    /**
     * Extract storage key from a full S3 or Cloudinary URL.
     * Returns the key directly if it is not a URL.
     */
    static extractKeyFromUrl(fileUrl) {
        if (!fileUrl || typeof fileUrl !== 'string') return null;
        if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
            return fileUrl;
        }

        try {
            const urlObj = new URL(fileUrl);
            
            // 1. Cloudinary URL Parsing
            if (urlObj.hostname.includes('cloudinary.com')) {
                const pathParts = urlObj.pathname.split('/');
                const uploadIndex = pathParts.indexOf('upload');
                if (uploadIndex !== -1 && uploadIndex + 1 < pathParts.length) {
                    let keyParts = pathParts.slice(uploadIndex + 1);
                    // Check if first part is a version tag (e.g. v1716262400)
                    if (keyParts[0].match(/^v\d+$/)) {
                        keyParts = keyParts.slice(1);
                    }
                    return keyParts.join('/');
                }
            }
            
            
            if (urlObj.hostname.includes('amazonaws.com')) {
                return decodeURIComponent(urlObj.pathname.slice(1));
            }

            
            return decodeURIComponent(urlObj.pathname.slice(1));
        } catch (error) {
            return fileUrl;
        }
    }

    /**
     * Delete an object from the active storage provider by its key
     */
    static async deleteFromS3(key) {
        if (!key) throw new AppError(400, 'File key is required for deletion');

        const provider = getStorageProvider();
        if (!provider) throw new AppError(503, 'No storage provider configured on the server');

        if (provider === 's3') {
            const params = {
                Bucket: env.AWS_S3_BUCKET_NAME,
                Key: key
            };

            try {
                await s3Client.send(new DeleteObjectCommand(params));
                Logger.info('S3 Object deleted', { key });
                return true;
            } catch (error) {
                Logger.error('S3 Deletion failed', { key, error: error.message });
                throw new AppError(500, 'Failed to delete file from S3');
            }
        } else {
            // Cloudinary deletion
            try {
                // Determine resource type based on key path (e.g. uploads/audio/... -> video, uploads/images/... -> image)
                const resourceType = key.includes('audio') ? 'video' : 'image';
                const result = await cloudinaryClient.uploader.destroy(key, { resource_type: resourceType });
                
                if (result.result === 'not_found') {
                    Logger.warn('Cloudinary object not found during deletion', { key });
                } else if (result.result !== 'ok') {
                    throw new Error(`Cloudinary returned: ${result.result}`);
                }

                Logger.info('Cloudinary Object deleted', { key, resourceType });
                return true;
            } catch (error) {
                Logger.error('Cloudinary Deletion failed', { key, error: error.message });
                throw new AppError(500, `Failed to delete file from Cloudinary: ${error.message}`);
            }
        }
    }

    /**
     * Generate access URL to securely access the resource
     */
    static async getSignedUrl(key, expiresIn = env.AWS_S3_SIGNED_URL_EXPIRES) {
        if (!key) throw new AppError(400, 'File key is required for URL generation');

        const provider = getStorageProvider();
        if (!provider) throw new AppError(503, 'No storage provider configured on the server');

        if (provider === 's3') {
            const params = {
                Bucket: env.AWS_S3_BUCKET_NAME,
                Key: key
            };

            try {
                const command = new GetObjectCommand(params);
                const signedUrl = await awsGetSignedUrl(s3Client, command, { expiresIn });
                Logger.info('S3 Signed URL generated', { key, expiresIn });
                return signedUrl;
            } catch (error) {
                Logger.error('Failed to generate S3 Signed URL', { key, error: error.message });
                throw new AppError(500, 'Failed to generate access URL');
            }
        } else {
            // Cloudinary direct secure URL
            const resourceType = key.includes('audio') ? 'video' : 'image';
            const cloudName = env.CLOUDINARY_CLOUD_NAME;
            const signedUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${key}`;
            Logger.info('Cloudinary URL generated', { key });
            return signedUrl;
        }
    }
}

module.exports = UploadService;

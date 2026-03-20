const { DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: awsGetSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3Client = require('../configs/s3.config');
const env = require('../configs/env');
const Logger = require('../utils/logger');
const AppError = require('../utils/AppError');

class UploadService {
    /**
     * Map multer-s3 response to our clean API format.
     */
    static buildFileResponse(file) {
        return {
            url: file.location, // S3 Object URL
            key: file.key,     // S3 Object Key
            size: file.size,
            mimeType: file.mimetype,
            originalName: file.originalname
        };
    }

    /**
     * Delete an object from S3 by its key
     */
    static async deleteFromS3(key) {
        if (!s3Client) throw new AppError(503, 'AWS S3 is not configured on the server');
        if (!key) throw new AppError(400, 'S3 object key is required for deletion');

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
            // Don't throw if we just want to suppress deletion errors, but throwing is safer for strictness
            throw new AppError(500, 'Failed to delete file from S3');
        }
    }

    /**
     * Generate a presigned URL to securely access a private bucket object
     */
    static async getSignedUrl(key, expiresIn = env.AWS_S3_SIGNED_URL_EXPIRES) {
        if (!s3Client) throw new AppError(503, 'AWS S3 is not configured on the server');
        if (!key) throw new AppError(400, 'S3 object key is required for signed URL generation');

        const params = {
            Bucket: env.AWS_S3_BUCKET_NAME,
            Key: key
        };

        try {
            const command = new GetObjectCommand(params);
            const signedUrl = await awsGetSignedUrl(s3Client, command, { expiresIn });
            Logger.info('Signed URL generated', { key, expiresIn });
            return signedUrl;
        } catch (error) {
            Logger.error('Failed to generate Signed URL', { key, error: error.message });
            throw new AppError(500, 'Failed to generate access URL');
        }
    }
}

module.exports = UploadService;

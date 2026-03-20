const { S3Client } = require('@aws-sdk/client-s3');
const env = require('./env');
const Logger = require('../utils/logger');

let s3Client = null;

if (env.AWS_REGION && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    s3Client = new S3Client({
        region: env.AWS_REGION,
        credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
    });
    Logger.info('✅ AWS S3 Client initialized automatically with region: ' + env.AWS_REGION);
} else {
    Logger.warn('⚠️ AWS S3 Client NOT initialized. Missing credentials in environment variables.');
}

module.exports = s3Client;

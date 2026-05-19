const cloudinary = require('cloudinary').v2;
const env = require('./env');
const Logger = require('../utils/logger');

let cloudinaryClient = null;

if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
    });
    cloudinaryClient = cloudinary;
    Logger.info('✅ Cloudinary Client initialized automatically with cloud name: ' + env.CLOUDINARY_CLOUD_NAME);
} else {
    Logger.warn('⚠️ Cloudinary Client NOT initialized. Missing credentials in environment variables.');
}

module.exports = cloudinaryClient;

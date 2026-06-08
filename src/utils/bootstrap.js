const Admin = require('../models/admin/admin.model');
const Category = require('../models/category.model');
const Language = require('../models/language.model');
const env = require('../configs/env');
const Logger = require('./logger');
const bcrypt = require('bcryptjs');

const INITIAL_CATEGORIES = [
    'Music',
    'Podcast',
    'News',
    'Comedy',
    'Education',
    'Sports',
    'Faith',
    'Culture',
    'Business',
    'Science',
    'Drama',
    'Wellness',
    'Gaming',
    'Talkshows',
    'Openmic',
    'Language',
    'Family',
    'Arts',
    'History',
    'Food',
    'Travel',
    'Tech',
    'Documentaries',
    'Audiobooks',
    'Film',
    'Stories'
];

const INITIAL_LANGUAGES = [
    'English',
    'Hindi',
    'Spanish',
    'French',
    'German',
    'Japanese',
    'Russian'
];

/**
 * Bootstraps the system Admin account from environment configuration.
 * Automatically handles creation or credential rotation on start.
 */
const bootstrapAdmin = async () => {
    try {
        const adminEmail = env.ADMIN_EMAIL.toLowerCase();
        const adminPassword = env.ADMIN_PASSWORD;

        // Find if any admin exists in the database
        let admin = await Admin.findOne().select('+password');

        if (!admin) {
            admin = new Admin({
                email: adminEmail,
                password: adminPassword, // will be hashed by adminSchema.pre('save') hook
            });
            await admin.save();
            Logger.info(`🚀 Admin account bootstrapped successfully: ${adminEmail}`);
        } else {
            // If the database email matches the env configuration, check for password rotation
            if (admin.email === adminEmail) {
                const isMatch = await bcrypt.compare(adminPassword, admin.password);
                if (!isMatch) {
                    admin.password = adminPassword; // will be hashed by adminSchema.pre('save') hook
                    await admin.save();
                    Logger.info(`🔄 Admin password updated/rotated successfully from environment configuration.`);
                } else {
                    Logger.debug(`Admin account already configured and up-to-date.`);
                }
            } else {
                Logger.info(`ℹ️ Admin is using a custom email updated via API: ${admin.email}`);
            }
        }
    } catch (error) {
        if (error.code === 11000) {
            Logger.info('ℹ️ Admin account already bootstrapped by another concurrent server instance.');
        } else {
            Logger.error('❌ Failed to bootstrap Admin account:', { error: error.message, stack: error.stack });
        }
    }
};

/**
 * Bootstraps default categories into the database if the collection is empty.
 */
const bootstrapCategories = async () => {
    try {
        const count = await Category.countDocuments();
        if (count === 0) {
            const categoriesToInsert = INITIAL_CATEGORIES.map(name => ({ name }));
            await Category.insertMany(categoriesToInsert);
            Logger.info(`🚀 Seeded ${INITIAL_CATEGORIES.length} default categories successfully.`);
        } else {
            Logger.debug('Categories already bootstrapped.');
        }
    } catch (error) {
        Logger.error('❌ Failed to bootstrap Categories:', { error: error.message, stack: error.stack });
    }
};

/**
 * Bootstraps default languages into the database if the collection is empty.
 */
const bootstrapLanguages = async () => {
    try {
        const count = await Language.countDocuments();
        if (count === 0) {
            const languagesToInsert = INITIAL_LANGUAGES.map(name => ({ name }));
            await Language.insertMany(languagesToInsert);
            Logger.info(`🚀 Seeded ${INITIAL_LANGUAGES.length} default languages successfully.`);
        } else {
            Logger.debug('Languages already bootstrapped.');
        }
    } catch (error) {
        Logger.error('❌ Failed to bootstrap Languages:', { error: error.message, stack: error.stack });
    }
};

module.exports = { bootstrapAdmin, bootstrapCategories, bootstrapLanguages };

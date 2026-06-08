const SystemSetting = require('../models/systemSetting.model');
const { redisClient } = require('../configs/redis');
const Logger = require('../utils/logger');

// L1 Local Memory Cache (prevents slamming Redis/DB under heavy load)
const localCache = {};
const CACHE_TTL_MS = 10000; // 10 seconds local cache expiration

/**
 * Fetch a setting by key with L1/L2 caching (fallback to default value)
 * @param {string} key - Setting key
 * @param {any} [defaultValue=null] - Fallback value if setting is not defined
 * @returns {Promise<any>} Setting value
 */
const getSetting = async (key, defaultValue = null) => {
    const now = Date.now();

    // 1. Check L1 Local Cache
    if (localCache[key] && (now - localCache[key].timestamp < CACHE_TTL_MS)) {
        return localCache[key].value;
    }

    const redisKey = `setting:${key}`;
    let val = null;
    let found = false;

    // 2. Check L2 Redis Cache (only if Redis connection is active and ready)
    if (redisClient && redisClient.status === 'ready') {
        try {
            const cached = await redisClient.get(redisKey);
            if (cached !== null) {
                val = JSON.parse(cached);
                found = true;
            }
        } catch (err) {
            Logger.error(`Redis get error on setting key ${redisKey}, failing open:`, err);
        }
    }

    // 3. Fallback to MongoDB
    if (!found) {
        try {
            const setting = await SystemSetting.findOne({ key }).lean();
            if (setting) {
                val = setting.value;
                found = true;

                // Cache back in Redis L2
                if (redisClient && redisClient.status === 'ready') {
                    redisClient.set(redisKey, JSON.stringify(val))
                        .catch((err) => Logger.error(`Redis set error for setting key ${redisKey}:`, err));
                }
            }
        } catch (dbErr) {
            Logger.error(`Database error fetching setting key ${key}:`, dbErr);
        }
    }

    if (!found) {
        val = defaultValue;
    }

    // Save/Update in L1 Cache
    localCache[key] = {
        value: val,
        timestamp: now,
    };

    return val;
};

/**
 * Update multiple settings in MongoDB and Redis
 * @param {Object} settingsObject - Key-value dictionary of settings to update
 * @returns {Promise<Object>} The updated settings
 */
const updateSettings = async (settingsObject) => {
    const updatedSettings = {};
    for (const [key, value] of Object.entries(settingsObject)) {
        // Upsert setting in DB
        const setting = await SystemSetting.findOneAndUpdate(
            { key },
            { value },
            { upsert: true, new: true, runValidators: true }
        ).lean();

        updatedSettings[key] = setting.value;

        // Invalidate and update L1 Cache
        localCache[key] = {
            value: setting.value,
            timestamp: Date.now(),
        };

        // Write to L2 Redis Cache
        if (redisClient && redisClient.status === 'ready') {
            const redisKey = `setting:${key}`;
            await redisClient.set(redisKey, JSON.stringify(setting.value))
                .catch((err) => Logger.error(`Redis write error updating setting key ${redisKey}:`, err));
        }
    }
    
    Logger.info('System settings updated successfully', { keysCount: Object.keys(settingsObject).length });
    return updatedSettings;
};

/**
 * Get all system settings as a dictionary
 * @returns {Promise<Object>} Key-value pairs of all settings
 */
const getAllSettings = async () => {
    const list = await SystemSetting.find({}).lean();
    const settings = {};
    list.forEach(item => {
        settings[item.key] = item.value;
    });
    return settings;
};

module.exports = {
    getSetting,
    updateSettings,
    getAllSettings,
};

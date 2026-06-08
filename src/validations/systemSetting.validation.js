const { z } = require('zod');

const updateSettings = z.object({
    body: z.object({
        maxAudioSizeMB: z.number({ invalid_type_error: 'maxAudioSizeMB must be a number' })
            .int('maxAudioSizeMB must be an integer')
            .positive('maxAudioSizeMB must be greater than zero')
            .max(500, 'maxAudioSizeMB cannot exceed 500MB')
            .optional(),
    }).strict('Unknown system settings keys provided'),
});

module.exports = {
    updateSettings,
};

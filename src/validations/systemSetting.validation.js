const { z } = require('zod');

const SUPPORTED_AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'webm', 'm4a', 'aac', 'flac'];

const updateSettings = z.object({
    body: z.object({
        maxAudioSizeMB: z.number({ invalid_type_error: 'maxAudioSizeMB must be a number' })
            .int('maxAudioSizeMB must be an integer')
            .positive('maxAudioSizeMB must be greater than zero')
            .max(500, 'maxAudioSizeMB cannot exceed 500MB')
            .optional(),
        allowedAudioFormats: z.array(
            z.enum(SUPPORTED_AUDIO_FORMATS, {
                errorMap: () => ({ message: `Each format must be one of: ${SUPPORTED_AUDIO_FORMATS.join(', ')}` }),
            })
        )
            .min(1, 'allowedAudioFormats must contain at least one format')
            .optional(),
    }).strict('Unknown system settings keys provided'),
});

module.exports = {
    updateSettings,
    SUPPORTED_AUDIO_FORMATS,
};

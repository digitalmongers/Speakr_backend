const { z } = require('zod');
const { REGEX } = require('../constants');

const createLanguage = z.object({
    body: z.object({
        name: z.string({ required_error: 'Language name is required' })
            .min(1, 'Language name cannot be empty')
            .max(50, 'Language name cannot exceed 50 characters')
            .trim(),
    }),
});

const updateLanguage = z.object({
    params: z.object({
        languageId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Language ID format'),
    }),
    body: z.object({
        name: z.string({ required_error: 'Language name is required' })
            .min(1, 'Language name cannot be empty')
            .max(50, 'Language name cannot exceed 50 characters')
            .trim(),
    }),
});

const languageIdParam = z.object({
    params: z.object({
        languageId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Language ID format'),
    }),
});

module.exports = {
    createLanguage,
    updateLanguage,
    languageIdParam,
};

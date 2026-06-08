const { z } = require('zod');
const { REGEX } = require('../constants');

const createCategory = z.object({
    body: z.object({
        name: z.string({ required_error: 'Category name is required' })
            .min(1, 'Category name cannot be empty')
            .max(50, 'Category name cannot exceed 50 characters')
            .trim(),
    }),
});

const updateCategory = z.object({
    params: z.object({
        categoryId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Category ID format'),
    }),
    body: z.object({
        name: z.string({ required_error: 'Category name is required' })
            .min(1, 'Category name cannot be empty')
            .max(50, 'Category name cannot exceed 50 characters')
            .trim(),
    }),
});

const categoryIdParam = z.object({
    params: z.object({
        categoryId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Category ID format'),
    }),
});

module.exports = {
    createCategory,
    updateCategory,
    categoryIdParam,
};

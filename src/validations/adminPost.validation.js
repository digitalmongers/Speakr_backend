const { z } = require('zod');
const { REGEX } = require('../constants');

const queryAdminPosts = {
    query: z.object({
        status: z.enum(['pending', 'approved', 'rejected']).optional(),
        category: z.string().optional(),
        language: z.string().optional(),
        creator: z.string().regex(REGEX.MONGODB_ID, 'Invalid Creator ID format').optional(),
        page: z.string().optional().transform((val) => val ? Number(val) : undefined),
        limit: z.string().optional().default('10').transform(Number),
        cursor: z.string().datetime({ message: 'Cursor must be a valid ISO 8601 date string' }).optional(),
        search: z.string().optional(),
    }),
};

const postIdParam = {
    params: z.object({
        postId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Post ID format'),
    }),
};

const getAdminPost = {
    params: z.object({
        postId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Post ID format'),
    }),
};

const updateAdminPost = {
    params: z.object({
        postId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Post ID format'),
    }),
    body: z.object({
        title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title cannot exceed 100 characters').optional(),
        category: z.string().min(1, 'Category cannot be empty').optional(),
        language: z.string().min(1, 'Language cannot be empty').optional(),
    }).refine((data) => Object.keys(data).length > 0, {
        message: 'At least one field (title, category, or language) must be provided for update',
    }),
};

module.exports = {
    queryAdminPosts,
    postIdParam,
    getAdminPost,
    updateAdminPost,
};

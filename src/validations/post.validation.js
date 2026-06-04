const { z } = require('zod');
const { REGEX } = require('../constants');
const { CATEGORIES, LANGUAGES } = require('../models/post.model');

const createPost = {
    body: z.object({
        title: z.string({ required_error: 'Title is required' })
            .min(3, 'Title must be at least 3 characters')
            .max(100, 'Title cannot exceed 100 characters'),
        description: z.string({ required_error: 'Description is required' })
            .min(10, 'Description must be at least 10 characters')
            .max(2000, 'Description cannot exceed 2000 characters'),
        audioUrl: z.string({ required_error: 'Audio URL is required' })
            .url('Invalid Audio URL format'),
        audioKey: z.string({ required_error: 'Audio storage key is required' })
            .min(1, 'Audio storage key cannot be empty'),
        thumbnailUrl: z.string({ required_error: 'Thumbnail URL is required' })
            .url('Invalid Thumbnail URL format'),
        thumbnailKey: z.string({ required_error: 'Thumbnail storage key is required' })
            .min(1, 'Thumbnail storage key cannot be empty'),
        category: z.enum(CATEGORIES, {
            errorMap: () => ({ message: `Category must be one of: ${CATEGORIES.join(', ')}` }),
        }),
        language: z.enum(LANGUAGES, {
            errorMap: () => ({ message: `Language must be one of: ${LANGUAGES.join(', ')}` }),
        }),
        isKidsContent: z.enum(['yes', 'no'], {
            required_error: 'Kids content selection (yes/no) is required',
        }).transform((val) => val === 'yes'),
        duration: z.number({ required_error: 'Audio duration is required' })
            .nonnegative('Duration cannot be negative'),
    }),
};

const queryPosts = {
    query: z.object({
        category: z.enum(CATEGORIES).optional(),
        language: z.enum(LANGUAGES).optional(),
        creator: z.string().regex(REGEX.MONGODB_ID, 'Invalid Creator ID format').optional(),
        isKidsContent: z.enum(['yes', 'no']).transform((val) => val === 'yes').optional(),
        page: z.string().optional().transform((val) => val ? Number(val) : undefined),
        limit: z.string().optional().default('10').transform(Number),
        cursor: z.string().datetime({ message: 'Cursor must be a valid ISO 8601 date string' }).optional(),
        search: z.string().optional(),
    }),
};

const getPost = {
    params: z.object({
        postId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Post ID format'),
    }),
};

module.exports = {
    createPost,
    queryPosts,
    getPost,
};

const { z } = require('zod');
const { REGEX } = require('../constants');

const addComment = {
    params: z.object({
        postId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Post ID format'),
    }),
    body: z.object({
        content: z
            .string({ required_error: 'Comment content is required' })
            .min(1, 'Comment content cannot be empty')
            .max(1000, 'Comment content cannot exceed 1000 characters'),
    }),
};

const getComments = {
    params: z.object({
        postId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Post ID format'),
    }),
    query: z
        .object({
            limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional(),
            cursor: z.string().optional(),
        })
        .optional(),
};

const deleteComment = {
    params: z.object({
        postId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Post ID format'),
        commentId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Comment ID format'),
    }),
};

module.exports = {
    addComment,
    getComments,
    deleteComment,
};

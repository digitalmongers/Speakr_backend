const { z } = require('zod');
const { REGEX } = require('../constants');

const addReply = {
    params: z.object({
        postId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Post ID format'),
        commentId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Comment ID format'),
    }),
};

const getReplies = {
    params: z.object({
        postId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Post ID format'),
        commentId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Comment ID format'),
    }),
    query: z
        .object({
            limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional(),
            cursor: z.string().optional(),
        })
        .optional(),
};

const deleteReply = {
    params: z.object({
        postId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Post ID format'),
        commentId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Comment ID format'),
        replyId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Reply ID format'),
    }),
};

module.exports = {
    addReply,
    getReplies,
    deleteReply,
};

const { z } = require('zod');
const { REGEX } = require('../constants');

const createBanner = z.object({
    body: z.object({
        redirectUrl: z.string().url('Invalid Redirect URL format').optional().or(z.literal('')),
        // Since multipart/form-data parses all text values as strings, handle coercion:
        isActive: z.union([z.boolean(), z.enum(['true', 'false'])]).optional().transform((val) => {
            if (val === 'true') return true;
            if (val === 'false') return false;
            return val;
        }),
    }),
});

const updateBanner = z.object({
    params: z.object({
        bannerId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Banner ID format'),
    }),
    body: z.object({
        redirectUrl: z.string().url('Invalid Redirect URL format').optional().or(z.literal('')),
        isActive: z.union([z.boolean(), z.enum(['true', 'false'])]).optional().transform((val) => {
            if (val === 'true') return true;
            if (val === 'false') return false;
            return val;
        }),
    }),
});

const bannerIdParam = z.object({
    params: z.object({
        bannerId: z.string().regex(REGEX.MONGODB_ID, 'Invalid Banner ID format'),
    }),
});

module.exports = {
    createBanner,
    updateBanner,
    bannerIdParam,
};

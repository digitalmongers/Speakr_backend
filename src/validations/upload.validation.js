const { z } = require('zod');

const getPresignedUrl = {
    query: z.object({
        key: z.string({ required_error: 'S3 object key is required' }).min(1, 'Key cannot be empty')
    })
};

const deleteFile = {
    body: z.object({
        key: z.string({ required_error: 'S3 object key is required for deletion' }).min(1, 'Key cannot be empty')
    })
};

module.exports = {
    getPresignedUrl,
    deleteFile
};

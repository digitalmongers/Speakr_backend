const express = require('express');
const validate = require('../../middlewares/validate.middleware');
const userAuth = require('../../middlewares/userAuth.middleware');
const optionalAuth = require('../../middlewares/optionalAuth.middleware');
const lockRequest = require('../../middlewares/lockRequest.middleware');
const { cacheMiddleware } = require('../../middlewares/cache.middleware');
const postValidation = require('../../validations/post.validation');
const commentValidation = require('../../validations/comment.validation');
const postController = require('../../controllers/post.controller');
const likeController = require('../../controllers/like.controller');
const savedPostController = require('../../controllers/savedPost.controller');
const listenController = require('../../controllers/listen.controller');
const commentController = require('../../controllers/comment.controller');
const commentReplyController = require('../../controllers/commentReply.controller');
const commentReplyValidation = require('../../validations/commentReply.validation');
const { uploadAudio, uploadPostFiles, multerErrorHandler } = require('../../middlewares/upload.middleware');

const router = express.Router();

const processPostFiles = (req, res, next) => {
    if (req.files) {
        const audioFile = req.files.audio?.[0] || req.files.file?.[0];
        const thumbnailFile = req.files.thumbnail?.[0] || req.files.image?.[0];

        if (audioFile) {
            req.body.audioUrl = audioFile.location;
            req.body.audioKey = audioFile.key;
        }
        if (thumbnailFile) {
            req.body.thumbnailUrl = thumbnailFile.location;
            req.body.thumbnailKey = thumbnailFile.key;
        }
    }

    if (req.body.duration !== undefined) {
        req.body.duration = Number(req.body.duration);
    }

    next();
};

/**
 * Endpoint: Create Post
 * Restricted to authenticated users
 */
router.post(
    '/',
    userAuth,
    lockRequest, // Block concurrency and duplicate submissions
    uploadPostFiles.fields(),
    multerErrorHandler,
    processPostFiles,
    validate(postValidation.createPost),
    postController.createPost
);

/**
 * Endpoint: Public Feed
 * Returns all approved, non-kids posts. Accessible publicly with optional auth,
 * query filtering (category, language, search) and cursor/offset pagination.
 */
router.get(
    '/feed',
    optionalAuth,
    cacheMiddleware(60),
    validate(postValidation.queryPosts),
    postController.queryPosts
);

/**
 * Endpoint: Get Current User's Posts
 * Restricted to authenticated users
 */
router.get(
    '/me',
    userAuth,
    validate(postValidation.queryPosts),
    postController.getMyPosts
);

/**
 * Endpoint: Get Current User's Saved Posts
 * Restricted to authenticated users
 */
router.get(
    '/me/saved',
    userAuth,
    validate(postValidation.queryPosts),
    savedPostController.getMySavedPosts
);

/**
 * Endpoint: Toggle Like on Post
 * Restricted to authenticated users
 */
router.post(
    '/:postId/like',
    userAuth,
    lockRequest, // Block concurrent duplicate like attempts
    validate(postValidation.getPost),
    likeController.toggleLike
);

/**
 * Endpoint: Toggle Dislike on Post
 * Restricted to authenticated users
 */
router.post(
    '/:postId/dislike',
    userAuth,
    lockRequest, // Block concurrent duplicate dislike attempts
    validate(postValidation.getPost),
    likeController.toggleDislike
);

/**
 * Endpoint: Toggle Save on Post
 * Restricted to authenticated users
 */
router.post(
    '/:postId/save',
    userAuth,
    lockRequest, // Block concurrent duplicate save attempts
    validate(postValidation.getPost),
    savedPostController.toggleSave
);

/**
 * Endpoint: Record Unique Listen on Post
 * Accessible to authenticated users and guests (optional authentication)
 */
router.post(
    '/:postId/listen',
    optionalAuth,
    lockRequest, // Block concurrent duplicate listen attempts
    validate(postValidation.getPost),
    listenController.recordListen
);

/**
 * Endpoint: Report a Post
 * Restricted to authenticated users. Uses lockRequest to prevent
 * concurrent duplicate submissions racing past the app-layer guard.
 */
router.post(
    '/:postId/report',
    userAuth,
    lockRequest, // Prevent concurrent duplicate report submissions for the same user+post
    validate(postValidation.reportPost),
    postController.reportPost
);

/**
 * Endpoint: Get Single Post Details
 * Accessible publicly
 */
router.get(
    '/:postId',
    optionalAuth,
    cacheMiddleware(60),
    validate(postValidation.getPost),
    postController.getPost
);

/**
 * Endpoint: Delete Post
 * Restricted to creator
 */
router.delete(
    '/:postId',
    userAuth,
    lockRequest, // Prevent concurrent delete attempts
    validate(postValidation.getPost),
    postController.deletePost
);

/**
 * Endpoint: Add Comment on Post
 * Restricted to authenticated users
 */
router.post(
    '/:postId/comments',
    userAuth,
    lockRequest, // Block concurrent duplicate comment submissions
    validate(commentValidation.addComment),
    commentController.addComment
);

/**
 * Endpoint: Get Comments on Post
 * Accessible publicly with optional auth hydration
 */
router.get(
    '/:postId/comments',
    optionalAuth,
    cacheMiddleware(60),
    validate(commentValidation.getComments),
    commentController.getComments
);

/**
 * Endpoint: Delete Comment on Post
 * Restricted to comment owner
 */
router.delete(
    '/:postId/comments/:commentId',
    userAuth,
    lockRequest, // Prevent concurrent duplicate delete actions
    validate(commentValidation.deleteComment),
    commentController.deleteComment
);

/**
 * Endpoint: Add Audio Reply to Comment
 * Restricted to authenticated users, uploads audio first
 */
router.post(
    '/:postId/comments/:commentId/replies',
    userAuth,
    lockRequest, // Prevent concurrent duplicate reply submissions
    uploadAudio.single('file'),
    multerErrorHandler,
    validate(commentReplyValidation.addReply),
    commentReplyController.addReply
);

/**
 * Endpoint: Get Audio Replies for Comment
 * Accessible publicly
 */
router.get(
    '/:postId/comments/:commentId/replies',
    optionalAuth,
    cacheMiddleware(60),
    validate(commentReplyValidation.getReplies),
    commentReplyController.getReplies
);

/**
 * Endpoint: Delete Audio Reply on Comment
 * Restricted to reply owner
 */
router.delete(
    '/:postId/comments/:commentId/replies/:replyId',
    userAuth,
    lockRequest, // Prevent concurrent duplicate delete actions
    validate(commentReplyValidation.deleteReply),
    commentReplyController.deleteReply
);

module.exports = router;

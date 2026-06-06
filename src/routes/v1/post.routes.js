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
const { uploadAudio, multerErrorHandler } = require('../../middlewares/upload.middleware');

const router = express.Router();

/**
 * Endpoint: Create Post
 * Restricted to authenticated users
 */
router.post(
    '/',
    userAuth,
    lockRequest, // Block concurrency and duplicate submissions
    validate(postValidation.createPost),
    postController.createPost
);

/**
 * Endpoint: Query All Public Posts
 * Accessible publicly with query filtering and pagination.
 */
router.get(
    '/',
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

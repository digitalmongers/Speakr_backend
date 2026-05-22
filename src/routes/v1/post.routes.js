const express = require('express');
const validate = require('../../middlewares/validate.middleware');
const userAuth = require('../../middlewares/userAuth.middleware');
const optionalAuth = require('../../middlewares/optionalAuth.middleware');
const lockRequest = require('../../middlewares/lockRequest.middleware');
const { cacheMiddleware } = require('../../middlewares/cache.middleware');
const postValidation = require('../../validations/post.validation');
const postController = require('../../controllers/post.controller');
const likeController = require('../../controllers/like.controller');
const savedPostController = require('../../controllers/savedPost.controller');
const listenController = require('../../controllers/listen.controller');

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

module.exports = router;

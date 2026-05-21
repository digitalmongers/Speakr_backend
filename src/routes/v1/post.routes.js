const express = require('express');
const validate = require('../../middlewares/validate.middleware');
const userAuth = require('../../middlewares/userAuth.middleware');
const lockRequest = require('../../middlewares/lockRequest.middleware');
const { cacheMiddleware } = require('../../middlewares/cache.middleware');
const postValidation = require('../../validations/post.validation');
const postController = require('../../controllers/post.controller');
const likeController = require('../../controllers/like.controller');

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
 * Endpoint: Get Single Post Details
 * Accessible publicly
 */
router.get(
    '/:postId',
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

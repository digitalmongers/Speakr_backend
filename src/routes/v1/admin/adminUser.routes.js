const express = require('express');
const validate = require('../../../middlewares/validate.middleware');
const adminAuth = require('../../../middlewares/adminAuth.middleware');
const adminValidation = require('../../../validations/admin.validation');
const adminUserController = require('../../../controllers/admin/adminUser.controller');

const router = express.Router();

/**
 * @route GET /api/v1/admin/users
 * @desc List all verified users
 * @access Protected (Admin)
 */
router.get('/', adminAuth, validate(adminValidation.listUsers), adminUserController.getVerifiedUsers);

/**
 * @route POST /api/v1/admin/users/:userId/toggle-block
 * @desc Toggle user block status and invalidate session if blocked
 * @access Protected (Admin)
 */
router.post('/:userId/toggle-block', adminAuth, validate(adminValidation.toggleBlock), adminUserController.toggleBlock);

/**
 * @route DELETE /api/v1/admin/users/:userId
 * @desc Delete user account and cascade delete all associated posts, comments, reactions
 * @access Protected (Admin)
 */
router.delete('/:userId', adminAuth, validate(adminValidation.deleteUser), adminUserController.deleteUser);

/**
 * @route GET /api/v1/admin/users/:userId
 * @desc Get detailed profile of a specific user
 * @access Protected (Admin)
 */
router.get('/:userId', adminAuth, validate(adminValidation.getUserDetails), adminUserController.getUserDetails);

/**
 * @route GET /api/v1/admin/users/:userId/posts
 * @desc Get posts of a specific user with cursor-based pagination
 * @access Protected (Admin)
 */
router.get('/:userId/posts', adminAuth, validate(adminValidation.getUserPosts), adminUserController.getUserPosts);

module.exports = router;

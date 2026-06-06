const express = require('express');
const validate = require('../../../middlewares/validate.middleware');
const lockRequest = require('../../../middlewares/lockRequest.middleware');
const adminAuth = require('../../../middlewares/adminAuth.middleware');
const { strictLimiter } = require('../../../middlewares/security.middleware');
const adminValidation = require('../../../validations/admin.validation');
const adminAuthController = require('../../../controllers/admin/adminAuth.controller');

const router = express.Router();

/**
 * @route POST /api/v1/admin/auth/login
 * @desc Login system admin from env credentials
 * @access Public
 */
router.post('/login', strictLimiter, lockRequest, validate(adminValidation.login), adminAuthController.login);

/**
 * @route POST /api/v1/admin/auth/logout
 * @desc Logout system admin and invalidate current token session
 * @access Protected (Admin)
 */
router.post('/logout', lockRequest, adminAuth, adminAuthController.logout);

/**
 * @route GET /api/v1/admin/auth/me
 * @desc Retrieve current logged-in admin's profile
 * @access Protected (Admin)
 */
router.get('/me', adminAuth, adminAuthController.getProfile);

/**
 * @route PATCH /api/v1/admin/auth/me
 * @desc Update logged-in admin's profile details & clean up old files
 * @access Protected (Admin)
 */
router.patch('/me', adminAuth, lockRequest, validate(adminValidation.updateProfile), adminAuthController.updateProfile);

/**
 * @route POST /api/v1/admin/auth/change-password
 * @desc Change password of authenticated admin & invalidate active sessions
 * @access Protected (Admin)
 */
router.post('/change-password', adminAuth, lockRequest, validate(adminValidation.changePassword), adminAuthController.changePassword);

/**
 * @route POST /api/v1/admin/auth/forgot-password
 * @desc Request a password reset OTP code (Email enumeration protected)
 * @access Public
 */
router.post('/forgot-password', strictLimiter, lockRequest, validate(adminValidation.forgotPassword), adminAuthController.forgotPassword);

/**
 * @route POST /api/v1/admin/auth/verify-otp
 * @desc Verify OTP and issue a short-lived reset token
 * @access Public
 */
router.post('/verify-otp', strictLimiter, lockRequest, validate(adminValidation.verifyOtp), adminAuthController.verifyOtp);

/**
 * @route POST /api/v1/admin/auth/reset-password
 * @desc Reset admin password using temporary reset token and invalidate all active sessions
 * @access Public
 */
router.post('/reset-password', strictLimiter, lockRequest, validate(adminValidation.resetPassword), adminAuthController.resetPassword);

module.exports = router;

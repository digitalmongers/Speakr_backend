const express = require('express');
const validate = require('../../middlewares/validate.middleware');
const lockRequest = require('../../middlewares/lockRequest.middleware');
const userAuth = require('../../middlewares/userAuth.middleware');
const { strictLimiter } = require('../../middlewares/security.middleware');
const authValidation = require('../../validations/auth.validation');
const authController = require('../../controllers/auth.controller');

const router = express.Router();

/**
 * @route POST /api/v1/auth/signup
 * @desc Create a new user account
 * @access Public
 */
router.post('/signup', strictLimiter, lockRequest, validate(authValidation.signup), authController.signup);

/**
 * @route POST /api/v1/auth/login
 * @desc Login with email/username and password
 * @access Public
 */
router.post('/login', strictLimiter, lockRequest, validate(authValidation.login), authController.login);

router.post('/logout', lockRequest, userAuth, validate(authValidation.logout), authController.logout);

/**
 * @route POST /api/v1/auth/verify-otp
 * @desc Verify OTP and complete account creation
 * @access Public
 */
router.post('/verify-otp', strictLimiter, lockRequest, validate(authValidation.verifyOtp), authController.verifyOtp);

module.exports = router;

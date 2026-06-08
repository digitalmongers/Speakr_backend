const express = require('express');
const settingController = require('../../controllers/setting.controller');

const router = express.Router();

/**
 * Route: GET /api/v1/settings
 * Public endpoint to fetch app configurations (like upload size limits)
 */
router.get('/', settingController.getPublicSettings);

module.exports = router;

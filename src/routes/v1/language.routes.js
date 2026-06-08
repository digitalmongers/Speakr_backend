const express = require('express');
const { cacheMiddleware } = require('../../middlewares/cache.middleware');
const languageController = require('../../controllers/language.controller');

const router = express.Router();

router.get('/', cacheMiddleware(300), languageController.getActiveLanguages);

module.exports = router;

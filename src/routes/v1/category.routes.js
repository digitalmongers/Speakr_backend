const express = require('express');
const { cacheMiddleware } = require('../../middlewares/cache.middleware');
const categoryController = require('../../controllers/category.controller');

const router = express.Router();

router.get('/', cacheMiddleware(300), categoryController.getActiveCategories);

module.exports = router;

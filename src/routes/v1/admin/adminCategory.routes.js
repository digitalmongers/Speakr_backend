const express = require('express');
const validate = require('../../../middlewares/validate.middleware');
const adminAuth = require('../../../middlewares/adminAuth.middleware');
const lockRequest = require('../../../middlewares/lockRequest.middleware');
const categoryValidation = require('../../../validations/category.validation');
const adminCategoryController = require('../../../controllers/admin/adminCategory.controller');

const router = express.Router();

router.route('/')
    .post(adminAuth, lockRequest, validate(categoryValidation.createCategory), adminCategoryController.createCategory)
    .get(adminAuth, adminCategoryController.getAllCategories);

router.route('/:categoryId')
    .patch(adminAuth, lockRequest, validate(categoryValidation.updateCategory), adminCategoryController.updateCategory)
    .delete(adminAuth, lockRequest, validate(categoryValidation.categoryIdParam), adminCategoryController.deleteCategory);

router.post('/:categoryId/toggle-status', adminAuth, lockRequest, validate(categoryValidation.categoryIdParam), adminCategoryController.toggleCategoryStatus);

module.exports = router;

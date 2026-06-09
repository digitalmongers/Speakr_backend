const express = require('express');
const validate = require('../../../middlewares/validate.middleware');
const adminAuth = require('../../../middlewares/adminAuth.middleware');
const lockRequest = require('../../../middlewares/lockRequest.middleware');
const adminPostValidation = require('../../../validations/adminPost.validation');
const adminPostController = require('../../../controllers/admin/adminPost.controller');

const router = express.Router();

router.route('/')
    .get(adminAuth, validate(adminPostValidation.queryAdminPosts), adminPostController.queryAdminPosts);

router.route('/general')
    .get(adminAuth, validate(adminPostValidation.queryAdminPosts), adminPostController.queryAdminGeneralPosts);

router.route('/:postId')
    .get(adminAuth, validate(adminPostValidation.getAdminPost), adminPostController.getAdminPost)
    .patch(adminAuth, lockRequest, validate(adminPostValidation.updateAdminPost), adminPostController.updateAdminPost)
    .delete(adminAuth, lockRequest, validate(adminPostValidation.postIdParam), adminPostController.deleteAdminPost);

router.post('/:postId/approve', adminAuth, lockRequest, validate(adminPostValidation.postIdParam), adminPostController.approvePost);
router.post('/:postId/reject', adminAuth, lockRequest, validate(adminPostValidation.postIdParam), adminPostController.rejectPost);

module.exports = router;

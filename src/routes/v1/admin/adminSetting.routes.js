const express = require('express');
const validate = require('../../../middlewares/validate.middleware');
const adminAuth = require('../../../middlewares/adminAuth.middleware');
const lockRequest = require('../../../middlewares/lockRequest.middleware');
const systemSettingValidation = require('../../../validations/systemSetting.validation');
const adminSettingController = require('../../../controllers/admin/adminSetting.controller');

const router = express.Router();

router.route('/')
    .get(adminAuth, adminSettingController.getSettings)
    .patch(adminAuth, lockRequest, validate(systemSettingValidation.updateSettings), adminSettingController.updateSettings);

module.exports = router;

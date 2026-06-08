const express = require('express');
const validate = require('../../../middlewares/validate.middleware');
const adminAuth = require('../../../middlewares/adminAuth.middleware');
const lockRequest = require('../../../middlewares/lockRequest.middleware');
const languageValidation = require('../../../validations/language.validation');
const adminLanguageController = require('../../../controllers/admin/adminLanguage.controller');

const router = express.Router();

router.route('/')
    .post(adminAuth, lockRequest, validate(languageValidation.createLanguage), adminLanguageController.createLanguage)
    .get(adminAuth, adminLanguageController.getAllLanguages);

router.route('/:languageId')
    .patch(adminAuth, lockRequest, validate(languageValidation.updateLanguage), adminLanguageController.updateLanguage)
    .delete(adminAuth, lockRequest, validate(languageValidation.languageIdParam), adminLanguageController.deleteLanguage);

router.post('/:languageId/toggle-status', adminAuth, lockRequest, validate(languageValidation.languageIdParam), adminLanguageController.toggleLanguageStatus);

module.exports = router;

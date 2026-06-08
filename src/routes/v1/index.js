const express = require('express');
const uploadRoutes = require('./upload.routes');
const authRoutes = require('./auth.routes');
const postRoutes = require('./post.routes');
const userRoutes = require("./user.routes");
const adminAuthRoutes = require('./admin/adminAuth.routes');
const adminUserRoutes = require('./admin/adminUser.routes');
const adminCategoryRoutes = require('./admin/adminCategory.routes');
const categoryRoutes = require('./category.routes');
const adminLanguageRoutes = require('./admin/adminLanguage.routes');
const languageRoutes = require('./language.routes');
const adminSettingRoutes = require('./admin/adminSetting.routes');
const settingRoutes = require('./setting.routes');
const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date() });
});
router.use("/users", userRoutes);
router.use('/upload', uploadRoutes);
router.use('/auth', authRoutes);
router.use('/posts', postRoutes);
router.use('/categories', categoryRoutes);
router.use('/languages', languageRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/users', adminUserRoutes);
router.use('/admin/categories', adminCategoryRoutes);
router.use('/admin/languages', adminLanguageRoutes);
router.use('/admin/settings', adminSettingRoutes);
router.use('/settings', settingRoutes);

module.exports = router;

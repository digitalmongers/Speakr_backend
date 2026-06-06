const express = require('express');
const uploadRoutes = require('./upload.routes');
const authRoutes = require('./auth.routes');
const postRoutes = require('./post.routes');
const userRoutes = require("./user.routes");
const adminAuthRoutes = require('./admin/adminAuth.routes');
const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date() });
});
router.use("/users", userRoutes);
router.use('/upload', uploadRoutes);
router.use('/auth', authRoutes);
router.use('/posts', postRoutes);
router.use('/admin/auth', adminAuthRoutes);

module.exports = router;

const express = require('express');
const uploadRoutes = require('./upload.routes');
const authRoutes = require('./auth.routes');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date() });
});

router.use('/upload', uploadRoutes);
router.use('/auth', authRoutes);

module.exports = router;

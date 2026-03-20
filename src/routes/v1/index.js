const express = require('express');
const uploadRoutes = require('./upload.routes');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date() });
});

router.use('/upload', uploadRoutes);

module.exports = router;

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');

// Mount routes
router.use('/auth', authRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: '知墨学习平台 API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      health: '/health'
    }
  });
});

module.exports = router;
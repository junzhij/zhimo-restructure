const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const documentRoutes = require('./documents');

// Mount routes
router.use('/auth', authRoutes);
router.use('/documents', documentRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: '知墨学习平台 API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      documents: '/api/documents',
      health: '/health'
    }
  });
});

module.exports = router;
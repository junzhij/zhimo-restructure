const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const databaseConnection = require('./utils/database');
const { initializeDatabase, getDatabaseStats } = require('./utils/initDatabase');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = databaseConnection.isHealthy();
    let dbStats = {};
    
    // Only get database stats if connected and not in test mode
    if (dbHealth && process.env.NODE_ENV !== 'test') {
      try {
        dbStats = await getDatabaseStats();
      } catch (error) {
        console.warn('Failed to get database stats:', error.message);
        dbStats = { error: 'Stats unavailable' };
      }
    }
    
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: dbHealth,
        stats: dbStats,
        info: databaseConnection.getConnectionInfo()
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'Service Unavailable',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Import routes
const authRoutes = require('./routes/auth');

// API routes
app.use('/api/auth', authRoutes);

// Catch-all for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

// 启动服务器函数
async function startServer() {
  try {
    // 只在非测试环境初始化数据库
    if (process.env.NODE_ENV !== 'test') {
      await initializeDatabase();
    }
    
    // 启动服务器
    app.listen(PORT, () => {
      console.log(`🚀 ZhiMo Study Platform server running on port ${PORT}`);
      console.log(`📊 Health check available at http://localhost:${PORT}/health`);
      console.log(`🗄️ Database: ${databaseConnection.isHealthy() ? 'Connected' : 'Disconnected'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭处理
process.on('SIGTERM', async () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');
  await databaseConnection.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 Received SIGINT, shutting down gracefully...');
  await databaseConnection.disconnect();
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

module.exports = app;
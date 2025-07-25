const mongoose = require('mongoose');
const config = require('./config');

class DatabaseConnection {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  /**
   * 连接到MongoDB数据库
   * @returns {Promise<mongoose.Connection>}
   */
  async connect() {
    try {
      if (this.isConnected) {
        return this.connection;
      }

      const mongoUri = process.env.NODE_ENV === 'test' 
        ? config.database.testUri 
        : config.database.uri;

      // 连接配置选项
      const options = {
        maxPoolSize: 10, // 连接池最大连接数
        minPoolSize: 2, // 连接池最小连接数
        serverSelectionTimeoutMS: 5000, // 服务器选择超时
        socketTimeoutMS: 45000, // Socket超时
        connectTimeoutMS: 10000, // 连接超时
        heartbeatFrequencyMS: 10000, // 心跳频率
        maxIdleTimeMS: 30000, // 最大空闲时间
        bufferCommands: false, // 禁用命令缓冲
      };

      this.connection = await mongoose.connect(mongoUri, options);
      this.isConnected = true;

      console.log(`✅ MongoDB connected successfully to: ${mongoUri}`);

      // 监听连接事件
      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
        this.isConnected = true;
      });

      return this.connection;
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * 断开数据库连接
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.connection.close();
        this.isConnected = false;
        console.log('✅ MongoDB disconnected successfully');
      }
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  /**
   * 检查数据库连接状态
   * @returns {boolean}
   */
  isHealthy() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * 获取数据库连接状态信息
   * @returns {Object}
   */
  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }
}

// 创建单例实例
const databaseConnection = new DatabaseConnection();

module.exports = databaseConnection;
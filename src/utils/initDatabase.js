const databaseConnection = require('./database');
const models = require('../models');

/**
 * 初始化数据库索引和配置
 */
async function initializeDatabase() {
  try {
    console.log('🔧 开始初始化数据库...');
    
    // 确保数据库连接
    await databaseConnection.connect();
    
    // 创建索引
    await createIndexes();
    
    // 验证模型
    await validateModels();
    
    console.log('✅ 数据库初始化完成');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}

/**
 * 创建数据库索引
 */
async function createIndexes() {
  console.log('📊 创建数据库索引...');
  
  try {
    // User 模型索引
    await models.User.createIndexes();
    console.log('  ✓ User 索引创建完成');
    
    // Document 模型索引
    await models.Document.createIndexes();
    console.log('  ✓ Document 索引创建完成');
    
    // Summary 模型索引
    await models.Summary.createIndexes();
    console.log('  ✓ Summary 索引创建完成');
    
    // Concept 模型索引
    await models.Concept.createIndexes();
    console.log('  ✓ Concept 索引创建完成');
    
    // MindMap 模型索引
    await models.MindMap.createIndexes();
    console.log('  ✓ MindMap 索引创建完成');
    
    // Exercise 模型索引
    await models.Exercise.createIndexes();
    console.log('  ✓ Exercise 索引创建完成');
    
    // ExerciseRecord 模型索引
    await models.ExerciseRecord.createIndexes();
    console.log('  ✓ ExerciseRecord 索引创建完成');
    
  } catch (error) {
    console.error('❌ 索引创建失败:', error);
    throw error;
  }
}

/**
 * 验证模型定义
 */
async function validateModels() {
  console.log('🔍 验证模型定义...');
  
  const modelNames = Object.keys(models);
  
  for (const modelName of modelNames) {
    const Model = models[modelName];
    
    try {
      // 验证模型是否正确定义
      const schema = Model.schema;
      const paths = schema.paths;
      
      console.log(`  ✓ ${modelName} 模型验证通过 (${Object.keys(paths).length} 个字段)`);
      
      // 检查必需字段
      const requiredFields = Object.keys(paths).filter(path => 
        schema.paths[path].isRequired
      );
      
      if (requiredFields.length > 0) {
        console.log(`    - 必需字段: ${requiredFields.join(', ')}`);
      }
      
    } catch (error) {
      console.error(`❌ ${modelName} 模型验证失败:`, error);
      throw error;
    }
  }
}

/**
 * 获取数据库统计信息
 */
async function getDatabaseStats() {
  try {
    const stats = {};
    const modelNames = Object.keys(models);
    
    for (const modelName of modelNames) {
      const Model = models[modelName];
      const count = await Model.countDocuments();
      stats[modelName] = count;
    }
    
    return stats;
  } catch (error) {
    console.error('获取数据库统计失败:', error);
    return {};
  }
}

/**
 * 清理测试数据（仅在测试环境使用）
 */
async function cleanTestData() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('清理数据只能在测试环境中执行');
  }
  
  console.log('🧹 清理测试数据...');
  
  const modelNames = Object.keys(models);
  
  for (const modelName of modelNames) {
    const Model = models[modelName];
    await Model.deleteMany({});
    console.log(`  ✓ ${modelName} 数据清理完成`);
  }
}

/**
 * 创建默认数据（开发环境）
 */
async function createDefaultData() {
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️ 生产环境跳过默认数据创建');
    return;
  }
  
  console.log('📝 创建默认数据...');
  
  try {
    // 检查是否已有用户数据
    const userCount = await models.User.countDocuments();
    if (userCount > 0) {
      console.log('  ℹ️ 已存在用户数据，跳过默认数据创建');
      return;
    }
    
    // 创建测试用户
    const testUser = new models.User({
      username: 'testuser',
      email: 'test@zhimo.com',
      passwordHash: 'test123456',
      profile: {
        displayName: '测试用户'
      }
    });
    
    await testUser.save();
    console.log('  ✓ 测试用户创建完成');
    
  } catch (error) {
    console.error('❌ 默认数据创建失败:', error);
    // 不抛出错误，允许应用继续启动
  }
}

module.exports = {
  initializeDatabase,
  createIndexes,
  validateModels,
  getDatabaseStats,
  cleanTestData,
  createDefaultData
};
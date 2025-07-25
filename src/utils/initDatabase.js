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
    await createModelIndexes('User', models.User);
    
    // Document 模型索引 (特殊处理文本索引冲突)
    await createDocumentIndexes();
    
    // Summary 模型索引
    await createModelIndexes('Summary', models.Summary);
    
    // Concept 模型索引
    await createModelIndexes('Concept', models.Concept);
    
    // MindMap 模型索引
    await createModelIndexes('MindMap', models.MindMap);
    
    // Exercise 模型索引
    await createModelIndexes('Exercise', models.Exercise);
    
    // ExerciseRecord 模型索引
    await createModelIndexes('ExerciseRecord', models.ExerciseRecord);
    
  } catch (error) {
    console.error('❌ 索引创建失败:', error);
    throw error;
  }
}

/**
 * 创建单个模型的索引
 */
async function createModelIndexes(modelName, Model) {
  try {
    await Model.createIndexes();
    console.log(`  ✓ ${modelName} 索引创建完成`);
  } catch (error) {
    if (error.code === 85) { // IndexOptionsConflict
      console.log(`  ⚠️ ${modelName} 索引冲突，尝试修复...`);
      await handleIndexConflict(modelName, Model);
    } else {
      throw error;
    }
  }
}

/**
 * 特殊处理Document模型的索引创建
 */
async function createDocumentIndexes() {
  try {
    await models.Document.createIndexes();
    console.log('  ✓ Document 索引创建完成');
  } catch (error) {
    if (error.code === 85 && error.errmsg.includes('document_text_search')) {
      console.log('  ⚠️ Document 文本索引冲突，尝试修复...');
      await fixDocumentTextIndex();
    } else {
      throw error;
    }
  }
}

/**
 * 修复Document文本索引冲突
 */
async function fixDocumentTextIndex() {
  const mongoose = require('mongoose');
  const collection = mongoose.connection.db.collection('documents');
  
  try {
    // 获取现有索引
    const indexes = await collection.listIndexes().toArray();
    
    // 查找冲突的文本索引
    const conflictingIndexes = indexes.filter(index => 
      index.key && index.key._fts === 'text' && index.name !== 'document_text_search'
    );
    
    // 删除冲突的索引
    for (const index of conflictingIndexes) {
      console.log(`    删除冲突索引: ${index.name}`);
      await collection.dropIndex(index.name);
    }
    
    // 重新创建Document索引
    await models.Document.createIndexes();
    console.log('  ✓ Document 索引修复完成');
    
  } catch (error) {
    console.error('  ❌ Document 索引修复失败:', error);
    throw error;
  }
}

/**
 * 处理一般的索引冲突
 */
async function handleIndexConflict(modelName, Model) {
  try {
    // 对于一般的索引冲突，尝试重新创建
    await Model.createIndexes();
    console.log(`  ✓ ${modelName} 索引冲突已解决`);
  } catch (retryError) {
    console.error(`  ❌ ${modelName} 索引冲突无法解决:`, retryError.message);
    // 不抛出错误，允许应用继续启动
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
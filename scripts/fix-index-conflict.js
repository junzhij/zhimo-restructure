#!/usr/bin/env node

/**
 * 修复MongoDB索引冲突的脚本
 * 删除冲突的旧索引，重新创建新索引
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Document = require('../src/models/Document');

async function fixIndexConflict() {
  try {
    console.log('🔧 开始修复索引冲突...');
    
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zhimo_study_platform');
    console.log('✅ 数据库连接成功');
    
    // 获取Document集合
    const collection = mongoose.connection.db.collection('documents');
    
    // 列出现有索引
    console.log('📋 当前索引列表:');
    const indexes = await collection.listIndexes().toArray();
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      if (index.weights) {
        console.log(`    权重: ${JSON.stringify(index.weights)}`);
      }
    });
    
    // 查找冲突的文本索引
    const conflictingIndexes = indexes.filter(index => 
      index.key && index.key._fts === 'text' && index.name !== 'document_text_search'
    );
    
    if (conflictingIndexes.length > 0) {
      console.log('\n🗑️ 删除冲突的索引:');
      for (const index of conflictingIndexes) {
        console.log(`  删除索引: ${index.name}`);
        await collection.dropIndex(index.name);
        console.log(`  ✅ 索引 ${index.name} 删除成功`);
      }
    } else {
      console.log('\n✅ 没有发现冲突的索引');
    }
    
    // 检查是否存在目标索引
    const targetIndex = indexes.find(index => index.name === 'document_text_search');
    if (!targetIndex) {
      console.log('\n📝 创建新的文本搜索索引...');
      
      // 手动创建索引
      await collection.createIndex({
        title: 'text',
        markdownContent: 'text',
        restructuredContent: 'text',
        tags: 'text'
      }, {
        weights: {
          title: 10,
          tags: 5,
          restructuredContent: 3,
          markdownContent: 1
        },
        name: 'document_text_search',
        background: true
      });
      
      console.log('✅ 新索引创建成功');
    } else {
      console.log('\n✅ 目标索引已存在');
    }
    
    // 验证索引
    console.log('\n🔍 验证最终索引状态:');
    const finalIndexes = await collection.listIndexes().toArray();
    const textIndexes = finalIndexes.filter(index => index.key && index.key._fts === 'text');
    
    textIndexes.forEach(index => {
      console.log(`  ✓ ${index.name}:`);
      console.log(`    字段: ${Object.keys(index.weights || {}).join(', ')}`);
      console.log(`    权重: ${JSON.stringify(index.weights || {})}`);
    });
    
    console.log('\n🎉 索引冲突修复完成!');
    
  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ 数据库连接已关闭');
  }
}

// 运行修复
if (require.main === module) {
  fixIndexConflict();
}

module.exports = fixIndexConflict;
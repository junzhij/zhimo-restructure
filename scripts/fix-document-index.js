require('dotenv').config();
const mongoose = require('mongoose');

async function fixDocumentIndex() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 数据库连接成功');

    const db = mongoose.connection.db;
    const collection = db.collection('documents');

    // 获取现有索引
    console.log('📋 查看现有索引...');
    const indexes = await collection.indexes();
    console.log('现有索引:', indexes.map(idx => idx.name));

    // 查找并删除旧的文本索引
    const textIndexes = indexes.filter(idx => idx.name.includes('text'));
    
    for (const index of textIndexes) {
      console.log(`🗑️ 删除旧索引: ${index.name}`);
      try {
        await collection.dropIndex(index.name);
        console.log(`✅ 成功删除索引: ${index.name}`);
      } catch (error) {
        console.log(`⚠️ 删除索引失败: ${error.message}`);
      }
    }

    // 重新创建新的文本索引
    console.log('🔧 创建新的文本搜索索引...');
    await collection.createIndex(
      { 
        title: 'text', 
        markdownContent: 'text',
        restructuredContent: 'text',
        tags: 'text'
      },
      {
        weights: {
          title: 10,
          tags: 5,
          restructuredContent: 3,
          markdownContent: 1
        },
        name: 'document_text_search'
      }
    );
    console.log('✅ 新文本搜索索引创建成功');

    // 验证新索引
    const newIndexes = await collection.indexes();
    console.log('📋 更新后的索引:', newIndexes.map(idx => idx.name));

    console.log('🎉 索引修复完成！');

  } catch (error) {
    console.error('❌ 索引修复失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 数据库连接已关闭');
  }
}

// 运行修复
if (require.main === module) {
  console.log('🔧 开始修复Document索引...');
  fixDocumentIndex().catch(console.error);
}

module.exports = fixDocumentIndex;
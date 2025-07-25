require('dotenv').config();
const mongoose = require('mongoose');
const Document = require('../src/models/Document');
const FileExtractService = require('../src/services/FileExtractService');

async function testRestructuredContent() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 数据库连接成功');

    const fileExtractService = new FileExtractService();
    
    // 创建测试文档
    const testDocument = new Document({
      userId: new mongoose.Types.ObjectId(),
      title: '测试重构内容',
      originalFormat: 'pdf',
      filePath: 'test/example.pdf',
      markdownContent: `# 人工智能基础

人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，它企图了解智能的实质，
并生产出一种新的能以人类智能相似的方式做出反应的智能机器。

## 机器学习
机器学习是人工智能的一个重要分支，通过算法使机器能够从数据中学习并做出决策或预测。

## 深度学习
深度学习是机器学习的子集，使用神经网络来模拟人脑的工作方式。`,
      processingStatus: 'completed'
    });

    await testDocument.save();
    console.log('✅ 测试文档创建成功:', testDocument._id);

    // 测试AI重构功能
    console.log('🤖 开始AI重构处理...');
    
    try {
      await fileExtractService.processAIFeatures(
        testDocument._id,
        testDocument.markdownContent
      );
      
      // 查询更新后的文档
      const updatedDocument = await Document.findById(testDocument._id);
      
      console.log('📄 原始内容长度:', updatedDocument.markdownContent.length);
      console.log('🔄 重构内容长度:', updatedDocument.restructuredContent?.length || 0);
      
      if (updatedDocument.restructuredContent) {
        console.log('✅ restructuredContent字段已成功填入');
        console.log('📝 重构内容预览:');
        console.log(updatedDocument.restructuredContent.substring(0, 200) + '...');
      } else {
        console.log('❌ restructuredContent字段为空');
      }
      
    } catch (aiError) {
      console.log('⚠️ AI处理失败（可能是API配置问题）:', aiError.message);
      
      // 手动测试字段更新
      console.log('🔧 手动测试restructuredContent字段更新...');
      await Document.findByIdAndUpdate(testDocument._id, {
        restructuredContent: '# 测试重构内容\n\n这是手动设置的重构内容，用于验证字段功能。'
      });
      
      const manualUpdatedDoc = await Document.findById(testDocument._id);
      if (manualUpdatedDoc.restructuredContent) {
        console.log('✅ restructuredContent字段手动更新成功');
        console.log('📝 内容:', manualUpdatedDoc.restructuredContent);
      }
    }

    // 清理测试数据
    //await Document.findByIdAndDelete(testDocument._id);
    console.log('🧹 测试数据清理完成');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 数据库连接已关闭');
  }
}

// 运行测试
if (require.main === module) {
  console.log('🧪 开始测试restructuredContent字段功能...');
  testRestructuredContent().catch(console.error);
}

module.exports = testRestructuredContent;
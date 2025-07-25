require('dotenv').config();
const mongoose = require('mongoose');
const DocumentService = require('../src/services/DocumentService');
const FileExtractService = require('../src/services/FileExtractService');
const fs = require('fs');
const path = require('path');

async function testDocumentFlow() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 数据库连接成功');

    const documentService = new DocumentService();
    const fileExtractService = new FileExtractService();

    // 模拟用户ID
    const userId = new mongoose.Types.ObjectId();

    // 读取测试PDF文件
    const testFilePath = path.join(__dirname, '../tests/example.pdf');
    if (!fs.existsSync(testFilePath)) {
      console.log('❌ 测试文件不存在:', testFilePath);
      return;
    }

    const fileBuffer = fs.readFileSync(testFilePath);
    const mockFile = {
      originalname: 'test-document.pdf',
      mimetype: 'application/pdf',
      size: fileBuffer.length,
      buffer: fileBuffer
    };

    console.log('📄 开始测试文档处理流程...');

    // 1. 测试文档上传
    console.log('1️⃣ 上传文档到S3和MongoDB...');
    const uploadResult = await documentService.uploadDocument(mockFile, userId, {
      title: '测试文档',
      tags: ['测试', 'PDF']
    });
    console.log('✅ 文档上传成功:', uploadResult.document._id);

    // 2. 测试文件提取和AI处理
    console.log('2️⃣ 开始文件提取和AI处理...');
    try {
      const markdownContent = await fileExtractService.extractToMarkdown(
        uploadResult.document._id,
        fileBuffer,
        mockFile.mimetype
      );
      console.log('✅ 文件提取成功，内容长度:', markdownContent.length);
    } catch (error) {
      console.log('⚠️ 文件提取失败（可能是AI服务未配置）:', error.message);
    }

    // 3. 测试文档查询
    console.log('3️⃣ 测试文档查询...');
    const document = await documentService.getDocument(uploadResult.document._id, userId);
    console.log('✅ 文档查询成功:', document.title);

    // 4. 测试文档列表
    console.log('4️⃣ 测试文档列表...');
    const documentList = await documentService.listUserDocuments(userId);
    console.log('✅ 文档列表查询成功，共', documentList.documents.length, '个文档');

    // 5. 测试文档更新
    console.log('5️⃣ 测试文档更新...');
    const updatedDocument = await documentService.updateDocument(
      uploadResult.document._id,
      userId,
      { title: '更新后的测试文档' }
    );
    console.log('✅ 文档更新成功:', updatedDocument.title);

    // 6. 测试软删除
    console.log('6️⃣ 测试文档软删除...');
    const deleteResult = await documentService.deleteDocument(uploadResult.document._id, userId);
    console.log('✅ 文档软删除成功:', deleteResult.message);

    console.log('🎉 所有测试完成！');

    // 等待一段时间让异步处理完成
    console.log('⏳ 等待异步处理完成...');
    await new Promise(resolve => setTimeout(resolve, 3000));

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 数据库连接已关闭');
  }
}

// 运行测试
if (require.main === module) {
  testDocumentFlow().catch(console.error);
}

module.exports = testDocumentFlow;
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { initializeDatabase, cleanTestData } = require('../src/utils/initDatabase');
const databaseConnection = require('../src/utils/database');

// 启动服务器
const app = require('../src/app');
let server;

describe('PDF Upload and Transcription with Axios', () => {
  const baseURL = 'http://localhost:3001';
  let authToken;
  let testUser;

  beforeAll(async () => {
    // 初始化数据库
    await initializeDatabase();
    
    // 启动服务器
    server = app.listen(3001, () => {
      console.log('Test server running on port 3001');
    });
    
    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  // 注释掉数据清理，保留数据
  // afterEach(async () => {
  //   await cleanTestData();
  // });

  afterAll(async () => {
    // 关闭服务器
    if (server) {
      server.close();
    }
    await databaseConnection.disconnect();
  });

  describe('Complete PDF Processing Workflow', () => {
    beforeEach(async () => {
      // 注册用户并获取token
      const registerData = {
        username: 'pdfuser',
        email: 'pdf@example.com',
        password: 'password123'
      };

      const registerResponse = await axios.post(`${baseURL}/api/auth/register`, registerData);
      
      expect(registerResponse.status).toBe(201);
      expect(registerResponse.data.success).toBe(true);
      
      authToken = registerResponse.data.data.token;
      testUser = registerResponse.data.data.user;
      
      console.log('✅ 用户注册成功:', testUser.username);
    });

    it('should upload PDF, process it, and retrieve markdown content', async () => {
      console.log('\n🔍 开始PDF上传和转写测试...');
      
      // 1. 准备PDF文件
      const pdfPath = path.join(__dirname, 'example.pdf');
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfStats = fs.statSync(pdfPath);
      
      console.log(`📄 PDF文件信息: ${pdfStats.size} bytes`);

      // 2. 创建FormData并上传PDF
      const formData = new FormData();
      formData.append('document', pdfBuffer, {
        filename: 'test-document.pdf',
        contentType: 'application/pdf'
      });
      formData.append('title', 'Facebook Haystack论文');

      console.log('📤 开始上传PDF文件...');
      
      const uploadResponse = await axios.post(
        `${baseURL}/api/documents/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // 3. 验证上传响应
      expect(uploadResponse.status).toBe(201);
      expect(uploadResponse.data.success).toBe(true);
      expect(uploadResponse.data.data.document.originalFormat).toBe('pdf');
      expect(uploadResponse.data.data.document.title).toBe('Facebook Haystack论文');
      
      const documentId = uploadResponse.data.data.document._id;
      const processingStatus = uploadResponse.data.data.document.processingStatus;
      
      console.log(`✅ PDF上传成功! 文档ID: ${documentId}`);
      console.log(`📊 处理状态: ${processingStatus}`);

      // 4. 检查处理状态（应该是completed或failed）
      expect(['completed', 'failed']).toContain(processingStatus);

      if (processingStatus === 'completed') {
        console.log('🎉 PDF处理成功，开始获取Markdown内容...');
        
        // 5. 获取Markdown内容
        const markdownResponse = await axios.get(
          `${baseURL}/api/documents/${documentId}/markdown`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        // 6. 验证Markdown响应
        expect(markdownResponse.status).toBe(200);
        expect(markdownResponse.data.success).toBe(true);
        expect(markdownResponse.data.data.markdownContent).toBeTruthy();
        expect(markdownResponse.data.data.wordCount).toBeGreaterThan(0);
        expect(markdownResponse.data.data.processingStatus).toBe('completed');

        const markdownContent = markdownResponse.data.data.markdownContent;
        const wordCount = markdownResponse.data.data.wordCount;

        console.log(`📝 Markdown内容长度: ${markdownContent.length} 字符`);
        console.log(`🔢 字数统计: ${wordCount} 字`);

        // 7. 验证Markdown内容质量
        expect(markdownContent).toContain('文档信息');
        expect(markdownContent).toContain('页数');
        expect(markdownContent).toContain('Facebook');
        expect(markdownContent).toContain('Haystack');

        // 8. 显示内容预览
        console.log('\n📖 Markdown内容预览:');
        console.log('='.repeat(50));
        console.log(markdownContent.substring(0, 300));
        console.log('... (内容已截断)');
        console.log('='.repeat(50));

        // 9. 分析标题结构
        const lines = markdownContent.split('\n');
        const headers = lines.filter(line => line.startsWith('#'));
        
        if (headers.length > 0) {
          console.log('\n🏷️  检测到的标题结构:');
          headers.forEach(header => {
            const level = header.match(/^#+/)[0].length;
            const title = header.replace(/^#+\s*/, '');
            console.log(`${'  '.repeat(level - 1)}- ${title}`);
          });
        }

        // 10. 获取文档详情
        const documentResponse = await axios.get(
          `${baseURL}/api/documents/${documentId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(documentResponse.status).toBe(200);
        expect(documentResponse.data.success).toBe(true);
        expect(documentResponse.data.data.userId).toBeTruthy(); // 修正路径
        expect(documentResponse.data.data.markdownContent).toBeTruthy();

        console.log('\n📋 文档详细信息:');
        console.log(`- 标题: ${documentResponse.data.data.title}`);
        console.log(`- 格式: ${documentResponse.data.data.originalFormat}`);
        console.log(`- 文件大小: ${documentResponse.data.data.metadata.fileSize} bytes`);
        console.log(`- 页数: ${documentResponse.data.data.metadata.pageCount || 'N/A'}`);
        console.log(`- 字数: ${documentResponse.data.data.metadata.wordCount || 'N/A'}`);
        console.log(`- 处理状态: ${documentResponse.data.data.processingStatus}`);

      } else if (processingStatus === 'failed') {
        console.log('❌ PDF处理失败，检查错误信息...');
        
        const processingError = uploadResponse.data.data.document.processingError;
        console.log(`错误信息: ${processingError}`);
        
        // 即使处理失败，文档记录也应该存在
        expect(uploadResponse.data.data.document._id).toBeTruthy();
        expect(processingError).toBeTruthy();
      }

      console.log('\n✅ PDF上传和转写测试完成!');
    }, 60000); // 60秒超时

    it('should handle multiple PDF uploads', async () => {
      console.log('\n🔄 测试多个PDF文件上传...');
      
      const pdfPath = path.join(__dirname, 'example.pdf');
      const pdfBuffer = fs.readFileSync(pdfPath);
      
      const uploadPromises = [];
      
      // 同时上传3个PDF文件
      for (let i = 1; i <= 3; i++) {
        const formData = new FormData();
        formData.append('document', pdfBuffer, {
          filename: `document-${i}.pdf`,
          contentType: 'application/pdf'
        });
        formData.append('title', `测试文档 ${i}`);

        const uploadPromise = axios.post(
          `${baseURL}/api/documents/upload`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        uploadPromises.push(uploadPromise);
      }

      // 等待所有上传完成
      const responses = await Promise.all(uploadPromises);
      
      // 验证所有上传都成功
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.data.success).toBe(true);
        expect(response.data.data.document.title).toBe(`测试文档 ${index + 1}`);
        console.log(`✅ 文档 ${index + 1} 上传成功`);
      });

      // 获取文档列表
      const listResponse = await axios.get(
        `${baseURL}/api/documents`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(listResponse.status).toBe(200);
      expect(listResponse.data.success).toBe(true);
      expect(listResponse.data.data).toHaveLength(3);

      console.log(`📋 共上传了 ${listResponse.data.data.length} 个文档`);
      
      // 获取统计信息
      const statsResponse = await axios.get(
        `${baseURL}/api/documents/stats`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.data.data.total).toBe(3);
      expect(statsResponse.data.data.formatStats.pdf).toBe(3);

      console.log('📊 文档统计:', statsResponse.data.data);
      console.log('\n✅ 多文档上传测试完成!');
    }, 90000); // 90秒超时

    it('should handle PDF reprocessing', async () => {
      console.log('\n🔄 测试PDF重新处理功能...');
      
      // 上传一个无效的PDF（模拟处理失败）
      const invalidPdfBuffer = Buffer.from('%PDF-1.4 invalid content');
      
      const formData = new FormData();
      formData.append('document', invalidPdfBuffer, {
        filename: 'invalid.pdf',
        contentType: 'application/pdf'
      });
      formData.append('title', '无效PDF文档');

      const uploadResponse = await axios.post(
        `${baseURL}/api/documents/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(uploadResponse.status).toBe(201);
      const documentId = uploadResponse.data.data.document._id;
      const processingStatus = uploadResponse.data.data.document.processingStatus;
      
      console.log(`📄 无效PDF上传完成，状态: ${processingStatus}`);

      if (processingStatus === 'failed') {
        console.log('❌ PDF处理失败，尝试重新处理...');
        
        // 尝试重新处理
        try {
          const reprocessResponse = await axios.post(
            `${baseURL}/api/documents/${documentId}/reprocess`,
            {},
            {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            }
          );
          
          // 由于PDF内容无效，重新处理应该仍然失败
          console.log('重新处理响应:', reprocessResponse.status);
        } catch (error) {
          // 预期会失败
          expect(error.response.status).toBe(500);
          console.log('✅ 重新处理失败（符合预期）');
        }
      }

      console.log('\n✅ PDF重新处理测试完成!');
    }, 30000);
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      // 注册用户
      const registerResponse = await axios.post(`${baseURL}/api/auth/register`, {
        username: 'erroruser',
        email: 'error@example.com',
        password: 'password123'
      });
      authToken = registerResponse.data.data.token;
    });

    it('should handle unauthorized requests', async () => {
      console.log('\n🔒 测试未授权请求...');
      
      const pdfBuffer = fs.readFileSync(path.join(__dirname, 'example.pdf'));
      const formData = new FormData();
      formData.append('document', pdfBuffer, {
        filename: 'test.pdf',
        contentType: 'application/pdf'
      });

      try {
        await axios.post(`${baseURL}/api/documents/upload`, formData, {
          headers: formData.getHeaders()
          // 没有Authorization header
        });
      } catch (error) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.success).toBe(false);
        console.log('✅ 未授权请求被正确拒绝');
      }
    });

    it('should handle unsupported file types', async () => {
      console.log('\n📄 测试不支持的文件类型...');
      
      const textBuffer = Buffer.from('This is a text file, not a PDF');
      const formData = new FormData();
      formData.append('document', textBuffer, {
        filename: 'test.txt',
        contentType: 'text/plain'
      });

      try {
        await axios.post(`${baseURL}/api/documents/upload`, formData, {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${authToken}`
          }
        });
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.message).toContain('不支持的文件类型');
        console.log('✅ 不支持的文件类型被正确拒绝');
      }
    });

    it('should handle missing file', async () => {
      console.log('\n📭 测试缺少文件的请求...');
      
      const formData = new FormData();
      formData.append('title', '没有文件的请求');

      try {
        await axios.post(`${baseURL}/api/documents/upload`, formData, {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${authToken}`
          }
        });
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.message).toContain('文件');
        console.log('✅ 缺少文件的请求被正确拒绝');
      }
    });
  });
});
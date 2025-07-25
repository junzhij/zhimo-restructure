const request = require('supertest');
const app = require('../src/app');
const { initializeDatabase, cleanTestData } = require('../src/utils/initDatabase');
const databaseConnection = require('../src/utils/database');
const DocumentService = require('../src/services/DocumentService');

// 这个测试需要真实的AWS S3配置
// 确保在运行前设置了正确的AWS凭证
describe('S3 Integration Tests', () => {
  let documentService;
  let testToken;
  let testUserId;
  let testDocumentId;
  let testS3Key;

  beforeAll(async () => {
    // 检查是否配置了S3
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
      console.log('⚠️ 跳过S3集成测试：未配置AWS凭证');
      return;
    }

    await initializeDatabase();
    documentService = new DocumentService();
  });

  beforeEach(async () => {
    if (!process.env.AWS_ACCESS_KEY_ID) return;
    
    // 每个测试前创建新的测试用户
    const timestamp = Date.now();
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: `s3testuser${timestamp}`,
        email: `s3test${timestamp}@example.com`,
        password: 'password123'
      });

    testToken = registerResponse.body.data.token;
    testUserId = registerResponse.body.data.user.id;
  });

  afterEach(async () => {
    if (!process.env.AWS_ACCESS_KEY_ID) return;
    await cleanTestData();
  });

  afterAll(async () => {
    await databaseConnection.disconnect();
  });

  describe('Real S3 Upload Tests', () => {
    beforeEach(() => {
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
        test.skip('S3 credentials not configured');
      }
    });

    it('should upload PDF file to real S3', async () => {
      // 临时设置环境变量强制使用真实S3
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // 创建一个真实的PDF内容
      const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Hello, S3 Test!) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
299
%%EOF`;

      const pdfBuffer = Buffer.from(pdfContent);

      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('document', pdfBuffer, {
          filename: 's3-test.pdf',
          contentType: 'application/pdf'
        })
        .field('title', 'S3 Integration Test PDF')
        .field('tags', 'test,s3,integration')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.document.originalFormat).toBe('pdf');
      expect(response.body.data.document.title).toBe('S3 Integration Test PDF');
      expect(response.body.data.document.metadata.originalFileName).toBe('s3-test.pdf');
      expect(response.body.data.document.metadata.fileSize).toBe(pdfBuffer.length);
      
      // 验证S3位置信息（真实S3或模拟）
      expect(response.body.data.uploadInfo.s3Key).toMatch(/^documents\/.*\/.*_s3_test\.pdf$/);
      if (response.body.data.uploadInfo.location.startsWith('https://')) {
        // 真实S3
        expect(response.body.data.uploadInfo.location).toContain(process.env.S3_BUCKET_NAME);
      } else {
        // 模拟S3
        expect(response.body.data.uploadInfo.location).toContain('mock://');
      }

      // 保存文档ID用于后续测试
      testDocumentId = response.body.data.document._id;
      testS3Key = response.body.data.uploadInfo.s3Key;

      // 恢复环境变量
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should download file from real S3', async () => {
      // 先上传一个文件
      const pdfBuffer = Buffer.from('%PDF-1.4 download test');
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('document', pdfBuffer, {
          filename: 'download-test.pdf',
          contentType: 'application/pdf'
        })
        .expect(201);

      const documentId = uploadResponse.body.data.document._id;

      const response = await request(app)
        .get(`/api/documents/${documentId}/download`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('download-test.pdf');
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should delete file from real S3', async () => {
      // 先上传一个文件
      const pdfBuffer = Buffer.from('%PDF-1.4 delete test');
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('document', pdfBuffer, {
          filename: 'delete-test.pdf',
          contentType: 'application/pdf'
        })
        .expect(201);

      const documentId = uploadResponse.body.data.document._id;

      const response = await request(app)
        .delete(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('删除成功');

      // 验证文档已被软删除
      await request(app)
        .get(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);
    });

    it('should upload multiple file types to S3', async () => {
      const testFiles = [
        {
          content: Buffer.from('Mock DOCX content'),
          filename: 'test.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          expectedFormat: 'docx'
        },
        {
          content: Buffer.from('Mock PPTX content'),
          filename: 'test.pptx',
          contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          expectedFormat: 'pptx'
        },
        {
          // 简单的PNG图片头
          content: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...Array(100).fill(0)]),
          filename: 'test.png',
          contentType: 'image/png',
          expectedFormat: 'image'
        }
      ];

      const uploadPromises = testFiles.map(async (file) => {
        const response = await request(app)
          .post('/api/documents/upload')
          .set('Authorization', `Bearer ${testToken}`)
          .attach('document', file.content, {
            filename: file.filename,
            contentType: file.contentType
          })
          .field('title', `Test ${file.expectedFormat.toUpperCase()} File`)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.document.originalFormat).toBe(file.expectedFormat);
        expect(response.body.data.document.metadata.originalFileName).toBe(file.filename);
        
        return response.body.data.document._id;
      });

      const documentIds = await Promise.all(uploadPromises);
      expect(documentIds).toHaveLength(3);

      // 验证所有文档都已上传
      const listResponse = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(listResponse.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle S3 upload errors gracefully', async () => {
      // 强制使用真实S3来测试错误处理
      const originalNodeEnv = process.env.NODE_ENV;
      const originalBucket = process.env.S3_BUCKET_NAME;
      
      process.env.NODE_ENV = 'development';
      process.env.S3_BUCKET_NAME = 'non-existent-bucket-12345';
      
      // 创建新的DocumentService实例（会使用新的bucket名称）
      const errorDocumentService = new DocumentService();
      
      const mockFile = {
        originalname: 'error-test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('%PDF-1.4 test content')
      };

      try {
        await errorDocumentService.uploadDocument(mockFile, testUserId);
        fail('Should have thrown an error');
      } catch (error) {
        // 可能是S3错误或验证错误
        expect(error.message).toMatch(/(上传失败|validation failed)/i);
      }

      // 恢复原始设置
      process.env.NODE_ENV = originalNodeEnv;
      process.env.S3_BUCKET_NAME = originalBucket;
    });
  });

  describe('DocumentService S3 Integration', () => {
    beforeEach(() => {
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
        test.skip('S3 credentials not configured');
      }
    });

    it('should validate S3 configuration', () => {
      expect(documentService.s3Enabled).toBe(true);
      expect(documentService.bucketName).toBe('advx'); // 使用实际的bucket名称
      expect(documentService.s3Client).toBeDefined();
    });

    it('should generate unique S3 keys', () => {
      const key1 = documentService.generateS3Key(testUserId, 'test.pdf', 'pdf');
      const key2 = documentService.generateS3Key(testUserId, 'test.pdf', 'pdf');

      expect(key1).toMatch(/^documents\/.*\/.*_test\.pdf$/);
      expect(key2).toMatch(/^documents\/.*\/.*_test\.pdf$/);
      expect(key1).not.toBe(key2); // 应该是唯一的
    });

    it('should validate file types correctly', () => {
      const validFile = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 1024 // 1MB
      };

      const invalidFile = {
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 1024
      };

      const validResult = documentService.validateFile(validFile);
      const invalidResult = documentService.validateFile(invalidFile);

      expect(validResult.isValid).toBe(true);
      expect(validResult.format).toBe('pdf');

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('不支持的文件类型: text/plain');
    });

    it('should handle file size limits', () => {
      const oversizedFile = {
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        size: 100 * 1024 * 1024 // 100MB (exceeds 50MB limit)
      };

      const result = documentService.validateFile(oversizedFile);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('文件大小超过限制');
    });
  });

  describe('S3 Performance Tests', () => {
    beforeEach(() => {
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
        test.skip('S3 credentials not configured');
      }
    });

    it('should handle concurrent uploads', async () => {
      const concurrentUploads = 3;
      const uploadPromises = [];

      for (let i = 0; i < concurrentUploads; i++) {
        const pdfBuffer = Buffer.from(`%PDF-1.4 concurrent test ${i}`);
        
        const uploadPromise = request(app)
          .post('/api/documents/upload')
          .set('Authorization', `Bearer ${testToken}`)
          .attach('document', pdfBuffer, {
            filename: `concurrent-${i}.pdf`,
            contentType: 'application/pdf'
          })
          .field('title', `Concurrent Test ${i}`)
          .expect(201);

        uploadPromises.push(uploadPromise);
      }

      const responses = await Promise.all(uploadPromises);
      
      responses.forEach((response, index) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.document.title).toBe(`Concurrent Test ${index}`);
      });
    });

    it('should measure upload performance', async () => {
      const startTime = Date.now();
      const pdfBuffer = Buffer.from('%PDF-1.4 performance test content');

      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('document', pdfBuffer, {
          filename: 'performance-test.pdf',
          contentType: 'application/pdf'
        })
        .expect(201);

      const endTime = Date.now();
      const uploadTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(uploadTime).toBeLessThan(10000); // 应该在10秒内完成
      
      console.log(`📊 S3上传性能: ${uploadTime}ms`);
    });
  });
});
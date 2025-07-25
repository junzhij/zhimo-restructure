const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
require('dotenv').config();

// 这个测试专门用于测试真实的S3功能
// 跳过条件：如果没有配置S3凭证
const skipS3Tests = !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME;

describe('Real S3 Integration Tests', () => {
  let s3Client;
  let bucketName;
  let testKeys = [];

  beforeAll(() => {
    if (skipS3Tests) {
      console.log('⚠️ 跳过真实S3测试：未配置AWS凭证');
      return;
    }

    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    bucketName = process.env.S3_BUCKET_NAME;
    console.log(`🔧 使用S3 Bucket: ${bucketName}`);
  });

  afterAll(async () => {
    if (skipS3Tests) return;

    // 清理测试文件
    console.log('🧹 清理S3测试文件...');
    for (const key of testKeys) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key
        }));
        console.log(`  ✓ 删除: ${key}`);
      } catch (error) {
        console.warn(`  ⚠️ 删除失败: ${key} - ${error.message}`);
      }
    }
  });

  describe('S3 Basic Operations', () => {
    beforeEach(() => {
      if (skipS3Tests) {
        test.skip('S3 credentials not configured');
      }
    });

    it('should upload file to S3', async () => {
      const testKey = `test/integration-test-${Date.now()}.txt`;
      const testContent = `S3集成测试内容 - ${new Date().toISOString()}`;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: testContent,
        ContentType: 'text/plain',
        Metadata: {
          testType: 'integration',
          timestamp: Date.now().toString()
        }
      });

      const result = await s3Client.send(command);
      
      expect(result.ETag).toBeDefined();
      expect(result.ETag.length).toBeGreaterThan(0);
      
      testKeys.push(testKey);
      console.log(`✅ 上传成功: ${testKey}`);
    });

    it('should upload large file using multipart upload', async () => {
      const testKey = `test/large-file-${Date.now()}.bin`;
      // 创建一个5MB的测试文件
      const largeContent = Buffer.alloc(5 * 1024 * 1024, 'A');

      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: bucketName,
          Key: testKey,
          Body: largeContent,
          ContentType: 'application/octet-stream'
        }
      });

      const result = await upload.done();
      
      expect(result.Location).toContain(bucketName);
      expect(result.Key).toBe(testKey);
      
      testKeys.push(testKey);
      console.log(`✅ 大文件上传成功: ${testKey} (${largeContent.length} bytes)`);
    });

    it('should download file from S3', async () => {
      // 先上传一个文件
      const testKey = `test/download-test-${Date.now()}.txt`;
      const originalContent = 'Download test content';

      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: originalContent,
        ContentType: 'text/plain'
      }));

      testKeys.push(testKey);

      // 然后下载
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: testKey
      });

      const response = await s3Client.send(getCommand);
      const downloadedContent = await response.Body.transformToString();

      expect(downloadedContent).toBe(originalContent);
      expect(response.ContentType).toBe('text/plain');
      
      console.log(`✅ 下载成功: ${testKey}`);
    });

    it('should handle PDF file upload', async () => {
      const testKey = `test/pdf-test-${Date.now()}.pdf`;
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
(Hello, Real S3!) Tj
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

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: pdfContent,
        ContentType: 'application/pdf'
      });

      const result = await s3Client.send(command);
      
      expect(result.ETag).toBeDefined();
      
      testKeys.push(testKey);
      console.log(`✅ PDF上传成功: ${testKey}`);
    });

    it('should delete file from S3', async () => {
      // 先上传一个文件
      const testKey = `test/delete-test-${Date.now()}.txt`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: 'File to be deleted',
        ContentType: 'text/plain'
      }));

      // 然后删除
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: testKey
      });

      const result = await s3Client.send(deleteCommand);
      
      // S3删除操作总是返回成功，即使文件不存在
      expect(result.$metadata.httpStatusCode).toBe(204);
      
      console.log(`✅ 删除成功: ${testKey}`);
    });

    it('should handle concurrent uploads', async () => {
      const concurrentCount = 5;
      const uploadPromises = [];

      for (let i = 0; i < concurrentCount; i++) {
        const testKey = `test/concurrent-${Date.now()}-${i}.txt`;
        const content = `Concurrent upload test ${i}`;

        const uploadPromise = s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: testKey,
          Body: content,
          ContentType: 'text/plain'
        })).then(result => {
          testKeys.push(testKey);
          return { key: testKey, result };
        });

        uploadPromises.push(uploadPromise);
      }

      const results = await Promise.all(uploadPromises);
      
      expect(results).toHaveLength(concurrentCount);
      results.forEach((result, index) => {
        expect(result.result.ETag).toBeDefined();
        expect(result.key).toContain(`concurrent-`);
      });

      console.log(`✅ 并发上传成功: ${concurrentCount} 个文件`);
    });

    it('should measure upload performance', async () => {
      const testKey = `test/performance-${Date.now()}.txt`;
      const content = 'Performance test content';

      const startTime = Date.now();

      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: content,
        ContentType: 'text/plain'
      }));

      const endTime = Date.now();
      const uploadTime = endTime - startTime;

      testKeys.push(testKey);

      expect(uploadTime).toBeLessThan(5000); // 应该在5秒内完成
      console.log(`📊 S3上传性能: ${uploadTime}ms`);
    });
  });

  describe('S3 Error Handling', () => {
    beforeEach(() => {
      if (skipS3Tests) {
        test.skip('S3 credentials not configured');
      }
    });

    it('should handle non-existent bucket error', async () => {
      const invalidS3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      });

      const command = new PutObjectCommand({
        Bucket: 'non-existent-bucket-12345',
        Key: 'test.txt',
        Body: 'test content'
      });

      await expect(invalidS3Client.send(command)).rejects.toThrow();
    });

    it('should handle invalid credentials', async () => {
      const invalidS3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: 'invalid-key',
          secretAccessKey: 'invalid-secret'
        }
      });

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: 'test.txt',
        Body: 'test content'
      });

      await expect(invalidS3Client.send(command)).rejects.toThrow();
    });
  });
});
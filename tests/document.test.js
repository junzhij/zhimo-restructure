const request = require('supertest');
const app = require('../src/app');
const { initializeDatabase, cleanTestData } = require('../src/utils/initDatabase');
const databaseConnection = require('../src/utils/database');

describe('Document Upload API', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterEach(async () => {
    await cleanTestData();
  });

  afterAll(async () => {
    await databaseConnection.disconnect();
  });

  describe('POST /api/documents/upload', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('令牌');
    });

    it('should require a file to be uploaded', async () => {
      // First register and login to get a token
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        });

      const token = registerResponse.body.data.token;

      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('文件');
    });

    it('should upload PDF file successfully', async () => {
      // Register and login
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser_pdf',
          email: 'testpdf@example.com',
          password: 'password123'
        });

      const token = registerResponse.body.data.token;

      // Create a mock PDF buffer
      const pdfBuffer = Buffer.from('%PDF-1.4 mock pdf content');

      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('document', pdfBuffer, {
          filename: 'test.pdf',
          contentType: 'application/pdf'
        })
        .field('title', 'Test PDF Document')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.document.originalFormat).toBe('pdf');
      expect(response.body.data.document.title).toBe('Test PDF Document');
      expect(response.body.data.document.metadata.originalFileName).toBe('test.pdf');
    });

    it('should reject unsupported file types', async () => {
      // Register and login
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser_unsupported',
          email: 'testunsupported@example.com',
          password: 'password123'
        });

      const token = registerResponse.body.data.token;

      // Create a mock unsupported file
      const unsupportedBuffer = Buffer.from('unsupported file content');

      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('document', unsupportedBuffer, {
          filename: 'test.txt',
          contentType: 'text/plain'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('不支持的文件类型');
    });
  });

  describe('POST /api/documents/url', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/documents/url')
        .send({ url: 'https://example.com' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should add URL document successfully', async () => {
      // Register and login
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser3',
          email: 'test3@example.com',
          password: 'password123'
        });

      const token = registerResponse.body.data.token;

      const response = await request(app)
        .post('/api/documents/url')
        .set('Authorization', `Bearer ${token}`)
        .send({
          url: 'https://example.com',
          title: 'Test URL Document'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.document.originalFormat).toBe('url');
      expect(response.body.data.document.title).toBe('Test URL Document');
    });

    it('should reject invalid URL', async () => {
      // Register and login
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser4',
          email: 'test4@example.com',
          password: 'password123'
        });

      const token = registerResponse.body.data.token;

      const response = await request(app)
        .post('/api/documents/url')
        .set('Authorization', `Bearer ${token}`)
        .send({
          url: 'invalid-url'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/documents', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/documents')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return empty list for new user', async () => {
      // Register and login
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser2',
          email: 'test2@example.com',
          password: 'password123'
        });

      const token = registerResponse.body.data.token;

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return documents after adding URL document', async () => {
      // Register and login
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser5',
          email: 'test5@example.com',
          password: 'password123'
        });

      const token = registerResponse.body.data.token;

      // Add URL document
      await request(app)
        .post('/api/documents/url')
        .set('Authorization', `Bearer ${token}`)
        .send({
          url: 'https://example.com',
          title: 'Test Document'
        });

      // Get documents
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].originalFormat).toBe('url');
    });
  });

  describe('GET /api/documents/stats', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/documents/stats')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return document statistics', async () => {
      // Register and login
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser_stats',
          email: 'teststats@example.com',
          password: 'password123'
        });

      const token = registerResponse.body.data.token;

      // Add some documents
      await request(app)
        .post('/api/documents/url')
        .set('Authorization', `Bearer ${token}`)
        .send({
          url: 'https://example.com',
          title: 'Test Document 1'
        });

      const pdfBuffer = Buffer.from('%PDF-1.4 mock pdf content');
      await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('document', pdfBuffer, {
          filename: 'test.pdf',
          contentType: 'application/pdf'
        });

      // Get stats
      const response = await request(app)
        .get('/api/documents/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.formatStats).toHaveProperty('url', 1);
      expect(response.body.data.formatStats).toHaveProperty('pdf', 1);
      expect(response.body.data.statusStats).toHaveProperty('pending', 2);
    });
  });

  describe('DELETE /api/documents/:documentId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/documents/123')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should delete document successfully', async () => {
      // Register and login
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser_delete',
          email: 'testdelete@example.com',
          password: 'password123'
        });

      const token = registerResponse.body.data.token;

      // Add a document
      const addResponse = await request(app)
        .post('/api/documents/url')
        .set('Authorization', `Bearer ${token}`)
        .send({
          url: 'https://example.com',
          title: 'Document to Delete'
        });

      const documentId = addResponse.body.data.document._id;

      // Delete the document
      const deleteResponse = await request(app)
        .delete(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);

      // Verify document is deleted (should return 404)
      await request(app)
        .get(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
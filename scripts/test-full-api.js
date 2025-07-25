require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class APITester {
  constructor() {
    this.baseURL = `http://localhost:${process.env.PORT || 3000}`;
    this.token = null;
    this.userId = null;
  }

  /**
   * 注册测试用户
   */
  async registerUser() {
    const userData = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'Test123456!',
      profile: {
        displayName: '测试用户'
      }
    };

    try {
      console.log('👤 注册测试用户...');
      const response = await axios.post(`${this.baseURL}/api/auth/register`, userData);
      
      console.log('✅ 用户注册成功:', {
        username: userData.username,
        email: userData.email,
        userId: response.data.data.user.id
      });

      this.userId = response.data.data.user.id;
      this.token = response.data.data.token;
      
      return response.data;
    } catch (error) {
      if (error.response) {
        console.error('❌ 注册失败:', error.response.status, error.response.data);
      } else {
        console.error('❌ 注册请求失败:', error.message);
      }
      throw error;
    }
  }

  /**
   * 用户登录（如果注册失败，可以尝试登录已存在用户）
   */
  async loginUser(username = 'testuser', password = 'Test123456!') {
    try {
      console.log('🔐 用户登录...');
      const response = await axios.post(`${this.baseURL}/api/auth/login`, {
        username,
        password
      });

      console.log('✅ 登录成功');
      this.token = response.data.data.token;
      this.userId = response.data.data.user.id;
      
      return response.data;
    } catch (error) {
      if (error.response) {
        console.error('❌ 登录失败:', error.response.status, error.response.data);
      } else {
        console.error('❌ 登录请求失败:', error.message);
      }
      throw error;
    }
  }

  /**
   * 上传文档
   */
  async uploadDocument() {
    if (!this.token) {
      throw new Error('未获取到JWT token，请先登录');
    }

    const testFilePath = path.join(__dirname, '../tests/example.pdf');
    if (!fs.existsSync(testFilePath)) {
      throw new Error(`测试文件不存在: ${testFilePath}`);
    }

    try {
      console.log('📤 上传文档...');
      
      const form = new FormData();
      form.append('document', fs.createReadStream(testFilePath));
      form.append('title', 'API测试文档');
      form.append('tags', '测试,API,PDF');

      const response = await axios.post(`${this.baseURL}/api/documents/upload`, form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${this.token}`
        }
      });

      console.log('✅ 文档上传成功:', {
        documentId: response.data.data.document._id,
        title: response.data.data.document.title,
        status: response.data.data.document.processingStatus
      });

      return response.data.data.document;
    } catch (error) {
      if (error.response) {
        console.error('❌ 上传失败:', error.response.status, error.response.data);
      } else {
        console.error('❌ 上传请求失败:', error.message);
      }
      throw error;
    }
  }

  /**
   * 查询文档状态
   */
  async checkDocumentStatus(documentId) {
    if (!this.token) {
      throw new Error('未获取到JWT token');
    }

    try {
      const response = await axios.get(`${this.baseURL}/api/documents/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      return response.data.data;
    } catch (error) {
      if (error.response) {
        console.error('❌ 查询文档失败:', error.response.status, error.response.data);
      } else {
        console.error('❌ 查询请求失败:', error.message);
      }
      throw error;
    }
  }

  /**
   * 等待文档处理完成
   */
  async waitForProcessing(documentId, maxAttempts = 15) {
    console.log('⏳ 等待文档处理完成...');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const document = await this.checkDocumentStatus(documentId);
        const status = document.processingStatus;
        
        console.log(`📊 [${attempt}/${maxAttempts}] 处理状态: ${status}`);

        if (status === 'completed') {
          console.log('✅ 文档处理完成!');
          console.log('📄 Markdown内容长度:', document.markdownContent?.length || 0);
          console.log('🔄 重构内容长度:', document.restructuredContent?.length || 0);
          return document;
        } else if (status === 'failed') {
          console.log('❌ 文档处理失败:', document.processingError);
          return document;
        }

        // 等待2秒后重试
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`查询状态失败 (尝试 ${attempt}):`, error.message);
      }
    }

    console.log('⚠️ 文档处理超时');
    return null;
  }

  /**
   * 获取文档列表
   */
  async getDocumentList() {
    if (!this.token) {
      throw new Error('未获取到JWT token');
    }

    try {
      console.log('📋 获取文档列表...');
      const response = await axios.get(`${this.baseURL}/api/documents`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      console.log('✅ 文档列表获取成功:', {
        总数: response.data.data.length,
        文档: response.data.data.map(doc => ({
          id: doc._id,
          title: doc.title,
          status: doc.processingStatus,
          format: doc.originalFormat
        }))
      });

      return response.data.data;
    } catch (error) {
      if (error.response) {
        console.error('❌ 获取列表失败:', error.response.status, error.response.data);
      } else {
        console.error('❌ 列表请求失败:', error.message);
      }
      throw error;
    }
  }

  /**
   * 运行完整测试
   */
  async runFullTest() {
    try {
      console.log('🚀 开始完整API测试...\n');

      // 1. 注册用户
      try {
        await this.registerUser();
      } catch (error) {
        console.log('⚠️ 注册失败，尝试使用默认用户登录...');
        await this.loginUser();
      }

      console.log(`🔑 JWT Token: ${this.token}\n`);

      // 2. 上传文档
      const document = await this.uploadDocument();
      const documentId = document._id;

      // 3. 等待处理完成
      const processedDocument = await this.waitForProcessing(documentId);

      // 4. 获取文档列表
      await this.getDocumentList();

      console.log('\n🎉 完整测试完成!');

      // 输出curl命令示例
      this.printCurlExamples();

    } catch (error) {
      console.error('\n❌ 测试失败:', error.message);
    }
  }

  /**
   * 输出curl命令示例
   */
  printCurlExamples() {
    console.log('\n📝 Curl命令示例:');
    console.log('================');
    
    console.log('\n1. 注册用户:');
    console.log(`curl -X POST ${this.baseURL}/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "testuser_$(date +%s)",
    "email": "test_$(date +%s)@example.com", 
    "password": "Test123456!",
    "profile": {
      "displayName": "测试用户"
    }
  }'`);

    console.log('\n2. 用户登录:');
    console.log(`curl -X POST ${this.baseURL}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "testuser",
    "password": "Test123456!"
  }'`);

    if (this.token) {
      console.log('\n3. 上传文档:');
      console.log(`curl -X POST ${this.baseURL}/api/documents/upload \\
  -H "Authorization: Bearer ${this.token}" \\
  -F "document=@tests/example.pdf" \\
  -F "title=测试文档" \\
  -F "tags=测试,PDF"`);

      console.log('\n4. 获取文档列表:');
      console.log(`curl -X GET ${this.baseURL}/api/documents \\
  -H "Authorization: Bearer ${this.token}"`);

      console.log('\n5. 获取文档详情:');
      console.log(`curl -X GET ${this.baseURL}/api/documents/{documentId} \\
  -H "Authorization: Bearer ${this.token}"`);
    }
  }
}

// 运行测试
if (require.main === module) {
  const tester = new APITester();
  tester.runFullTest().catch(console.error);
}

module.exports = APITester;
require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testAPIUpload() {
  try {
    const baseURL = `http://localhost:${process.env.PORT || 3000}`;
    
    // 1. 注册测试用户并获取token
    let token;
    try {
      console.log('👤 注册测试用户...');
      const registerResponse = await axios.post(`${baseURL}/api/auth/register`, {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'Test123456!',
        profile: {
          displayName: '测试用户'
        }
      });
      token = registerResponse.data.data.token;
      console.log('✅ 用户注册成功，获取到token');
    } catch (error) {
      console.log('⚠️ 注册失败，尝试登录默认用户...');
      try {
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
          username: 'testuser',
          password: 'Test123456!'
        });
        token = loginResponse.data.data.token;
        console.log('✅ 登录成功，获取到token');
      } catch (loginError) {
        console.error('❌ 登录也失败了，请检查认证服务');
        return;
      }
    }
    
    // 2. 准备测试文件
    const testFilePath = path.join(__dirname, '../tests/example.pdf');
    if (!fs.existsSync(testFilePath)) {
      console.log('❌ 测试文件不存在:', testFilePath);
      return;
    }

    // 3. 创建表单数据
    const form = new FormData();
    form.append('document', fs.createReadStream(testFilePath));
    form.append('title', 'API测试文档');
    form.append('tags', '测试,API,PDF');

    console.log('📤 开始上传文档...');

    // 4. 发送上传请求
    const uploadResponse = await axios.post(`${baseURL}/api/documents/upload`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ 文档上传成功:', uploadResponse.data);
    
    const documentId = uploadResponse.data.data.document._id;

    // 5. 等待处理完成
    console.log('⏳ 等待文档处理...');
    let processingComplete = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!processingComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const statusResponse = await axios.get(`${baseURL}/api/documents/${documentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const status = statusResponse.data.data.processingStatus;
        console.log(`📊 处理状态: ${status}`);

        if (status === 'completed' || status === 'failed') {
          processingComplete = true;
          
          if (status === 'completed') {
            console.log('✅ 文档处理完成');
            console.log('📄 Markdown内容长度:', statusResponse.data.data.markdownContent?.length || 0);
          } else {
            console.log('❌ 文档处理失败:', statusResponse.data.data.processingError);
          }
        }
      } catch (error) {
        console.error('查询文档状态失败:', error.message);
      }

      attempts++;
    }

    if (!processingComplete) {
      console.log('⚠️ 文档处理超时');
    }

  } catch (error) {
    if (error.response) {
      console.error('❌ API请求失败:', error.response.status, error.response.data);
    } else {
      console.error('❌ 测试失败:', error.message);
    }
  }
}

// 运行测试
if (require.main === module) {
  console.log('🚀 开始API上传测试...');
  console.log('⚠️ 注意：需要先启动服务器');
  testAPIUpload().catch(console.error);
}

module.exports = testAPIUpload;
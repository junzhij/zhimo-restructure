const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');


async function uploadPdfDemo() {
  console.log('🚀 启动PDF上传演示...\n');
  
  try {
    
    // 1. 注册用户
    console.log('👤 注册演示用户...');
    const registerData = {
      username: 'demo_user',
      email: 'demo@zhimo.com',
      password: 'demo123456'
    };

    let authToken;
    try {
      const registerResponse = await axios.post(`${baseURL}/api/auth/register`, registerData);
      authToken = registerResponse.data.data.token;
      console.log(`✅ 用户注册成功: ${registerResponse.data.data.user.username}`);
    } catch (error) {
      if (error.response?.status === 400 && error.response.data.message.includes('已存在')) {
        console.log('👤 用户已存在，尝试登录...');
        
        // 尝试登录
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
          email: registerData.email,
          password: registerData.password
        });
        authToken = loginResponse.data.data.token;
        console.log(`✅ 用户登录成功: ${loginResponse.data.data.user.username}`);
      } else {
        throw error;
      }
    }

    // 2. 上传PDF文件
    console.log('\n📄 准备上传PDF文件...');
    const pdfPath = path.join(__dirname, '../tests/example.pdf');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfStats = fs.statSync(pdfPath);
    
    console.log(`📊 PDF文件信息: ${(pdfStats.size / 1024).toFixed(2)} KB`);

    const formData = new FormData();
    formData.append('document', pdfBuffer, {
      filename: 'Facebook-Haystack-Paper.pdf',
      contentType: 'application/pdf'
    });
    formData.append('title', 'Facebook Haystack: 大规模照片存储系统');

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

    const documentId = uploadResponse.data.data.document._id;
    const processingStatus = uploadResponse.data.data.document.processingStatus;
    
    console.log(`✅ PDF上传成功!`);
    console.log(`📋 文档ID: ${documentId}`);
    console.log(`⚡ 处理状态: ${processingStatus}`);

    // 3. 获取处理结果
    if (processingStatus === 'completed') {
      console.log('\n🎉 PDF处理成功，获取Markdown内容...');
      
      const markdownResponse = await axios.get(
        `${baseURL}/api/documents/${documentId}/markdown`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      const markdownContent = markdownResponse.data.data.markdownContent;
      const wordCount = markdownResponse.data.data.wordCount;

      console.log(`📝 Markdown内容长度: ${markdownContent.length} 字符`);
      console.log(`🔢 字数统计: ${wordCount} 字`);

      // 显示内容预览
      console.log('\n📖 Markdown内容预览:');
      console.log('='.repeat(60));
      console.log(markdownContent.substring(0, 500));
      if (markdownContent.length > 500) {
        console.log('\n... (内容已截断，完整内容已保存到数据库)');
      }
      console.log('='.repeat(60));

      // 分析标题结构
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

      // 获取完整文档信息
      const documentResponse = await axios.get(
        `${baseURL}/api/documents/${documentId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      console.log('\n📋 完整文档信息:');
      const doc = documentResponse.data.data;
      console.log(`- 标题: ${doc.title}`);
      console.log(`- 格式: ${doc.originalFormat}`);
      console.log(`- 文件大小: ${(doc.metadata.fileSize / 1024).toFixed(2)} KB`);
      console.log(`- 页数: ${doc.metadata.pageCount || 'N/A'}`);
      console.log(`- 字数: ${doc.metadata.wordCount || 'N/A'}`);
      console.log(`- 处理状态: ${doc.processingStatus}`);
      console.log(`- 上传时间: ${new Date(doc.createdAt).toLocaleString()}`);
      console.log(`- 文档ID: ${doc._id}`);

    } else if (processingStatus === 'failed') {
      console.log('\n❌ PDF处理失败');
      const processingError = uploadResponse.data.data.document.processingError;
      console.log(`错误信息: ${processingError}`);
    }

    // 4. 获取用户所有文档
    console.log('\n📚 获取用户所有文档...');
    const listResponse = await axios.get(
      `${baseURL}/api/documents`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    console.log(`📊 用户共有 ${listResponse.data.data.length} 个文档`);
    listResponse.data.data.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.title} (${doc.originalFormat}) - ${doc.processingStatus}`);
    });

    // 5. 获取统计信息
    const statsResponse = await axios.get(
      `${baseURL}/api/documents/stats`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    console.log('\n📈 文档统计信息:');
    const stats = statsResponse.data.data;
    console.log(`- 总文档数: ${stats.total}`);
    console.log(`- 格式分布: ${JSON.stringify(stats.formatStats)}`);
    console.log(`- 状态分布: ${JSON.stringify(stats.statusStats)}`);
    console.log(`- 总存储大小: ${stats.readableTotalSize}`);

    console.log('\n✅ PDF上传和处理演示完成!');
    console.log('💾 所有数据已永久保存到MongoDB数据库中');
    console.log('🔗 可以通过API继续访问和管理这些文档');

  } catch (error) {
    console.error('\n❌ 演示过程中发生错误:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  } finally {
    // 关闭服务器
    if (server) {
      console.log('\n🔌 关闭服务器...');
      server.close();
    }
    
    // 等待一下再退出
    setTimeout(() => {
      console.log('👋 演示结束');
      process.exit(0);
    }, 1000);
  }
}

// 运行演示
uploadPdfDemo();
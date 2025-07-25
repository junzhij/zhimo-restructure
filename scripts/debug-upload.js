#!/usr/bin/env node

/**
 * 文件上传调试脚本
 * 用于诊断"意外的文件字段"错误
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const TEST_FILE = path.join(__dirname, '../tests/example.pdf');

// 测试用户凭证
const TEST_USER = {
  username: 'testuser',
  password: 'Test123456!'
};

async function debugUpload() {
  try {
    console.log('🔐 尝试登录用户...');
    let token;
    
    try {
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        identifier: TEST_USER.username,
        password: TEST_USER.password
      });
      token = loginResponse.data.data.token;
      console.log('✅ 登录成功');
    } catch (loginError) {
      console.log('⚠️ 登录失败，尝试注册新用户...');
      
      // 尝试注册
      const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
        username: TEST_USER.username,
        email: 'test@example.com',
        password: TEST_USER.password,
        profile: {
          displayName: '测试用户'
        }
      });
      token = registerResponse.data.data.token;
      console.log('✅ 注册成功');
    }

    // 检查测试文件是否存在
    if (!fs.existsSync(TEST_FILE)) {
      console.log('❌ 测试文件不存在:', TEST_FILE);
      return;
    }

    console.log('📁 测试文件信息:');
    const stats = fs.statSync(TEST_FILE);
    console.log(`   路径: ${TEST_FILE}`);
    console.log(`   大小: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`   修改时间: ${stats.mtime}`);

    // 测试1: 正确的字段名
    console.log('\n🧪 测试1: 正确的字段名 "document"');
    await testUpload(token, 'document', '正确字段名测试');

    // 测试2: 错误的字段名
    console.log('\n🧪 测试2: 错误的字段名 "file"');
    await testUpload(token, 'file', '错误字段名测试');

    // 测试3: 多个文件字段
    console.log('\n🧪 测试3: 多个文件字段');
    await testMultipleFiles(token);

  } catch (error) {
    console.error('❌ 调试失败:', error.response?.data?.message || error.message);
  }
}

async function testUpload(token, fieldName, testName) {
  try {
    const form = new FormData();
    form.append(fieldName, fs.createReadStream(TEST_FILE));
    form.append('title', testName);
    form.append('tags', '调试,测试');

    console.log(`   📤 使用字段名: "${fieldName}"`);
    
    const response = await axios.post(`${BASE_URL}/api/documents/upload`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('   ✅ 上传成功:', response.data.data.document.title);
    
  } catch (error) {
    console.log('   ❌ 上传失败:', error.response?.data?.message || error.message);
    if (error.response?.data?.details) {
      console.log('   📋 详细信息:', error.response.data.details);
    }
    if (error.response?.data?.hint) {
      console.log('   💡 提示:', error.response.data.hint);
    }
  }
}

async function testMultipleFiles(token) {
  try {
    const form = new FormData();
    form.append('document', fs.createReadStream(TEST_FILE));
    form.append('extraFile', fs.createReadStream(TEST_FILE)); // 额外的文件字段
    form.append('title', '多文件字段测试');
    form.append('tags', '调试,多文件');

    console.log('   📤 发送多个文件字段: document + extraFile');
    
    const response = await axios.post(`${BASE_URL}/api/documents/upload`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('   ✅ 上传成功:', response.data.data.document.title);
    
  } catch (error) {
    console.log('   ❌ 上传失败:', error.response?.data?.message || error.message);
    if (error.response?.data?.details) {
      console.log('   📋 详细信息:', error.response.data.details);
    }
  }
}

// 运行调试
if (require.main === module) {
  debugUpload();
}

module.exports = debugUpload;
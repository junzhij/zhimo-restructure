#!/usr/bin/env node

/**
 * 测试AI端点的脚本
 * 验证新的GET端点是否正确返回已生成的AI内容
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// 测试用户凭证（需要先注册或使用现有用户）
const TEST_USER = {
  username: 'testuser',
  password: 'Test123456!'
};

async function testAIEndpoints() {
  try {
    console.log('🔐 登录用户...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, TEST_USER);
    const token = loginResponse.data.data.token;
    console.log('✅ 登录成功');

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    console.log('📋 获取文档列表...');
    const documentsResponse = await axios.get(`${BASE_URL}/api/documents`, { headers });
    const documents = documentsResponse.data.data;
    
    if (!documents || documents.length === 0) {
      console.log('⚠️ 没有找到文档，请先上传一个文档');
      return;
    }

    // 找到一个已完成处理的文档
    const completedDoc = documents.find(doc => doc.processingStatus === 'completed');
    if (!completedDoc) {
      console.log('⚠️ 没有找到已完成处理的文档');
      return;
    }

    const documentId = completedDoc._id;
    console.log(`📄 使用文档: ${completedDoc.title} (${documentId})`);

    // 测试获取重构内容
    console.log('\n🔄 测试获取AI重构内容...');
    try {
      const restructureResponse = await axios.get(
        `${BASE_URL}/api/documents/${documentId}/ai/restructure`,
        { headers }
      );
      console.log('✅ 重构内容获取成功');
      console.log(`   原始内容长度: ${restructureResponse.data.data.originalContent?.length || 0}`);
      console.log(`   重构内容长度: ${restructureResponse.data.data.restructuredContent?.length || 0}`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ 重构内容尚未生成');
      } else {
        console.log('❌ 重构内容获取失败:', error.response?.data?.message || error.message);
      }
    }

    // 测试获取摘要
    console.log('\n📝 测试获取文档摘要...');
    try {
      const summaryResponse = await axios.get(
        `${BASE_URL}/api/documents/${documentId}/ai/summary`,
        { headers }
      );
      console.log('✅ 摘要获取成功');
      const summaries = summaryResponse.data.data.summaries;
      console.log(`   找到 ${summaries.length} 个摘要:`);
      summaries.forEach((summary, index) => {
        console.log(`   ${index + 1}. 类型: ${summary.type}, 字数: ${summary.wordCount}, 生成时间: ${summary.generatedAt}`);
      });
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ 文档摘要尚未生成');
      } else {
        console.log('❌ 摘要获取失败:', error.response?.data?.message || error.message);
      }
    }

    // 测试获取概念
    console.log('\n🧠 测试获取文档概念...');
    try {
      const conceptsResponse = await axios.get(
        `${BASE_URL}/api/documents/${documentId}/ai/concepts`,
        { headers }
      );
      console.log('✅ 概念获取成功');
      const concepts = conceptsResponse.data.data.concepts;
      console.log(`   找到 ${concepts.length} 个概念:`);
      concepts.slice(0, 5).forEach((concept, index) => {
        console.log(`   ${index + 1}. ${concept.term} (${concept.category}, 重要性: ${concept.importance})`);
      });
      if (concepts.length > 5) {
        console.log(`   ... 还有 ${concepts.length - 5} 个概念`);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ 文档概念尚未提取');
      } else {
        console.log('❌ 概念获取失败:', error.response?.data?.message || error.message);
      }
    }

    // 测试带参数的概念查询
    console.log('\n🔍 测试概念筛选查询...');
    try {
      const filteredConceptsResponse = await axios.get(
        `${BASE_URL}/api/documents/${documentId}/ai/concepts?category=concept&importance=4&limit=3`,
        { headers }
      );
      const filteredConcepts = filteredConceptsResponse.data.data.concepts;
      console.log(`✅ 筛选查询成功，找到 ${filteredConcepts.length} 个高重要性概念`);
    } catch (error) {
      console.log('⚠️ 概念筛选查询失败:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 AI端点测试完成!');

  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data?.message || error.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testAIEndpoints();
}

module.exports = testAIEndpoints;
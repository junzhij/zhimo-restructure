#!/usr/bin/env node

/**
 * 测试练习题路由功能
 */

require('dotenv').config();
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const { User, Document, Exercise } = require('../src/models');
const jwt = require('jsonwebtoken');

let testUser;
let testDocument;
let testExercise;
let authToken;

async function setupTestData() {
  console.log('🔧 设置测试数据...');
  
  // 连接数据库
  await mongoose.connect(process.env.MONGODB_URI);
  
  // 清理旧数据
  await User.deleteMany({ email: 'exercise-routes-test@example.com' });
  
  // 创建测试用户
  testUser = new User({
    username: 'exerciseroutestest',
    email: 'exercise-routes-test@example.com',
    passwordHash: 'hashedpassword123',
    profile: {
      displayName: '练习题路由测试用户'
    }
  });
  await testUser.save();
  
  // 生成JWT token
  authToken = jwt.sign(
    { id: testUser._id, username: testUser.username },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
  
  // 创建测试文档
  testDocument = new Document({
    userId: testUser._id,
    title: '练习题路由测试文档',
    originalFormat: 'pdf',
    filePath: '/tmp/exercise-routes-test.pdf',
    markdownContent: '# 测试内容\n\n这是用于测试练习题路由的内容。',
    metadata: {
      fileSize: 1024000,
      originalFileName: 'exercise-routes-test.pdf',
      mimeType: 'application/pdf'
    },
    processingStatus: 'completed'
  });
  await testDocument.save();
  
  // 创建测试练习题
  testExercise = new Exercise({
    documentId: testDocument._id,
    userId: testUser._id,
    title: '测试练习题集',
    description: '这是一个测试用的练习题集',
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        question: '这是一道选择题？',
        options: ['选项A', '选项B', '选项C', '选项D'],
        correctAnswer: '选项A',
        explanation: '这是选择题的解释',
        difficulty: 2,
        points: 10,
        tags: ['测试'],
        metadata: {
          sourceSection: '第一章',
          keywordsCovered: ['测试', '选择题'],
          estimatedTime: 30
        }
      },
      {
        id: 'q2',
        type: 'true_false',
        question: '这是一道判断题？',
        correctAnswer: 'true',
        explanation: '这是判断题的解释',
        difficulty: 1,
        points: 5,
        tags: ['测试'],
        metadata: {
          sourceSection: '第一章',
          keywordsCovered: ['测试', '判断题'],
          estimatedTime: 20
        }
      },
      {
        id: 'q3',
        type: 'short_answer',
        question: '这是一道简答题？',
        correctAnswer: '这是简答题的参考答案',
        explanation: '这是简答题的解释',
        difficulty: 3,
        points: 15,
        tags: ['测试'],
        metadata: {
          sourceSection: '第二章',
          keywordsCovered: ['测试', '简答题'],
          estimatedTime: 120
        }
      }
    ],
    metadata: {
      generationPrompt: '测试练习题生成',
      aiModel: 'test-model',
      generationTime: 1000
    }
  });
  await testExercise.save();
  
  console.log('✅ 测试数据设置完成');
  console.log('  - 用户ID:', testUser._id);
  console.log('  - 文档ID:', testDocument._id);
  console.log('  - 练习题ID:', testExercise._id);
}

async function testGetExercisesList() {
  console.log('\n📝 测试获取练习题列表API...');
  
  try {
    const response = await request(app)
      .get('/api/documents/exercises')
      .set('Authorization', `Bearer ${authToken}`);
    
    console.log('✅ 练习题列表API响应状态:', response.status);
    
    if (response.status === 200) {
      const data = response.body.data;
      console.log('  - 练习题数量:', data.length);
      
      if (data.length > 0) {
        const exercise = data[0];
        console.log('  - 第一个练习题:');
        console.log('    - ID:', exercise.id);
        console.log('    - 标题:', exercise.title);
        console.log('    - 文档ID:', exercise.documentId);
        console.log('    - 创建时间:', exercise.createdAt);
        
        // 验证返回的字段
        const expectedFields = ['id', 'title', 'documentId', 'createdAt'];
        const actualFields = Object.keys(exercise);
        const hasAllFields = expectedFields.every(field => actualFields.includes(field));
        console.log('  - 字段完整性:', hasAllFields ? '✅ 完整' : '❌ 缺失');
        
        if (!hasAllFields) {
          console.log('    - 期望字段:', expectedFields);
          console.log('    - 实际字段:', actualFields);
        }
      }
    } else {
      console.log('❌ API调用失败:', response.body);
    }
    
  } catch (error) {
    console.error('❌ 练习题列表测试失败:', error.message);
  }
}

async function testGetExerciseDetail() {
  console.log('\n📖 测试获取练习题详情API...');
  
  try {
    const response = await request(app)
      .get(`/api/documents/exercises/${testExercise._id}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    console.log('✅ 练习题详情API响应状态:', response.status);
    
    if (response.status === 200) {
      const data = response.body.data;
      console.log('  - 练习题ID:', data.id);
      console.log('  - 标题:', data.title);
      console.log('  - 题目数量:', data.questions?.length || 0);
      
      if (data.questions && data.questions.length > 0) {
        console.log('  - 题目详情:');
        data.questions.forEach((q, index) => {
          console.log(`    题目 ${index + 1}:`);
          console.log(`      类型: ${q.type}`);
          console.log(`      问题: ${q.question.substring(0, 30)}...`);
          console.log(`      分值: ${q.points}`);
          console.log(`      难度: ${q.difficulty}`);
        });
      }
      
      if (data.metadata) {
        console.log('  - 元数据:');
        console.log(`    - 总题数: ${data.metadata.totalQuestions}`);
        console.log(`    - 总分: ${data.metadata.totalPoints}`);
        console.log(`    - 预估时长: ${data.metadata.estimatedDuration} 分钟`);
      }
      
      // 验证返回的字段
      const expectedFields = ['id', 'title', 'questions', 'metadata', 'settings'];
      const actualFields = Object.keys(data);
      const hasAllFields = expectedFields.every(field => actualFields.includes(field));
      console.log('  - 字段完整性:', hasAllFields ? '✅ 完整' : '❌ 缺失');
      
    } else {
      console.log('❌ API调用失败:', response.body);
    }
    
  } catch (error) {
    console.error('❌ 练习题详情测试失败:', error.message);
  }
}

async function testNonExistentExercise() {
  console.log('\n🚫 测试不存在的练习题...');
  
  try {
    const fakeId = new mongoose.Types.ObjectId();
    const response = await request(app)
      .get(`/api/documents/exercises/${fakeId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    console.log('✅ 不存在练习题API响应状态:', response.status);
    
    if (response.status === 404) {
      console.log('  - 正确返回404状态码 ✅');
      console.log('  - 错误信息:', response.body.message);
    } else {
      console.log('❌ 期望404状态码，实际返回:', response.status);
    }
    
  } catch (error) {
    console.error('❌ 不存在练习题测试失败:', error.message);
  }
}

async function testUnauthorizedAccess() {
  console.log('\n🔒 测试未授权访问...');
  
  try {
    const response = await request(app)
      .get('/api/documents/exercises');
    
    console.log('✅ 未授权访问API响应状态:', response.status);
    
    if (response.status === 401) {
      console.log('  - 正确返回401状态码 ✅');
    } else {
      console.log('❌ 期望401状态码，实际返回:', response.status);
    }
    
  } catch (error) {
    console.error('❌ 未授权访问测试失败:', error.message);
  }
}

async function cleanup() {
  console.log('\n🧹 清理测试数据...');
  
  try {
    await User.deleteMany({ email: 'exercise-routes-test@example.com' });
    await Document.deleteMany({ userId: testUser._id });
    await Exercise.deleteMany({ userId: testUser._id });
    
    console.log('✅ 测试数据清理完成');
  } catch (error) {
    console.error('❌ 清理失败:', error.message);
  }
}

async function runTests() {
  try {
    await setupTestData();
    await testGetExercisesList();
    await testGetExerciseDetail();
    await testNonExistentExercise();
    await testUnauthorizedAccess();
    
    console.log('\n🎉 所有测试完成！');
    
  } catch (error) {
    console.error('❌ 测试运行失败:', error);
  } finally {
    await cleanup();
    await mongoose.disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
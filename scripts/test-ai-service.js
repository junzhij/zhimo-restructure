require('dotenv').config();
const AIService = require('../src/services/AIService');

async function testAIService() {
  const aiService = new AIService();
  
  const sampleContent = `
# 人工智能基础

人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，它企图了解智能的实质，
并生产出一种新的能以人类智能相似的方式做出反应的智能机器。

## 机器学习
机器学习是人工智能的一个重要分支，通过算法使机器能够从数据中学习并做出决策或预测。
主要包括监督学习、无监督学习和强化学习三种类型。

## 深度学习
深度学习是机器学习的子集，使用神经网络来模拟人脑的工作方式。
深度学习在图像识别、自然语言处理等领域取得了突破性进展。

## 应用领域
- 自然语言处理
- 计算机视觉
- 语音识别
- 推荐系统
- 自动驾驶
  `;

  console.log('🤖 开始测试AIService功能...\n');

  try {
    // 测试文档重构
    console.log('📝 测试文档重构...');
    const restructured = await aiService.restructureDocument(sampleContent, {
      style: 'academic',
      language: 'zh'
    });
    console.log('✅ 文档重构完成');
    console.log('重构结果预览:', restructured.substring(0, 200) + '...\n');

    // 测试摘要生成
    console.log('📋 测试摘要生成...');
    const summary = await aiService.generateSummary(sampleContent, {
      length: 'medium',
      language: 'zh',
      includeKeyPoints: true
    });
    console.log('✅ 摘要生成完成');
    console.log('摘要结果:', summary, '\n');

    // 测试概念提取
    console.log('🔍 测试概念提取...');
    const concepts = await aiService.extractConcepts(sampleContent, {
      maxConcepts: 5,
      language: 'zh'
    });
    console.log('✅ 概念提取完成');
    console.log('提取的概念数量:', concepts.length);
    concepts.forEach((concept, index) => {
      console.log(`${index + 1}. ${concept.term}: ${concept.definition.substring(0, 100)}...`);
    });
    console.log();

    // 测试练习题生成
    console.log('❓ 测试练习题生成...');
    const exercises = await aiService.generateExercises(sampleContent, {
      count: 3,
      types: ['multiple_choice', 'true_false', 'short_answer'],
      difficulty: 'medium',
      language: 'zh'
    });
    console.log('✅ 练习题生成完成');
    console.log('生成的题目数量:', exercises.length);
    exercises.forEach((exercise, index) => {
      console.log(`${index + 1}. [${exercise.type}] ${exercise.question}`);
      if (exercise.options) {
        exercise.options.forEach(option => console.log(`   ${option}`));
      }
    });
    console.log();

    // 测试思维导图生成
    console.log('🗺️ 测试思维导图生成...');
    const mindMap = await aiService.generateMindMap(sampleContent, {
      maxNodes: 15,
      language: 'zh',
      style: 'mindmap'
    });
    console.log('✅ 思维导图生成完成');
    console.log('Mermaid语法验证:', aiService.validateMermaidSyntax(mindMap) ? '✅ 通过' : '❌ 失败');
    console.log('思维导图代码:');
    console.log(mindMap);
    console.log();

    // 测试批量处理
    console.log('⚡ 测试批量处理...');
    const batchResults = await aiService.processDocument(sampleContent, {
      includeRestructure: true,
      includeSummary: true,
      includeExercises: true,
      includeConcepts: true,
      includeMindMap: true,
      language: 'zh'
    });
    
    console.log('✅ 批量处理完成');
    console.log('批量处理结果包含:');
    Object.keys(batchResults).forEach(key => {
      if (key.endsWith('Error')) {
        console.log(`❌ ${key}: ${batchResults[key]}`);
      } else {
        console.log(`✅ ${key}: 已生成`);
      }
    });

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  testAIService().catch(console.error);
}

module.exports = testAIService;
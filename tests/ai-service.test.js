const AIService = require('../src/services/AIService');

describe('AIService', () => {
  let aiService;
  
  beforeEach(() => {
    aiService = new AIService();
  });

  describe('validateMermaidSyntax', () => {
    test('应该验证有效的mindmap语法', () => {
      const validMindmap = `mindmap
  root((学习平台))
    文档管理
      上传文档
      解析PDF
    AI功能
      摘要生成
      概念提取
      出题功能`;
      
      expect(aiService.validateMermaidSyntax(validMindmap)).toBe(true);
    });

    test('应该拒绝无效的mindmap语法', () => {
      const invalidMindmap = `mindmap
  root((学习平台))
    文档管理<invalid>
      上传文档{bad}`;
      
      expect(aiService.validateMermaidSyntax(invalidMindmap)).toBe(false);
    });

    test('应该拒绝没有图表类型的代码', () => {
      const noType = `root((学习平台))
    文档管理`;
      
      expect(aiService.validateMermaidSyntax(noType)).toBe(false);
    });
  });

  describe('isValidMindmapNode', () => {
    test('应该验证有效的节点格式', () => {
      expect(aiService.isValidMindmapNode('  文档管理')).toBe(true);
      expect(aiService.isValidMindmapNode('    上传功能')).toBe(true);
      expect(aiService.isValidMindmapNode('root((主节点))')).toBe(false); // 包含特殊字符
    });

    test('应该拒绝包含特殊字符的节点', () => {
      expect(aiService.isValidMindmapNode('  文档<管理>')).toBe(false);
      expect(aiService.isValidMindmapNode('  功能[测试]')).toBe(false);
      expect(aiService.isValidMindmapNode('  数据{处理}')).toBe(false);
    });

    test('应该拒绝空节点', () => {
      expect(aiService.isValidMindmapNode('')).toBe(false);
      expect(aiService.isValidMindmapNode('   ')).toBe(false);
    });
  });

  // 注意：以下测试需要有效的OpenAI API密钥才能运行
  describe('AI功能集成测试', () => {
    const sampleContent = `
人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，它企图了解智能的实质，
并生产出一种新的能以人类智能相似的方式做出反应的智能机器。机器学习是人工智能的一个重要分支，
通过算法使机器能够从数据中学习并做出决策或预测。深度学习是机器学习的子集，
使用神经网络来模拟人脑的工作方式。
    `;

    test('应该生成文档摘要', async () => {
      // 跳过实际API调用的测试，除非有API密钥
      if (!process.env.OPENAI_API_KEY) {
        console.log('跳过AI测试：缺少OPENAI_API_KEY');
        return;
      }

      const summary = await aiService.generateSummary(sampleContent, {
        length: 'short',
        language: 'zh'
      });

      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    }, 30000);

    test('应该提取概念', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.log('跳过AI测试：缺少OPENAI_API_KEY');
        return;
      }

      const concepts = await aiService.extractConcepts(sampleContent, {
        maxConcepts: 5,
        language: 'zh'
      });

      expect(Array.isArray(concepts)).toBe(true);
      if (concepts.length > 0) {
        expect(concepts[0]).toHaveProperty('term');
        expect(concepts[0]).toHaveProperty('definition');
        expect(concepts[0]).toHaveProperty('category');
        expect(concepts[0]).toHaveProperty('importance');
      }
    }, 30000);

    test('应该生成练习题', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.log('跳过AI测试：缺少OPENAI_API_KEY');
        return;
      }

      const exercises = await aiService.generateExercises(sampleContent, {
        count: 3,
        types: ['multiple_choice', 'true_false'],
        difficulty: 'medium'
      });

      expect(Array.isArray(exercises)).toBe(true);
      if (exercises.length > 0) {
        expect(exercises[0]).toHaveProperty('type');
        expect(exercises[0]).toHaveProperty('question');
        expect(['multiple_choice', 'true_false', 'short_answer']).toContain(exercises[0].type);
      }
    }, 30000);

    test('应该生成思维导图', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.log('跳过AI测试：缺少OPENAI_API_KEY');
        return;
      }

      const mindMap = await aiService.generateMindMap(sampleContent, {
        maxNodes: 10,
        language: 'zh'
      });

      expect(typeof mindMap).toBe('string');
      expect(mindMap).toMatch(/^mindmap/);
      expect(aiService.validateMermaidSyntax(mindMap)).toBe(true);
    }, 30000);
  });
});
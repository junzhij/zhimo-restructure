require('dotenv').config();
const OpenAI = require('openai');

// 简单的日志工具
const logger = {
  info: (message, data = {}) => {
    console.log(`[AIService] INFO: ${message}`, data);
  },
  error: (message, error = {}) => {
    console.error(`[AIService] ERROR: ${message}`, error);
  },
  debug: (message, data = {}) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[AIService] DEBUG: ${message}`, data);
    }
  }
};

class AIService {
  constructor() {
    // 只在有API密钥时初始化OpenAI客户端
    if (process.env.OPENAI_API_KEY) {
      const config = {
        apiKey: process.env.OPENAI_API_KEY,
      };

      // 如果设置了自定义baseURL，则使用它
      if (process.env.OPENAI_BASE_URL) {
        config.baseURL = process.env.OPENAI_BASE_URL;
      }

      this.openai = new OpenAI(config);
      logger.info('OpenAI客户端初始化成功', {
        baseURL: config.baseURL || 'https://api.openai.com/v1',
        hasApiKey: !!process.env.OPENAI_API_KEY
      });
    } else {
      this.openai = null;
      logger.error('OpenAI API密钥未配置');
    }

    // 从环境变量获取模型配置
    this.model = process.env.OPENAI_MODEL;
    this.temperature = parseFloat(process.env.AI_TEMPERATURE) || 0.3;
    this.maxTokens = parseInt(process.env.AI_MAX_TOKENS) || 4000;

    logger.info('AIService配置加载完成', {
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens
    });
  }

  /**
   * 检查OpenAI客户端是否可用
   */
  _checkOpenAIAvailable() {
    if (!this.openai) {
      throw new Error('OpenAI API密钥未配置，请设置OPENAI_API_KEY环境变量');
    }
  }



  /**
   * 文档重构 - 将文档内容重新组织和优化
   * @param {string} content - 原始文档内容
   * @param {Object} options - 重构选项
   * @returns {Promise<string>} 重构后的markdown内容
   */
  async restructureDocument(content, options = {}) {
    this._checkOpenAIAvailable();

    const { style = 'academic', language = 'zh' } = options;

    const prompt = `请对以下文档内容进行重构，要求：
1. 保持原有信息的完整性
2. 优化文档结构和逻辑
3. 使用清晰的标题层级
4. 改善语言表达和可读性
5. 输出格式为markdown
6. 风格：${style}
7. 语言：${language}

原始内容：
${content}

请输出重构后的文档：`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      return response.choices[0].message.content;
    } catch (error) {
      throw new Error(`文档重构失败: ${error.message}`);
    }
  }

  /**
   * AI摘要生成
   * @param {string} content - 文档内容
   * @param {Object} options - 摘要选项
   * @returns {Promise<string>} 摘要内容（markdown格式）
   */
  async generateSummary(content, options = {}) {
    this._checkOpenAIAvailable();

    const { length = 'medium', language = 'zh', includeKeyPoints = true } = options;

    const lengthMap = {
      short: '100-200字',
      medium: '300-500字',
      long: '500-800字'
    };

    const prompt = `请为以下文档生成摘要，要求：
1. 长度：${lengthMap[length]}
2. 语言：${language}
3. ${includeKeyPoints ? '包含关键要点列表' : ''}
4. 输出格式为markdown
5. 保持客观和准确

文档内容：
${content}

请生成摘要：`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: this.maxTokens,
      });

      return response.choices[0].message.content;
    } catch (error) {
      throw new Error(`摘要生成失败: ${error.message}`);
    }
  }  /**

   * AI出题 - 基于文档内容生成练习题
   * @param {string} content - 文档内容
   * @param {Object} options - 出题选项
   * @returns {Promise<Array>} 题目数组
   */
  async generateExercises(content, options = {}) {
    this._checkOpenAIAvailable();

    const {
      count = 5,
      types = ['multiple_choice', 'true_false', 'short_answer'],
      difficulty = 'medium',
      language = 'zh'
    } = options;

    const prompt = `基于以下文档内容生成${count}道练习题，要求：
1. 题目类型：${types.join(', ')}
2. 难度：${difficulty}
3. 语言：${language}
4. 必须严格按照以下JSON格式输出，不要包含任何其他文字：

{
  "exercises": [
    {
      "type": "multiple_choice",
      "question": "题目内容",
      "options": ["A选项", "B选项", "C选项", "D选项"],
      "correct_answer": "A",
      "explanation": "答案解释"
    },
    {
      "type": "true_false",
      "question": "判断题内容",
      "correct_answer": true,
      "explanation": "答案解释"
    },
    {
      "type": "short_answer",
      "question": "简答题内容",
      "sample_answer": "参考答案",
      "key_points": ["要点1", "要点2"]
    }
  ]
}

文档内容：
${content}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: this.maxTokens,
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result.exercises;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`AI出题响应格式错误: ${error.message}`);
      }
      throw new Error(`AI出题失败: ${error.message}`);
    }
  }

  /**
   * 提取概念 - 从文档中提取关键概念
   * @param {string} content - 文档内容
   * @param {Object} options - 提取选项
   * @returns {Promise<Array>} 概念数组，符合Concept模型格式
   */
  async extractConcepts(content, options = {}) {
    this._checkOpenAIAvailable();

    const { maxConcepts = 10, language = 'zh' } = options;

    const prompt = `从以下文档中提取关键概念，要求：
1. 最多提取${maxConcepts}个概念
2. 语言：${language}
3. 必须严格按照以下JSON格式输出，不要包含任何其他文字：

{
  "concepts": [
    {
      "term": "概念术语",
      "definition": "概念定义（详细说明）",
      "category": "person|place|concept|term|formula|theory|other",
      "importance": 1-5,
      "occurrences": [
        {
          "position": 文档中的字符位置,
          "context": "包含该概念的上下文片段",
          "confidence": 0.0-1.0
        }
      ],
      "relatedTerms": ["相关术语1", "相关术语2"]
    }
  ]
}

注意：
- term: 概念的核心术语，不超过200字符
- definition: 详细定义，不超过2000字符
- category: 必须是枚举值之一
- importance: 1-5的数字，5最重要
- occurrences: 在文档中出现的位置和上下文
- relatedTerms: 相关术语列表

文档内容：
${content}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result.concepts;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`概念提取响应格式错误: ${error.message}`);
      }
      throw new Error(`概念提取失败: ${error.message}`);
    }
  }  /**

   * 生成思维导图 - 基于文档内容生成Mermaid格式的思维导图
   * @param {string} content - 文档内容
   * @param {Object} options - 生成选项
   * @returns {Promise<Object>} 包含title和mermaid内容的对象
   */
  async generateMindMap(content, options = {}) {
    this._checkOpenAIAvailable();

    const { maxNodes = 20, language = 'zh', style = 'mindmap' } = options;

    const prompt = `基于以下文档内容生成思维导图，要求：
1. 使用Mermaid mindmap语法
2. 最多${maxNodes}个节点
3. 语言：${language}
4. 样式：${style}
5. 必须严格按照以下JSON格式输出，不要包含任何其他文字：

{
  "title": "思维导图标题",
  "mermaid": "mindmap代码内容"
}

## Mermaid Mindmap 语法规则：
- 必须以 \`mindmap\` 开头
- 根节点格式：\`root((文本内容))\`
- 使用空格缩进表示层级关系（2空格为一级，4空格为二级，以此类推）
- 节点形状语法：
  * \`((文本))\` - 圆形
  * \`(文本)\` - 圆角矩形  
  * \`[文本]\` - 矩形
  * \`{{文本}}\` - 六边形
  * \`))文本((\` - 云形
  * \`>文本]\` - 不对称形状
- 同级节点必须使用相同缩进
- 避免使用 \`---\` 或 \`[(text)]\` 等错误语法
- 节点文本不宜过长
- 建议层级深度不超过4-5层

## 正确示例：
\`\`\`
mindmap
  root((主题))
    分支1
      子节点1
      子节点2
    分支2
      子节点3
        孙节点1
        孙节点2
\`\`\`

文档内容：
${content}

请生成JSON格式的思维导图：`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const result = JSON.parse(response.choices[0].message.content);

      // 验证返回的数据结构
      if (!result.title || !result.mermaid) {
        throw new Error('AI返回的JSON格式不正确，缺少title或mermaid字段');
      }

      return result;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`思维导图响应格式错误: ${error.message}`);
      }
      throw new Error(`思维导图生成失败: ${error.message}`);
    }
  }

  /**
   * 验证Mermaid语法
   * @param {string} mermaidCode - Mermaid代码
   * @returns {boolean} 是否语法正确
   */
  validateMermaidSyntax(mermaidCode) {
    try {
      // 基本语法检查
      const lines = mermaidCode.split('\n').filter(line => line.trim());

      // 检查是否有图表类型声明
      const firstLine = lines[0]?.trim();
      const validTypes = ['mindmap', 'graph', 'flowchart', 'gitgraph', 'journey', 'gantt', 'pie', 'quadrantChart'];
      const hasValidType = validTypes.some(type => firstLine?.startsWith(type));

      if (!hasValidType) {
        return false;
      }

      // 检查mindmap特定语法
      if (firstLine.startsWith('mindmap')) {
        // 检查节点格式
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line && !this.isValidMindmapNode(line)) {
            return false;
          }
        }
      }

      // 检查是否有基本的节点内容
      if (lines.length < 2) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证思维导图节点格式
   * @param {string} line - 节点行
   * @returns {boolean} 是否为有效节点
   */
  isValidMindmapNode(line) {
    // 检查缩进和节点格式
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    // 移除缩进后的内容
    const content = line.trim();

    // 检查是否为有效的节点内容（不为空，不包含特殊字符）
    if (!content || content.length === 0) {
      return false;
    }

    // 检查是否包含不允许的字符
    const invalidChars = ['<', '>', '{', '}', '[', ']', '(', ')', '|'];
    for (const char of invalidChars) {
      if (content.includes(char)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 批量处理文档 - 一次性生成所有AI内容
   * @param {string} content - 文档内容
   * @param {Object} options - 处理选项
   * @returns {Promise<Object>} 包含所有生成内容的对象
   */
  async processDocument(content, options = {}) {
    const {
      includeRestructure = true,
      includeSummary = true,
      includeExercises = true,
      includeConcepts = true,
      includeMindMap = true,
      ...otherOptions
    } = options;

    const results = {};

    try {
      const promises = [];

      if (includeRestructure) {
        promises.push(
          this.restructureDocument(content, otherOptions)
            .then(result => ({ restructuredContent: result }))
            .catch(error => ({ restructureError: error.message }))
        );
      }

      if (includeSummary) {
        promises.push(
          this.generateSummary(content, otherOptions)
            .then(result => ({ summary: result }))
            .catch(error => ({ summaryError: error.message }))
        );
      }

      if (includeExercises) {
        promises.push(
          this.generateExercises(content, otherOptions)
            .then(result => ({ exercises: result }))
            .catch(error => ({ exercisesError: error.message }))
        );
      }

      if (includeConcepts) {
        promises.push(
          this.extractConcepts(content, otherOptions)
            .then(result => ({ concepts: result }))
            .catch(error => ({ conceptsError: error.message }))
        );
      }

      if (includeMindMap) {
        promises.push(
          this.generateMindMap(content, otherOptions)
            .then(result => ({ mindMap: result }))
            .catch(error => ({ mindMapError: error.message }))
        );
      }

      const allResults = await Promise.all(promises);

      // 合并所有结果
      allResults.forEach(result => {
        Object.assign(results, result);
      });

      return results;
    } catch (error) {
      throw new Error(`批量处理文档失败: ${error.message}`);
    }
  }
}

module.exports = AIService;
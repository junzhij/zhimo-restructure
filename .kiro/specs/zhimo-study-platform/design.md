# 知墨学习平台设计文档

## 概述

知墨（ZhiMo）是一个基于Node.js的智能学习平台后端系统，旨在支持学生从"收集"到"消化"再到"产出"的完整学习流程。系统通过AI助教功能解决信息过载问题，将多格式学习资料转化为易于理解和记忆的知识点。

### 核心功能
- 多格式文档上传和解析（PDF、Word、PPT、图片、网页）
- AI驱动的文档摘要生成
- 关键概念识别和提取
- 思维导图自动生成
- 智能练习题生成

## 架构

### 整体架构
系统采用分层架构模式，包含以下主要层次：

```
┌─────────────────────────────────────┐
│           API Gateway               │
├─────────────────────────────────────┤
│         Controller Layer            │
├─────────────────────────────────────┤
│          Service Layer              │
├─────────────────────────────────────┤
│          Database Layer             │
└─────────────────────────────────────┘
```

### 技术栈选择
- **运行时**: Node.js (LTS版本)
- **框架**: Express.js (轻量级、成熟的Web框架)
- **数据库**: MongoDB (文档型数据库，适合存储非结构化学习资料)
- **文件存储**: AWS S3
- **AI服务**: OpenAI API
- **文档处理**: 
  - PDF: pdf-parse
  - Word: mammoth.js
  - PPT: node-pptx
  - OCR: Tesseract.js
- **认证**: JWT Token
- **缓存**: Redis (可选，用于提升性能)

## 组件和接口

### 1. 文档管理服务 (DocumentService)

**职责**: 处理多格式文档的上传、解析和存储

**核心接口**:
```javascript
class DocumentService {
  async uploadDocument(file, userId, metadata)
  async parseDocument(documentId, format)
  async convertToMarkdown(documentId)
  async getDocument(documentId, userId)
  async listUserDocuments(userId, filters)
  async deleteDocument(documentId, userId)
}
```

**设计决策**: 
- 使用策略模式处理不同文档格式的解析
- 所有文档统一转换为Markdown格式存储，便于后续AI处理
- 支持异步处理大文件，避免阻塞主线程

### 2. AI助教服务 (AIAssistantService)

**职责**: 提供AI驱动的内容分析和生成功能

**核心接口**:
```javascript
class AIAssistantService {
  async generateSummary(content, summaryType) // 返回markdown格式摘要
  async extractKeywords(content) // 使用AI prompt提取关键概念
  async highlightKeyTerms(markdownContent) // 在markdown中高亮关键词
  async generateMindMap(content) // 生成Mermaid格式思维导图
  async generateQuestions(content, questionTypes) // 生成markdown格式练习题
  async evaluateAnswer(question, userAnswer, standardAnswer)
  async formatConceptExtraction(content) // AI prompt调试格式化概念输出
  async optimizePromptForConcepts(documentType) // 根据文档类型优化概念提取prompt
}
```

**设计决策**:
- 实现请求缓存机制，避免重复调用AI服务
- 支持批量处理以提高效率
- **所有AI生成内容统一输出为markdown格式**
- **概念提取使用专门的AI prompt进行调试和格式化输出**
- **思维导图生成直接输出Mermaid语法的plaintext字符串**

### 3. 概念管理服务 (ConceptService)

**职责**: 管理关键概念的识别、存储和检索

**核心接口**:
```javascript
class ConceptService {
  async extractConcepts(documentId)// AI 驱动
  async createConceptCard(concept, context)
  async getConceptOccurrences(conceptId, documentId)
  async searchConcepts(query, userId)
  async linkConcepts(conceptId1, conceptId2, relationship)
}
```

### 4. 思维导图服务 (MindMapService)

**职责**: 生成和管理思维导图，使用Mermaid格式存储

**核心接口**:
```javascript
class MindMapService {
  async generateMindMap(documentId) // 返回Mermaid格式的思维导图代码
  async parseMermaidContent(mermaidString) // 解析Mermaid内容为节点结构
  async updateMindMapNode(mindMapId, nodeId, updates)
  async addMindMapNode(mindMapId, parentNodeId, nodeData)
  async deleteMindMapNode(mindMapId, nodeId)
  async getMindMap(mindMapId, userId) // 返回Mermaid格式字符串
  async validateMermaidSyntax(mermaidContent) // 验证Mermaid语法正确性
}
```

**设计决策**:
- 思维导图以Mermaid格式的plaintext-markdown存储为string
- 支持Mermaid的多种图表类型（flowchart、mindmap、graph等）
- 提供Mermaid语法验证确保生成的图表可正确渲染

### 5. 练习服务 (ExerciseService)

**职责**: 生成和管理练习题

**核心接口**:
```javascript
class ExerciseService {
  async generateQuestions(documentId, questionTypes, count)
  async submitAnswer(questionId, userId, answer)
  async getExerciseHistory(userId, documentId)
  async adaptDifficulty(userId, performance)
}
```

## 数据模型

### 用户模型 (User)
```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  passwordHash: String,
  profile: {
    displayName: String,
    avatar: String
  },
  preferences: {
    defaultSummaryType: String,
    language: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 文档模型 (Document)
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  title: String,
  originalFormat: String, // pdf, docx, pptx, image, url
  filePath: String,
  markdownContent: String,
  metadata: {
    fileSize: Number,
    uploadDate: Date,
    originalFileName: String,
    mimeType: String
  },
  processingStatus: String, // pending, processing, completed, failed
  syncStatus: {
    lastSynced: Date,
    version: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 摘要模型 (Summary)
```javascript
{
  _id: ObjectId,
  documentId: ObjectId,
  userId: ObjectId,
  type: String, // oneline, detailed, keypoints
  content: String,
  generatedAt: Date,
  version: Number
}
```

### 概念模型 (Concept)
```javascript
{
  _id: ObjectId,
  term: String,
  definition: String,
  documentId: ObjectId,
  userId: ObjectId,
  occurrences: [{
    position: Number,
    context: String
  }],
  relatedConcepts: [ObjectId],
  createdAt: Date
}
```

### 思维导图模型 (MindMap)
```javascript
{
  _id: ObjectId,
  documentId: ObjectId,
  userId: ObjectId,
  title: String,
  mermaidContent: String, // 存储Mermaid格式的plaintext-markdown字符串
  mermaidType: String, // flowchart, mindmap, graph等Mermaid图表类型
  version: Number,
  metadata: {
    nodeCount: Number,
    complexity: String, // simple, medium, complex
    generationPrompt: String // 用于生成此思维导图的AI prompt
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 练习题模型 (Exercise)
```javascript
{
  _id: ObjectId,
  documentId: ObjectId,
  userId: ObjectId,
  questions: [{
    id: String,
    type: String, // multiple_choice, true_false, short_answer
    question: String,
    options: [String], // for multiple choice
    correctAnswer: String,
    explanation: String,
    difficulty: Number
  }],
  createdAt: Date
}
```

### 练习记录模型 (ExerciseRecord)
```javascript
{
  _id: ObjectId,
  exerciseId: ObjectId,
  userId: ObjectId,
  answers: [{
    questionId: String,
    userAnswer: String,
    isCorrect: Boolean,
    timeSpent: Number
  }],
  completedAt: Date
}
```

## 错误处理

### 错误分类
1. **客户端错误 (4xx)**
   - 400: 请求参数错误
   - 401: 未授权访问
   - 403: 权限不足
   - 404: 资源不存在
   - 413: 文件过大

2. **服务器错误 (5xx)**
   - 500: 内部服务器错误
   - 502: AI服务不可用
   - 503: 服务暂时不可用

### 错误处理策略
```javascript
class ErrorHandler {
  static handleDocumentProcessingError(error) {
    // 文档处理失败时的重试机制
  }
  
  static handleAIServiceError(error) {
    // AI服务调用失败时的降级处理
  }
  
  static handleSyncError(error) {
    // 同步失败时的冲突解决
  }
}
```

### 重试机制
- AI服务调用失败：指数退避重试，最多3次
- 文档上传失败：立即重试1次，然后提示用户
- 同步失败：后台定期重试，直到成功或达到最大重试次数

## 测试策略

### 单元测试
- 使用Jest框架进行单元测试
- 每个Service类都需要有对应的测试文件
- 测试覆盖率目标：80%以上

### 集成测试
- 测试API端点的完整流程
- 测试数据库操作的正确性
- 测试AI服务集成的稳定性

### 性能测试
- 文档上传和处理的性能基准
- AI服务调用的响应时间监控
- 并发用户访问的压力测试

### 测试数据管理
- 使用测试数据库，与生产环境隔离
- 提供测试用的样本文档（各种格式）
- 模拟AI服务响应，减少测试成本

### 测试环境配置
```javascript
// test.config.js
module.exports = {
  database: {
    url: 'mongodb://localhost:27017/zhimo_test'
  },
  ai: {
    mockMode: true, // 使用模拟AI响应
    timeout: 5000
  },
  storage: {
    path: './test_uploads'
  }
}
```

## 安全考虑

### 认证和授权
- JWT Token认证
- 基于角色的访问控制
- API请求频率限制

### 数据安全
- 用户上传文件的病毒扫描
- 敏感信息加密存储
- 定期数据备份


## 性能优化

### 缓存策略
- 文档解析结果缓存
- 用户会话缓存

### 异步处理
- 大文件上传使用流式处理
- AI服务调用异步化
- 后台任务队列处理耗时操作

### 数据库优化
- 适当的索引设计
- 查询优化
- 连接池管理
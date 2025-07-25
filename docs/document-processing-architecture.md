# 文档处理架构说明

## 架构概览

重构后的文档处理系统采用分层架构，将职责清晰分离：

```
DocumentController -> DocumentService -> FileExtractService -> AIService
                           |                    |
                           v                    v
                      S3 + MongoDB        Summary + Concept
```

## 核心组件

### 1. DocumentService
**职责**: S3文件存储 + MongoDB文档记录管理

**主要功能**:
- `uploadDocument()` - 上传文件到S3，创建MongoDB记录
- `getDocument()` - 获取文档详情
- `listUserDocuments()` - 获取用户文档列表
- `updateDocument()` - 更新文档信息
- `deleteDocument()` - 软删除文档
- `permanentDeleteDocument()` - 物理删除文档和S3文件
- `getFileStream()` - 获取S3文件流（用于下载）
- `processFileExtraction()` - 异步触发文件提取

### 2. FileExtractService
**职责**: 文件内容提取 + AI处理协调

**主要功能**:
- `extractToMarkdown()` - 将原始文件转换为Markdown
  - PDF提取（已实现）
  - Word提取（待实现）
  - 纯文本提取
- `processAIFeatures()` - 异步处理AI功能
  - 调用AI重构
  - 生成摘要并保存到Summary集合
  - 提取概念并保存到Concept集合

### 3. AIService
**职责**: AI功能实现

**主要功能**:
- `restructureDocument()` - 文档重构
- `generateSummary()` - 生成摘要
- `extractConcepts()` - 提取概念
- `generateExercises()` - 生成练习题
- `generateMindMap()` - 生成思维导图
- `validateMermaidSyntax()` - 验证Mermaid语法

### 4. DocumentController
**职责**: HTTP请求处理

**主要功能**:
- `uploadDocument()` - 处理文档上传请求
- `getDocument()` - 获取文档详情
- `listDocuments()` - 获取文档列表
- 其他CRUD操作
- AI功能的HTTP接口（可选，因为AI处理是自动的）

## 处理流程

### 文档上传流程

1. **用户上传文件** → DocumentController.uploadDocument()
2. **文件验证** → DocumentService._validateFile()
3. **上传到S3** → DocumentService._uploadToS3()
4. **创建MongoDB记录** → Document.save()
5. **异步文件提取** → DocumentService.processFileExtraction()
6. **返回响应** → 状态: pending

### 文件提取流程（异步）

1. **更新状态为processing** → Document.findByIdAndUpdate()
2. **提取文件内容** → FileExtractService.extractToMarkdown()
   - PDF解析 → pdfParse()
   - 转换为Markdown
3. **保存Markdown内容** → Document.findByIdAndUpdate()
4. **异步AI处理** → FileExtractService.processAIFeatures()

### AI处理流程（异步）

1. **AI重构文档** → AIService.restructureDocument()
2. **更新重构内容** → Document.findByIdAndUpdate()
3. **并行处理**:
   - **生成摘要** → AIService.generateSummary() → Summary.save()
   - **提取概念** → AIService.extractConcepts() → Concept.save()

## 数据模型

### Document集合
```javascript
{
  userId: ObjectId,
  title: String,
  originalFormat: String,
  filePath: String, // S3路径
  markdownContent: String, // 提取的内容
  restructuredContent: String, // AI重构后的内容
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed',
  processingError: String,
  metadata: {
    originalFileName: String,
    fileSize: Number,
    mimeType: String,
    s3Key: String,
    s3Bucket: String
  },
  tags: [String]
}
```

### Summary集合
```javascript
{
  documentId: ObjectId,
  userId: ObjectId,
  content: String,
  type: 'ai_generated' | 'manual',
  metadata: {
    aiModel: String,
    generatedAt: Date,
    contentLength: Number
  }
}
```

### Concept集合
```javascript
{
  term: String,
  definition: String,
  documentId: ObjectId,
  userId: ObjectId,
  category: 'person' | 'place' | 'concept' | 'term' | 'formula' | 'theory' | 'other',
  importance: Number, // 1-5
  occurrences: [{
    position: Number,
    context: String,
    confidence: Number
  }],
  metadata: {
    extractionMethod: 'ai',
    aiModel: String,
    extractionConfidence: Number
  }
}
```

## 环境配置

### 必需的环境变量
```env
# 数据库
MONGODB_URI=mongodb://localhost:27017/zhimo_study_platform

# S3配置
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket

# AI服务
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-3.5-turbo
AI_TEMPERATURE=0.3
AI_MAX_TOKENS=4000
```

## API接口

### 文档上传
```http
POST /api/documents/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

{
  "document": <file>,
  "title": "文档标题",
  "tags": "标签1,标签2"
}
```

### 获取文档状态
```http
GET /api/documents/:documentId
Authorization: Bearer <token>
```

### 获取文档列表
```http
GET /api/documents?format=pdf&status=completed&search=关键词
Authorization: Bearer <token>
```

## 测试

### 运行测试
```bash
# 测试完整流程
node scripts/test-document-flow.js

# 测试AI服务
node scripts/test-ai-service.js

# 测试API上传（需要先启动服务器）
node scripts/test-api-upload.js
```

## 扩展点

1. **支持更多文件格式**: 在FileExtractService中添加新的提取方法
2. **自定义AI处理**: 修改processAIFeatures方法
3. **批量处理**: 添加批量上传和处理功能
4. **处理队列**: 使用Redis队列处理大量文件
5. **缓存优化**: 添加Redis缓存提高性能

## 注意事项

1. **异步处理**: AI处理是异步的，需要通过轮询或WebSocket获取处理状态
2. **错误处理**: 文件提取失败会更新processingStatus为'failed'
3. **资源管理**: 大文件处理需要考虑内存和超时限制
4. **并发控制**: 可能需要限制同时处理的文件数量
5. **数据一致性**: 确保S3和MongoDB数据的一致性
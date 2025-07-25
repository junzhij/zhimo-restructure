# AI端点重构说明

## 概述

根据系统架构优化需求，AI相关的端点已从"生成式"改为"查询式"。AI处理现在在文档上传时自动完成，相关端点只负责查询已生成的结果。

## 变更详情

### 1. 端点方法变更

| 功能 | 原端点 | 新端点 | 变更说明 |
|------|--------|--------|----------|
| AI文档重构 | `POST /api/documents/:id/ai/restructure` | `GET /api/documents/:id/ai/restructure` | 查询已生成的重构内容 |
| 文档摘要 | `POST /api/documents/:id/ai/summary` | `GET /api/documents/:id/ai/summary` | 查询Summary集合中的摘要 |
| 概念提取 | `POST /api/documents/:id/ai/concepts` | `GET /api/documents/:id/ai/concepts` | 查询Concept集合中的概念 |
| 练习题生成 | `POST /api/documents/:id/ai/exercises` | `POST /api/documents/:id/ai/exercises` | 保持不变（按需生成） |
| 思维导图 | `POST /api/documents/:id/ai/mindmap` | `POST /api/documents/:id/ai/mindmap` | 保持不变（按需生成） |

### 2. 控制器方法变更

| 原方法名 | 新方法名 | 功能变更 |
|----------|----------|----------|
| `restructureDocument` | `getRestructuredContent` | 从Document.restructuredContent字段查询 |
| `generateSummary` | `getDocumentSummary` | 从Summary集合查询，支持类型筛选 |
| `extractConcepts` | `getDocumentConcepts` | 从Concept集合查询，支持分类和重要性筛选 |

### 3. 响应格式变更

#### AI重构内容
```javascript
// 新响应格式
{
  "success": true,
  "data": {
    "originalContent": "原始Markdown内容",
    "restructuredContent": "AI重构后的内容",
    "processingStatus": "completed"
  }
}
```

#### 文档摘要
```javascript
// 新响应格式
{
  "success": true,
  "data": {
    "summaries": [
      {
        "id": "摘要ID",
        "type": "ai_generated|oneline|detailed|keypoints",
        "content": "摘要内容",
        "wordCount": 500,
        "generatedAt": "2024-01-01T00:00:00.000Z",
        "aiModel": "gpt-3.5-turbo"
      }
    ]
  }
}
```

#### 文档概念
```javascript
// 新响应格式
{
  "success": true,
  "data": {
    "concepts": [
      {
        "id": "概念ID",
        "term": "概念术语",
        "definition": "概念定义",
        "category": "concept|person|place|term|formula|theory|other",
        "importance": 4,
        "occurrenceCount": 3,
        "extractionConfidence": 0.85,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 15
  }
}
```

### 4. 查询参数支持

#### 摘要查询
- `type`: 筛选摘要类型 (`ai_generated`, `oneline`, `detailed`, `keypoints`)

```bash
GET /api/documents/:id/ai/summary?type=detailed
```

#### 概念查询
- `category`: 筛选概念分类
- `importance`: 最低重要性等级 (1-5)
- `limit`: 返回数量限制

```bash
GET /api/documents/:id/ai/concepts?category=concept&importance=4&limit=10
```

## 处理流程

### 文档上传时的AI处理
1. 用户上传文档 → `POST /api/documents/upload`
2. 文件存储到S3，创建Document记录
3. 异步提取文件内容为Markdown
4. **自动触发AI处理**:
   - AI重构文档 → 更新Document.restructuredContent
   - 生成摘要 → 保存到Summary集合
   - 提取概念 → 保存到Concept集合

### 查询AI结果
1. 客户端查询AI结果 → `GET /api/documents/:id/ai/*`
2. 验证文档权限
3. 从数据库查询已生成的结果
4. 返回格式化的响应

## 错误处理

### 404 - 内容未生成
```javascript
{
  "success": false,
  "message": "文档摘要尚未生成" // 或其他相应消息
}
```

### 400 - 文档未处理完成
```javascript
{
  "success": false,
  "message": "文档尚未处理完成"
}
```

## 测试

### 运行AI端点测试
```bash
npm run test:ai-endpoints
```

### 手动测试示例
```bash
# 获取文档摘要
curl -X GET "http://localhost:3000/api/documents/DOCUMENT_ID/ai/summary" \
  -H "Authorization: Bearer TOKEN"

# 获取概念（筛选高重要性）
curl -X GET "http://localhost:3000/api/documents/DOCUMENT_ID/ai/concepts?importance=4&limit=5" \
  -H "Authorization: Bearer TOKEN"

# 获取重构内容
curl -X GET "http://localhost:3000/api/documents/DOCUMENT_ID/ai/restructure" \
  -H "Authorization: Bearer TOKEN"
```

## 优势

1. **性能提升**: 避免重复AI调用，响应更快
2. **成本降低**: 减少AI API调用次数
3. **用户体验**: 即时获取结果，无需等待AI处理
4. **数据持久化**: AI结果保存在数据库中，支持历史查询
5. **可扩展性**: 支持多种摘要类型和概念分类

## 注意事项

1. **数据一致性**: 确保AI处理完成后数据正确保存
2. **错误处理**: 处理AI生成失败的情况
3. **权限验证**: 确保用户只能访问自己的文档AI结果
4. **缓存策略**: 考虑添加Redis缓存提高查询性能

## 迁移指南

### 客户端代码更新
```javascript
// 旧代码
const response = await fetch('/api/documents/123/ai/summary', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ length: 'medium' })
});

// 新代码
const response = await fetch('/api/documents/123/ai/summary', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' }
});
```

### 响应处理更新
```javascript
// 旧响应处理
const { summary } = response.data;

// 新响应处理
const { summaries } = response.data;
const summary = summaries[0]?.content; // 获取第一个摘要
```
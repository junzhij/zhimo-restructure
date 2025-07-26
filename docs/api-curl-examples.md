# 智墨学习平台 API cURL 使用范例

## 基础配置

```bash
BASE_URL="http://localhost:3000"
TIMESTAMP=$(date +%s)
```

## 1. 用户认证

### 注册用户

```bash
curl -X POST 127.0.0.1:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser_1",
    "email": "test_1@example.com",
    "password": "Test123456!",
    "profile": {
      "displayName": "测试用户"
    }
  }'
```

**响应示例:**
```json
{
  "success": true,
  "message": "用户注册成功",
  "data": {
    "user": {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "username": "testuser_1627123456",
      "email": "test_1627123456@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 用户登录

```bash
curl -X POST 127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser_",
    "password": "Test123456!"
  }'
```

### 获取Token（用于后续请求）

```bash
TOKEN=$(curl -s -X POST 127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test123456!"
  }' | jq -r '.data.token')

echo "Token: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0"
```

## 2. 文档管理

### 上传文档

```bash
curl -X POST 127.0.0.1:3000/api/documents/upload \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" \
  -F "document=@tests/example.pdf" \
  -F "title=测试文档" \
  -F "tags=测试,PDF"
```

**响应示例:**

```json
{
  "success": true,
  "message": "文档上传成功，正在处理中",
  "data": {
    "document": {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "title": "测试文档",
      "originalFormat": "pdf",
      "processingStatus": "pending",
      "filePath": "documents/1627123456-abc123.pdf"
    },
    "processingStatus": "pending"
  }
}
```

### 获取文档列表

```bash
curl -X GET 127.0.0.1:3000/api/documents \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0"
```

**带查询参数:**

```bash
curl -X GET "127.0.0.1:3000/api/documents?format=pdf&status=completed&search=测试&limit=10&offset=0" \
  -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0"
```

### 获取文档详情

```bash
# 替换 {documentId} 为实际的文档ID
curl -X GET 127.0.0.1:3000/api/documents/688383698d5a1a90b03e4ddf \
  -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0"
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "title": "测试文档",
    "originalFormat": "pdf",
    "processingStatus": "completed",
    "markdownContent": "# 文档标题\n\n这是文档内容...",
    "restructuredContent": "# 重构后的文档\n\n## 1. 优化后的结构\n\n经过AI重构的内容...",
    "metadata": {
      "originalFileName": "example.pdf",
      "fileSize": 1024000,
      "mimeType": "application/pdf"
    }
  }
}
```

**注意**: `restructuredContent`字段在AI重构完成后自动填入，如果文档尚未完成AI处理，该字段可能为`null`。
```

### 下载文档

```bash
curl -X GET 127.0.0.1:3000/api/documents/688383698d5a1a90b03e4ddf/download \
  -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" \
  -o downloaded_document.pdf
```

### 获取文档Markdown内容

```bash
curl -X GET $BASE_URL/api/documents/{documentId}/markdown \
  -H "Authorization: Bearer $TOKEN"
```

### 获取重构后的内容

```bash
# 获取AI重构后的内容（如果可用）
curl -X GET $BASE_URL/api/documents/{documentId} \
  -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" \
  | jq '.data.restructuredContent'
```

**说明**: `restructuredContent`字段包含AI重构后的优化内容，在文档处理完成后自动生成。如果文档尚未完成AI处理，该字段可能为`null`。

### 更新文档

```bash
curl -X PUT 127.0.0.1:3000/api/documents/{documentId} \
  -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "更新后的标题",
    "tags": ["新标签", "更新"]
  }'
```

### 删除文档（软删除）

```bash
curl -X DELETE 127.0.0.1:3000/api/documents/{documentId} \
  -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0"
```

## 3. AI功能

### 文档重构

```bash
curl -X GET 127.0.0.1:3000/api/documents/6883d5973da75c7e8069b677/ai/restructure \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODgzZDU1NDNkYTc1YzdlODA2OWI2M2UiLCJpYXQiOjE3NTM0NzAzNDEsImV4cCI6MTc1NDA3NTE0MX0.OQzYuGRgtrm_nLxD_ukwKiasByEBYCM__aIEAh9P5YQ" \
  -H "Content-Type: application/json" \
  -d '{
    "style": "academic",
    "language": "zh"
  }'
```

### 生成摘要

```bash
curl -X GET 127.0.0.1:3000/api/documents/6883d5973da75c7e8069b677/ai/summary \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODgzZDU1NDNkYTc1YzdlODA2OWI2M2UiLCJpYXQiOjE3NTM0NzAzNDEsImV4cCI6MTc1NDA3NTE0MX0.OQzYuGRgtrm_nLxD_ukwKiasByEBYCM__aIEAh9P5YQ" \
  -H "Content-Type: application/json" \
  -d '{
    "length": "medium",
    "language": "zh",
    "includeKeyPoints": true
  }'
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "summary": "# 文档摘要\n\n这是一个关于...",
    "options": {
      "length": "medium",
      "language": "zh",
      "includeKeyPoints": true
    }
  }
}
```

### 生成练习题

```bash
curl -X POST 127.0.0.1:3000/api/documents/688383698d5a1a90b03e4ddf/ai/exercises \
  -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" \
  -H "Content-Type: application/json" \
  -d '{
    "count": 5,
    "types": ["multiple_choice", "true_false", "short_answer"],
    "difficulty": "medium",
    "language": "zh"
  }'
```

### 提取概念

```bash
curl -X POST 127.0.0.1:3000/api/documents/688383698d5a1a90b03e4ddf/ai/concepts \
  -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" \
  -H "Content-Type: application/json" \
  -d '{
    "maxConcepts": 10,
    "language": "zh"
  }'
```

### 生成思维导图

```bash
curl -X POST 127.0.0.1:3000/api/documents/68844c6a72f62a5ff2e7e75c/ai/mindmap \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" \
  -H "Content-Type: application/json" \
  -d '{
    "maxNodes": 20,
    "language": "zh",
    "style": "mindmap"
  }'
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "mindMap": "mindmap\n  root((学习平台))\n    文档管理\n      上传文档\n      解析PDF",
    "isValidSyntax": true,
    "options": {
      "maxNodes": 20,
      "language": "zh",
      "style": "mindmap"
    }
  }
}
```

### 批量AI处理

```bash
curl -X POST 127.0.0.1:3000/api/documents/{documentId}/ai/process \
  -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" \
  -H "Content-Type: application/json" \
  -d '{
    "includeRestructure": true,
    "includeSummary": true,
    "includeExercises": true,
    "includeConcepts": true,
    "includeMindMap": true,
    "language": "zh"
  }'
```

## 4. 完整测试流程

### 自动化测试脚本

```bash
#!/bin/bash
# 保存为 test-api.sh 并执行

BASE_URL="http://localhost:3000"
TIMESTAMP=$(date +%s)

echo "🔐 注册并登录用户..."
REGISTER_RESPONSE=$(curl -s -X POST 127.0.0.1:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"testuser_$TIMESTAMP\",
    \"email\": \"test_$TIMESTAMP@example.com\",
    \"password\": \"Test123456!\",
    \"profile\": {
      \"displayName\": \"测试用户\"
    }
  }")

TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.token')

if [ "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" = "null" ] || [ -z "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" ]; then
  echo "⚠️ 注册失败，尝试登录..."
  TOKEN=$(curl -s -X POST 127.0.0.1:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username": "testuser", "password": "Test123456!"}' | jq -r '.data.token')
fi

echo "✅ Token获取成功"

echo "📤 上传文档..."
UPLOAD_RESPONSE=$(curl -s -X POST 127.0.0.1:3000/api/documents/upload \
  -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" \
  -F "document=@tests/example.pdf" \
  -F "title=测试文档" \
  -F "tags=测试,PDF")

DOCUMENT_ID=$(echo $UPLOAD_RESPONSE | jq -r '.data.document._id')
echo "✅ 文档上传成功，ID: $DOCUMENT_ID"

echo "⏳ 等待文档处理完成..."
for i in {1..10}; do
  sleep 2
  STATUS_RESPONSE=$(curl -s -X GET 127.0.0.1:3000/api/documents/$DOCUMENT_ID \
    -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0")
  STATUS=$(echo $STATUS_RESPONSE | jq -r '.data.processingStatus')
  echo "📊 处理状态: $STATUS"
  
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
done

if [ "$STATUS" = "completed" ]; then
  echo "🎯 测试AI功能..."
  
  echo "📝 获取摘要..."
  curl -s -X GET 127.0.0.1:3000/api/documents/$DOCUMENT_ID/ai/summary \
    -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" | jq '.data.summaries[0].content' | head -3
  
  echo "🧠 获取概念..."
  curl -s -X GET 127.0.0.1:3000/api/documents/$DOCUMENT_ID/ai/concepts \
    -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" | jq '.data.concepts[].term'
  
  echo "🔄 获取重构内容..."
  curl -s -X GET 127.0.0.1:3000/api/documents/$DOCUMENT_ID/ai/restructure \
    -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" | jq '.data.restructuredContent' | head -3
fi

echo "📋 获取文档列表..."
curl -s -X GET 127.0.0.1:3000/api/documents \
  -H "Authorization: Bearer Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NGJkNDcyZjYyYTVmZjJlN2U3NTIiLCJpYXQiOjE3NTM1MDA2MjksImV4cCI6MTc1NDEwNTQyOX0.6Bi097rZp6zogIqPJ8Tr3RDiCX6THHfImrW89sEjVj0" | jq '.data[] | {id: ._id, title: .title, status: .processingStatus}'

echo "🎉 测试完成!"
```

## 5. 错误处理

### 常见错误响应

**401 未授权:**
```json
{
  "success": false,
  "message": "未提供认证令牌"
}
```

**400 请求错误:**
```json
{
  "success": false,
  "message": "请求参数验证失败",
  "errors": [
    {
      "field": "title",
      "message": "标题不能为空"
    }
  ]
}
```

**500 服务器错误:**
```json
{
  "success": false,
  "message": "文档上传失败: S3上传失败"
}
```

## 6. 使用提示

1. **环境要求:**
   - 服务器运行在 `http://localhost:3000`
   - 安装 `jq` 工具解析JSON响应
   - 确保 `tests/example.pdf` 文件存在

2. **Token管理:**
   - Token有效期为7天（可配置）
   - 每次请求都需要在Header中包含Token
   - Token格式: `Authorization: Bearer <token>`

3. **文件上传:**
   - 支持的格式: PDF, DOC, DOCX, TXT, JPG, PNG
   - 最大文件大小: 50MB（可配置）
   - 使用 `multipart/form-data` 格式

4. **异步处理:**
   - 文档上传后会异步处理
   - 通过 `processingStatus` 字段查看处理状态
   - 状态: `pending` → `processing` → `completed`/`failed`
   - AI重构后的内容自动填入 `restructuredContent` 字段

5. **AI功能:**
   - 需要配置有效的OpenAI API密钥
   - AI处理可能需要较长时间
   - 支持多种AI模型和参数配置




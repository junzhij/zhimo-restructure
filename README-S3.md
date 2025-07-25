# 智墨学习平台 - S3集成测试

本项目实现了完整的AWS S3文档存储功能，包括文件上传、下载、删除和管理。

## 🚀 快速开始

### 1. 环境配置

在`.env`文件中配置AWS S3凭证：

\`\`\`bash
# AWS S3配置
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=ap-northeast-3
S3_BUCKET_NAME=your-bucket-name
\`\`\`

### 2. 测试S3连接

\`\`\`bash
npm run test:s3-connection
\`\`\`

### 3. 运行完整的S3集成测试

\`\`\`bash
npm run test:s3-real
\`\`\`

## 📋 测试套件

| 测试类型 | 命令 | 描述 |
|---------|------|------|
| S3连接测试 | \`npm run test:s3-connection\` | 验证AWS配置和连接 |
| 真实S3测试 | \`npm run test:s3-real\` | 测试真实S3操作 |
| 应用层集成测试 | \`npm run test:s3\` | 测试API端点和服务层 |
| 所有测试 | \`npm test\` | 运行完整测试套件 |

## ✅ 测试覆盖功能

### 文件操作
- [x] 文件上传 (小文件和大文件)
- [x] 文件下载
- [x] 文件删除
- [x] 多种文件格式支持 (PDF, DOCX, PPTX, 图片)

### 性能和并发
- [x] 并发上传测试
- [x] 大文件多部分上传
- [x] 上传性能测试

### 错误处理
- [x] 无效凭证处理
- [x] 不存在的bucket处理
- [x] 文件验证错误
- [x] 网络错误处理

## 📊 测试结果示例

\`\`\`
Real S3 Integration Tests
  S3 Basic Operations
    ✓ should upload file to S3 (713 ms)
    ✓ should upload large file using multipart upload (3864 ms)
    ✓ should download file from S3 (412 ms)
    ✓ should handle PDF file upload (218 ms)
    ✓ should delete file from S3 (418 ms)
    ✓ should handle concurrent uploads (617 ms)
    ✓ should measure upload performance (224 ms)
  S3 Error Handling
    ✓ should handle non-existent bucket error (380 ms)
    ✓ should handle invalid credentials (233 ms)

Test Suites: 1 passed, 1 total
Tests: 9 passed, 9 total
Time: 8.578 s
\`\`\`

## 🔧 API端点

### 文档上传
\`\`\`http
POST /api/documents/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "document": <file>,
  "title": "文档标题",
  "tags": "标签1,标签2"
}
\`\`\`

### 文档列表
\`\`\`http
GET /api/documents
Authorization: Bearer <token>
\`\`\`

### 文档下载
\`\`\`http
GET /api/documents/:id/download
Authorization: Bearer <token>
\`\`\`

### 文档删除
\`\`\`http
DELETE /api/documents/:id
Authorization: Bearer <token>
\`\`\`

### URL文档添加
\`\`\`http
POST /api/documents/url
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com",
  "title": "网页文档标题"
}
\`\`\`

## 🛠️ 技术栈

- **后端**: Node.js + Express
- **数据库**: MongoDB
- **云存储**: AWS S3
- **认证**: JWT
- **测试**: Jest + Supertest
- **文件处理**: Multer + AWS SDK v3

## 📁 项目结构

\`\`\`
src/
├── controllers/
│   └── documentController.js    # 文档控制器
├── services/
│   └── DocumentService.js       # 文档服务层
├── models/
│   └── Document.js             # 文档数据模型
├── routes/
│   └── documents.js            # 文档路由
└── middleware/
    ├── auth.js                 # 认证中间件
    └── validation.js           # 验证中间件

tests/
├── document.test.js            # 基础文档测试
├── s3-integration.test.js      # S3集成测试
└── s3-real.test.js            # 真实S3测试

scripts/
├── test-s3.js                 # S3测试运行脚本
└── test-s3-connection.js      # S3连接测试脚本
\`\`\`

## 🔒 安全特性

- JWT认证保护所有端点
- 文件类型验证
- 文件大小限制
- 用户权限隔离
- S3访问权限控制

## 📈 性能优化

- 大文件多部分上传
- 并发上传支持
- 文件流式传输
- 数据库索引优化

## 🐛 故障排除

### 常见问题

1. **S3连接失败**
   - 检查AWS凭证配置
   - 验证bucket权限
   - 确认网络连接

2. **文件上传失败**
   - 检查文件大小限制
   - 验证文件类型支持
   - 查看服务器日志

3. **测试失败**
   - 确保环境变量正确配置
   - 检查AWS服务状态
   - 验证测试数据库连接

### 调试命令

\`\`\`bash
# 检查S3配置
npm run test:s3-connection

# 运行单个测试
npx jest tests/s3-real.test.js -t "should upload file"

# 启用详细日志
DEBUG=* npm run test:s3-real
\`\`\`

## 📚 相关文档

- [S3测试详细文档](docs/s3-testing.md)
- [API文档](docs/api.md)
- [部署指南](docs/deployment.md)

## 🤝 贡献

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

**注意**: 请确保在生产环境中使用适当的AWS IAM权限和安全配置。
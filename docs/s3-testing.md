# S3集成测试文档

本文档描述了智墨学习平台的S3集成测试套件，包括测试配置、运行方法和测试覆盖范围。

## 测试套件概览

### 1. S3连接测试 (`npm run test:s3-connection`)
- **文件**: `scripts/test-s3-connection.js`
- **目的**: 验证AWS S3配置是否正确
- **功能**:
  - 检查环境变量配置
  - 测试S3连接
  - 验证bucket访问权限
  - 测试基本的上传/删除操作

### 2. 真实S3集成测试 (`npm run test:s3-real`)
- **文件**: `tests/s3-real.test.js`
- **目的**: 测试真实S3操作功能
- **覆盖范围**:
  - 基本文件上传/下载/删除
  - 大文件多部分上传
  - PDF文件处理
  - 并发上传测试
  - 性能测试
  - 错误处理

### 3. 应用层S3集成测试 (`npm run test:s3`)
- **文件**: `tests/s3-integration.test.js`
- **目的**: 测试应用层的S3集成功能
- **覆盖范围**:
  - 文档上传API端点
  - 文档下载功能
  - 文档删除功能
  - 多种文件格式支持
  - DocumentService类功能

## 环境配置

### 必需的环境变量

在运行S3集成测试之前，请确保在`.env`文件中配置以下环境变量：

\`\`\`bash
# AWS S3配置
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=your-aws-region
S3_BUCKET_NAME=your-bucket-name
\`\`\`

### 权限要求

测试用的AWS IAM用户需要以下S3权限：

\`\`\`json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
\`\`\`

## 运行测试

### 1. 检查S3连接
\`\`\`bash
npm run test:s3-connection
\`\`\`

### 2. 运行真实S3测试
\`\`\`bash
npm run test:s3-real
\`\`\`

### 3. 运行应用层集成测试
\`\`\`bash
npm run test:s3
\`\`\`

### 4. 运行所有测试
\`\`\`bash
npm test
\`\`\`

## 测试结果示例

### 成功的S3连接测试
\`\`\`
=== S3连接测试工具 ===

📋 当前S3配置:
   AWS_REGION: ap-northeast-3
   S3_BUCKET_NAME: advx
   AWS_ACCESS_KEY_ID: 已设置
   AWS_SECRET_ACCESS_KEY: 已设置

🔍 测试S3连接...

📦 测试Bucket: advx
🌍 AWS Region: ap-northeast-3

1️⃣ 测试列出对象...
✅ 成功列出对象，找到 0 个对象

2️⃣ 测试上传文件...
✅ 成功上传测试文件: test/connection-test-1753437256136.txt

3️⃣ 测试删除文件...
✅ 成功删除测试文件: test/connection-test-1753437256136.txt

🎉 S3连接测试全部通过！
\`\`\`

### 真实S3集成测试结果
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
\`\`\`

## 测试覆盖的功能

### 文件上传功能
- ✅ 小文件上传 (< 5MB)
- ✅ 大文件多部分上传 (> 5MB)
- ✅ PDF文件上传
- ✅ 多种文件格式支持 (PDF, DOCX, PPTX, 图片)
- ✅ 文件类型验证
- ✅ 文件大小限制

### 文件下载功能
- ✅ 文件流下载
- ✅ 正确的Content-Type设置
- ✅ 文件名处理

### 文件删除功能
- ✅ S3文件删除
- ✅ 数据库记录软删除
- ✅ 权限验证

### 性能和并发
- ✅ 并发上传测试
- ✅ 上传性能测试
- ✅ 大文件处理

### 错误处理
- ✅ 无效bucket处理
- ✅ 无效凭证处理
- ✅ 网络错误处理
- ✅ 文件验证错误

## 故障排除

### 常见问题

1. **环境变量未配置**
   - 错误: "缺少必需的环境变量"
   - 解决: 检查`.env`文件中的AWS配置

2. **权限不足**
   - 错误: "AccessDenied"
   - 解决: 检查IAM用户权限配置

3. **Bucket不存在**
   - 错误: "NoSuchBucket"
   - 解决: 确认bucket名称正确且存在

4. **网络连接问题**
   - 错误: "NetworkingError"
   - 解决: 检查网络连接和AWS服务状态

### 调试技巧

1. **启用详细日志**
   \`\`\`bash
   DEBUG=* npm run test:s3-real
   \`\`\`

2. **单独运行特定测试**
   \`\`\`bash
   npx jest tests/s3-real.test.js -t "should upload file to S3"
   \`\`\`

3. **检查S3控制台**
   - 登录AWS S3控制台
   - 查看bucket中的测试文件
   - 检查访问日志

## 最佳实践

### 测试环境隔离
- 使用专门的测试bucket
- 测试文件使用唯一前缀 (`test/`)
- 自动清理测试文件

### 安全考虑
- 不要在代码中硬编码AWS凭证
- 使用最小权限原则
- 定期轮换访问密钥

### 性能优化
- 对大文件使用多部分上传
- 实施并发限制
- 监控上传性能

## 持续集成

在CI/CD流水线中运行S3测试：

\`\`\`yaml
# GitHub Actions示例
- name: Run S3 Integration Tests
  env:
    AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
    S3_BUCKET_NAME: \${{ secrets.S3_BUCKET_NAME }}
    AWS_REGION: ap-northeast-3
  run: |
    npm run test:s3-connection
    npm run test:s3-real
\`\`\`

## 总结

S3集成测试套件提供了全面的测试覆盖，确保文档上传和存储功能的可靠性。通过分层测试（连接测试、真实S3测试、应用层测试），我们可以快速定位和解决问题，保证生产环境的稳定性。
# 文件上传故障排除指南

## "意外的文件字段" 错误

### 错误描述
```json
{
  "success": false,
  "message": "意外的文件字段",
  "details": "请确保文件字段名为 \"document\"，且只上传一个文件",
  "expectedField": "document",
  "hint": "正确的表单字段应该是: <input name=\"document\" type=\"file\" />"
}
```

### 常见原因

#### 1. 字段名不匹配
**错误示例:**
```javascript
// ❌ 错误 - 字段名是 "file"
const form = new FormData();
form.append('file', fileBuffer);

// ❌ 错误 - 字段名是 "upload"
form.append('upload', fileBuffer);
```

**正确示例:**
```javascript
// ✅ 正确 - 字段名必须是 "document"
const form = new FormData();
form.append('document', fileBuffer);
```

#### 2. 多个文件字段
**错误示例:**
```javascript
// ❌ 错误 - 发送了多个文件字段
const form = new FormData();
form.append('document', file1);
form.append('attachment', file2); // 额外的文件字段
```

**正确示例:**
```javascript
// ✅ 正确 - 只发送一个文件字段
const form = new FormData();
form.append('document', file);
form.append('title', '文档标题'); // 非文件字段可以有多个
form.append('tags', '标签1,标签2');
```

#### 3. HTML表单字段名错误
**错误示例:**
```html
<!-- ❌ 错误 -->
<input type="file" name="file" />
<input type="file" name="upload" />
```

**正确示例:**
```html
<!-- ✅ 正确 -->
<input type="file" name="document" />
```

### 调试步骤

#### 1. 运行调试脚本
```bash
npm run debug:upload
```

这个脚本会测试：
- 正确的字段名 "document"
- 错误的字段名 "file"
- 多个文件字段的情况

#### 2. 检查请求内容
使用浏览器开发者工具或Postman检查请求：

**正确的请求应该包含:**
```
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...

------WebKitFormBoundary...
Content-Disposition: form-data; name="document"; filename="example.pdf"
Content-Type: application/pdf

[文件内容]
------WebKitFormBoundary...
Content-Disposition: form-data; name="title"

文档标题
------WebKitFormBoundary...
```

#### 3. 验证multer配置
服务器配置为：
```javascript
upload.single('document') // 只接受名为 "document" 的单个文件
```

### 解决方案

#### 客户端修复

**JavaScript/Node.js:**
```javascript
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('document', fs.createReadStream('path/to/file.pdf')); // 字段名必须是 "document"
form.append('title', '文档标题');
form.append('tags', '标签1,标签2');

// 发送请求
const response = await axios.post('/api/documents/upload', form, {
  headers: {
    ...form.getHeaders(),
    'Authorization': 'Bearer token'
  }
});
```

**浏览器JavaScript:**
```javascript
const formData = new FormData();
const fileInput = document.getElementById('fileInput');
formData.append('document', fileInput.files[0]); // 字段名必须是 "document"
formData.append('title', '文档标题');

fetch('/api/documents/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer token'
  },
  body: formData
});
```

**cURL:**
```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer token" \
  -F "document=@path/to/file.pdf" \
  -F "title=文档标题" \
  -F "tags=标签1,标签2"
```

#### React示例
```jsx
function FileUpload() {
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    const fileInput = e.target.querySelector('input[type="file"]');
    
    // 确保字段名是 "document"
    formData.append('document', fileInput.files[0]);
    formData.append('title', '文档标题');
    
    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const result = await response.json();
      console.log('上传成功:', result);
    } catch (error) {
      console.error('上传失败:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="file" name="document" required />
      <button type="submit">上传</button>
    </form>
  );
}
```

### 其他multer错误

#### 文件大小超限
```json
{
  "success": false,
  "message": "文件大小超过限制 (50MB)"
}
```

#### 文件类型不支持
```json
{
  "success": false,
  "message": "不支持的文件类型: text/plain"
}
```

#### 文件数量超限
```json
{
  "success": false,
  "message": "一次只能上传一个文件"
}
```

### 支持的文件类型

- PDF: `application/pdf`
- Word: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- PowerPoint: `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- 图片: `image/jpeg`, `image/png`, `image/gif`, `image/bmp`, `image/webp`

### 测试建议

1. **使用调试脚本**: `npm run debug:upload`
2. **检查网络请求**: 使用浏览器开发者工具查看实际发送的请求
3. **验证文件**: 确保文件存在且格式正确
4. **检查权限**: 确保用户已登录且token有效

### 联系支持

如果问题仍然存在，请提供：
1. 完整的错误信息
2. 客户端代码示例
3. 文件类型和大小
4. 调试脚本的输出结果
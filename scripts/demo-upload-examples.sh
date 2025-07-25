#!/bin/bash

# 文件上传示例脚本
# 演示正确和错误的上传方式

BASE_URL="http://localhost:3000"
echo "🚀 文件上传示例演示"
echo "服务器地址: $BASE_URL"
echo ""

# 1. 获取认证token
echo "🔐 获取认证token..."
TOKEN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "testuser", "password": "Test123456!"}')

TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.data.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ 获取token失败，请确保用户已注册"
  echo "响应: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Token获取成功"
echo ""

# 2. 正确的上传示例
echo "✅ 示例1: 正确的文件上传"
echo "字段名: document (正确)"
echo "命令:"
echo "curl -X POST $BASE_URL/api/documents/upload \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -F \"document=@tests/example.pdf\" \\"
echo "  -F \"title=正确上传示例\" \\"
echo "  -F \"tags=示例,正确\""
echo ""

RESPONSE1=$(curl -s -X POST $BASE_URL/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "document=@tests/example.pdf" \
  -F "title=正确上传示例" \
  -F "tags=示例,正确")

SUCCESS1=$(echo $RESPONSE1 | jq -r '.success')
if [ "$SUCCESS1" = "true" ]; then
  echo "🎉 上传成功!"
  DOCUMENT_ID=$(echo $RESPONSE1 | jq -r '.data.document._id')
  echo "文档ID: $DOCUMENT_ID"
else
  echo "❌ 上传失败:"
  echo $RESPONSE1 | jq '.message'
fi
echo ""

# 3. 错误示例1: 错误的字段名
echo "❌ 示例2: 错误的字段名"
echo "字段名: file (错误，应该是document)"
echo "命令:"
echo "curl -X POST $BASE_URL/api/documents/upload \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -F \"file=@tests/example.pdf\" \\"
echo "  -F \"title=错误字段名示例\""
echo ""

RESPONSE2=$(curl -s -X POST $BASE_URL/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@tests/example.pdf" \
  -F "title=错误字段名示例")

SUCCESS2=$(echo $RESPONSE2 | jq -r '.success')
if [ "$SUCCESS2" = "false" ]; then
  echo "✅ 正确拒绝了错误的字段名"
  echo "错误信息: $(echo $RESPONSE2 | jq -r '.message')"
  echo "详细信息: $(echo $RESPONSE2 | jq -r '.details')"
  echo "提示: $(echo $RESPONSE2 | jq -r '.hint')"
else
  echo "⚠️ 意外成功，这不应该发生"
fi
echo ""

# 4. 错误示例2: 多个文件字段
echo "❌ 示例3: 多个文件字段"
echo "字段名: document + extraFile (错误，只能有一个文件字段)"
echo "命令:"
echo "curl -X POST $BASE_URL/api/documents/upload \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -F \"document=@tests/example.pdf\" \\"
echo "  -F \"extraFile=@tests/example.pdf\" \\"
echo "  -F \"title=多文件字段示例\""
echo ""

RESPONSE3=$(curl -s -X POST $BASE_URL/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "document=@tests/example.pdf" \
  -F "extraFile=@tests/example.pdf" \
  -F "title=多文件字段示例")

SUCCESS3=$(echo $RESPONSE3 | jq -r '.success')
if [ "$SUCCESS3" = "false" ]; then
  echo "✅ 正确拒绝了多个文件字段"
  echo "错误信息: $(echo $RESPONSE3 | jq -r '.message')"
else
  echo "⚠️ 意外成功，这不应该发生"
fi
echo ""

# 5. 错误示例3: 无认证token
echo "❌ 示例4: 无认证token"
echo "命令:"
echo "curl -X POST $BASE_URL/api/documents/upload \\"
echo "  -F \"document=@tests/example.pdf\" \\"
echo "  -F \"title=无认证示例\""
echo ""

RESPONSE4=$(curl -s -X POST $BASE_URL/api/documents/upload \
  -F "document=@tests/example.pdf" \
  -F "title=无认证示例")

SUCCESS4=$(echo $RESPONSE4 | jq -r '.success')
if [ "$SUCCESS4" = "false" ]; then
  echo "✅ 正确拒绝了无认证请求"
  echo "错误信息: $(echo $RESPONSE4 | jq -r '.message')"
else
  echo "⚠️ 意外成功，这不应该发生"
fi
echo ""

# 6. 总结
echo "📋 总结:"
echo "✅ 正确上传: 使用 'document' 字段名，提供认证token"
echo "❌ 常见错误:"
echo "   - 使用错误的字段名 (如 'file' 而不是 'document')"
echo "   - 发送多个文件字段"
echo "   - 缺少认证token"
echo "   - 文件类型不支持"
echo "   - 文件大小超过限制 (50MB)"
echo ""
echo "💡 提示: 运行 'npm run debug:upload' 进行详细调试"
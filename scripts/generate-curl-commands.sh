#!/bin/bash

# 智墨学习平台 API 测试脚本
# 使用方法: ./scripts/generate-curl-commands.sh

BASE_URL="http://localhost:3000"
TIMESTAMP=$(date +%s)

echo "🚀 智墨学习平台 API 测试命令"
echo "================================"

echo ""
echo "1️⃣ 注册用户:"
echo "curl -X POST $BASE_URL/api/auth/register \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"username\": \"testuser_$TIMESTAMP\","
echo "    \"email\": \"test_$TIMESTAMP@example.com\","
echo "    \"password\": \"Test123456!\","
echo "    \"profile\": {"
echo "      \"displayName\": \"测试用户\""
echo "    }"
echo "  }'"

echo ""
echo "2️⃣ 用户登录:"
echo "curl -X POST $BASE_URL/api/auth/login \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"username\": \"testuser_$TIMESTAMP\","
echo "    \"password\": \"Test123456!\""
echo "  }'"

echo ""
echo "3️⃣ 获取JWT Token (从登录响应中提取):"
echo "TOKEN=\$(curl -s -X POST $BASE_URL/api/auth/login \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"username\": \"testuser_$TIMESTAMP\","
echo "    \"password\": \"Test123456!\""
echo "  }' | jq -r '.data.token')"

echo ""
echo "4️⃣ 上传文档:"
echo "curl -X POST $BASE_URL/api/documents/upload \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -F \"document=@tests/example.pdf\" \\"
echo "  -F \"title=测试文档\" \\"
echo "  -F \"tags=测试,PDF\""

echo ""
echo "5️⃣ 获取文档列表:"
echo "curl -X GET $BASE_URL/api/documents \\"
echo "  -H \"Authorization: Bearer \$TOKEN\""

echo ""
echo "6️⃣ 获取文档详情 (替换{documentId}):"
echo "curl -X GET $BASE_URL/api/documents/{documentId} \\"
echo "  -H \"Authorization: Bearer \$TOKEN\""

echo ""
echo "7️⃣ 下载文档:"
echo "curl -X GET $BASE_URL/api/documents/{documentId}/download \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -o downloaded_document.pdf"

echo ""
echo "8️⃣ AI功能测试:"
echo "# 生成摘要"
echo "curl -X POST $BASE_URL/api/documents/{documentId}/ai/summary \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"length\": \"medium\","
echo "    \"language\": \"zh\","
echo "    \"includeKeyPoints\": true"
echo "  }'"

echo ""
echo "# 提取概念"
echo "curl -X POST $BASE_URL/api/documents/{documentId}/ai/concepts \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"maxConcepts\": 10,"
echo "    \"language\": \"zh\""
echo "  }'"

echo ""
echo "# 生成思维导图"
echo "curl -X POST $BASE_URL/api/documents/{documentId}/ai/mindmap \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"maxNodes\": 20,"
echo "    \"language\": \"zh\","
echo "    \"style\": \"mindmap\""
echo "  }'"

echo ""
echo "9️⃣ 完整测试流程 (一键执行):"
echo "================================"

cat << 'EOF'
#!/bin/bash
# 完整测试流程

BASE_URL="http://localhost:3000"
TIMESTAMP=$(date +%s)

echo "🔐 注册并登录用户..."
TOKEN=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"testuser_$TIMESTAMP\",
    \"email\": \"test_$TIMESTAMP@example.com\",
    \"password\": \"Test123456!\",
    \"profile\": {
      \"displayName\": \"测试用户\"
    }
  }" | jq -r '.data.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "⚠️ 注册失败，尝试登录..."
  TOKEN=$(curl -s -X POST $BASE_URL/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username": "testuser", "password": "Test123456!"}' | jq -r '.data.token')
fi

echo "✅ Token: $TOKEN"

echo "📤 上传文档..."
UPLOAD_RESPONSE=$(curl -s -X POST $BASE_URL/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "document=@tests/example.pdf" \
  -F "title=测试文档" \
  -F "tags=测试,PDF")

DOCUMENT_ID=$(echo $UPLOAD_RESPONSE | jq -r '.data.document._id')
echo "✅ 文档ID: $DOCUMENT_ID"

echo "⏳ 等待处理完成..."
for i in {1..10}; do
  sleep 2
  STATUS=$(curl -s -X GET $BASE_URL/api/documents/$DOCUMENT_ID \
    -H "Authorization: Bearer $TOKEN" | jq -r '.data.processingStatus')
  echo "📊 状态: $STATUS"
  
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
done

echo "📋 获取文档列表..."
curl -s -X GET $BASE_URL/api/documents \
  -H "Authorization: Bearer $TOKEN" | jq '.data[] | {id: ._id, title: .title, status: .processingStatus}'

echo "🎉 测试完成!"
EOF

echo ""
echo "💡 提示:"
echo "- 确保服务器在 $BASE_URL 运行"
echo "- 确保 tests/example.pdf 文件存在"
echo "- 需要安装 jq 工具来解析JSON响应"
echo "- 将上面的完整测试流程保存为 .sh 文件并执行"
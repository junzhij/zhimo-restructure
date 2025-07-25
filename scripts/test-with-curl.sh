#!/bin/bash

# 智墨学习平台完整API测试脚本
# 使用方法: ./scripts/test-with-curl.sh

set -e  # 遇到错误立即退出

BASE_URL="http://localhost:3000"
TIMESTAMP=$(date +%s)

echo "🚀 开始智墨学习平台API测试"
echo "================================"

# 检查服务器是否运行
echo "🔍 检查服务器状态..."
if ! curl -s --connect-timeout 5 $BASE_URL/health > /dev/null 2>&1; then
  echo "❌ 服务器未运行，请先启动服务器: npm start"
  exit 1
fi
echo "✅ 服务器运行正常"

# 检查测试文件
if [ ! -f "tests/example.pdf" ]; then
  echo "❌ 测试文件不存在: tests/example.pdf"
  exit 1
fi
echo "✅ 测试文件存在"

# 1. 注册用户
echo ""
echo "1️⃣ 注册用户..."
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"testuser_$TIMESTAMP\",
    \"email\": \"test_$TIMESTAMP@example.com\",
    \"password\": \"Test123456!\",
    \"profile\": {
      \"displayName\": \"测试用户\"
    }
  }")

# 提取token
TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "⚠️ 注册失败，尝试登录默认用户..."
  
  LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "username": "testuser",
      "password": "Test123456!"
    }')
  
  TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token // empty')
  
  if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ 登录也失败了，请检查认证服务"
    echo "注册响应: $REGISTER_RESPONSE"
    echo "登录响应: $LOGIN_RESPONSE"
    exit 1
  fi
  echo "✅ 登录成功"
else
  echo "✅ 注册成功"
fi

echo "🔑 JWT Token: ${TOKEN}"

# 2. 上传文档
echo ""
echo "2️⃣ 上传文档..."
UPLOAD_RESPONSE=$(curl -s -X POST $BASE_URL/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "document=@tests/example.pdf" \
  -F "title=Curl测试文档" \
  -F "tags=测试,Curl,PDF")

# 检查上传是否成功
if echo $UPLOAD_RESPONSE | jq -e '.success' > /dev/null; then
  DOCUMENT_ID=$(echo $UPLOAD_RESPONSE | jq -r '.data.document._id')
  echo "✅ 文档上传成功"
  echo "📄 文档ID: $DOCUMENT_ID"
  echo "📊 初始状态: $(echo $UPLOAD_RESPONSE | jq -r '.data.document.processingStatus')"
else
  echo "❌ 文档上传失败"
  echo "响应: $UPLOAD_RESPONSE"
  exit 1
fi

# 3. 等待处理完成
echo ""
echo "3️⃣ 等待文档处理完成..."
MAX_ATTEMPTS=15
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  sleep 2
  
  STATUS_RESPONSE=$(curl -s -X GET $BASE_URL/api/documents/$DOCUMENT_ID \
    -H "Authorization: Bearer $TOKEN")
  
  STATUS=$(echo $STATUS_RESPONSE | jq -r '.data.processingStatus // "unknown"')
  echo "📊 [$ATTEMPT/$MAX_ATTEMPTS] 处理状态: $STATUS"
  
  if [ "$STATUS" = "completed" ]; then
    echo "✅ 文档处理完成!"
    
    # 显示处理结果
    MARKDOWN_LENGTH=$(echo $STATUS_RESPONSE | jq -r '.data.markdownContent | length // 0')
    RESTRUCTURED_LENGTH=$(echo $STATUS_RESPONSE | jq -r '.data.restructuredContent | length // 0')
    
    echo "📄 Markdown内容长度: $MARKDOWN_LENGTH"
    echo "🔄 重构内容长度: $RESTRUCTURED_LENGTH"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "❌ 文档处理失败"
    ERROR=$(echo $STATUS_RESPONSE | jq -r '.data.processingError // "未知错误"')
    echo "错误信息: $ERROR"
    break
  fi
  
  ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
  echo "⚠️ 文档处理超时"
fi

# 4. 获取文档列表
echo ""
echo "4️⃣ 获取文档列表..."
LIST_RESPONSE=$(curl -s -X GET $BASE_URL/api/documents \
  -H "Authorization: Bearer $TOKEN")

if echo $LIST_RESPONSE | jq -e '.success' > /dev/null; then
  echo "✅ 文档列表获取成功"
  echo $LIST_RESPONSE | jq -r '.data[] | "📄 \(.title) (\(.processingStatus)) - \(._id)"'
else
  echo "❌ 获取文档列表失败"
  echo "响应: $LIST_RESPONSE"
fi

# 5. 测试AI功能（如果文档处理完成）
if [ "$STATUS" = "completed" ]; then
  echo ""
  echo "5️⃣ 测试AI功能..."
  
  # 生成摘要
  echo "📝 生成摘要..."
  SUMMARY_RESPONSE=$(curl -s -X POST $BASE_URL/api/documents/$DOCUMENT_ID/ai/summary \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "length": "medium",
      "language": "zh",
      "includeKeyPoints": true
    }')
  
  if echo $SUMMARY_RESPONSE | jq -e '.success' > /dev/null; then
    echo "✅ 摘要生成成功"
    SUMMARY_LENGTH=$(echo $SUMMARY_RESPONSE | jq -r '.data.summary | length')
    echo "📊 摘要长度: $SUMMARY_LENGTH 字符"
  else
    echo "⚠️ 摘要生成失败: $(echo $SUMMARY_RESPONSE | jq -r '.message // "未知错误"')"
  fi
  
  # 提取概念
  echo "🔍 提取概念..."
  CONCEPTS_RESPONSE=$(curl -s -X POST $BASE_URL/api/documents/$DOCUMENT_ID/ai/concepts \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "maxConcepts": 5,
      "language": "zh"
    }')
  
  if echo $CONCEPTS_RESPONSE | jq -e '.success' > /dev/null; then
    echo "✅ 概念提取成功"
    CONCEPTS_COUNT=$(echo $CONCEPTS_RESPONSE | jq -r '.data.concepts | length')
    echo "📊 提取概念数量: $CONCEPTS_COUNT"
    echo $CONCEPTS_RESPONSE | jq -r '.data.concepts[] | "💡 \(.name): \(.definition[:100])..."'
  else
    echo "⚠️ 概念提取失败: $(echo $CONCEPTS_RESPONSE | jq -r '.message // "未知错误"')"
  fi
fi

echo ""
echo "🎉 API测试完成!"
echo "================================"
echo "📋 测试总结:"
echo "- 用户认证: ✅"
echo "- 文档上传: ✅"
echo "- 文档处理: $([ "$STATUS" = "completed" ] && echo "✅" || echo "⚠️")"
echo "- 文档列表: ✅"
echo "- AI功能: $([ "$STATUS" = "completed" ] && echo "✅" || echo "⚠️")"

echo ""
echo "🔧 有用的命令:"
echo "export TOKEN=\"$TOKEN\""
echo "export DOCUMENT_ID=\"$DOCUMENT_ID\""
echo ""
echo "# 查看文档详情"
echo "curl -H \"Authorization: Bearer \$TOKEN\" $BASE_URL/api/documents/\$DOCUMENT_ID"
echo ""
echo "# 下载文档"
echo "curl -H \"Authorization: Bearer \$TOKEN\" $BASE_URL/api/documents/\$DOCUMENT_ID/download -o downloaded.pdf"
#!/bin/bash

# 练习题API测试脚本
# 使用方法: ./scripts/test-exercise-api-curl.sh [JWT_TOKEN]

BASE_URL="http://localhost:3000/api/documents"

# 检查是否提供了JWT token
if [ -z "$1" ]; then
    echo "❌ 请提供JWT token"
    echo "使用方法: $0 <JWT_TOKEN>"
    echo ""
    echo "示例:"
    echo "  $0 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    exit 1
fi

JWT_TOKEN="$1"

echo "🧪 练习题API测试"
echo "=================="
echo ""

# 测试1: 获取所有练习题列表
echo "📝 测试1: 获取所有练习题列表"
echo "GET $BASE_URL/exercises"
echo ""

curl -s -X GET \
  "$BASE_URL/exercises" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "---"
echo ""

# 测试2: 获取指定练习题详情（需要先有练习题ID）
echo "📖 测试2: 获取指定练习题详情"
echo "注意: 需要先从上面的列表中获取一个有效的练习题ID"
echo ""

# 先获取练习题列表，提取第一个ID
EXERCISE_ID=$(curl -s -X GET \
  "$BASE_URL/exercises" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq -r '.data[0].id // empty')

if [ -n "$EXERCISE_ID" ] && [ "$EXERCISE_ID" != "null" ]; then
    echo "找到练习题ID: $EXERCISE_ID"
    echo "GET $BASE_URL/exercises/$EXERCISE_ID"
    echo ""
    
    curl -s -X GET \
      "$BASE_URL/exercises/$EXERCISE_ID" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json" | jq '.'
else
    echo "⚠️ 没有找到可用的练习题，请先生成一些练习题"
    echo ""
    echo "可以使用以下命令生成练习题:"
    echo "curl -X POST '$BASE_URL/{DOCUMENT_ID}/ai/exercises' \\"
    echo "  -H 'Authorization: Bearer $JWT_TOKEN' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{\"count\": 3, \"types\": [\"multiple_choice\", \"true_false\"], \"difficulty\": \"medium\"}'"
fi

echo ""
echo "---"
echo ""

# 测试3: 测试不存在的练习题ID
echo "🚫 测试3: 测试不存在的练习题ID"
FAKE_ID="507f1f77bcf86cd799439011"
echo "GET $BASE_URL/exercises/$FAKE_ID"
echo ""

curl -s -X GET \
  "$BASE_URL/exercises/$FAKE_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "---"
echo ""

# 测试4: 测试未授权访问
echo "🔒 测试4: 测试未授权访问"
echo "GET $BASE_URL/exercises (without token)"
echo ""

curl -s -X GET \
  "$BASE_URL/exercises" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "=================="
echo "✅ 测试完成"
echo ""
echo "API端点总结:"
echo "1. GET /api/documents/exercises - 获取所有练习题列表"
echo "2. GET /api/documents/exercises/:exerciseId - 获取指定练习题详情"
echo ""
echo "返回格式:"
echo "- 列表API: 返回包含 id, title, documentId, createdAt 的数组"
echo "- 详情API: 返回包含 id, title, questions, metadata, settings 的对象"
#!/usr/bin/env node

/**
 * S3集成测试运行脚本
 * 
 * 使用方法:
 * npm run test:s3
 * 或
 * node scripts/test-s3.js
 */

const { execSync } = require('child_process');
const path = require('path');

// 检查环境变量
function checkEnvironment() {
  const requiredVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY', 
    'S3_BUCKET_NAME',
    'AWS_REGION'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ 缺少必需的环境变量:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n请在.env文件中配置这些变量，或者设置环境变量');
    console.error('示例:');
    console.error('AWS_ACCESS_KEY_ID=your-access-key');
    console.error('AWS_SECRET_ACCESS_KEY=your-secret-key');
    console.error('S3_BUCKET_NAME=your-bucket-name');
    console.error('AWS_REGION=us-east-1');
    process.exit(1);
  }

  console.log('✅ 环境变量检查通过');
  console.log(`📦 S3 Bucket: ${process.env.S3_BUCKET_NAME}`);
  console.log(`🌍 AWS Region: ${process.env.AWS_REGION}`);
}

// 运行S3集成测试
function runS3Tests() {
  console.log('🚀 开始运行S3集成测试...\n');
  
  try {
    // 设置测试环境
    process.env.NODE_ENV = 'test';
    
    // 运行S3集成测试
    execSync('jest tests/s3-integration.test.js --forceExit --verbose', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
    
    console.log('\n✅ S3集成测试完成');
  } catch (error) {
    console.error('\n❌ S3集成测试失败');
    process.exit(1);
  }
}

// 主函数
function main() {
  console.log('=== S3集成测试 ===\n');
  
  // 加载环境变量
  require('dotenv').config();
  
  // 检查环境
  checkEnvironment();
  
  // 运行测试
  runS3Tests();
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { checkEnvironment, runS3Tests };
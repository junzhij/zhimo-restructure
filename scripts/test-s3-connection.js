#!/usr/bin/env node

/**
 * S3连接测试工具
 * 
 * 用于验证AWS S3配置是否正确
 */

const { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

async function testS3Connection() {
  console.log('🔍 测试S3连接...\n');

  // 检查环境变量
  const requiredVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME', 'AWS_REGION'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ 缺少环境变量:', missing.join(', '));
    return false;
  }

  // 创建S3客户端
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  const bucketName = process.env.S3_BUCKET_NAME;
  console.log(`📦 测试Bucket: ${bucketName}`);
  console.log(`🌍 AWS Region: ${process.env.AWS_REGION}\n`);

  try {
    // 测试1: 列出对象
    console.log('1️⃣ 测试列出对象...');
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 5
    });
    
    const listResult = await s3Client.send(listCommand);
    console.log(`✅ 成功列出对象，找到 ${listResult.KeyCount || 0} 个对象`);

    // 测试2: 上传测试文件
    console.log('\n2️⃣ 测试上传文件...');
    const testKey = `test/connection-test-${Date.now()}.txt`;
    const testContent = `S3连接测试 - ${new Date().toISOString()}`;
    
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain'
    });
    
    await s3Client.send(putCommand);
    console.log(`✅ 成功上传测试文件: ${testKey}`);

    // 测试3: 删除测试文件
    console.log('\n3️⃣ 测试删除文件...');
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: testKey
    });
    
    await s3Client.send(deleteCommand);
    console.log(`✅ 成功删除测试文件: ${testKey}`);

    console.log('\n🎉 S3连接测试全部通过！');
    return true;

  } catch (error) {
    console.error('\n❌ S3连接测试失败:');
    console.error('错误信息:', error.message);
    
    if (error.name === 'NoSuchBucket') {
      console.error('💡 提示: Bucket不存在，请检查bucket名称');
    } else if (error.name === 'AccessDenied') {
      console.error('💡 提示: 访问被拒绝，请检查AWS凭证和权限');
    } else if (error.name === 'InvalidAccessKeyId') {
      console.error('💡 提示: Access Key ID无效');
    } else if (error.name === 'SignatureDoesNotMatch') {
      console.error('💡 提示: Secret Access Key无效');
    }
    
    return false;
  }
}

// 显示当前配置信息
function showConfiguration() {
  console.log('📋 当前S3配置:');
  console.log(`   AWS_REGION: ${process.env.AWS_REGION || '未设置'}`);
  console.log(`   S3_BUCKET_NAME: ${process.env.S3_BUCKET_NAME || '未设置'}`);
  console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '已设置' : '未设置'}`);
  console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '已设置' : '未设置'}`);
  console.log('');
}

async function main() {
  console.log('=== S3连接测试工具 ===\n');
  
  showConfiguration();
  
  const success = await testS3Connection();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { testS3Connection };
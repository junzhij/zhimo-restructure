const fs = require('fs');
const path = require('path');
const DocumentService = require('../src/services/DocumentService');

async function testPdfParsing() {
  console.log('🔍 测试真实PDF解析功能...\n');
  
  try {
    // 读取真实PDF文件
    const pdfPath = path.join(__dirname, '../tests/example.pdf');
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    console.log(`📄 PDF文件大小: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    
    // 创建DocumentService实例
    const documentService = new DocumentService();
    
    // 模拟文件对象
    const mockFile = {
      buffer: pdfBuffer,
      originalname: 'example.pdf',
      mimetype: 'application/pdf',
      size: pdfBuffer.length
    };
    
    // 直接测试PDF解析
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(pdfBuffer);
    
    console.log('\n📊 PDF解析结果:');
    console.log(`- 页数: ${pdfData.numpages}`);
    console.log(`- 原始文本长度: ${pdfData.text.length} 字符`);
    
    if (pdfData.info) {
      console.log('- PDF信息:');
      if (pdfData.info.Title) console.log(`  标题: ${pdfData.info.Title}`);
      if (pdfData.info.Author) console.log(`  作者: ${pdfData.info.Author}`);
      if (pdfData.info.Subject) console.log(`  主题: ${pdfData.info.Subject}`);
      if (pdfData.info.Creator) console.log(`  创建工具: ${pdfData.info.Creator}`);
    }
    
    // 转换为Markdown
    const markdownContent = documentService.convertPdfTextToMarkdown(pdfData);
    const wordCount = documentService.countWords(markdownContent);
    
    console.log('\n📝 Markdown转换结果:');
    console.log(`- Markdown长度: ${markdownContent.length} 字符`);
    console.log(`- 字数统计: ${wordCount} 字`);
    
    // 显示前500个字符的Markdown内容
    console.log('\n📖 Markdown内容预览:');
    console.log('=' .repeat(50));
    console.log(markdownContent.substring(0, 500));
    if (markdownContent.length > 500) {
      console.log('\n... (内容已截断)');
    }
    console.log('=' .repeat(50));
    
    // 分析标题结构
    const lines = markdownContent.split('\n');
    const headers = lines.filter(line => line.startsWith('#'));
    
    if (headers.length > 0) {
      console.log('\n🏷️  检测到的标题结构:');
      headers.forEach(header => {
        const level = header.match(/^#+/)[0].length;
        const title = header.replace(/^#+\s*/, '');
        console.log(`${'  '.repeat(level - 1)}- ${title}`);
      });
    }
    
    console.log('\n✅ PDF解析测试完成！');
    
  } catch (error) {
    console.error('❌ PDF解析测试失败:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
testPdfParsing();
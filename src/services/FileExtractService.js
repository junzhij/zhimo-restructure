const pdfParse = require('pdf-parse');
const AIService = require('./AIService');
const Document = require('../models/Document');
const Summary = require('../models/Summary');
const Concept = require('../models/Concept');

class FileExtractService {
  constructor() {
    this.aiService = new AIService();
  }

  /**
   * 处理文件提取 - 从原始文件转换为markdown
   * @param {string} documentId - 文档ID
   * @param {Buffer} fileBuffer - 文件缓冲区
   * @param {string} mimeType - 文件MIME类型
   * @returns {Promise<string>} markdown内容
   */
  async extractToMarkdown(documentId, fileBuffer, mimeType) {
    try {
      let markdownContent = '';

      switch (mimeType) {
        case 'application/pdf':
          markdownContent = await this.extractPdfToMarkdown(fileBuffer);
          break;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          // TODO: 实现Word文档提取
          markdownContent = await this.extractWordToMarkdown(fileBuffer);
          break;
        case 'text/plain':
          markdownContent = fileBuffer.toString('utf-8');
          break;
        default:
          throw new Error(`不支持的文件类型: ${mimeType}`);
      }

      // 更新文档的markdown内容
      await Document.findByIdAndUpdate(documentId, {
        markdownContent,
        processingStatus: 'completed'
      });

      // 异步处理AI功能
      this.processAIFeatures(documentId, markdownContent).catch(error => {
        console.error('AI处理失败:', error);
      });

      return markdownContent;
    } catch (error) {
      // 更新处理状态为失败
      await Document.findByIdAndUpdate(documentId, {
        processingStatus: 'failed',
        processingError: error.message
      });
      throw error;
    }
  }

  /**
   * PDF转Markdown
   */
  async extractPdfToMarkdown(fileBuffer) {
    try {
      const data = await pdfParse(fileBuffer);
      const text = data.text;
      
      // 简单的文本到markdown转换
      // 这里可以根据需要添加更复杂的格式化逻辑
      const lines = text.split('\n');
      let markdown = '';
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          // 简单的标题检测（全大写或特定模式）
          if (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length < 100) {
            markdown += `## ${trimmedLine}\n\n`;
          } else {
            markdown += `${trimmedLine}\n\n`;
          }
        }
      }
      
      return markdown;
    } catch (error) {
      throw new Error(`PDF解析失败: ${error.message}`);
    }
  }

  /**
   * Word文档转Markdown (占位符)
   */
  async extractWordToMarkdown(fileBuffer) {
    // TODO: 实现Word文档解析
    // 可以使用mammoth.js或其他库
    throw new Error('Word文档解析功能待实现');
  }

  /**
   * 异步处理AI功能
   */
  async processAIFeatures(documentId, markdownContent) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('文档不存在');
      }

      // 1. AI重构文档内容
      const restructuredContent = await this.aiService.restructureDocument(markdownContent, {
        style: 'academic',
        language: 'zh'
      });

      // 更新文档的重构内容
      await Document.findByIdAndUpdate(documentId, {
        restructuredContent
      });

      // 2. 并行处理摘要和概念提取
      const [summaryResult, conceptsResult] = await Promise.allSettled([
        this.generateAndSaveSummary(documentId, document.userId, markdownContent),
        this.extractAndSaveConcepts(documentId, document.userId, markdownContent)
      ]);

      // 记录处理结果
      if (summaryResult.status === 'rejected') {
        console.error('摘要生成失败:', summaryResult.reason);
      }
      if (conceptsResult.status === 'rejected') {
        console.error('概念提取失败:', conceptsResult.reason);
      }

    } catch (error) {
      console.error('AI功能处理失败:', error);
      throw error;
    }
  }

  /**
   * 生成并保存摘要
   */
  async generateAndSaveSummary(documentId, userId, markdownContent) {
    try {
      const summaryContent = await this.aiService.generateSummary(markdownContent, {
        length: 'medium',
        language: 'zh',
        includeKeyPoints: true
      });

      // 保存到Summary集合
      const summary = new Summary({
        documentId,
        userId,
        content: summaryContent,
        type: 'ai_generated',
        metadata: {
          aiModel: this.aiService.model,
          generatedAt: new Date(),
          contentLength: markdownContent.length
        }
      });

      await summary.save();
      return summary;
    } catch (error) {
      throw new Error(`摘要生成失败: ${error.message}`);
    }
  }

  /**
   * 提取并保存概念
   */
  async extractAndSaveConcepts(documentId, userId, markdownContent) {
    try {
      const concepts = await this.aiService.extractConcepts(markdownContent, {
        maxConcepts: 10,
        language: 'zh'
      });

      const savedConcepts = [];

      for (const conceptData of concepts) {
        // 检查概念是否已存在
        const existingConcept = await Concept.findOne({
          documentId,
          term: conceptData.term
        });

        if (existingConcept) {
          // 更新现有概念
          existingConcept.definition = conceptData.definition;
          existingConcept.category = conceptData.category;
          existingConcept.importance = conceptData.importance;
          
          // 添加新的出现位置
          if (conceptData.occurrences) {
            for (const occurrence of conceptData.occurrences) {
              await existingConcept.addOccurrence(
                occurrence.position,
                occurrence.context,
                occurrence.confidence
              );
            }
          }

          await existingConcept.save();
          savedConcepts.push(existingConcept);
        } else {
          // 创建新概念
          const concept = new Concept({
            term: conceptData.term,
            definition: conceptData.definition,
            documentId,
            userId,
            category: conceptData.category,
            importance: conceptData.importance,
            occurrences: conceptData.occurrences || [],
            metadata: {
              extractionMethod: 'ai',
              aiModel: this.aiService.model,
              extractionConfidence: 0.8
            }
          });

          await concept.save();
          savedConcepts.push(concept);
        }
      }

      return savedConcepts;
    } catch (error) {
      throw new Error(`概念提取失败: ${error.message}`);
    }
  }
}

module.exports = FileExtractService;
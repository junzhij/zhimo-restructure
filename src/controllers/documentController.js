const DocumentService = require('../services/DocumentService');
const FileExtractService = require('../services/FileExtractService');
const AIService = require('../services/AIService');
const { validationResult } = require('express-validator');

class DocumentController {
  constructor() {
    this.documentService = new DocumentService();
    this.aiService = new AIService();
  }

  /**
   * 上传文档
   */
  async uploadDocument(req, res) {
    try {
      // 检查验证错误
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '请求参数验证失败',
          errors: errors.array()
        });
      }

      // 检查是否有文件上传
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请选择要上传的文件'
        });
      }

      const userId = req.user.id;
      const metadata = {
        title: req.body.title,
        tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : []
      };

      // 上传文档到S3并创建MongoDB记录（会自动触发文件提取和AI处理）
      const uploadResult = await this.documentService.uploadDocument(req.file, userId, metadata);

      res.status(201).json({
        success: true,
        message: '文档上传成功，正在处理中',
        data: {
          document: uploadResult.document,
          processingStatus: 'pending'
        }
      });
    } catch (error) {
      console.error('Upload document error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '文档上传失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 获取文档详情
   */
  async getDocument(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;

      const document = await this.documentService.getDocument(documentId, userId);

      res.json({
        success: true,
        data: document
      });
    } catch (error) {
      console.error('Get document error:', error);
      const statusCode = error.message.includes('不存在') || error.message.includes('无权访问') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || '获取文档失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 获取用户文档列表
   */
  async listDocuments(req, res) {
    try {
      const userId = req.user.id;
      const filters = {
        format: req.query.format,
        status: req.query.status,
        search: req.query.search,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      // 移除空值
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined || filters[key] === null || filters[key] === '') {
          delete filters[key];
        }
      });

      const result = await this.documentService.listUserDocuments(userId, filters);
      
      // 导入模型用于检查数据是否存在
      const Summary = require('../models/Summary');
      const Concept = require('../models/Concept');
      
      // 批量检查所有文档的 Summary 和 Concept 数据
      const documentIds = result.documents.map(doc => doc._id);
      
      const [summaryDocs, conceptDocs] = await Promise.all([
        Summary.find({ 
          documentId: { $in: documentIds }, 
          isDeleted: false 
        }).distinct('documentId'),
        Concept.find({ 
          documentId: { $in: documentIds }, 
          isDeleted: false 
        }).distinct('documentId')
      ]);
      
      // 转换为Set以便快速查找
      const summaryDocSet = new Set(summaryDocs.map(id => id.toString()));
      const conceptDocSet = new Set(conceptDocs.map(id => id.toString()));

      res.json({
        success: true,
        data: result.documents.map(doc => ({
          hasBothSummaryAndConcept: summaryDocSet.has(doc._id.toString()) && conceptDocSet.has(doc._id.toString()),
          _id: doc._id,
          title: doc.title,
          createdAt: doc.createdAt,
          fileSize: doc.metadata?.fileSize || 0,
          readableFileSize: this.formatFileSize(doc.metadata?.fileSize || 0)
        }))
      });
    } catch (error) {
      console.error('List documents error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取文档列表失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 删除文档
   */
  async deleteDocument(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;

      const result = await this.documentService.deleteDocument(documentId, userId);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Delete document error:', error);
      const statusCode = error.message.includes('不存在') || error.message.includes('无权访问') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || '删除文档失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 下载文档
   */
  async downloadDocument(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;

      // 获取文档信息
      const document = await this.documentService.getDocument(documentId, userId);

      if (!document.filePath) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        });
      }

      // 从S3获取文件流
      const fileStream = await this.documentService.getFileStream(document.filePath);

      // 设置响应头
      res.setHeader('Content-Type', document.metadata.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.metadata.originalFileName)}"`);

      // 流式传输文件
      fileStream.pipe(res);
    } catch (error) {
      console.error('Download document error:', error);
      const statusCode = error.message.includes('不存在') || error.message.includes('无权访问') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || '下载文档失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 获取文档统计信息
   */
  async getDocumentStats(req, res) {
    try {
      const userId = req.user.id;

      // 这里可以添加更复杂的统计查询
      const stats = await this.documentService.listUserDocuments(userId, { limit: 1000 });

      const formatStats = {};
      const statusStats = {};
      let totalSize = 0;

      stats.documents.forEach(doc => {
        // 格式统计
        formatStats[doc.originalFormat] = (formatStats[doc.originalFormat] || 0) + 1;

        // 状态统计
        statusStats[doc.processingStatus] = (statusStats[doc.processingStatus] || 0) + 1;

        // 总大小
        totalSize += doc.metadata.fileSize || 0;
      });

      res.json({
        success: true,
        data: {
          total: stats.documents.length,
          formatStats,
          statusStats,
          totalSize,
          readableTotalSize: this.formatFileSize(totalSize)
        }
      });
    } catch (error) {
      console.error('Get document stats error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取统计信息失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 添加URL文档
   */
  async addUrlDocument(req, res) {
    try {
      // 检查验证错误
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '请求参数验证失败',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const { url, title, tags } = req.body;

      const metadata = {
        title,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : []
      };

      const result = await this.documentService.addUrlDocument(url, userId, metadata);

      res.status(201).json({
        success: true,
        message: 'URL文档添加成功',
        data: result
      });
    } catch (error) {
      console.error('Add URL document error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'URL文档添加失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 获取文档的Markdown内容
   */
  async getMarkdownContent(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;

      const document = await this.documentService.getDocument(documentId, userId);

      if (!document.markdownContent) {
        return res.status(404).json({
          success: false,
          message: '文档尚未处理完成或处理失败'
        });
      }

      res.json({
        success: true,
        data: {
          markdownContent: document.markdownContent,
          wordCount: document.metadata.wordCount || 0,
          processingStatus: document.processingStatus
        }
      });
    } catch (error) {
      console.error('Get markdown content error:', error);
      const statusCode = error.message.includes('不存在') || error.message.includes('无权访问') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || '获取Markdown内容失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 重新处理文档（如果之前处理失败）
   */
  async reprocessDocument(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;

      // 验证文档存在且属于当前用户
      const document = await this.documentService.getDocument(documentId, userId);

      if (document.processingStatus === 'processing') {
        return res.status(400).json({
          success: false,
          message: '文档正在处理中，请稍后再试'
        });
      }

      const result = await this.documentService.parseAndConvertDocument(documentId);

      res.json({
        success: true,
        message: '文档重新处理成功',
        data: result
      });
    } catch (error) {
      console.error('Reprocess document error:', error);
      const statusCode = error.message.includes('不存在') || error.message.includes('无权访问') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || '文档重新处理失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 获取AI文档重构结果
   */
  async getRestructuredContent(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;

      // 获取文档内容
      const document = await this.documentService.getDocument(documentId, userId);

      if (!document.restructuredContent) {
        return res.status(404).json({
          success: false,
          message: '文档尚未完成AI重构处理'
        });
      }

      res.json({
        success: true,
        data: {
          originalContent: document.markdownContent,
          restructuredContent: document.restructuredContent,
          processingStatus: document.processingStatus
        }
      });
    } catch (error) {
      console.error('Get restructured content error:', error);
      const statusCode = error.message.includes('不存在') || error.message.includes('无权访问') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || '获取AI重构内容失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 获取文档摘要
   */
  async getDocumentSummary(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;
      const { type } = req.query; // 可选：指定摘要类型

      // 验证文档存在且属于当前用户
      await this.documentService.getDocument(documentId, userId);

      // 从Summary集合中查询摘要
      const Summary = require('../models/Summary');
      const summaries = await Summary.findByDocument(documentId, { type });

      if (!summaries || summaries.length === 0) {
        return res.status(404).json({
          success: false,
          message: '文档摘要尚未生成'
        });
      }

      res.json({
        success: true,
        data: {
          summaries: summaries.map(summary => ({
            id: summary._id,
            type: summary.type,
            content: summary.content,
            wordCount: summary.metadata.wordCount,
            generatedAt: summary.generatedAt,
            aiModel: summary.metadata.aiModel
          }))
        }
      });
    } catch (error) {
      console.error('Get document summary error:', error);
      const statusCode = error.message.includes('不存在') || error.message.includes('无权访问') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || '获取文档摘要失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 生成练习题
   */
  async generateExercises(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;
      const {
        count = 5,
        types = ['multiple_choice', 'true_false', 'short_answer'],
        difficulty = 'medium',
        language = 'zh'
      } = req.body;

      const document = await this.documentService.getDocument(documentId, userId);

      if (!document.markdownContent) {
        return res.status(400).json({
          success: false,
          message: '文档尚未处理完成，无法生成练习题'
        });
      }

      const result = await this.aiService.generateExercises(
        document.markdownContent,
        document.title,
        {
          count,
          types,
          difficulty,
          language,
          documentId,
          userId,
          saveToDatabase: true
        }
      );

      res.json({
        success: true,
        data: {
          exercises: result.exercises,
          saved: result.saved,
          databaseId: result.databaseObject?._id,
          options: { count, types, difficulty, language }
        }
      });
    } catch (error) {
      console.error('Generate exercises error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '生成练习题失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 获取提取的概念
   */
  async getDocumentConcepts(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;
      const { category, importance, limit } = req.query;

      // 验证文档存在且属于当前用户
      await this.documentService.getDocument(documentId, userId);

      // 从Concept集合中查询概念
      const Concept = require('../models/Concept');
      const options = {};

      if (category) options.category = category;
      if (importance) options.importance = parseInt(importance);
      if (limit) options.limit = parseInt(limit);

      const concepts = await Concept.findByDocument(documentId, options);

      if (!concepts || concepts.length === 0) {
        return res.status(404).json({
          success: false,
          message: '文档概念尚未提取'
        });
      }

      res.json({
        success: true,
        data: {
          concepts: concepts.map(concept => ({
            id: concept._id,
            term: concept.term,
            definition: concept.definition,
            category: concept.category,
            importance: concept.importance,
            occurrenceCount: concept.occurrences.length,
            extractionConfidence: concept.metadata.extractionConfidence,
            createdAt: concept.createdAt
          })),
          total: concepts.length
        }
      });
    } catch (error) {
      console.error('Get document concepts error:', error);
      const statusCode = error.message.includes('不存在') || error.message.includes('无权访问') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || '获取文档概念失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 生成思维导图
   */
  async generateMindMap(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;
      const { maxNodes = 20, language = 'zh', style = 'mindmap' } = req.body;

      const document = await this.documentService.getDocument(documentId, userId);

      if (!document.markdownContent) {
        return res.status(400).json({
          success: false,
          message: '文档尚未处理完成，无法生成思维导图'
        });
      }

      const result = await this.aiService.generateMindMap(
        document.markdownContent,
        {
          maxNodes,
          language,
          style,
          documentId,
          userId,
          saveToDatabase: true
        }
      );

      res.json({
        success: true,
        data: {
          title: result.title,
          mermaid: result.mermaid,
          saved: result.saved,
          databaseId: result.databaseObject?._id,
          isValidSyntax: result.mermaid ? this.aiService.validateMermaidSyntax(result.mermaid) : false,
          options: { maxNodes, language, style }
        }
      });
    } catch (error) {
      console.error('Generate mind map error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '生成思维导图失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 批量AI处理
   */
  async processWithAI(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;
      const options = req.body;

      const document = await this.documentService.getDocument(documentId, userId);

      if (!document.markdownContent) {
        return res.status(400).json({
          success: false,
          message: '文档尚未处理完成，无法进行AI处理'
        });
      }

      const results = await this.aiService.processDocument(
        document.markdownContent,
        {
          ...options,
          documentId,
          userId,
          saveToDatabase: true
        }
      );

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Process with AI error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'AI批量处理失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 获取所有练习题列表
   */
  async getExercisesList(req, res) {
    try {
      const userId = req.user.id;

      const Exercise = require('../models/Exercise');
      const exercises = await Exercise.find({
        userId,
        isDeleted: false
      })
        .select('title documentId createdAt')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: exercises.map(exercise => ({
          id: exercise._id,
          title: exercise.title,
          documentId: exercise.documentId,
          createdAt: exercise.createdAt
        }))
      });
    } catch (error) {
      console.error('Get exercises list error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取练习题列表失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 获取指定练习题详情
   */
  async getExerciseDetail(req, res) {
    try {
      const { exerciseId } = req.params;
      const userId = req.user.id;

      const Exercise = require('../models/Exercise');
      const exercise = await Exercise.findOne({
        _id: exerciseId,
        userId,
        isDeleted: false
      })
        .select('title questions metadata settings');

      if (!exercise) {
        return res.status(404).json({
          success: false,
          message: '练习题不存在或无权访问'
        });
      }

      res.json({
        success: true,
        data: {
          id: exercise._id,
          title: exercise.title,
          questions: exercise.questions,
          metadata: {
            totalQuestions: exercise.metadata.totalQuestions,
            totalPoints: exercise.metadata.totalPoints,
            estimatedDuration: exercise.metadata.estimatedDuration,
            questionTypes: exercise.metadata.questionTypes,
            difficultyDistribution: exercise.metadata.difficultyDistribution
          },
          settings: exercise.settings
        }
      });
    } catch (error) {
      console.error('Get exercise detail error:', error);
      const statusCode = error.message.includes('不存在') || error.message.includes('无权访问') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || '获取练习题详情失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
  /**
   * 一次性获取文档的特定文件相应总结、概念、测试、练习题等
   * @param {string} documentId - 文档ID
   * @param {string} type - 类型（summary, concept, test, exercise）
   * @returns {Promise<Object>} - 返回特定类型的数据
   * @throws {Error} - 如果文档不存在或无权访问

  
  */
 async getAllDatafromDocumentonetime(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;
      // 验证文档存在且属于当前用户
      const document = await this.documentService.getDocument(documentId, userId);
      if (!document) {
        return res.status(404).json({
          success: false,
          message: '文档不存在或无权访问'
        });
      }
      let data;

      // 一次性获取文档的特定文件相应总结、概念、测试、练习题等
      data = await Promise.all([
        this.documentService.getDocumentSummary(documentId, userId),
        this.documentService.getDocumentConcepts(documentId, userId),
        this.documentService.getDocumentExercises(documentId, userId),
        this.documentService.getDocumentTests(documentId, userId)
      ]);

      res.json({
        success: true,
        data: {
          summary: data[0],
          concepts: data[1],
          exercises: data[2],
          tests: data[3]
        }
      });
    } catch (error) {
      console.error('Get all data from document error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取文档数据失败',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = DocumentController;
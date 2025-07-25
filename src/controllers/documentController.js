const DocumentService = require('../services/DocumentService');
const { validationResult } = require('express-validator');

class DocumentController {
  constructor() {
    this.documentService = new DocumentService();
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

      const result = await this.documentService.uploadDocument(req.file, userId, metadata);

      res.status(201).json({
        success: true,
        message: '文档上传成功',
        data: result
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

      res.json({
        success: true,
        data: result.documents,
        pagination: result.pagination
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
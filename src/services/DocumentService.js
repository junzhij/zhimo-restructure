const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const mime = require('mime-types');
const crypto = require('crypto');
const path = require('path');
const Document = require('../models/Document');

class DocumentService {
  constructor() {
    // 检查是否配置了S3
    this.s3Enabled = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME);
    
    if (this.s3Enabled) {
      // 初始化 AWS S3 客户端
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      });
      
      this.bucketName = process.env.S3_BUCKET_NAME;
    }
    
    this.maxFileSize = this.parseFileSize(process.env.MAX_FILE_SIZE || '50MB');
    
    // 支持的文件类型配置
    this.supportedFormats = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'docx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.ms-powerpoint': 'pptx',
      'image/jpeg': 'image',
      'image/jpg': 'image',
      'image/png': 'image',
      'image/gif': 'image',
      'image/bmp': 'image',
      'image/webp': 'image'
    };
  }

  /**
   * 解析文件大小字符串为字节数
   */
  parseFileSize(sizeStr) {
    const units = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };
    
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
    if (!match) {
      throw new Error('Invalid file size format');
    }
    
    const [, size, unit] = match;
    return parseFloat(size) * units[unit.toUpperCase()];
  }

  /**
   * 验证文件类型和大小
   */
  validateFile(file) {
    const errors = [];
    
    // 验证文件大小
    if (file.size > this.maxFileSize) {
      errors.push(`文件大小超过限制 (${this.maxFileSize / (1024 * 1024)}MB)`);
    }
    
    // 验证文件类型
    const mimeType = file.mimetype || mime.lookup(file.originalname);
    if (!this.supportedFormats[mimeType]) {
      errors.push(`不支持的文件类型: ${mimeType}`);
    }
    
    // 验证文件名
    if (!file.originalname || file.originalname.trim().length === 0) {
      errors.push('文件名不能为空');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      format: this.supportedFormats[mimeType],
      mimeType
    };
  }

  /**
   * 生成唯一的S3对象键
   */
  generateS3Key(userId, originalFileName, format) {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalFileName) || `.${format}`;
    const baseName = path.basename(originalFileName, ext).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    
    return `documents/${userId}/${timestamp}_${randomId}_${baseName}${ext}`;
  }

  /**
   * 上传文件到S3
   */
  async uploadToS3(file, s3Key) {
    // 如果在测试环境或S3未配置，模拟上传
    if (process.env.NODE_ENV === 'test' || !this.s3Enabled) {
      return {
        success: true,
        location: `mock://test-bucket/${s3Key}`,
        key: s3Key,
        etag: 'mock-etag-' + Date.now()
      };
    }

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
          Metadata: {
            originalName: file.originalname,
            uploadDate: new Date().toISOString()
          }
        }
      });

      const result = await upload.done();
      return {
        success: true,
        location: result.Location,
        key: s3Key,
        etag: result.ETag
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`文件上传失败: ${error.message}`);
    }
  }

  /**
   * 从S3删除文件
   */
  async deleteFromS3(s3Key) {
    // 如果在测试环境或S3未配置，模拟删除
    if (process.env.NODE_ENV === 'test' || !this.s3Enabled) {
      return { success: true };
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });
      
      await this.s3Client.send(command);
      return { success: true };
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error(`文件删除失败: ${error.message}`);
    }
  }

  /**
   * 上传文档
   */
  async uploadDocument(file, userId, metadata = {}) {
    try {
      // 验证文件
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // 生成S3键
      const s3Key = this.generateS3Key(userId, file.originalname, validation.format);
      
      // 上传到S3
      const uploadResult = await this.uploadToS3(file, s3Key);
      
      // 创建文档记录
      const document = new Document({
        userId,
        title: metadata.title || path.basename(file.originalname, path.extname(file.originalname)),
        originalFormat: validation.format,
        filePath: s3Key,
        metadata: {
          fileSize: file.size,
          uploadDate: new Date(),
          originalFileName: file.originalname,
          mimeType: validation.mimeType,
          s3Location: uploadResult.location,
          s3ETag: uploadResult.etag,
          ...metadata
        },
        processingStatus: 'pending'
      });

      await document.save();
      
      return {
        success: true,
        document: document.toJSON(),
        uploadInfo: {
          s3Key,
          location: uploadResult.location
        }
      };
    } catch (error) {
      console.error('Document upload error:', error);
      throw error;
    }
  }

  /**
   * 获取文档
   */
  async getDocument(documentId, userId) {
    try {
      const document = await Document.findOne({
        _id: documentId,
        userId,
        isDeleted: false
      });

      if (!document) {
        throw new Error('文档不存在或无权访问');
      }

      return document;
    } catch (error) {
      console.error('Get document error:', error);
      throw error;
    }
  }

  /**
   * 获取用户文档列表
   */
  async listUserDocuments(userId, filters = {}) {
    try {
      const query = {
        userId,
        isDeleted: false
      };

      // 应用过滤器
      if (filters.format) {
        query.originalFormat = filters.format;
      }
      
      if (filters.status) {
        query.processingStatus = filters.status;
      }

      if (filters.search) {
        query.$text = { $search: filters.search };
      }

      const documents = await Document.find(query)
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.offset || 0);

      const total = await Document.countDocuments(query);

      return {
        documents,
        pagination: {
          total,
          limit: filters.limit || 50,
          offset: filters.offset || 0,
          hasMore: (filters.offset || 0) + documents.length < total
        }
      };
    } catch (error) {
      console.error('List documents error:', error);
      throw error;
    }
  }

  /**
   * 删除文档
   */
  async deleteDocument(documentId, userId) {
    try {
      const document = await Document.findOne({
        _id: documentId,
        userId,
        isDeleted: false
      });

      if (!document) {
        throw new Error('文档不存在或无权访问');
      }

      // 从S3删除文件
      if (document.filePath) {
        await this.deleteFromS3(document.filePath);
      }

      // 软删除文档记录
      await document.softDelete();

      return {
        success: true,
        message: '文档删除成功'
      };
    } catch (error) {
      console.error('Delete document error:', error);
      throw error;
    }
  }

  /**
   * 从S3获取文件流
   */
  async getFileStream(s3Key) {
    // 如果在测试环境或S3未配置，返回模拟流
    if (process.env.NODE_ENV === 'test' || !this.s3Enabled) {
      const { Readable } = require('stream');
      const mockStream = new Readable();
      mockStream.push('Mock file content');
      mockStream.push(null);
      return mockStream;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      const response = await this.s3Client.send(command);
      return response.Body;
    } catch (error) {
      console.error('Get file stream error:', error);
      throw new Error(`获取文件失败: ${error.message}`);
    }
  }

  /**
   * 添加URL文档
   */
  async addUrlDocument(url, userId, metadata = {}) {
    try {
      // 验证URL格式
      try {
        new URL(url);
      } catch (error) {
        throw new Error('无效的URL格式');
      }

      // 创建URL文档记录
      const document = new Document({
        userId,
        title: metadata.title || this.extractTitleFromUrl(url),
        originalFormat: 'url',
        metadata: {
          url,
          uploadDate: new Date(),
          ...metadata
        },
        processingStatus: 'pending'
      });

      await document.save();
      
      return {
        success: true,
        document: document.toJSON()
      };
    } catch (error) {
      console.error('Add URL document error:', error);
      throw error;
    }
  }

  /**
   * 从URL提取标题
   */
  extractTitleFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/').filter(segment => segment.length > 0);
      
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        // 移除文件扩展名
        return lastSegment.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      }
      
      return urlObj.hostname;
    } catch (error) {
      return 'Web Document';
    }
  }

  /**
   * 更新文档处理状态
   */
  async updateProcessingStatus(documentId, status, error = null) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('文档不存在');
      }

      await document.updateProcessingStatus(status, error);
      return document;
    } catch (error) {
      console.error('Update processing status error:', error);
      throw error;
    }
  }
}

module.exports = DocumentService;
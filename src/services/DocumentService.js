const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const mime = require('mime-types');
const crypto = require('crypto');
const path = require('path');
const Document = require('../models/Document');
const FileExtractService = require('./FileExtractService');

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

    // 初始化文件提取服务
    this.fileExtractService = new FileExtractService();

    // 支持的文件类型配置
    this.supportedFormats = {
      'application/pdf': { extension: '.pdf', category: 'document' },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: '.docx', category: 'document' },
      'application/msword': { extension: '.doc', category: 'document' },
      'text/plain': { extension: '.txt', category: 'text' },
      'image/jpeg': { extension: '.jpg', category: 'image' },
      'image/png': { extension: '.png', category: 'image' }
    };
  }

  /**
   * 上传文档到S3并创建MongoDB记录
   * @param {Object} file - multer文件对象
   * @param {string} userId - 用户ID
   * @param {Object} metadata - 文档元数据
   * @returns {Promise<Object>} 创建的文档记录
   */
  async uploadDocument(file, userId, metadata = {}) {
    try {
      // 验证文件
      this._validateFile(file);

      // 生成唯一文件名
      const fileKey = this._generateFileKey(file.originalname);
      
      // 上传到S3
      const s3Result = await this._uploadToS3(file.buffer, fileKey, file.mimetype);

      // 创建MongoDB记录
      const document = new Document({
        userId,
        title: metadata.title || this._extractTitle(file.originalname),
        originalFormat: this._getFormatFromMimeType(file.mimetype),
        filePath: fileKey,
        processingStatus: 'pending',
        metadata: {
          originalFileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date(),
          s3Key: fileKey,
          s3Bucket: this.bucketName,
          ...metadata
        },
        tags: metadata.tags || []
      });

      const savedDocument = await document.save();

      // 异步处理文件提取
      this.processFileExtraction(savedDocument._id, file.buffer, file.mimetype).catch(error => {
        console.error('文件提取处理失败:', error);
      });
      
      return {
        document: savedDocument,
        uploadInfo: s3Result
      };
    } catch (error) {
      throw new Error(`文档上传失败: ${error.message}`);
    }
  }

  /**
   * 获取文档详情
   * @param {string} documentId - 文档ID
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 文档记录
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
      throw new Error(`获取文档失败: ${error.message}`);
    }
  }

  /**
   * 获取用户文档列表
   * @param {string} userId - 用户ID
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} 文档列表和分页信息
   */
  async listUserDocuments(userId, filters = {}) {
    try {
      const {
        format,
        status,
        search,
        limit = 50,
        offset = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      // 构建查询条件
      const query = { userId, isDeleted: false };

      if (format) {
        query.originalFormat = format;
      }

      if (status) {
        query.processingStatus = status;
      }

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { 'metadata.originalFileName': { $regex: search, $options: 'i' } }
        ];
      }

      // 执行查询
      const documents = await Document.find(query)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(offset)
        .limit(limit)
        .lean();

      const total = await Document.countDocuments(query);

      return {
        documents,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };
    } catch (error) {
      throw new Error(`获取文档列表失败: ${error.message}`);
    }
  }

  /**
   * 更新文档
   * @param {string} documentId - 文档ID
   * @param {string} userId - 用户ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新后的文档
   */
  async updateDocument(documentId, userId, updateData) {
    try {
      const document = await Document.findOneAndUpdate(
        { _id: documentId, userId, isDeleted: false },
        { 
          ...updateData,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!document) {
        throw new Error('文档不存在或无权访问');
      }

      return document;
    } catch (error) {
      throw new Error(`更新文档失败: ${error.message}`);
    }
  }

  /**
   * 删除文档（软删除）
   * @param {string} documentId - 文档ID
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteDocument(documentId, userId) {
    try {
      const document = await Document.findOneAndUpdate(
        { _id: documentId, userId, isDeleted: false },
        { 
          isDeleted: true,
          deletedAt: new Date()
        },
        { new: true }
      );

      if (!document) {
        throw new Error('文档不存在或无权访问');
      }

      return {
        message: '文档删除成功',
        documentId
      };
    } catch (error) {
      throw new Error(`删除文档失败: ${error.message}`);
    }
  }

  /**
   * 物理删除文档（包括S3文件）
   * @param {string} documentId - 文档ID
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 删除结果
   */
  async permanentDeleteDocument(documentId, userId) {
    try {
      const document = await Document.findOne({ 
        _id: documentId, 
        userId 
      });

      if (!document) {
        throw new Error('文档不存在或无权访问');
      }

      // 从S3删除文件
      if (document.filePath && this.s3Enabled) {
        await this._deleteFromS3(document.filePath);
      }

      // 从MongoDB删除记录
      await Document.findByIdAndDelete(documentId);

      return {
        message: '文档永久删除成功',
        documentId
      };
    } catch (error) {
      throw new Error(`永久删除文档失败: ${error.message}`);
    }
  }

  /**
   * 获取文件流（用于下载）
   * @param {string} filePath - S3文件路径
   * @returns {Promise<Stream>} 文件流
   */
  async getFileStream(filePath) {
    try {
      if (!this.s3Enabled) {
        throw new Error('S3未配置');
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filePath
      });

      const response = await this.s3Client.send(command);
      return response.Body;
    } catch (error) {
      throw new Error(`获取文件流失败: ${error.message}`);
    }
  }

  /**
   * 获取文件缓冲区
   * @param {string} filePath - S3文件路径
   * @returns {Promise<Buffer>} 文件缓冲区
   */
  async getFileBuffer(filePath) {
    try {
      const stream = await this.getFileStream(filePath);
      const chunks = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      throw new Error(`获取文件缓冲区失败: ${error.message}`);
    }
  }

  // 私有方法

  /**
   * 验证文件
   * @param {Object} file - 文件对象
   */
  _validateFile(file) {
    if (!file) {
      throw new Error('文件不能为空');
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`文件大小超过限制 (${this.formatFileSize(this.maxFileSize)})`);
    }

    if (!this.supportedFormats[file.mimetype]) {
      throw new Error(`不支持的文件类型: ${file.mimetype}`);
    }
  }

  /**
   * 生成唯一文件键
   * @param {string} originalName - 原始文件名
   * @returns {string} 文件键
   */
  _generateFileKey(originalName) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    return `documents/${timestamp}-${randomString}${extension}`;
  }

  /**
   * 上传文件到S3
   * @param {Buffer} buffer - 文件缓冲区
   * @param {string} key - S3键
   * @param {string} contentType - 内容类型
   * @returns {Promise<Object>} 上传结果
   */
  async _uploadToS3(buffer, key, contentType) {
    if (!this.s3Enabled) {
      throw new Error('S3未配置');
    }

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType
        }
      });

      const result = await upload.done();
      return result;
    } catch (error) {
      throw new Error(`S3上传失败: ${error.message}`);
    }
  }

  /**
   * 从S3删除文件
   * @param {string} key - S3键
   */
  async _deleteFromS3(key) {
    if (!this.s3Enabled) {
      return;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('S3删除失败:', error);
      // 不抛出错误，因为这不应该阻止文档删除
    }
  }

  /**
   * 从MIME类型获取格式
   * @param {string} mimeType - MIME类型
   * @returns {string} 格式
   */
  _getFormatFromMimeType(mimeType) {
    const formatMap = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
      'text/plain': 'txt',
      'image/jpeg': 'jpg',
      'image/png': 'png'
    };
    return formatMap[mimeType] || 'unknown';
  }

  /**
   * 从文件名提取标题
   * @param {string} filename - 文件名
   * @returns {string} 标题
   */
  _extractTitle(filename) {
    return path.basename(filename, path.extname(filename));
  }

  /**
   * 解析文件大小字符串
   * @param {string} sizeStr - 大小字符串 (如 "50MB")
   * @returns {number} 字节数
   */
  parseFileSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
    if (!match) return 50 * 1024 * 1024; // 默认50MB
    return parseFloat(match[1]) * (units[match[2].toUpperCase()] || 1);
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化的大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  /**
   * 处理文件提取
   * @param {string} documentId - 文档ID
   * @param {Buffer} fileBuffer - 文件缓冲区
   * @param {string} mimeType - 文件MIME类型
   */
  async processFileExtraction(documentId, fileBuffer, mimeType) {
    try {
      // 更新处理状态
      await Document.findByIdAndUpdate(documentId, {
        processingStatus: 'processing'
      });

      // 调用文件提取服务
      await this.fileExtractService.extractToMarkdown(documentId, fileBuffer, mimeType);
      
    } catch (error) {
      console.error('文件提取失败:', error);
      // 更新处理状态为失败
      await Document.findByIdAndUpdate(documentId, {
        processingStatus: 'failed',
        processingError: error.message
      });
    }
  }
}

module.exports = DocumentService;
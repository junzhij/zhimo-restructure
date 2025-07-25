const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const mime = require('mime-types');
const crypto = require('crypto');
const path = require('path');
const pdfParse = require('pdf-parse');
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
                processingStatus: 'processing'
            });

            await document.save();

            // 立即解析文档内容并转换为Markdown
            try {
                await this.parseAndConvertDocument(document._id, file);
            } catch (parseError) {
                console.error('Document parsing error during upload:', parseError);
                // 即使解析失败，也保留文档记录，但标记为失败状态
                await document.updateProcessingStatus('failed', parseError.message);
            }

            // 重新获取更新后的文档
            const updatedDocument = await Document.findById(document._id);

            return {
                success: true,
                document: updatedDocument.toJSON(),
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
                processingStatus: 'processing'
            });

            await document.save();

            // 立即生成Markdown内容
            try {
                await this.parseAndConvertDocument(document._id);
            } catch (parseError) {
                console.error('URL document processing error:', parseError);
                await document.updateProcessingStatus('failed', parseError.message);
            }

            // 重新获取更新后的文档
            const updatedDocument = await Document.findById(document._id);

            return {
                success: true,
                document: updatedDocument.toJSON()
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

    /**
     * 解析PDF文档
     */
    async parsePdfDocument(documentId) {
        try {
            const document = await Document.findById(documentId);
            if (!document) {
                throw new Error('文档不存在');
            }

            if (document.originalFormat !== 'pdf') {
                throw new Error('文档格式不是PDF');
            }

            // 更新处理状态为处理中
            await document.updateProcessingStatus('processing');

            // 获取PDF文件流
            const fileStream = await this.getFileStream(document.filePath);

            // 将流转换为Buffer
            const buffer = await this.streamToBuffer(fileStream);

            // 解析PDF
            const pdfData = await pdfParse(buffer);

            // 提取文本内容并转换为Markdown
            const markdownContent = this.convertPdfTextToMarkdown(pdfData);

            // 更新文档记录
            document.markdownContent = markdownContent;
            document.metadata.wordCount = this.countWords(markdownContent);
            document.metadata.pageCount = pdfData.numpages;

            await document.updateProcessingStatus('completed');

            return {
                success: true,
                document: document.toJSON(),
                extractedData: {
                    text: pdfData.text,
                    numPages: pdfData.numpages,
                    info: pdfData.info,
                    metadata: pdfData.metadata,
                    wordCount: document.metadata.wordCount
                }
            };
        } catch (error) {
            console.error('PDF parsing error:', error);

            // 更新处理状态为失败
            if (documentId) {
                try {
                    const document = await Document.findById(documentId);
                    if (document) {
                        await document.updateProcessingStatus('failed', error.message);
                    }
                } catch (updateError) {
                    console.error('Failed to update processing status:', updateError);
                }
            }

            throw error;
        }
    }

    /**
     * 将流转换为Buffer
     */
    async streamToBuffer(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    }

    /**
     * 将PDF文本转换为Markdown格式
     */
    convertPdfTextToMarkdown(pdfData) {
        let text = pdfData.text;

        // 添加文档信息
        const docInfo = this.generateDocumentInfo(pdfData);

        if (!text || text.trim().length === 0) {
            return docInfo + '\n\n# 文档内容\n\n无法提取文本内容，可能是扫描版PDF或包含大量图片的文档。';
        }

        // 基本的文本清理和格式化
        text = text
            // 移除多余的空白字符
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            // 合并多个连续的空行为单个空行
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            // 移除行首行尾的空白字符
            .split('\n')
            .map(line => line.trim())
            .join('\n');

        // 尝试识别标题结构
        const lines = text.split('\n');
        const processedLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (!line) {
                processedLines.push('');
                continue;
            }

            // 检测可能的标题（全大写、较短、独立成行）
            if (this.isPotentialTitle(line, lines, i)) {
                // 根据上下文判断标题级别
                const level = this.determineTitleLevel(line, lines, i);
                processedLines.push(`${'#'.repeat(level)} ${line}`);
            } else {
                processedLines.push(line);
            }
        }

        let markdownContent = processedLines.join('\n');

        // 如果没有检测到任何标题，添加一个默认标题
        if (!markdownContent.includes('#')) {
            markdownContent = '# 文档内容\n\n' + markdownContent;
        }

        return docInfo + '\n\n' + markdownContent;
    }

    /**
     * 判断是否为潜在标题
     */
    isPotentialTitle(line, lines, index) {
        // 空行不是标题
        if (!line.trim()) return false;

        // 太长的行不太可能是标题（超过100字符）
        if (line.length > 100) return false;

        // 检查是否全大写（对于英文）
        const hasUpperCase = /[A-Z]/.test(line);
        const isAllUpperCase = line === line.toUpperCase() && hasUpperCase;

        // 检查是否以数字开头（章节编号）
        const startsWithNumber = /^\d+[\.\s]/.test(line);

        // 检查前后是否有空行
        const prevLineEmpty = index === 0 || !lines[index - 1].trim();
        const nextLineEmpty = index === lines.length - 1 || !lines[index + 1].trim();

        // 检查是否包含常见标题关键词
        const titleKeywords = ['章', '节', '部分', 'Chapter', 'Section', 'Part', '第', '概述', '介绍', '总结'];
        const containsTitleKeyword = titleKeywords.some(keyword => line.includes(keyword));

        return (isAllUpperCase && prevLineEmpty) ||
            startsWithNumber ||
            (containsTitleKeyword && line.length < 50) ||
            (prevLineEmpty && nextLineEmpty && line.length < 80);
    }

    /**
     * 确定标题级别
     */
    determineTitleLevel(line, lines, index) {
        // 检查子章节编号模式 (如 1.1, 2.3 等) - 先检查这个
        const subNumberMatch = line.match(/^(\d+)\.(\d+)/);
        if (subNumberMatch) {
            return 2; // 子章节
        }

        // 检查数字编号模式
        const numberMatch = line.match(/^(\d+)[\.\s]/);
        if (numberMatch) {
            const number = parseInt(numberMatch[1]);
            if (number <= 10) return 1; // 主要章节
            return 2; // 子章节
        }

        // 检查中文章节模式
        if (line.includes('第') && (line.includes('章') || line.includes('节'))) {
            return line.includes('章') ? 1 : 2;
        }

        // 检查英文章节模式
        if (line.toLowerCase().includes('chapter')) return 1;
        if (line.toLowerCase().includes('section')) return 2;

        // 根据位置和长度判断
        if (index < lines.length * 0.1) return 1; // 文档前10%的标题可能是主标题
        if (line.length < 30) return 2;

        return 3; // 默认三级标题
    }

    /**
     * 生成文档信息
     */
    generateDocumentInfo(pdfData) {
        const info = [];

        info.push('---');
        info.push('**文档信息**');
        info.push('');
        info.push(`- **页数**: ${pdfData.numpages}`);

        if (pdfData.info) {
            if (pdfData.info.Title) {
                info.push(`- **标题**: ${pdfData.info.Title}`);
            }
            if (pdfData.info.Author) {
                info.push(`- **作者**: ${pdfData.info.Author}`);
            }
            if (pdfData.info.Subject) {
                info.push(`- **主题**: ${pdfData.info.Subject}`);
            }
            if (pdfData.info.Creator) {
                info.push(`- **创建工具**: ${pdfData.info.Creator}`);
            }
            if (pdfData.info.CreationDate) {
                info.push(`- **创建日期**: ${pdfData.info.CreationDate}`);
            }
        }

        info.push('---');

        return info.join('\n');
    }

    /**
     * 统计字数
     */
    countWords(text) {
        if (!text) return 0;

        // 移除Markdown标记
        const cleanText = text
            .replace(/#{1,6}\s/g, '') // 移除标题标记
            .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体标记
            .replace(/\*(.*?)\*/g, '$1') // 移除斜体标记
            .replace(/`(.*?)`/g, '$1') // 移除代码标记
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // 移除链接，保留文本
            .replace(/---/g, '') // 移除分隔线
            .replace(/\-\s\*\*.*?\*\*:\s/g, '') // 移除文档信息格式
            .replace(/\n/g, ' '); // 将换行替换为空格

        // 统计中文字符和英文单词
        const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;
        const englishWords = (cleanText.match(/[a-zA-Z]+/g) || []).length;

        return chineseChars + englishWords;
    }

    /**
     * 解析并转换文档（上传时调用）
     */
    async parseAndConvertDocument(documentId, fileBuffer = null) {
        try {
            const document = await Document.findById(documentId);
            if (!document) {
                throw new Error('文档不存在');
            }

            // 更新处理状态为处理中
            await document.updateProcessingStatus('processing');

            let buffer;
            if (fileBuffer) {
                // 如果提供了文件缓冲区，直接使用
                buffer = fileBuffer.buffer;
            } else {
                // 否则从S3获取文件流并转换为Buffer
                const fileStream = await this.getFileStream(document.filePath);
                buffer = await this.streamToBuffer(fileStream);
            }

            let markdownContent = '';
            let extractedData = {};

            // 根据文档格式进行解析
            switch (document.originalFormat) {
                case 'pdf':
                    const pdfData = await pdfParse(buffer);
                    markdownContent = this.convertPdfTextToMarkdown(pdfData);
                    extractedData = {
                        text: pdfData.text,
                        numPages: pdfData.numpages,
                        info: pdfData.info,
                        metadata: pdfData.metadata
                    };

                    // 更新PDF特有的元数据
                    document.metadata.pageCount = pdfData.numpages;
                    break;

                case 'url':
                    // URL文档暂时不需要解析文件内容
                    markdownContent = `# ${document.title}\n\n**URL**: ${document.metadata.url}\n\n*此文档为网页链接，内容解析功能将在后续版本中提供。*`;
                    break;

                default:
                    throw new Error(`暂不支持 ${document.originalFormat} 格式的解析`);
            }

            // 更新文档内容和元数据
            document.markdownContent = markdownContent;
            document.metadata.wordCount = this.countWords(markdownContent);

            await document.updateProcessingStatus('completed');

            return {
                success: true,
                document: document.toJSON(),
                extractedData
            };
        } catch (error) {
            console.error('Parse and convert document error:', error);

            // 更新处理状态为失败
            if (documentId) {
                try {
                    const document = await Document.findById(documentId);
                    if (document) {
                        await document.updateProcessingStatus('failed', error.message);
                    }
                } catch (updateError) {
                    console.error('Failed to update processing status:', updateError);
                }
            }

            throw error;
        }
    }

    /**
     * 解析文档（通用方法）
     */
    async parseDocument(documentId, format) {
        try {
            switch (format) {
                case 'pdf':
                    return await this.parsePdfDocument(documentId);
                default:
                    throw new Error(`暂不支持 ${format} 格式的解析`);
            }
        } catch (error) {
            console.error('Document parsing error:', error);
            throw error;
        }
    }

    /**
     * 将PDF内容转换为Markdown（公共接口）
     */
    async convertToMarkdown(documentId) {
        try {
            const document = await Document.findById(documentId);
            if (!document) {
                throw new Error('文档不存在');
            }

            // 如果已经有Markdown内容，直接返回
            if (document.markdownContent) {
                return {
                    success: true,
                    markdownContent: document.markdownContent,
                    wordCount: document.metadata.wordCount
                };
            }

            // 根据格式解析文档
            const parseResult = await this.parseDocument(documentId, document.originalFormat);

            return {
                success: true,
                markdownContent: parseResult.document.markdownContent,
                wordCount: parseResult.document.metadata.wordCount
            };
        } catch (error) {
            console.error('Convert to markdown error:', error);
            throw error;
        }
    }
}

module.exports = DocumentService;
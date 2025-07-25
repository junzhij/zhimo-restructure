const DocumentService = require('../src/services/DocumentService');
const Document = require('../src/models/Document');
const { initializeDatabase, cleanTestData } = require('../src/utils/initDatabase');
const databaseConnection = require('../src/utils/database');
const fs = require('fs');
const path = require('path');

describe('PDF Parsing Service', () => {
    let documentService;
    let testUserId;

    beforeAll(async () => {
        await initializeDatabase();
        documentService = new DocumentService();
        // Create a test user ID
        testUserId = '507f1f77bcf86cd799439011';
    });

    afterEach(async () => {
        await cleanTestData();
    });

    afterAll(async () => {
        await databaseConnection.disconnect();
    });

    describe('parsePdfDocument', () => {
        it('should parse a simple PDF document successfully', async () => {
            // Create a mock PDF document in database
            const document = new Document({
                userId: testUserId,
                title: 'Test PDF',
                originalFormat: 'pdf',
                filePath: 'test/path/test.pdf',
                processingStatus: 'pending',
                metadata: {
                    fileSize: 1024,
                    originalFileName: 'test.pdf',
                    mimeType: 'application/pdf'
                }
            });
            await document.save();

            // 使用真实的PDF文件
            const fs = require('fs');
            const path = require('path');
            const mockPdfBuffer = fs.readFileSync(path.join(__dirname, 'example.pdf'));

            // Mock getFileStream to return a readable stream
            const { Readable } = require('stream');
            const mockStream = new Readable();
            mockStream.push(mockPdfBuffer);
            mockStream.push(null);

            documentService.getFileStream = jest.fn().mockResolvedValue(mockStream);

            const result = await documentService.parsePdfDocument(document._id);

            expect(result.success).toBe(true);
            expect(result.document.processingStatus).toBe('completed');
            expect(result.document.markdownContent).toContain('文档信息');
            expect(result.extractedData.numPages).toBe(1);
            expect(typeof result.extractedData.wordCount).toBe('number');
        });

        it('should handle PDF parsing errors gracefully', async () => {
            // Create a mock PDF document in database
            const document = new Document({
                userId: testUserId,
                title: 'Invalid PDF',
                originalFormat: 'pdf',
                filePath: 'test/path/invalid.pdf',
                processingStatus: 'pending',
                metadata: {
                    fileSize: 1024,
                    originalFileName: 'invalid.pdf',
                    mimeType: 'application/pdf'
                }
            });
            await document.save();

            // Mock getFileStream to return invalid PDF data
            const { Readable } = require('stream');
            const mockStream = new Readable();
            mockStream.push(Buffer.from('Invalid PDF content'));
            mockStream.push(null);

            documentService.getFileStream = jest.fn().mockResolvedValue(mockStream);

            await expect(documentService.parsePdfDocument(document._id))
                .rejects.toThrow();

            // Check that document status was updated to failed
            const updatedDocument = await Document.findById(document._id);
            expect(updatedDocument.processingStatus).toBe('failed');
            expect(updatedDocument.processingError).toBeTruthy();
        });

        it('should reject non-PDF documents', async () => {
            // Create a non-PDF document in database
            const document = new Document({
                userId: testUserId,
                title: 'Word Document',
                originalFormat: 'docx',
                filePath: 'test/path/test.docx',
                processingStatus: 'pending',
                metadata: {
                    fileSize: 1024,
                    originalFileName: 'test.docx',
                    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                }
            });
            await document.save();

            await expect(documentService.parsePdfDocument(document._id))
                .rejects.toThrow('文档格式不是PDF');
        });

        it('should handle non-existent documents', async () => {
            const nonExistentId = '507f1f77bcf86cd799439999';

            await expect(documentService.parsePdfDocument(nonExistentId))
                .rejects.toThrow('文档不存在');
        });
    });

    describe('convertPdfTextToMarkdown', () => {
        it('should convert simple text to markdown', () => {
            const mockPdfData = {
                text: 'Chapter 1: Introduction\n\nThis is the introduction text.\n\nSection 1.1: Overview\n\nThis is the overview.',
                numpages: 1,
                info: {
                    Title: 'Test Document',
                    Author: 'Test Author'
                }
            };

            const markdown = documentService.convertPdfTextToMarkdown(mockPdfData);

            expect(markdown).toContain('**文档信息**');
            expect(markdown).toContain('**页数**: 1');
            expect(markdown).toContain('**标题**: Test Document');
            expect(markdown).toContain('**作者**: Test Author');
            expect(markdown).toContain('# Chapter 1: Introduction');
            expect(markdown).toContain('## Section 1.1: Overview');
        });

        it('should handle empty or invalid PDF text', () => {
            const mockPdfData = {
                text: '',
                numpages: 1,
                info: {}
            };

            const markdown = documentService.convertPdfTextToMarkdown(mockPdfData);

            expect(markdown).toContain('无法提取文本内容');
            expect(markdown).toContain('**页数**: 1');
        });

        it('should detect Chinese chapter titles', () => {
            const mockPdfData = {
                text: '第一章 概述\n\n这是概述内容。\n\n第二节 详细说明\n\n这是详细说明。',
                numpages: 1,
                info: {}
            };

            const markdown = documentService.convertPdfTextToMarkdown(mockPdfData);

            expect(markdown).toContain('# 第一章 概述');
            expect(markdown).toContain('## 第二节 详细说明');
        });

        it('should detect numbered sections', () => {
            const mockPdfData = {
                text: '1. Introduction\n\nIntroduction content.\n\n1.1 Background\n\nBackground content.\n\n2. Methodology\n\nMethodology content.',
                numpages: 1,
                info: {}
            };

            const markdown = documentService.convertPdfTextToMarkdown(mockPdfData);

            expect(markdown).toContain('# 1. Introduction');
            expect(markdown).toContain('## 1.1 Background');
            expect(markdown).toContain('# 2. Methodology');
        });
    });

    describe('isPotentialTitle', () => {
        it('should identify uppercase titles', () => {
            const lines = ['', 'INTRODUCTION', '', 'This is content.'];
            const result = documentService.isPotentialTitle('INTRODUCTION', lines, 1);
            expect(result).toBe(true);
        });

        it('should identify numbered sections', () => {
            const lines = ['', '1. Introduction', '', 'Content here.'];
            const result = documentService.isPotentialTitle('1. Introduction', lines, 1);
            expect(result).toBe(true);
        });

        it('should identify Chinese chapters', () => {
            const lines = ['', '第一章 概述', '', '这是内容。'];
            const result = documentService.isPotentialTitle('第一章 概述', lines, 1);
            expect(result).toBe(true);
        });

        it('should reject long lines as titles', () => {
            const longLine = 'This is a very long line that should not be considered a title because it contains too much content and is likely to be regular paragraph text rather than a heading.';
            const lines = ['', longLine, '', 'More content.'];
            const result = documentService.isPotentialTitle(longLine, lines, 1);
            expect(result).toBe(false);
        });

        it('should reject empty lines as titles', () => {
            const lines = ['', '', '', 'Content here.'];
            const result = documentService.isPotentialTitle('', lines, 1);
            expect(result).toBe(false);
        });
    });

    describe('determineTitleLevel', () => {
        it('should assign level 1 to chapters', () => {
            const lines = ['第一章 概述'];
            const level = documentService.determineTitleLevel('第一章 概述', lines, 0);
            expect(level).toBe(1);
        });

        it('should assign level 2 to sections', () => {
            const lines = ['第一节 详细说明'];
            const level = documentService.determineTitleLevel('第一节 详细说明', lines, 0);
            expect(level).toBe(2);
        });

        it('should assign level 1 to low numbers', () => {
            const lines = ['1. Introduction'];
            const level = documentService.determineTitleLevel('1. Introduction', lines, 0);
            expect(level).toBe(1);
        });

        it('should assign level 2 to subsections', () => {
            const lines = ['1.1 Background'];
            const level = documentService.determineTitleLevel('1.1 Background', lines, 0);
            expect(level).toBe(2);
        });
    });

    describe('countWords', () => {
        it('should count Chinese characters and English words', () => {
            const text = '这是中文内容 and this is English content.';
            const count = documentService.countWords(text);
            expect(count).toBe(11); // 6 Chinese chars + 5 English words
        });

        it('should handle markdown formatting', () => {
            const text = '# 标题\n\n**粗体文本** and *italic text*\n\n`code text`';
            const count = documentService.countWords(text);
            expect(count).toBe(11); // 2 Chinese chars + 6 English words + 3 more words
        });

        it('should handle empty text', () => {
            const count = documentService.countWords('');
            expect(count).toBe(0);
        });

        it('should handle null text', () => {
            const count = documentService.countWords(null);
            expect(count).toBe(0);
        });
    });

    describe('streamToBuffer', () => {
        it('should convert stream to buffer', async () => {
            const { Readable } = require('stream');
            const testData = 'Test stream data';
            const stream = new Readable();
            stream.push(testData);
            stream.push(null);

            const buffer = await documentService.streamToBuffer(stream);
            expect(buffer.toString()).toBe(testData);
        });

        it('should handle stream errors', async () => {
            const { Readable } = require('stream');
            const stream = new Readable({
                read() {
                    // Emit error immediately
                    this.emit('error', new Error('Stream error'));
                }
            });

            await expect(documentService.streamToBuffer(stream))
                .rejects.toThrow('Stream error');
        });
    });

    describe('parseAndConvertDocument', () => {
        it('should process PDF document with file buffer', async () => {
            // Create a mock PDF document
            const document = new Document({
                userId: testUserId,
                title: 'Test PDF',
                originalFormat: 'pdf',
                filePath: 'test/path/test.pdf',
                processingStatus: 'pending',
                metadata: {
                    fileSize: 1024,
                    originalFileName: 'test.pdf',
                    mimeType: 'application/pdf'
                }
            });
            await document.save();

            // 使用真实的PDF文件
            const fs = require('fs');
            const path = require('path');
            const mockPdfBuffer = fs.readFileSync(path.join(__dirname, 'example.pdf'));

            const mockFile = { buffer: mockPdfBuffer };

            const result = await documentService.parseAndConvertDocument(document._id, mockFile);

            expect(result.success).toBe(true);
            expect(result.document.processingStatus).toBe('completed');
            expect(result.document.markdownContent).toContain('文档信息');
            expect(result.extractedData.numPages).toBe(1);
        });

        it('should process URL document', async () => {
            // Create a mock URL document
            const document = new Document({
                userId: testUserId,
                title: 'Test URL',
                originalFormat: 'url',
                processingStatus: 'pending',
                metadata: {
                    url: 'https://example.com',
                    uploadDate: new Date()
                }
            });
            await document.save();

            const result = await documentService.parseAndConvertDocument(document._id);

            expect(result.success).toBe(true);
            expect(result.document.processingStatus).toBe('completed');
            expect(result.document.markdownContent).toContain('Test URL');
            expect(result.document.markdownContent).toContain('https://example.com');
        }, 30000); // 增加超时时间到30秒

        it('should handle processing errors', async () => {
            // Create a mock PDF document
            const document = new Document({
                userId: testUserId,
                title: 'Invalid PDF',
                originalFormat: 'pdf',
                filePath: 'test/path/invalid.pdf',
                processingStatus: 'pending',
                metadata: {
                    fileSize: 1024,
                    originalFileName: 'invalid.pdf',
                    mimeType: 'application/pdf'
                }
            });
            await document.save();

            const invalidFile = { buffer: Buffer.from('Invalid PDF content') };

            await expect(documentService.parseAndConvertDocument(document._id, invalidFile))
                .rejects.toThrow();

            // Check that document status was updated to failed
            const updatedDocument = await Document.findById(document._id);
            expect(updatedDocument.processingStatus).toBe('failed');
            expect(updatedDocument.processingError).toBeTruthy();
        });

        it('should reject unsupported formats', async () => {
            const document = new Document({
                userId: testUserId,
                title: 'Test Document',
                originalFormat: 'docx', // Unsupported format
                filePath: 'test/path/test.docx',
                processingStatus: 'pending'
            });
            await document.save();

            await expect(documentService.parseAndConvertDocument(document._id))
                .rejects.toThrow('暂不支持 docx 格式的解析');
        }, 30000); // 增加超时时间到30秒
    });

    describe('parseDocument', () => {
        it('should route PDF documents to PDF parser', async () => {
            // Create a mock PDF document
            const document = new Document({
                userId: testUserId,
                title: 'Test PDF',
                originalFormat: 'pdf',
                filePath: 'test/path/test.pdf',
                processingStatus: 'pending',
                metadata: {
                    fileSize: 1024,
                    originalFileName: 'test.pdf',
                    mimeType: 'application/pdf'
                }
            });
            await document.save();

            // Mock parsePdfDocument
            documentService.parsePdfDocument = jest.fn().mockResolvedValue({
                success: true,
                document: document.toJSON()
            });

            const result = await documentService.parseDocument(document._id, 'pdf');

            expect(documentService.parsePdfDocument).toHaveBeenCalledWith(document._id);
            expect(result.success).toBe(true);
        });

        it('should reject unsupported formats', async () => {
            const document = new Document({
                userId: testUserId,
                title: 'Test Document',
                originalFormat: 'pdf', // Use valid format for document creation
                filePath: 'test/path/test.pdf',
                processingStatus: 'pending'
            });
            await document.save();

            await expect(documentService.parseDocument(document._id, 'unsupported'))
                .rejects.toThrow('暂不支持 unsupported 格式的解析');
        });
    });

    describe('convertToMarkdown', () => {
        it('should return existing markdown content if available', async () => {
            const existingMarkdown = '# Existing Content\n\nThis is existing markdown.';
            const document = new Document({
                userId: testUserId,
                title: 'Test Document',
                originalFormat: 'pdf',
                filePath: 'test/path/test.pdf',
                markdownContent: existingMarkdown,
                processingStatus: 'completed',
                metadata: {
                    wordCount: 10
                }
            });
            await document.save();

            const result = await documentService.convertToMarkdown(document._id);

            expect(result.success).toBe(true);
            expect(result.markdownContent).toBe(existingMarkdown);
            expect(result.wordCount).toBe(10);
        });

        it('should parse document if no markdown content exists', async () => {
            const document = new Document({
                userId: testUserId,
                title: 'Test PDF',
                originalFormat: 'pdf',
                filePath: 'test/path/test.pdf',
                processingStatus: 'pending',
                metadata: {
                    fileSize: 1024,
                    originalFileName: 'test.pdf',
                    mimeType: 'application/pdf'
                }
            });
            await document.save();

            // Mock parseDocument
            const mockMarkdown = '# Parsed Content\n\nThis is parsed markdown.';
            documentService.parseDocument = jest.fn().mockResolvedValue({
                success: true,
                document: {
                    ...document.toJSON(),
                    markdownContent: mockMarkdown,
                    metadata: { ...document.metadata, wordCount: 15 }
                }
            });

            const result = await documentService.convertToMarkdown(document._id);

            expect(documentService.parseDocument).toHaveBeenCalledWith(document._id, 'pdf');
            expect(result.success).toBe(true);
            expect(result.markdownContent).toBe(mockMarkdown);
            expect(result.wordCount).toBe(15);
        });

        it('should handle non-existent documents', async () => {
            const nonExistentId = '507f1f77bcf86cd799439999';

            await expect(documentService.convertToMarkdown(nonExistentId))
                .rejects.toThrow('文档不存在');
        });
    });
});
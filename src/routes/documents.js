const express = require('express');
const multer = require('multer');
const router = express.Router();

const DocumentController = require('../controllers/documentController');
const { authenticateToken } = require('../middleware/auth');
const { validateDocumentUpload, validateUrlDocument } = require('../middleware/validation');

// Initialize document controller
const documentController = new DocumentController();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1 // Only allow single file upload
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
    }
  }
});

/**
 * @route   POST /api/documents/upload
 * @desc    上传文档
 * @access  Private
 */
router.post('/upload', 
  authenticateToken,
  upload.single('document'),
  validateDocumentUpload,
  documentController.uploadDocument.bind(documentController)
);

/**
 * @route   GET /api/documents
 * @desc    获取用户文档列表
 * @access  Private
 */
router.get('/',
  authenticateToken,
  documentController.listDocuments.bind(documentController)
);

/**
 * @route   GET /api/documents/stats
 * @desc    获取文档统计信息
 * @access  Private
 */
router.get('/stats',
  authenticateToken,
  documentController.getDocumentStats.bind(documentController)
);

/**
 * @route   GET /api/documents/:documentId
 * @desc    获取文档详情
 * @access  Private
 */
router.get('/:documentId',
  authenticateToken,
  documentController.getDocument.bind(documentController)
);

/**
 * @route   GET /api/documents/:documentId/download
 * @desc    下载文档
 * @access  Private
 */
router.get('/:documentId/download',
  authenticateToken,
  documentController.downloadDocument.bind(documentController)
);

/**
 * @route   POST /api/documents/url
 * @desc    添加URL文档
 * @access  Private
 */
router.post('/url',
  authenticateToken,
  validateUrlDocument,
  documentController.addUrlDocument.bind(documentController)
);

/**
 * @route   GET /api/documents/:documentId/markdown
 * @desc    获取文档的Markdown内容
 * @access  Private
 */
router.get('/:documentId/markdown',
  authenticateToken,
  documentController.getMarkdownContent.bind(documentController)
);

/**
 * @route   POST /api/documents/:documentId/reprocess
 * @desc    重新处理文档（如果之前处理失败）
 * @access  Private
 */
router.post('/:documentId/reprocess',
  authenticateToken,
  documentController.reprocessDocument.bind(documentController)
);

/**
 * @route   DELETE /api/documents/:documentId
 * @desc    删除文档
 * @access  Private
 */
router.delete('/:documentId',
  authenticateToken,
  documentController.deleteDocument.bind(documentController)
);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '文件大小超过限制 (50MB)'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: '一次只能上传一个文件'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: '意外的文件字段'
      });
    }
  }
  
  if (error.message.includes('不支持的文件类型')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router;
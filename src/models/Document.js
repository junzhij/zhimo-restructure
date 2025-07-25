const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '用户ID是必需的'],
    index: true
  },
  title: {
    type: String,
    required: [true, '文档标题是必需的'],
    trim: true,
    maxlength: [200, '标题不能超过200个字符']
  },
  originalFormat: {
    type: String,
    required: [true, '原始格式是必需的'],
    enum: ['pdf', 'docx', 'pptx', 'image', 'url'],
    index: true
  },
  filePath: {
    type: String,
    required: function() {
      return this.originalFormat !== 'url';
    }
  },
  markdownContent: {
    type: String,
    default: ''
  },
  restructuredContent: {
    type: String,
    default: null,
    maxlength: [50000, '重构内容不能超过50000个字符']
  },
  metadata: {
    fileSize: {
      type: Number,
      min: [0, '文件大小不能为负数']
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    originalFileName: {
      type: String,
      trim: true
    },
    mimeType: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      trim: true,
      required: function() {
        return this.originalFormat === 'url';
      }
    },
    wordCount: {
      type: Number,
      default: 0,
      min: [0, '字数不能为负数']
    },
    pageCount: {
      type: Number,
      default: 0,
      min: [0, '页数不能为负数']
    }
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  processingError: {
    type: String,
    default: null
  },
  syncStatus: {
    lastSynced: {
      type: Date,
      default: Date.now
    },
    version: {
      type: Number,
      default: 1,
      min: [1, '版本号必须大于0']
    },
    syncHash: {
      type: String,
      default: null
    }
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, '标签不能超过50个字符']
  }],
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// 复合索引配置
documentSchema.index({ userId: 1, createdAt: -1 });
documentSchema.index({ userId: 1, originalFormat: 1 });
documentSchema.index({ userId: 1, processingStatus: 1 });
documentSchema.index({ userId: 1, isDeleted: 1 });
documentSchema.index({ 'syncStatus.lastSynced': -1 });

// 文本搜索索引
documentSchema.index({ 
  title: 'text', 
  markdownContent: 'text',
  restructuredContent: 'text',
  'tags': 'text'
}, {
  weights: {
    title: 10,
    tags: 5,
    restructuredContent: 3,
    markdownContent: 1
  },
  name: 'document_text_search'
});

// 虚拟字段：文档大小（人类可读格式）
documentSchema.virtual('readableFileSize').get(function() {
  if (!this.metadata.fileSize) return 'Unknown';
  
  const bytes = this.metadata.fileSize;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// 实例方法：更新处理状态
documentSchema.methods.updateProcessingStatus = function(status, error = null) {
  this.processingStatus = status;
  if (error) {
    this.processingError = error;
  } else {
    this.processingError = null;
  }
  return this.save();
};

// 实例方法：更新同步状态
documentSchema.methods.updateSyncStatus = function() {
  this.syncStatus.lastSynced = new Date();
  this.syncStatus.version += 1;
  return this.save();
};

// 实例方法：软删除
documentSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// 静态方法：获取用户的活跃文档
documentSchema.statics.findActiveByUser = function(userId, options = {}) {
  const query = { userId, isDeleted: false };
  
  if (options.format) {
    query.originalFormat = options.format;
  }
  
  if (options.status) {
    query.processingStatus = options.status;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

// 静态方法：全文搜索
documentSchema.statics.searchByUser = function(userId, searchText, options = {}) {
  const query = {
    userId,
    isDeleted: false,
    $text: { $search: searchText }
  };
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20);
};

module.exports = mongoose.model('Document', documentSchema);
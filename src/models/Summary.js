const mongoose = require('mongoose');

const summarySchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: [true, '文档ID是必需的'],
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '用户ID是必需的'],
    index: true
  },
  type: {
    type: String,
    required: [true, '摘要类型是必需的'],
    enum: ['ai_generated', 'manual', 'oneline', 'detailed', 'keypoints'],
    default: 'ai_generated',
    index: true
  },
  content: {
    type: String,
    required: [true, '摘要内容是必需的'],
    maxlength: [10000, '摘要内容不能超过10000个字符']
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  version: {
    type: Number,
    default: 1,
    min: [1, '版本号必须大于0']
  },
  metadata: {
    wordCount: {
      type: Number,
      default: 0,
      min: [0, '字数不能为负数']
    },
    generationTime: {
      type: Number, // 生成耗时（毫秒）
      min: [0, '生成时间不能为负数']
    },
    aiModel: {
      type: String,
      default: 'gpt-3.5-turbo'
    },
    prompt: {
      type: String,
      maxlength: [2000, 'Prompt不能超过2000个字符']
    }
  },
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
summarySchema.index({ documentId: 1, type: 1 }, { unique: true });
summarySchema.index({ userId: 1, generatedAt: -1 });
summarySchema.index({ userId: 1, type: 1 });
summarySchema.index({ documentId: 1, isDeleted: 1 });

// 虚拟字段：摘要长度分类
summarySchema.virtual('lengthCategory').get(function() {
  const length = this.content.length;
  if (length <= 100) return 'short';
  if (length <= 1000) return 'medium';
  return 'long';
});

// 中间件：保存前计算字数
summarySchema.pre('save', function(next) {
  if (this.isModified('content')) {
    // 计算中文字符数（去除空格和标点）
    this.metadata.wordCount = this.content.replace(/[\s\p{P}]/gu, '').length;
  }
  next();
});

// 实例方法：更新版本
summarySchema.methods.updateVersion = function(newContent) {
  this.content = newContent;
  this.version += 1;
  this.generatedAt = new Date();
  return this.save();
};

// 实例方法：软删除
summarySchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// 静态方法：获取文档的所有摘要
summarySchema.statics.findByDocument = function(documentId, options = {}) {
  const query = { documentId, isDeleted: false };
  
  if (options.type) {
    query.type = options.type;
  }
  
  return this.find(query)
    .sort({ generatedAt: -1 })
    .populate('userId', 'username profile.displayName');
};

// 静态方法：获取用户的最新摘要
summarySchema.statics.findLatestByUser = function(userId, limit = 10) {
  return this.find({ userId, isDeleted: false })
    .sort({ generatedAt: -1 })
    .limit(limit)
    .populate('documentId', 'title originalFormat');
};

// 静态方法：获取特定类型的摘要统计
summarySchema.statics.getTypeStats = function(userId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), isDeleted: false } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        avgWordCount: { $avg: '$metadata.wordCount' },
        latestGenerated: { $max: '$generatedAt' }
      }
    }
  ]);
};

module.exports = mongoose.model('Summary', summarySchema);
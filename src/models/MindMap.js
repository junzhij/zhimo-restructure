const mongoose = require('mongoose');

const mindMapSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: [true, '思维导图标题是必需的'],
    trim: true,
    maxlength: [200, '标题不能超过200个字符']
  },
  mermaidContent: {
    type: String,
    required: [true, 'Mermaid内容是必需的'],
    maxlength: [50000, 'Mermaid内容不能超过50000个字符']
  },
  mermaidType: {
    type: String,
    required: [true, 'Mermaid图表类型是必需的'],
    enum: ['flowchart', 'mindmap', 'graph', 'gitgraph', 'timeline', 'classDiagram'],
    default: 'mindmap',
    index: true
  },
  version: {
    type: Number,
    default: 1,
    min: [1, '版本号必须大于0']
  },
  metadata: {
    nodeCount: {
      type: Number,
      default: 0,
      min: [0, '节点数不能为负数']
    },
    complexity: {
      type: String,
      enum: ['simple', 'medium', 'complex'],
      default: 'medium'
    },
    generationPrompt: {
      type: String,
      maxlength: [2000, '生成提示不能超过2000个字符']
    },
    generationTime: {
      type: Number, // 生成耗时（毫秒）
      min: [0, '生成时间不能为负数']
    },
    aiModel: {
      type: String,
      default: 'gpt-3.5-turbo'
    },
    lastValidated: {
      type: Date,
      default: null
    },
    validationStatus: {
      type: String,
      enum: ['valid', 'invalid', 'pending'],
      default: 'pending'
    },
    validationErrors: [{
      line: Number,
      message: String,
      severity: {
        type: String,
        enum: ['error', 'warning', 'info'],
        default: 'error'
      }
    }]
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
mindMapSchema.index({ documentId: 1, version: -1 });
mindMapSchema.index({ userId: 1, createdAt: -1 });
mindMapSchema.index({ userId: 1, mermaidType: 1 });
mindMapSchema.index({ documentId: 1, isDeleted: 1 });

// 虚拟字段：内容长度
mindMapSchema.virtual('contentLength').get(function() {
  return this.mermaidContent.length;
});

// 虚拟字段：是否为最新版本
mindMapSchema.virtual('isLatestVersion').get(function() {
  // 这个需要在查询时通过聚合或额外查询来确定
  return true; // 占位符
});

// 中间件：保存前计算节点数和复杂度
mindMapSchema.pre('save', function(next) {
  if (this.isModified('mermaidContent')) {
    // 计算节点数（简单估算，基于行数和特定关键字）
    const lines = this.mermaidContent.split('\n').filter(line => line.trim());
    this.metadata.nodeCount = lines.filter(line => 
      line.includes('-->') || line.includes('---') || line.includes('::')
    ).length;
    
    // 根据节点数确定复杂度
    if (this.metadata.nodeCount <= 10) {
      this.metadata.complexity = 'simple';
    } else if (this.metadata.nodeCount <= 30) {
      this.metadata.complexity = 'medium';
    } else {
      this.metadata.complexity = 'complex';
    }
  }
  next();
});

// 实例方法：验证Mermaid语法
mindMapSchema.methods.validateMermaidSyntax = function() {
  const errors = [];
  const lines = this.mermaidContent.split('\n');
  
  // 基本语法检查
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // 检查是否有未闭合的括号
    const openBrackets = (line.match(/\[/g) || []).length;
    const closeBrackets = (line.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push({
        line: i + 1,
        message: '括号未正确闭合',
        severity: 'error'
      });
    }
    
    // 检查箭头语法
    if (line.includes('->') && !line.includes('-->')) {
      errors.push({
        line: i + 1,
        message: '箭头语法不正确，应使用 "-->"',
        severity: 'warning'
      });
    }
  }
  
  this.metadata.validationErrors = errors;
  this.metadata.validationStatus = errors.length === 0 ? 'valid' : 'invalid';
  this.metadata.lastValidated = new Date();
  
  return this.save();
};

// 实例方法：更新版本
mindMapSchema.methods.updateVersion = function(newContent, prompt = null) {
  this.mermaidContent = newContent;
  this.version += 1;
  if (prompt) {
    this.metadata.generationPrompt = prompt;
  }
  this.metadata.validationStatus = 'pending';
  return this.save();
};

// 实例方法：软删除
mindMapSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// 静态方法：获取文档的思维导图
mindMapSchema.statics.findByDocument = function(documentId, options = {}) {
  const query = { documentId, isDeleted: false };
  
  if (options.type) {
    query.mermaidType = options.type;
  }
  
  return this.find(query)
    .sort({ version: -1, createdAt: -1 })
    .limit(options.limit || 10);
};

// 静态方法：获取最新版本的思维导图
mindMapSchema.statics.findLatestByDocument = function(documentId) {
  return this.findOne({ documentId, isDeleted: false })
    .sort({ version: -1 });
};

// 静态方法：获取用户的思维导图统计
mindMapSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), isDeleted: false } },
    {
      $group: {
        _id: '$mermaidType',
        count: { $sum: 1 },
        avgNodeCount: { $avg: '$metadata.nodeCount' },
        complexityDistribution: {
          $push: '$metadata.complexity'
        }
      }
    }
  ]);
};

// 静态方法：搜索思维导图
mindMapSchema.statics.searchByUser = function(userId, searchText, options = {}) {
  const query = {
    userId,
    isDeleted: false,
    $or: [
      { title: { $regex: searchText, $options: 'i' } },
      { mermaidContent: { $regex: searchText, $options: 'i' } }
    ]
  };
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20)
    .populate('documentId', 'title originalFormat');
};

module.exports = mongoose.model('MindMap', mindMapSchema);
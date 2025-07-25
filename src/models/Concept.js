const mongoose = require('mongoose');

const conceptSchema = new mongoose.Schema({
  term: {
    type: String,
    required: [true, '概念术语是必需的'],
    trim: true,
    maxlength: [200, '术语不能超过200个字符'],
    index: true
  },
  definition: {
    type: String,
    required: [true, '概念定义是必需的'],
    maxlength: [2000, '定义不能超过2000个字符']
  },
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
  occurrences: [{
    position: {
      type: Number,
      required: true,
      min: [0, '位置不能为负数']
    },
    context: {
      type: String,
      required: true,
      maxlength: [500, '上下文不能超过500个字符']
    },
    confidence: {
      type: Number,
      min: [0, '置信度不能小于0'],
      max: [1, '置信度不能大于1'],
      default: 1.0
    }
  }],
  relatedConcepts: [{
    conceptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Concept'
    },
    relationship: {
      type: String,
      enum: ['synonym', 'antonym', 'related', 'parent', 'child'],
      default: 'related'
    },
    strength: {
      type: Number,
      min: [0, '关联强度不能小于0'],
      max: [1, '关联强度不能大于1'],
      default: 0.5
    }
  }],
  category: {
    type: String,
    enum: ['person', 'place', 'concept', 'term', 'formula', 'theory', 'other'],
    default: 'concept',
    index: true
  },
  importance: {
    type: Number,
    min: [1, '重要性等级不能小于1'],
    max: [5, '重要性等级不能大于5'],
    default: 3
  },
  metadata: {
    extractionMethod: {
      type: String,
      enum: ['ai', 'manual', 'hybrid'],
      default: 'ai'
    },
    aiModel: {
      type: String,
      default: 'gpt-3.5-turbo'
    },
    extractionConfidence: {
      type: Number,
      min: [0, '提取置信度不能小于0'],
      max: [1, '提取置信度不能大于1'],
      default: 0.8
    },
    lastReviewed: {
      type: Date,
      default: null
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: [0, '复习次数不能为负数']
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
conceptSchema.index({ documentId: 1, term: 1 }, { unique: true });
conceptSchema.index({ userId: 1, category: 1 });
conceptSchema.index({ userId: 1, importance: -1 });
conceptSchema.index({ userId: 1, createdAt: -1 });
conceptSchema.index({ term: 'text', definition: 'text' });

// 虚拟字段：出现次数
conceptSchema.virtual('occurrenceCount').get(function() {
  return this.occurrences.length;
});

// 虚拟字段：关联概念数量
conceptSchema.virtual('relatedCount').get(function() {
  return this.relatedConcepts.length;
});

// 实例方法：添加出现位置
conceptSchema.methods.addOccurrence = function(position, context, confidence = 1.0) {
  // 检查是否已存在相同位置
  const existingOccurrence = this.occurrences.find(occ => occ.position === position);
  if (existingOccurrence) {
    existingOccurrence.context = context;
    existingOccurrence.confidence = confidence;
  } else {
    this.occurrences.push({ position, context, confidence });
  }
  return this.save();
};

// 实例方法：添加关联概念
conceptSchema.methods.addRelatedConcept = function(conceptId, relationship = 'related', strength = 0.5) {
  // 检查是否已存在关联
  const existingRelation = this.relatedConcepts.find(rel => 
    rel.conceptId.toString() === conceptId.toString()
  );
  
  if (existingRelation) {
    existingRelation.relationship = relationship;
    existingRelation.strength = strength;
  } else {
    this.relatedConcepts.push({ conceptId, relationship, strength });
  }
  return this.save();
};

// 实例方法：更新复习记录
conceptSchema.methods.updateReview = function() {
  this.metadata.lastReviewed = new Date();
  this.metadata.reviewCount += 1;
  return this.save();
};

// 实例方法：软删除
conceptSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// 静态方法：根据文档获取概念
conceptSchema.statics.findByDocument = function(documentId, options = {}) {
  const query = { documentId, isDeleted: false };
  
  if (options.category) {
    query.category = options.category;
  }
  
  if (options.importance) {
    query.importance = { $gte: options.importance };
  }
  
  return this.find(query)
    .sort({ importance: -1, createdAt: -1 })
    .limit(options.limit || 50);
};

// 静态方法：搜索概念
conceptSchema.statics.searchByUser = function(userId, searchText, options = {}) {
  const query = {
    userId,
    isDeleted: false,
    $text: { $search: searchText }
  };
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20);
};

// 静态方法：获取高频概念
conceptSchema.statics.getFrequentConcepts = function(userId, limit = 10) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), isDeleted: false } },
    {
      $addFields: {
        occurrenceCount: { $size: '$occurrences' }
      }
    },
    { $sort: { occurrenceCount: -1, importance: -1 } },
    { $limit: limit }
  ]);
};

// 静态方法：获取概念统计
conceptSchema.statics.getConceptStats = function(userId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), isDeleted: false } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgImportance: { $avg: '$importance' },
        totalOccurrences: { $sum: { $size: '$occurrences' } }
      }
    }
  ]);
};

module.exports = mongoose.model('Concept', conceptSchema);
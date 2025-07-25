const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: [true, '题目类型是必需的'],
    enum: ['multiple_choice', 'true_false', 'short_answer'],
    index: true
  },
  question: {
    type: String,
    required: [true, '题目内容是必需的'],
    maxlength: [1000, '题目内容不能超过1000个字符']
  },
  options: [{
    type: String,
    maxlength: [500, '选项不能超过500个字符']
  }],
  correctAnswer: {
    type: String,
    required: [true, '正确答案是必需的'],
    maxlength: [2000, '正确答案不能超过2000个字符']
  },
  explanation: {
    type: String,
    maxlength: [2000, '解析不能超过2000个字符']
  },
  difficulty: {
    type: Number,
    min: [1, '难度等级不能小于1'],
    max: [5, '难度等级不能大于5'],
    default: 3
  },
  points: {
    type: Number,
    min: [1, '分值不能小于1'],
    max: [100, '分值不能大于100'],
    default: 10
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, '标签不能超过50个字符']
  }],
  metadata: {
    sourceSection: {
      type: String,
      maxlength: [200, '来源章节不能超过200个字符']
    },
    keywordsCovered: [{
      type: String,
      maxlength: [100, '关键词不能超过100个字符']
    }],
    estimatedTime: {
      type: Number, // 预估答题时间（秒）
      min: [10, '预估时间不能小于10秒'],
      default: 60
    }
  }
}, { _id: false });

const exerciseSchema = new mongoose.Schema({
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
    required: [true, '练习标题是必需的'],
    trim: true,
    maxlength: [200, '标题不能超过200个字符']
  },
  description: {
    type: String,
    maxlength: [1000, '描述不能超过1000个字符']
  },
  questions: [questionSchema],
  metadata: {
    totalQuestions: {
      type: Number,
      default: 0,
      min: [0, '题目总数不能为负数']
    },
    questionTypes: {
      multiple_choice: { type: Number, default: 0 },
      true_false: { type: Number, default: 0 },
      short_answer: { type: Number, default: 0 }
    },
    difficultyDistribution: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 }
    },
    totalPoints: {
      type: Number,
      default: 0,
      min: [0, '总分不能为负数']
    },
    estimatedDuration: {
      type: Number, // 预估完成时间（分钟）
      default: 0,
      min: [0, '预估时长不能为负数']
    },
    generationPrompt: {
      type: String,
      maxlength: [2000, '生成提示不能超过2000个字符']
    },
    aiModel: {
      type: String,
      default: 'gpt-3.5-turbo'
    },
    generationTime: {
      type: Number, // 生成耗时（毫秒）
      min: [0, '生成时间不能为负数']
    }
  },
  settings: {
    shuffleQuestions: {
      type: Boolean,
      default: false
    },
    shuffleOptions: {
      type: Boolean,
      default: true
    },
    showExplanation: {
      type: Boolean,
      default: true
    },
    allowRetry: {
      type: Boolean,
      default: true
    },
    timeLimit: {
      type: Number, // 时间限制（分钟），0表示无限制
      default: 0,
      min: [0, '时间限制不能为负数']
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
exerciseSchema.index({ documentId: 1, createdAt: -1 });
exerciseSchema.index({ userId: 1, createdAt: -1 });
exerciseSchema.index({ userId: 1, isDeleted: 1 });

// 中间件：保存前更新元数据
exerciseSchema.pre('save', function(next) {
  if (this.isModified('questions')) {
    // 更新题目总数
    this.metadata.totalQuestions = this.questions.length;
    
    // 重置计数器
    this.metadata.questionTypes = {
      multiple_choice: 0,
      true_false: 0,
      short_answer: 0
    };
    
    this.metadata.difficultyDistribution = {
      easy: 0,
      medium: 0,
      hard: 0
    };
    
    let totalPoints = 0;
    let totalEstimatedTime = 0;
    
    // 统计各类型题目数量和难度分布
    this.questions.forEach(question => {
      this.metadata.questionTypes[question.type]++;
      
      // 难度分布
      if (question.difficulty <= 2) {
        this.metadata.difficultyDistribution.easy++;
      } else if (question.difficulty <= 3) {
        this.metadata.difficultyDistribution.medium++;
      } else {
        this.metadata.difficultyDistribution.hard++;
      }
      
      totalPoints += question.points;
      totalEstimatedTime += question.metadata.estimatedTime || 60;
    });
    
    this.metadata.totalPoints = totalPoints;
    this.metadata.estimatedDuration = Math.ceil(totalEstimatedTime / 60); // 转换为分钟
  }
  next();
});

// 实例方法：添加题目
exerciseSchema.methods.addQuestion = function(questionData) {
  const questionId = new mongoose.Types.ObjectId().toString();
  const question = {
    id: questionId,
    ...questionData
  };
  
  this.questions.push(question);
  return this.save();
};

// 实例方法：更新题目
exerciseSchema.methods.updateQuestion = function(questionId, updates) {
  const question = this.questions.id(questionId);
  if (!question) {
    throw new Error('题目不存在');
  }
  
  Object.assign(question, updates);
  return this.save();
};

// 实例方法：删除题目
exerciseSchema.methods.removeQuestion = function(questionId) {
  this.questions.id(questionId).remove();
  return this.save();
};

// 实例方法：获取随机题目
exerciseSchema.methods.getRandomQuestions = function(count) {
  const shuffled = [...this.questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// 实例方法：软删除
exerciseSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// 静态方法：根据文档获取练习
exerciseSchema.statics.findByDocument = function(documentId, options = {}) {
  const query = { documentId, isDeleted: false };
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 10);
};

// 静态方法：根据难度获取练习
exerciseSchema.statics.findByDifficulty = function(userId, difficulty, options = {}) {
  const query = {
    userId,
    isDeleted: false,
    'questions.difficulty': difficulty
  };
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20);
};

// 静态方法：搜索练习
exerciseSchema.statics.searchByUser = function(userId, searchText, options = {}) {
  const query = {
    userId,
    isDeleted: false,
    $or: [
      { title: { $regex: searchText, $options: 'i' } },
      { description: { $regex: searchText, $options: 'i' } },
      { 'questions.question': { $regex: searchText, $options: 'i' } }
    ]
  };
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20)
    .populate('documentId', 'title originalFormat');
};

// 静态方法：获取练习统计
exerciseSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), isDeleted: false } },
    {
      $group: {
        _id: null,
        totalExercises: { $sum: 1 },
        totalQuestions: { $sum: '$metadata.totalQuestions' },
        avgQuestionsPerExercise: { $avg: '$metadata.totalQuestions' },
        totalPoints: { $sum: '$metadata.totalPoints' },
        typeDistribution: {
          $push: '$metadata.questionTypes'
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Exercise', exerciseSchema);
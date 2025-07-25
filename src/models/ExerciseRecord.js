const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: [true, '题目ID是必需的']
  },
  userAnswer: {
    type: String,
    required: [true, '用户答案是必需的'],
    maxlength: [2000, '答案不能超过2000个字符']
  },
  correctAnswer: {
    type: String,
    required: [true, '正确答案是必需的']
  },
  isCorrect: {
    type: Boolean,
    required: [true, '是否正确是必需的'],
    index: true
  },
  timeSpent: {
    type: Number, // 答题耗时（秒）
    required: [true, '答题时间是必需的'],
    min: [0, '答题时间不能为负数']
  },
  points: {
    type: Number,
    required: [true, '得分是必需的'],
    min: [0, '得分不能为负数']
  },
  maxPoints: {
    type: Number,
    required: [true, '满分是必需的'],
    min: [0, '满分不能为负数']
  },
  difficulty: {
    type: Number,
    min: [1, '难度等级不能小于1'],
    max: [5, '难度等级不能大于5']
  },
  questionType: {
    type: String,
    enum: ['multiple_choice', 'true_false', 'short_answer'],
    required: [true, '题目类型是必需的']
  },
  feedback: {
    type: String,
    maxlength: [1000, '反馈不能超过1000个字符']
  }
}, { _id: false });

const exerciseRecordSchema = new mongoose.Schema({
  exerciseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    required: [true, '练习ID是必需的'],
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '用户ID是必需的'],
    index: true
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: [true, '文档ID是必需的'],
    index: true
  },
  answers: [answerSchema],
  score: {
    totalPoints: {
      type: Number,
      default: 0,
      min: [0, '总得分不能为负数']
    },
    maxPoints: {
      type: Number,
      default: 0,
      min: [0, '总满分不能为负数']
    },
    percentage: {
      type: Number,
      default: 0,
      min: [0, '得分百分比不能小于0'],
      max: [100, '得分百分比不能大于100']
    },
    grade: {
      type: String,
      enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'],
      default: 'F'
    }
  },
  performance: {
    totalQuestions: {
      type: Number,
      default: 0,
      min: [0, '题目总数不能为负数']
    },
    correctAnswers: {
      type: Number,
      default: 0,
      min: [0, '正确答案数不能为负数']
    },
    accuracy: {
      type: Number,
      default: 0,
      min: [0, '准确率不能小于0'],
      max: [100, '准确率不能大于100']
    },
    totalTimeSpent: {
      type: Number, // 总耗时（秒）
      default: 0,
      min: [0, '总耗时不能为负数']
    },
    averageTimePerQuestion: {
      type: Number, // 平均每题耗时（秒）
      default: 0,
      min: [0, '平均每题耗时不能为负数']
    }
  },
  difficultyBreakdown: {
    easy: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    },
    medium: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    },
    hard: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    }
  },
  typeBreakdown: {
    multiple_choice: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    },
    true_false: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    },
    short_answer: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    }
  },
  completedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: {
    deviceInfo: {
      type: String,
      maxlength: [200, '设备信息不能超过200个字符']
    },
    sessionId: {
      type: String,
      maxlength: [100, '会话ID不能超过100个字符']
    },
    retryCount: {
      type: Number,
      default: 0,
      min: [0, '重试次数不能为负数']
    },
    hints: [{
      questionId: String,
      hintText: String,
      usedAt: { type: Date, default: Date.now }
    }]
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
exerciseRecordSchema.index({ userId: 1, completedAt: -1 });
exerciseRecordSchema.index({ exerciseId: 1, completedAt: -1 });
exerciseRecordSchema.index({ documentId: 1, completedAt: -1 });
exerciseRecordSchema.index({ userId: 1, 'score.percentage': -1 });

// 中间件：保存前计算统计数据
exerciseRecordSchema.pre('save', function(next) {
  if (this.isModified('answers')) {
    // 计算基本统计
    this.performance.totalQuestions = this.answers.length;
    this.performance.correctAnswers = this.answers.filter(a => a.isCorrect).length;
    this.performance.accuracy = this.performance.totalQuestions > 0 
      ? (this.performance.correctAnswers / this.performance.totalQuestions) * 100 
      : 0;
    
    // 计算总耗时和平均耗时
    this.performance.totalTimeSpent = this.answers.reduce((sum, a) => sum + a.timeSpent, 0);
    this.performance.averageTimePerQuestion = this.performance.totalQuestions > 0 
      ? this.performance.totalTimeSpent / this.performance.totalQuestions 
      : 0;
    
    // 计算总分
    this.score.totalPoints = this.answers.reduce((sum, a) => sum + a.points, 0);
    this.score.maxPoints = this.answers.reduce((sum, a) => sum + a.maxPoints, 0);
    this.score.percentage = this.score.maxPoints > 0 
      ? (this.score.totalPoints / this.score.maxPoints) * 100 
      : 0;
    
    // 计算等级
    this.score.grade = this.calculateGrade(this.score.percentage);
    
    // 计算难度分布统计
    this.calculateDifficultyBreakdown();
    
    // 计算题型分布统计
    this.calculateTypeBreakdown();
  }
  next();
});

// 实例方法：计算等级
exerciseRecordSchema.methods.calculateGrade = function(percentage) {
  if (percentage >= 97) return 'A+';
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 60) return 'D';
  return 'F';
};

// 实例方法：计算难度分布
exerciseRecordSchema.methods.calculateDifficultyBreakdown = function() {
  const breakdown = {
    easy: { attempted: 0, correct: 0, accuracy: 0 },
    medium: { attempted: 0, correct: 0, accuracy: 0 },
    hard: { attempted: 0, correct: 0, accuracy: 0 }
  };
  
  this.answers.forEach(answer => {
    let category;
    if (answer.difficulty <= 2) category = 'easy';
    else if (answer.difficulty <= 3) category = 'medium';
    else category = 'hard';
    
    breakdown[category].attempted++;
    if (answer.isCorrect) {
      breakdown[category].correct++;
    }
  });
  
  // 计算准确率
  Object.keys(breakdown).forEach(key => {
    const data = breakdown[key];
    data.accuracy = data.attempted > 0 ? (data.correct / data.attempted) * 100 : 0;
  });
  
  this.difficultyBreakdown = breakdown;
};

// 实例方法：计算题型分布
exerciseRecordSchema.methods.calculateTypeBreakdown = function() {
  const breakdown = {
    multiple_choice: { attempted: 0, correct: 0, accuracy: 0 },
    true_false: { attempted: 0, correct: 0, accuracy: 0 },
    short_answer: { attempted: 0, correct: 0, accuracy: 0 }
  };
  
  this.answers.forEach(answer => {
    const type = answer.questionType;
    breakdown[type].attempted++;
    if (answer.isCorrect) {
      breakdown[type].correct++;
    }
  });
  
  // 计算准确率
  Object.keys(breakdown).forEach(key => {
    const data = breakdown[key];
    data.accuracy = data.attempted > 0 ? (data.correct / data.attempted) * 100 : 0;
  });
  
  this.typeBreakdown = breakdown;
};

// 静态方法：获取用户练习历史
exerciseRecordSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId };
  
  if (options.exerciseId) {
    query.exerciseId = options.exerciseId;
  }
  
  if (options.documentId) {
    query.documentId = options.documentId;
  }
  
  return this.find(query)
    .sort({ completedAt: -1 })
    .limit(options.limit || 50)
    .populate('exerciseId', 'title metadata.totalQuestions')
    .populate('documentId', 'title originalFormat');
};

// 静态方法：获取用户表现统计
exerciseRecordSchema.statics.getUserPerformanceStats = function(userId, timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);
  
  return this.aggregate([
    { 
      $match: { 
        userId: new mongoose.Types.ObjectId(userId),
        completedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalExercises: { $sum: 1 },
        avgScore: { $avg: '$score.percentage' },
        avgAccuracy: { $avg: '$performance.accuracy' },
        totalTimeSpent: { $sum: '$performance.totalTimeSpent' },
        gradeDistribution: { $push: '$score.grade' },
        improvementTrend: {
          $push: {
            date: '$completedAt',
            score: '$score.percentage'
          }
        }
      }
    }
  ]);
};

// 静态方法：获取弱项分析
exerciseRecordSchema.statics.getWeaknessAnalysis = function(userId, limit = 10) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $unwind: '$answers' },
    { $match: { 'answers.isCorrect': false } },
    {
      $group: {
        _id: {
          difficulty: '$answers.difficulty',
          type: '$answers.questionType'
        },
        incorrectCount: { $sum: 1 },
        avgTimeSpent: { $avg: '$answers.timeSpent' },
        examples: { $push: '$answers.questionId' }
      }
    },
    { $sort: { incorrectCount: -1 } },
    { $limit: limit }
  ]);
};

module.exports = mongoose.model('ExerciseRecord', exerciseRecordSchema);
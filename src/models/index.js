const mongoose = require('mongoose');

// 导入所有模型
const User = require('./User');
const Document = require('./Document');
const Summary = require('./Summary');
const Concept = require('./Concept');
const MindMap = require('./MindMap');
const Exercise = require('./Exercise');
const ExerciseRecord = require('./ExerciseRecord');

// 导出所有模型
module.exports = {
  User,
  Document,
  Summary,
  Concept,
  MindMap,
  Exercise,
  ExerciseRecord
};
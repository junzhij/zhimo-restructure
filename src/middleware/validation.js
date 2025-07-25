const { body } = require('express-validator');

/**
 * 用户注册验证规则
 */
const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('用户名长度必须在3-30个字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),
    
  body('email')
    .trim()
    .isEmail()
    .withMessage('请输入有效的邮箱地址')
    .normalizeEmail(),
    
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码至少需要6个字符')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('密码必须包含至少一个字母和一个数字'),
    
  body('displayName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('显示名称不能超过50个字符')
];

/**
 * 用户登录验证规则
 */
const validateLogin = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('请输入用户名或邮箱'),
    
  body('password')
    .notEmpty()
    .withMessage('请输入密码')
];

/**
 * 更新用户资料验证规则
 */
const validateUpdateProfile = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('显示名称不能超过50个字符'),
    
  body('defaultSummaryType')
    .optional()
    .isIn(['oneline', 'detailed', 'keypoints'])
    .withMessage('默认摘要类型必须是 oneline、detailed 或 keypoints'),
    
  body('language')
    .optional()
    .isIn(['zh-CN', 'en-US'])
    .withMessage('语言设置必须是 zh-CN 或 en-US')
];

/**
 * 修改密码验证规则
 */
const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('请输入当前密码'),
    
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('新密码至少需要6个字符')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('新密码必须包含至少一个字母和一个数字'),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('确认密码与新密码不匹配');
      }
      return true;
    })
];

/**
 * 文档上传验证规则
 */
const validateDocumentUpload = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('文档标题不能超过200个字符'),
    
  body('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        const tags = value.split(',').map(tag => tag.trim());
        if (tags.length > 10) {
          throw new Error('标签数量不能超过10个');
        }
        for (const tag of tags) {
          if (tag.length > 50) {
            throw new Error('单个标签长度不能超过50个字符');
          }
        }
      }
      return true;
    })
];

/**
 * URL文档添加验证规则
 */
const validateUrlDocument = [
  body('url')
    .trim()
    .isURL()
    .withMessage('请输入有效的URL地址'),
    
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('文档标题不能超过200个字符'),
    
  body('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        const tags = value.split(',').map(tag => tag.trim());
        if (tags.length > 10) {
          throw new Error('标签数量不能超过10个');
        }
        for (const tag of tags) {
          if (tag.length > 50) {
            throw new Error('单个标签长度不能超过50个字符');
          }
        }
      }
      return true;
    })
];

module.exports = {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
  validateDocumentUpload,
  validateUrlDocument
};
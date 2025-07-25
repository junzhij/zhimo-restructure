const { validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

/**
 * 用户注册
 */
const register = async (req, res) => {
  try {
    // 检查验证结果
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入数据验证失败',
        errors: errors.array()
      });
    }

    const { username, email, password, displayName } = req.body;

    // 检查用户名和邮箱是否已存在
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username }
      ]
    });

    if (existingUser) {
      const field = existingUser.email === email.toLowerCase() ? '邮箱' : '用户名';
      return res.status(409).json({
        success: false,
        message: `${field}已被使用`
      });
    }

    // 创建新用户
    const user = new User({
      username,
      email: email.toLowerCase(),
      passwordHash: password, // 会在pre-save中间件中自动加密
      profile: {
        displayName: displayName || username
      }
    });

    await user.save();

    // 生成JWT token
    const token = generateToken(user._id);

    // 更新最后登录时间
    try {
      await user.updateLastLogin();
    } catch (updateError) {
      // Log the error but don't fail the registration
      console.warn('Failed to update last login time:', updateError.message);
    }

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // 处理MongoDB重复键错误
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const fieldName = field === 'email' ? '邮箱' : '用户名';
      return res.status(409).json({
        success: false,
        message: `${fieldName}已被使用`
      });
    }

    res.status(500).json({
      success: false,
      message: '注册过程中发生错误'
    });
  }
};

/**
 * 用户登录
 */
const login = async (req, res) => {
  try {
    // 检查验证结果
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入数据验证失败',
        errors: errors.array()
      });
    }

    const { identifier, password } = req.body;

    // 根据邮箱或用户名查找用户
    const user = await User.findByEmailOrUsername(identifier);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名/邮箱或密码错误'
      });
    }

    // 检查用户是否活跃
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: '用户账户已被禁用'
      });
    }

    // 验证密码
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '用户名/邮箱或密码错误'
      });
    }

    // 生成JWT token
    const token = generateToken(user._id);

    // 更新最后登录时间
    try {
      await user.updateLastLogin();
    } catch (updateError) {
      // Log the error but don't fail the login
      console.warn('Failed to update last login time:', updateError.message);
    }

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: '登录过程中发生错误'
    });
  }
};

/**
 * 用户登出
 * 注意：JWT是无状态的，真正的登出需要在客户端删除token
 * 这里主要用于记录登出行为和清理服务端状态（如果有的话）
 */
const logout = async (req, res) => {
  try {
    // 可以在这里添加token黑名单逻辑（如果需要的话）
    // 或者记录登出日志
    
    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: '登出过程中发生错误'
    });
  }
};

/**
 * 获取当前用户信息
 */
const getCurrentUser = async (req, res) => {
  try {
    // req.user 由认证中间件设置
    res.json({
      success: true,
      data: {
        user: req.user.toJSON()
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
};

/**
 * 更新用户资料
 */
const updateProfile = async (req, res) => {
  try {
    // 检查验证结果
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入数据验证失败',
        errors: errors.array()
      });
    }

    const { displayName, defaultSummaryType, language } = req.body;
    const userId = req.user._id;

    const updateData = {};
    
    if (displayName !== undefined) {
      updateData['profile.displayName'] = displayName;
    }
    
    if (defaultSummaryType !== undefined) {
      updateData['preferences.defaultSummaryType'] = defaultSummaryType;
    }
    
    if (language !== undefined) {
      updateData['preferences.language'] = language;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      message: '资料更新成功',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: '更新资料过程中发生错误'
    });
  }
};

/**
 * 修改密码
 */
const changePassword = async (req, res) => {
  try {
    // 检查验证结果
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入数据验证失败',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // 获取用户（包含密码哈希）
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 验证当前密码
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: '当前密码错误'
      });
    }

    // 更新密码
    user.passwordHash = newPassword; // 会在pre-save中间件中自动加密
    await user.save();

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: '修改密码过程中发生错误'
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword
};
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const { generateToken } = require('../src/middleware/auth');

// Test database setup
const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/zhimo_test';

describe('Authentication System', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_TEST_URI);
    }
  });

  beforeEach(async () => {
    // Clean up database before each test
    await User.deleteMany({});
    
    // Create a test user
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'password123'
    });
    await testUser.save();
    
    // Generate auth token for protected route tests
    authToken = generateToken(testUser._id);
  });

  afterEach(async () => {
    // Clean up after each test
    await User.deleteMany({});
  });

  afterAll(async () => {
    // Close database connection
    await mongoose.connection.close();
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        displayName: 'New User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('注册成功');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    test('should fail with invalid username', async () => {
      const userData = {
        username: 'ab', // Too short
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('输入数据验证失败');
    });

    test('should fail with invalid email', async () => {
      const userData = {
        username: 'testuser2',
        email: 'invalid-email',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('输入数据验证失败');
    });

    test('should fail with weak password', async () => {
      const userData = {
        username: 'testuser2',
        email: 'test2@example.com',
        password: '123' // Too short and no letters
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('输入数据验证失败');
    });

    test('should fail with duplicate username', async () => {
      const userData = {
        username: 'testuser', // Already exists
        email: 'different@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('用户名已被使用');
    });

    test('should fail with duplicate email', async () => {
      const userData = {
        username: 'differentuser',
        email: 'test@example.com', // Already exists
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('邮箱已被使用');
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login with username successfully', async () => {
      const loginData = {
        identifier: 'testuser',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('登录成功');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.username).toBe('testuser');
    });

    test('should login with email successfully', async () => {
      const loginData = {
        identifier: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('登录成功');
      expect(response.body.data.user.email).toBe('test@example.com');
    });

    test('should fail with wrong password', async () => {
      const loginData = {
        identifier: 'testuser',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('用户名/邮箱或密码错误');
    });

    test('should fail with non-existent user', async () => {
      const loginData = {
        identifier: 'nonexistent',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('用户名/邮箱或密码错误');
    });

    test('should fail with inactive user', async () => {
      // Deactivate the test user
      testUser.isActive = false;
      await testUser.save();

      const loginData = {
        identifier: 'testuser',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('用户账户已被禁用');
    });

    test('should fail with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('输入数据验证失败');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('登出成功');
    });

    test('should fail without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('访问令牌缺失');
    });

    test('should fail with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('无效的访问令牌');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should get current user info with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.username).toBe('testuser');
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    test('should fail without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('访问令牌缺失');
    });

    test('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('无效的访问令牌');
    });
  });

  describe('PUT /api/auth/profile', () => {
    test('should update profile successfully', async () => {
      const updateData = {
        displayName: 'Updated Name',
        defaultSummaryType: 'oneline',
        language: 'en-US'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('资料更新成功');
      expect(response.body.data.user.profile.displayName).toBe('Updated Name');
      expect(response.body.data.user.preferences.defaultSummaryType).toBe('oneline');
      expect(response.body.data.user.preferences.language).toBe('en-US');
    });

    test('should fail with invalid summary type', async () => {
      const updateData = {
        defaultSummaryType: 'invalid-type'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('输入数据验证失败');
    });

    test('should fail without token', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .send({ displayName: 'New Name' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('访问令牌缺失');
    });
  });

  describe('PUT /api/auth/password', () => {
    test('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      };

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('密码修改成功');

      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'testuser',
          password: 'newpassword123'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    test('should fail with wrong current password', async () => {
      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      };

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('当前密码错误');
    });

    test('should fail with mismatched passwords', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: 'newpassword123',
        confirmPassword: 'differentpassword123'
      };

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('输入数据验证失败');
    });

    test('should fail with weak new password', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: '123', // Too short and no letters
        confirmPassword: '123'
      };

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('输入数据验证失败');
    });

    test('should fail without token', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      };

      const response = await request(app)
        .put('/api/auth/password')
        .send(passwordData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('访问令牌缺失');
    });
  });

  describe('JWT Token Authentication', () => {
    test('should handle expired token', async () => {
      // Create an expired token (this is a mock test since we can't easily create expired tokens)
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer expired.token.here')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('无效的访问令牌');
    });

    test('should handle malformed token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer malformed-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('无效的访问令牌');
    });

    test('should handle missing Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', authToken) // Missing "Bearer " prefix
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('访问令牌缺失');
    });
  });

  describe('User Model Methods', () => {
    test('should hash password on save', async () => {
      const user = new User({
        username: 'hashtest',
        email: 'hash@example.com',
        passwordHash: 'plainpassword'
      });

      await user.save();
      
      // Password should be hashed, not plain text
      expect(user.passwordHash).not.toBe('plainpassword');
      expect(user.passwordHash.length).toBeGreaterThan(20);
    });

    test('should compare passwords correctly', async () => {
      const user = new User({
        username: 'comparetest',
        email: 'compare@example.com',
        passwordHash: 'testpassword123'
      });

      await user.save();

      const isValid = await user.comparePassword('testpassword123');
      const isInvalid = await user.comparePassword('wrongpassword');

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });

    test('should find user by email or username', async () => {
      const foundByEmail = await User.findByEmailOrUsername('test@example.com');
      const foundByUsername = await User.findByEmailOrUsername('testuser');
      const notFound = await User.findByEmailOrUsername('nonexistent');

      expect(foundByEmail).toBeTruthy();
      expect(foundByEmail.username).toBe('testuser');
      expect(foundByUsername).toBeTruthy();
      expect(foundByUsername.email).toBe('test@example.com');
      expect(notFound).toBeNull();
    });

    test('should update last login time', async () => {
      const originalLoginTime = testUser.lastLoginAt;
      
      await testUser.updateLastLogin();
      
      expect(testUser.lastLoginAt).not.toBe(originalLoginTime);
      expect(testUser.lastLoginAt).toBeInstanceOf(Date);
    });

    test('should not include password in JSON output', async () => {
      const userJson = testUser.toJSON();
      
      expect(userJson).not.toHaveProperty('passwordHash');
      expect(userJson).not.toHaveProperty('__v');
      expect(userJson).toHaveProperty('username');
      expect(userJson).toHaveProperty('email');
    });
  });
});